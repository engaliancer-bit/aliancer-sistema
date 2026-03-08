/*
  # Corrigir Criação de Entregas para Expandir Composições

  ## Problema Identificado

  A função `create_delivery_from_quote` estava criando entregas apenas com produtos
  diretos do orçamento, NÃO incluindo produtos que fazem parte de composições.

  Isso causava problema no controle de estoque:
  - ✅ Ordens de produção eram criadas corretamente (produtos + composições)
  - ❌ Entregas NÃO incluíam produtos de composições
  - ❌ Estoque NÃO era reservado/descontado para produtos de composições

  ## Exemplo do Problema

  **Orçamento com Composição:**
  - 1x "Kit Laje Nervurada 10m²" (composição)
    └── Contém:
        ├── 50x Vigotas Pré-Moldadas
        ├── 25x Blocos de Enchimento
        └── 10m³ Concreto

  **ANTES (comportamento incorreto):**
  - Entrega criada: vazia (nenhum produto)
  - Estoque: NÃO descontado
  - Problema: Sistema permite vender o mesmo estoque múltiplas vezes!

  **DEPOIS (comportamento correto):**
  - Entrega criada com:
    ├── 50x Vigotas Pré-Moldadas (da composição)
    ├── 25x Blocos de Enchimento (da composição)
    └── 10m³ Concreto (da composição)
  - Estoque: descontado imediatamente ao aprovar orçamento
  - ✅ Controle de estoque preciso!

  ## Solução Implementada

  Recriar a função `create_delivery_from_quote` para:

  1. **Processar produtos diretos** do orçamento (comportamento existente)
  2. **EXPANDIR composições** e incluir todos os produtos componentes
  3. Marcar produtos de composições com flags adequadas:
     - `is_from_composition = true`
     - `parent_composition_id` e `parent_composition_name`
  4. Verificar estoque de TODOS os produtos (diretos + composições)
  5. Criar entrega apenas se houver estoque completo

  ## Fluxo Correto

  1. Orçamento aprovado → trigger dispara
  2. Sistema verifica estoque:
     - Produtos diretos
     - Produtos dentro de composições (expandidos)
  3. Se estoque OK:
     - Cria entrega com TODOS os produtos
     - Estoque é reservado imediatamente
     - Status: 'open' (aguardando carregamento)
  4. Se estoque insuficiente:
     - Marca orçamento como "aguardando produção"
     - Ordens de produção são criadas
     - Entrega NÃO é criada ainda
*/

-- =====================================================
-- RECRIAR FUNÇÃO COM EXPANSÃO DE COMPOSIÇÕES
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
  v_quantity_required numeric;
  v_composition_name text;
  v_direct_items integer;
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

  RAISE NOTICE 'Processando orçamento % para cliente %', p_quote_id, v_quote_record.customer_id;

  -- ============================================================
  -- FASE 1: VERIFICAR ESTOQUE DE TODOS OS PRODUTOS
  -- ============================================================

  -- Verificar produtos diretos
  FOR v_item IN
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.item_type = 'product'
      AND qi.product_id IS NOT NULL
  LOOP
    v_product_stock := get_product_available_stock(v_item.product_id);

    RAISE NOTICE '[Produto Direto] Produto: %, Necessário: %, Disponível: %',
      v_item.product_id, v_item.quantity, v_product_stock;

    IF v_product_stock < v_item.quantity THEN
      v_has_stock := false;
      RAISE NOTICE '  └─ ESTOQUE INSUFICIENTE!';
      EXIT;
    END IF;
  END LOOP;

  -- Se ainda tem estoque, verificar produtos de composições
  IF v_has_stock THEN
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

      RAISE NOTICE '[Composição] %', v_composition_name;

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

        RAISE NOTICE '  └─ Produto: %, Necessário: %, Disponível: %',
          v_composition_item.product_name, v_quantity_required, v_product_stock;

        IF v_product_stock < v_quantity_required THEN
          v_has_stock := false;
          RAISE NOTICE '     └─ ESTOQUE INSUFICIENTE!';
          EXIT;
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

    RAISE NOTICE 'Orçamento % marcado como aguardando produção por falta de estoque', p_quote_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE 'Estoque verificado com sucesso. Criando entrega com status open...';

  -- ============================================================
  -- FASE 2: CRIAR ENTREGA
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
    'Entrega automática criada ao aprovar orçamento. Inclui produtos diretos e de composições.'
  )
  RETURNING id INTO v_delivery_id;

  RAISE NOTICE 'Entrega % criada com sucesso (status: open)', v_delivery_id;

  -- ============================================================
  -- FASE 3: ADICIONAR PRODUTOS DIRETOS
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
  RAISE NOTICE 'Inseridos % produtos diretos na entrega', v_direct_items;

  -- ============================================================
  -- FASE 4: EXPANDIR E ADICIONAR PRODUTOS DE COMPOSIÇÕES
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

    RAISE NOTICE 'Expandindo composição: %', v_item.composition_name;

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
      format('Produto da composição "%s" (quantidade por unidade: %s, unidades: %s)',
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
    RAISE NOTICE '  └─ Inseridos % produtos da composição "%s"',
      v_composition_items, v_item.composition_name;
  END LOOP;

  -- ============================================================
  -- FASE 5: VERIFICAÇÃO FINAL
  -- ============================================================

  SELECT COUNT(*) INTO v_total_items
  FROM delivery_items
  WHERE delivery_id = v_delivery_id;

  RAISE NOTICE 'Total de itens na entrega %: %', v_delivery_id, v_total_items;

  IF v_total_items = 0 THEN
    RAISE WARNING 'ATENÇÃO: Nenhum item foi adicionado à entrega %!', v_delivery_id;
  END IF;

  -- Atualizar flag do orçamento
  UPDATE quotes
  SET awaiting_production = false
  WHERE id = p_quote_id;

  RAISE NOTICE 'Entrega % criada com sucesso! Produtos diretos e de composições incluídos.', v_delivery_id;
  RETURN v_delivery_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- =====================================================
-- COMENTÁRIO ATUALIZADO
-- =====================================================

COMMENT ON FUNCTION create_delivery_from_quote(uuid) IS
  'Cria uma entrega automática ao aprovar um orçamento.

   ✨ NOVA FUNCIONALIDADE: Expande composições!

   Fluxo:
   1. Verifica estoque de produtos diretos do orçamento
   2. Verifica estoque de produtos dentro de composições (expandindo)
   3. Se estoque OK:
      - Cria entrega (status=open)
      - Adiciona produtos diretos
      - EXPANDE composições e adiciona todos os produtos componentes
      - Marca produtos de composições adequadamente (is_from_composition=true)
      - Estoque é reservado imediatamente
   4. Se estoque insuficiente:
      - Marca orçamento como "aguardando produção"
      - Não cria entrega (será criada após produção)

   Retorna: ID da entrega criada ou NULL se não houver estoque suficiente';
