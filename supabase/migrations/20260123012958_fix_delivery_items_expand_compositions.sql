/*
  # Corrigir Expansão de Composições em Entregas

  ## Descrição
  Ao criar entregas automaticamente a partir de orçamentos, os itens que são composições
  devem ser expandidos para seus produtos individuais COM A QUANTIDADE MULTIPLICADA.

  ## Exemplo
  Orçamento: 3x Pórtico (composição)
  Pórtico contém:
    - 2x Pilar P1
    - 1x Tirante T1

  Entrega deve ter:
    - 6x Pilar P1 (3 * 2)
    - 3x Tirante T1 (3 * 1)

  ## Mudanças
  1. Adiciona campos para rastrear origem de composição em delivery_items:
     - is_from_composition (boolean)
     - parent_composition_id (uuid)
     - parent_composition_name (text)

  2. Reescreve função create_delivery_from_quote para expandir composições corretamente
*/

-- Adicionar campos para rastrear origem de composição
ALTER TABLE delivery_items
ADD COLUMN IF NOT EXISTS is_from_composition boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_composition_id uuid REFERENCES compositions(id),
ADD COLUMN IF NOT EXISTS parent_composition_name text;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_delivery_items_parent_composition
  ON delivery_items(parent_composition_id)
  WHERE parent_composition_id IS NOT NULL;

-- Reescrever função para expandir composições
CREATE OR REPLACE FUNCTION create_delivery_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_quote_item RECORD;
  v_composition_item RECORD;
  v_composition_name text;
  v_has_stock boolean := true;
  v_product_stock numeric;
  v_required_quantity numeric;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;

  RAISE NOTICE 'Processando orçamento % para cliente %', p_quote_id, v_quote_record.customer_id;

  -- Verificar estoque de todos os produtos (incluindo os dentro de composições)
  FOR v_quote_item IN
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
  LOOP
    -- Se é um produto direto
    IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN
      v_product_stock := get_product_available_stock(v_quote_item.product_id);

      IF v_product_stock < v_quote_item.quantity THEN
        v_has_stock := false;
        RAISE NOTICE 'Produto % não tem estoque suficiente (necessário: %, disponível: %)',
          v_quote_item.product_id, v_quote_item.quantity, v_product_stock;
        EXIT;
      END IF;

    -- Se é uma composição, verificar estoque de cada produto dentro dela
    ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN
      FOR v_composition_item IN
        SELECT ci.product_id, ci.quantity as comp_qty
        FROM composition_items ci
        WHERE ci.composition_id = v_quote_item.composition_id
          AND ci.item_type = 'product'
          AND ci.product_id IS NOT NULL
      LOOP
        v_required_quantity := v_composition_item.comp_qty * v_quote_item.quantity;
        v_product_stock := get_product_available_stock(v_composition_item.product_id);

        IF v_product_stock < v_required_quantity THEN
          v_has_stock := false;
          RAISE NOTICE 'Produto % da composição não tem estoque suficiente (necessário: %, disponível: %)',
            v_composition_item.product_id, v_required_quantity, v_product_stock;
          EXIT;
        END IF;
      END LOOP;

      IF NOT v_has_stock THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  -- Se não houver estoque completo, não criar entrega
  IF NOT v_has_stock THEN
    UPDATE quotes
    SET awaiting_production = true
    WHERE id = p_quote_id;

    RAISE NOTICE 'Orçamento % marcado como aguardando produção por falta de estoque', p_quote_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE 'Estoque verificado com sucesso. Criando entrega com status open...';

  -- Criar a entrega
  INSERT INTO deliveries (
    quote_id,
    customer_id,
    delivery_date,
    status,
    auto_created
  ) VALUES (
    p_quote_id,
    v_quote_record.customer_id,
    CURRENT_DATE + INTERVAL '7 days',
    'open',
    true
  )
  RETURNING id INTO v_delivery_id;

  RAISE NOTICE 'Entrega % criada com sucesso', v_delivery_id;

  -- Criar itens da entrega
  FOR v_quote_item IN
    SELECT qi.*
    FROM quote_items qi
    WHERE qi.quote_id = p_quote_id
  LOOP
    -- Se é um produto direto, adicionar diretamente
    IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN
      INSERT INTO delivery_items (
        delivery_id,
        product_id,
        quote_item_id,
        item_type,
        item_name,
        quantity,
        unit_price,
        is_from_composition
      ) VALUES (
        v_delivery_id,
        v_quote_item.product_id,
        v_quote_item.id,
        'product',
        v_quote_item.item_name,
        v_quote_item.quantity,
        v_quote_item.proposed_price,
        false
      );

      RAISE NOTICE 'Adicionado produto direto: % x %', v_quote_item.item_name, v_quote_item.quantity;

    -- Se é uma composição, expandir para produtos individuais
    ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN
      -- Buscar nome da composição
      SELECT name INTO v_composition_name
      FROM compositions
      WHERE id = v_quote_item.composition_id;

      RAISE NOTICE 'Expandindo composição: % x %', v_composition_name, v_quote_item.quantity;

      -- Para cada produto na composição
      FOR v_composition_item IN
        SELECT
          ci.product_id,
          ci.quantity as comp_qty,
          p.name as product_name,
          p.code as product_code
        FROM composition_items ci
        JOIN products p ON p.id = ci.product_id
        WHERE ci.composition_id = v_quote_item.composition_id
          AND ci.item_type = 'product'
          AND ci.product_id IS NOT NULL
      LOOP
        -- Calcular quantidade multiplicada
        v_required_quantity := v_composition_item.comp_qty * v_quote_item.quantity;

        INSERT INTO delivery_items (
          delivery_id,
          product_id,
          quote_item_id,
          item_type,
          item_name,
          quantity,
          unit_price,
          is_from_composition,
          parent_composition_id,
          parent_composition_name
        ) VALUES (
          v_delivery_id,
          v_composition_item.product_id,
          v_quote_item.id,
          'product',
          v_composition_item.product_name,
          v_required_quantity,
          v_quote_item.proposed_price / NULLIF((
            SELECT SUM(ci2.quantity)
            FROM composition_items ci2
            WHERE ci2.composition_id = v_quote_item.composition_id
              AND ci2.item_type = 'product'
          ), 0),
          true,
          v_quote_item.composition_id,
          v_composition_name
        );

        RAISE NOTICE '  → Produto expandido: % x % (de composição %)',
          v_composition_item.product_name, v_required_quantity, v_composition_name;
      END LOOP;

    -- Para outros tipos de item (material, serviço, etc.)
    ELSE
      INSERT INTO delivery_items (
        delivery_id,
        item_id,
        quote_item_id,
        item_type,
        item_name,
        quantity,
        unit_price,
        is_from_composition
      ) VALUES (
        v_delivery_id,
        v_quote_item.item_id,
        v_quote_item.id,
        v_quote_item.item_type,
        v_quote_item.item_name,
        v_quote_item.quantity,
        v_quote_item.proposed_price,
        false
      );
    END IF;
  END LOOP;

  -- Verificar quantos itens foram inseridos
  DECLARE
    v_items_count integer;
  BEGIN
    SELECT COUNT(*) INTO v_items_count
    FROM delivery_items
    WHERE delivery_id = v_delivery_id;

    RAISE NOTICE 'Total de % itens adicionados à entrega %', v_items_count, v_delivery_id;

    IF v_items_count = 0 THEN
      RAISE WARNING 'Nenhum item foi adicionado à entrega %!', v_delivery_id;
    END IF;
  END;

  -- Atualizar flag do orçamento
  UPDATE quotes
  SET awaiting_production = false
  WHERE id = p_quote_id;

  RAISE NOTICE 'Entrega % criada com sucesso para orçamento %', v_delivery_id, p_quote_id;
  RETURN v_delivery_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar entrega para orçamento %: %', p_quote_id, SQLERRM;
    RETURN NULL;
END;
$$;