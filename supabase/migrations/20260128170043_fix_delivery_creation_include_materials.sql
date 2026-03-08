/*
  # Corrigir Criação de Entregas para Incluir Insumos

  ## Problema Identificado

  A função `create_delivery_from_quote` estava apenas processando itens do tipo 'product',
  ignorando completamente os insumos (item_type = 'material') dos orçamentos.

  **Exemplo do problema:**
  - Orçamento contém:
    ✅ PAver retangular 10x20x06 (produto)
    ❌ Areia industrial 1,5t (insumo) - NÃO aparece na entrega!

  ## Causa Raiz

  A função tinha 3 verificações que filtravam apenas produtos:
  1. Verificação de estoque: `qi.item_type = 'product'`
  2. Criação de itens diretos: `qi.item_type = 'product'`
  3. Expansão de composições: processa apenas produtos dentro de composições

  ## Solução Implementada

  Atualizar a função para:
  1. ✅ Verificar estoque de produtos E insumos
  2. ✅ Criar itens de entrega para produtos E insumos
  3. ✅ Manter a expansão de composições (produtos dentro de composições)
  4. ✅ Usar os campos corretos: `material_id` e `item_type = 'material'`

  ## Fluxo Corrigido

  **ANTES:**
  ```
  Orçamento → Verifica apenas produtos → Cria entrega apenas com produtos
  ```

  **DEPOIS:**
  ```
  Orçamento → Verifica produtos + insumos → Cria entrega com produtos + insumos + composições
  ```
*/

-- =====================================================
-- FUNÇÃO PARA CALCULAR ESTOQUE DE INSUMOS
-- =====================================================

CREATE OR REPLACE FUNCTION get_material_available_stock(p_material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_available numeric;
BEGIN
  -- Para insumos, verificar o estoque na tabela material_inventory
  SELECT COALESCE(current_stock, 0)
  INTO v_available
  FROM material_inventory
  WHERE material_id = p_material_id;

  -- Se não encontrar registro, retornar 0
  IF NOT FOUND THEN
    v_available := 0;
  END IF;

  RETURN GREATEST(v_available, 0);
END;
$$;

COMMENT ON FUNCTION get_material_available_stock(uuid) IS
  'Calcula estoque disponível de um insumo (material).
   Consulta a tabela material_inventory.';

-- =====================================================
-- RECRIAR FUNÇÃO COM SUPORTE A INSUMOS
-- =====================================================

CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_item RECORD;
  v_composition_item RECORD;
  v_has_stock boolean := true;
  v_product_stock numeric;
  v_material_stock numeric;
  v_quantity_required numeric;
  v_composition_name text;
  v_direct_items integer;
  v_material_items integer;
  v_composition_items integer;
  v_total_items integer;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Processando orçamento % para cliente %', p_quote_id, v_quote_record.customer_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- ============================================================
  -- FASE 1: VERIFICAR ESTOQUE DE PRODUTOS
  -- ============================================================

  RAISE NOTICE '→ FASE 1: Verificando estoque de PRODUTOS diretos...';

  FOR v_item IN
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.item_type = 'product'
      AND qi.product_id IS NOT NULL
  LOOP
    v_product_stock := get_product_available_stock(v_item.product_id);

    RAISE NOTICE '  [Produto] ID: %, Necessário: %, Disponível: %',
      v_item.product_id, v_item.quantity, v_product_stock;

    IF v_product_stock < v_item.quantity THEN
      v_has_stock := false;
      RAISE NOTICE '  └─ ❌ ESTOQUE INSUFICIENTE!';
      EXIT;
    ELSE
      RAISE NOTICE '  └─ ✅ Estoque OK';
    END IF;
  END LOOP;

  -- ============================================================
  -- FASE 2: VERIFICAR ESTOQUE DE INSUMOS (MATERIALS)
  -- ============================================================

  IF v_has_stock THEN
    RAISE NOTICE '→ FASE 2: Verificando estoque de INSUMOS...';

    FOR v_item IN
      SELECT qi.*
      FROM quote_items qi
      WHERE qi.quote_id = p_quote_id
        AND qi.item_type = 'material'
        AND qi.material_id IS NOT NULL
    LOOP
      v_material_stock := get_material_available_stock(v_item.material_id);

      RAISE NOTICE '  [Insumo] ID: %, Necessário: %, Disponível: %',
        v_item.material_id, v_item.quantity, v_material_stock;

      IF v_material_stock < v_item.quantity THEN
        v_has_stock := false;
        RAISE NOTICE '  └─ ❌ ESTOQUE INSUFICIENTE!';
        EXIT;
      ELSE
        RAISE NOTICE '  └─ ✅ Estoque OK';
      END IF;
    END LOOP;
  END IF;

  -- ============================================================
  -- FASE 3: VERIFICAR PRODUTOS DE COMPOSIÇÕES
  -- ============================================================

  IF v_has_stock THEN
    RAISE NOTICE '→ FASE 3: Verificando produtos em COMPOSIÇÕES...';

    FOR v_item IN
      SELECT qi.*
      FROM quote_items qi
      WHERE qi.quote_id = p_quote_id
        AND qi.item_type = 'composition'
        AND qi.composition_id IS NOT NULL
    LOOP

      SELECT c.name INTO v_composition_name
      FROM compositions c
      WHERE c.id = v_item.composition_id;

      RAISE NOTICE '  [Composição] %', v_composition_name;

      -- Verificar cada produto da composição
      FOR v_composition_item IN
        SELECT
          ci.product_id,
          ci.quantity as quantity_per_unit,
          p.name as product_name
        FROM composition_items ci
        LEFT JOIN products p ON p.id = ci.product_id
        WHERE ci.composition_id = v_item.composition_id
          AND ci.item_type = 'product'
          AND ci.product_id IS NOT NULL
      LOOP
        v_quantity_required := v_item.quantity * v_composition_item.quantity_per_unit;
        v_product_stock := get_product_available_stock(v_composition_item.product_id);

        RAISE NOTICE '    └─ Produto: %, Necessário: %, Disponível: %',
          v_composition_item.product_name, v_quantity_required, v_product_stock;

        IF v_product_stock < v_quantity_required THEN
          v_has_stock := false;
          RAISE NOTICE '       └─ ❌ ESTOQUE INSUFICIENTE!';
          EXIT;
        ELSE
          RAISE NOTICE '       └─ ✅ Estoque OK';
        END IF;
      END LOOP;

      EXIT WHEN NOT v_has_stock;
    END LOOP;
  END IF;

  -- Se não houver estoque completo, marcar como aguardando produção
  IF NOT v_has_stock THEN
    UPDATE quotes
    SET awaiting_production = true
    WHERE id = p_quote_id;

    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '⚠️  Orçamento % marcado como AGUARDANDO PRODUÇÃO', p_quote_id;
    RAISE NOTICE '    Motivo: Estoque insuficiente';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RETURN NULL;
  END IF;

  RAISE NOTICE '✅ Estoque verificado com sucesso! Criando entrega...';

  -- ============================================================
  -- FASE 4: CRIAR ENTREGA
  -- ============================================================

  INSERT INTO deliveries (
    quote_id,
    customer_id,
    delivery_date,
    status,
    auto_created,
    notes
  ) VALUES (
    p_quote_id,
    v_quote_record.customer_id,
    CURRENT_DATE + INTERVAL '7 days',
    'open',
    true,
    'Entrega automática: produtos, insumos e composições.'
  )
  RETURNING id INTO v_delivery_id;

  RAISE NOTICE '→ Entrega % criada (status: open)', v_delivery_id;

  -- ============================================================
  -- FASE 5: ADICIONAR PRODUTOS DIRETOS
  -- ============================================================

  INSERT INTO delivery_items (
    delivery_id,
    product_id,
    quote_item_id,
    item_type,
    quantity,
    loaded_quantity,
    unit_price,
    is_additional,
    is_from_composition,
    notes
  )
  SELECT
    v_delivery_id,
    qi.product_id,
    qi.id,
    'product',
    qi.quantity,
    0,
    qi.proposed_price,
    false,
    false,
    'Produto direto do orçamento'
  FROM quote_items qi
  WHERE qi.quote_id = p_quote_id
    AND qi.item_type = 'product'
    AND qi.product_id IS NOT NULL;

  GET DIAGNOSTICS v_direct_items = ROW_COUNT;
  RAISE NOTICE '→ Inseridos % produtos diretos', v_direct_items;

  -- ============================================================
  -- FASE 6: ADICIONAR INSUMOS (MATERIALS)
  -- ============================================================

  INSERT INTO delivery_items (
    delivery_id,
    material_id,
    quote_item_id,
    item_type,
    quantity,
    loaded_quantity,
    unit_price,
    is_additional,
    is_from_composition,
    notes
  )
  SELECT
    v_delivery_id,
    qi.material_id,
    qi.id,
    'material',
    qi.quantity,
    0,
    qi.proposed_price,
    false,
    false,
    'Insumo direto do orçamento'
  FROM quote_items qi
  WHERE qi.quote_id = p_quote_id
    AND qi.item_type = 'material'
    AND qi.material_id IS NOT NULL;

  GET DIAGNOSTICS v_material_items = ROW_COUNT;
  RAISE NOTICE '→ Inseridos % insumos', v_material_items;

  -- ============================================================
  -- FASE 7: EXPANDIR E ADICIONAR PRODUTOS DE COMPOSIÇÕES
  -- ============================================================

  FOR v_item IN
    SELECT
      qi.id as quote_item_id,
      qi.composition_id,
      qi.quantity as composition_quantity,
      c.name as composition_name
    FROM quote_items qi
    LEFT JOIN compositions c ON c.id = qi.composition_id
    WHERE qi.quote_id = p_quote_id
      AND qi.item_type = 'composition'
      AND qi.composition_id IS NOT NULL
  LOOP

    RAISE NOTICE '→ Expandindo composição: %', v_item.composition_name;

    -- Inserir cada produto da composição
    INSERT INTO delivery_items (
      delivery_id,
      product_id,
      quote_item_id,
      item_type,
      quantity,
      loaded_quantity,
      unit_price,
      is_additional,
      is_from_composition,
      parent_composition_id,
      parent_composition_name,
      notes
    )
    SELECT
      v_delivery_id,
      ci.product_id,
      v_item.quote_item_id,
      'product',
      ci.quantity * v_item.composition_quantity,
      0,
      COALESCE(p.resale_price, p.unit_price_brl, 0),
      false,
      true,
      v_item.composition_id,
      v_item.composition_name,
      format('Produto da composição "%s" (%s un × %s)',
        v_item.composition_name,
        ci.quantity,
        v_item.composition_quantity
      )
    FROM composition_items ci
    LEFT JOIN products p ON p.id = ci.product_id
    WHERE ci.composition_id = v_item.composition_id
      AND ci.item_type = 'product'
      AND ci.product_id IS NOT NULL;

    GET DIAGNOSTICS v_composition_items = ROW_COUNT;
    RAISE NOTICE '  └─ Inseridos % produtos da composição', v_composition_items;
  END LOOP;

  -- ============================================================
  -- FASE 8: VERIFICAÇÃO FINAL
  -- ============================================================

  SELECT COUNT(*) INTO v_total_items
  FROM delivery_items
  WHERE delivery_id = v_delivery_id;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ ENTREGA CRIADA COM SUCESSO!';
  RAISE NOTICE '   ID: %', v_delivery_id;
  RAISE NOTICE '   Total de itens: %', v_total_items;
  RAISE NOTICE '   - Produtos diretos: %', v_direct_items;
  RAISE NOTICE '   - Insumos: %', v_material_items;
  RAISE NOTICE '   - Produtos de composições: %', COALESCE(v_composition_items, 0);
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  IF v_total_items = 0 THEN
    RAISE WARNING '⚠️  ATENÇÃO: Nenhum item foi adicionado à entrega %!', v_delivery_id;
  END IF;

  -- Atualizar flag do orçamento
  UPDATE quotes
  SET awaiting_production = false
  WHERE id = p_quote_id;

  RETURN v_delivery_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- =====================================================
-- COMENTÁRIO ATUALIZADO
-- =====================================================

COMMENT ON FUNCTION create_delivery_from_quote(uuid) IS
  'Cria uma entrega automática ao aprovar um orçamento.

   ✨ FUNCIONALIDADES:

   1. ✅ Verifica estoque de PRODUTOS diretos
   2. ✅ Verifica estoque de INSUMOS (materials)
   3. ✅ Verifica estoque de produtos em COMPOSIÇÕES (expandindo)

   4. Se estoque completo:
      - Cria entrega (status=open)
      - Adiciona PRODUTOS diretos
      - Adiciona INSUMOS diretos
      - Expande COMPOSIÇÕES e adiciona produtos componentes
      - Estoque é reservado imediatamente

   5. Se estoque insuficiente:
      - Marca orçamento como "aguardando produção"
      - Não cria entrega (será criada após produção)

   Retorna: ID da entrega ou NULL se estoque insuficiente';
