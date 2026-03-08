/*
  # Criar Entregas com Avisos de Estoque

  1. Nova Função
    - `create_delivery_with_stock_warnings`: Cria entrega mesmo sem estoque
    - Adiciona observações detalhadas sobre itens sem estoque
    - Permite gerenciar pedidos pendentes de produção

  2. Funcionalidade
    - Cria entrega independente do estoque disponível
    - Registra warnings para cada item sem estoque suficiente
    - Adiciona observações nos itens de entrega
*/

-- Função para criar entrega com avisos de estoque insuficiente
CREATE OR REPLACE FUNCTION create_delivery_with_stock_warnings(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_record RECORD;
  v_delivery_id uuid;
  v_item RECORD;
  v_composition_item RECORD;
  v_product_stock numeric;
  v_material_stock numeric;
  v_quantity_required numeric;
  v_composition_name text;
  v_total_items integer;
  v_warning_notes text;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO v_quote_record
  FROM quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_quote_id;
  END IF;

  -- Verificar se já existe entrega
  IF EXISTS (SELECT 1 FROM deliveries WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'Já existe uma entrega para este orçamento';
  END IF;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Criando entrega COM AVISOS DE ESTOQUE para orçamento %', p_quote_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Criar entrega
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
    '⚠️ ATENÇÃO: Esta entrega contém itens com estoque insuficiente. Verifique as observações de cada item.'
  )
  RETURNING id INTO v_delivery_id;

  RAISE NOTICE '→ Entrega % criada', v_delivery_id;

  -- Adicionar produtos diretos
  FOR v_item IN
    SELECT qi.*, p.name as product_name
    FROM quote_items qi
    LEFT JOIN products p ON p.id = qi.product_id
    WHERE qi.quote_id = p_quote_id
    AND qi.item_type = 'product'
    AND qi.product_id IS NOT NULL
  LOOP
    v_product_stock := get_product_available_stock(v_item.product_id);
    
    IF v_product_stock < v_item.quantity THEN
      v_warning_notes := format('⚠️ ESTOQUE INSUFICIENTE: Necessário %s, Disponível %s (Faltam %s)',
        v_item.quantity, v_product_stock, v_item.quantity - v_product_stock);
    ELSE
      v_warning_notes := '✅ Estoque disponível';
    END IF;

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
    ) VALUES (
      v_delivery_id,
      v_item.product_id,
      v_item.id,
      'product',
      v_item.quantity,
      0,
      v_item.proposed_price,
      false,
      false,
      v_warning_notes
    );
  END LOOP;

  -- Adicionar insumos (materials)
  FOR v_item IN
    SELECT qi.*, m.name as material_name, m.unit
    FROM quote_items qi
    LEFT JOIN materials m ON m.id = qi.material_id
    WHERE qi.quote_id = p_quote_id
    AND qi.item_type = 'material'
    AND qi.material_id IS NOT NULL
  LOOP
    v_material_stock := get_material_available_stock(v_item.material_id);
    
    IF v_material_stock < v_item.quantity THEN
      v_warning_notes := format('⚠️ ESTOQUE INSUFICIENTE: Necessário %s %s, Disponível %s %s (Faltam %s %s)',
        v_item.quantity, v_item.unit, v_material_stock, v_item.unit, 
        v_item.quantity - v_material_stock, v_item.unit);
    ELSE
      v_warning_notes := '✅ Estoque disponível';
    END IF;

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
    ) VALUES (
      v_delivery_id,
      v_item.material_id,
      v_item.id,
      'material',
      v_item.quantity,
      0,
      v_item.proposed_price,
      false,
      false,
      v_warning_notes
    );
  END LOOP;

  -- Expandir e adicionar produtos de composições
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
    -- Inserir cada produto da composição
    FOR v_composition_item IN
      SELECT
        ci.product_id,
        ci.quantity as quantity_per_unit,
        p.name as product_name,
        COALESCE(p.resale_price, p.unit_price_brl, 0) as unit_price
      FROM composition_items ci
      LEFT JOIN products p ON p.id = ci.product_id
      WHERE ci.composition_id = v_item.composition_id
      AND ci.item_type = 'product'
      AND ci.product_id IS NOT NULL
    LOOP
      v_quantity_required := v_item.composition_quantity * v_composition_item.quantity_per_unit;
      v_product_stock := get_product_available_stock(v_composition_item.product_id);
      
      IF v_product_stock < v_quantity_required THEN
        v_warning_notes := format('⚠️ ESTOQUE INSUFICIENTE: Necessário %s, Disponível %s (Faltam %s) - Composição "%s"',
          v_quantity_required, v_product_stock, v_quantity_required - v_product_stock, v_item.composition_name);
      ELSE
        v_warning_notes := format('✅ Estoque disponível - Composição "%s"', v_item.composition_name);
      END IF;

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
      ) VALUES (
        v_delivery_id,
        v_composition_item.product_id,
        v_item.quote_item_id,
        'product',
        v_quantity_required,
        0,
        v_composition_item.unit_price,
        false,
        true,
        v_item.composition_id,
        v_item.composition_name,
        v_warning_notes
      );
    END LOOP;
  END LOOP;

  -- Verificação final
  SELECT COUNT(*) INTO v_total_items
  FROM delivery_items
  WHERE delivery_id = v_delivery_id;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ ENTREGA CRIADA (com avisos de estoque)';
  RAISE NOTICE '   ID: %', v_delivery_id;
  RAISE NOTICE '   Total de itens: %', v_total_items;
  RAISE NOTICE '   ⚠️  Verifique as observações de cada item!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Atualizar flag do orçamento
  UPDATE quotes
  SET awaiting_production = false
  WHERE id = p_quote_id;

  RETURN v_delivery_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ Erro ao criar entrega com avisos: %', SQLERRM;
    RETURN NULL;
END;
$$;
