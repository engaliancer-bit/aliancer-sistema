/*
  # Prevenir Duplicação de Vinculação Orçamento-Obra

  1. Alterações
    - Atualiza função `process_quote_approval_for_construction()` para verificar se o orçamento já foi processado
    - Evita criação de itens duplicados em `construction_quote_items`
    - Retorna mensagem informativa quando detecta duplicação

  2. Segurança
    - Mantém integridade referencial
    - Não afeta dados existentes
    - Apenas adiciona verificação preventiva
*/

-- Recriar função com verificação de duplicação
CREATE OR REPLACE FUNCTION process_quote_approval_for_construction(
  quote_id_param uuid,
  quote_type_param text,
  construction_project_id_param uuid
)
RETURNS jsonb AS $$
DECLARE
  v_quote_item RECORD;
  v_stock_info RECORD;
  v_production_order_id uuid;
  v_delivery_id uuid;
  v_order_number text;
  v_delivery_number text;
  v_next_number int;
  v_result jsonb;
  v_items_created int := 0;
  v_orders_created int := 0;
  v_deliveries_created int := 0;
  v_total_items int := 0;
  v_construction_item_id uuid;
  v_has_items boolean;
  v_project_record RECORD;
  v_items_for_delivery jsonb := '[]'::jsonb;
  v_item_record RECORD;
BEGIN
  RAISE NOTICE 'Iniciando processamento do orcamento para obra';

  -- Buscar informações da obra
  SELECT * INTO v_project_record
  FROM construction_projects
  WHERE id = construction_project_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  -- Verificar se o orçamento já foi processado para esta obra (prevenir duplicação)
  SELECT COUNT(*) INTO v_items_created
  FROM construction_quote_items
  WHERE construction_project_id = construction_project_id_param
    AND quote_id = quote_id_param
    AND quote_type = quote_type_param;

  IF v_items_created > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Este orçamento já foi processado para esta obra. Os itens não serão duplicados.',
      'existing_items', v_items_created,
      'compositions_processed', 0,
      'items_created', 0,
      'production_orders_created', 0,
      'deliveries_created', 0
    );
  END IF;

  -- Resetar contador
  v_items_created := 0;

  -- Processar itens do orçamento baseado no tipo
  IF quote_type_param = 'quote' THEN
    FOR v_quote_item IN
      SELECT qi.id, qi.composition_id, qi.quantity
      FROM quote_items qi
      WHERE qi.quote_id = quote_id_param
      AND qi.composition_id IS NOT NULL
    LOOP
      v_total_items := v_total_items + 1;

      SELECT EXISTS(
        SELECT 1 FROM composition_items
        WHERE composition_id = v_quote_item.composition_id
        AND (
          (item_type = 'product' AND product_id IS NOT NULL) OR
          (item_type = 'material' AND material_id IS NOT NULL)
        )
      ) INTO v_has_items;

      IF NOT v_has_items THEN
        CONTINUE;
      END IF;

      FOR v_stock_info IN
        SELECT * FROM check_composition_full_stock(
          v_quote_item.composition_id,
          v_quote_item.quantity
        )
      LOOP
        INSERT INTO construction_quote_items (
          construction_project_id,
          quote_id,
          quote_type,
          quote_item_id,
          composition_id,
          product_id,
          material_id,
          item_type,
          quantity_required,
          quantity_in_stock,
          quantity_to_produce,
          unit,
          status,
          notes
        ) VALUES (
          construction_project_id_param,
          quote_id_param,
          quote_type_param,
          v_quote_item.id,
          v_quote_item.composition_id,
          CASE WHEN v_stock_info.item_type = 'product' THEN v_stock_info.item_reference_id ELSE NULL END,
          CASE WHEN v_stock_info.item_type = 'material' THEN v_stock_info.item_reference_id ELSE NULL END,
          v_stock_info.item_type,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce,
          v_stock_info.unit,
          CASE
            WHEN v_stock_info.has_sufficient_stock THEN 'available_for_delivery'
            WHEN v_stock_info.quantity_in_stock > 0 THEN 'partially_available'
            ELSE 'in_production'
          END,
          format('Item: %s | Necessario: %s | Estoque: %s',
            v_stock_info.item_name,
            v_stock_info.quantity_required,
            v_stock_info.quantity_in_stock)
        ) RETURNING id INTO v_construction_item_id;

        v_items_created := v_items_created + 1;

        IF v_stock_info.quantity_in_stock > 0 THEN
          v_items_for_delivery := v_items_for_delivery || jsonb_build_object(
            'construction_item_id', v_construction_item_id,
            'item_type', v_stock_info.item_type,
            'item_id', v_stock_info.item_reference_id,
            'item_name', v_stock_info.item_name,
            'quantity', v_stock_info.quantity_in_stock,
            'unit', v_stock_info.unit
          );
        END IF;

        IF v_stock_info.item_type = 'product' AND v_stock_info.quantity_to_produce > 0 THEN
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';

          v_order_number := 'OP-' || v_next_number;

          INSERT INTO production_orders (
            order_number,
            product_id,
            quantity,
            priority,
            status,
            notes
          ) VALUES (
            v_order_number,
            v_stock_info.item_reference_id,
            v_stock_info.quantity_to_produce,
            'high',
            'open',
            format('Ordem para obra: %s | Produto: %s', v_project_record.name, v_stock_info.item_name)
          ) RETURNING id INTO v_production_order_id;

          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;

          v_orders_created := v_orders_created + 1;
        END IF;
      END LOOP;
    END LOOP;

  ELSIF quote_type_param = 'ribbed_slab' THEN
    FOR v_quote_item IN
      SELECT rf.id, rf.composition_id, rf.quantity
      FROM ribbed_slab_floors rf
      WHERE rf.quote_id = quote_id_param
      AND rf.composition_id IS NOT NULL
    LOOP
      v_total_items := v_total_items + 1;

      SELECT EXISTS(
        SELECT 1 FROM composition_items
        WHERE composition_id = v_quote_item.composition_id
        AND (
          (item_type = 'product' AND product_id IS NOT NULL) OR
          (item_type = 'material' AND material_id IS NOT NULL)
        )
      ) INTO v_has_items;

      IF NOT v_has_items THEN
        CONTINUE;
      END IF;

      FOR v_stock_info IN
        SELECT * FROM check_composition_full_stock(
          v_quote_item.composition_id,
          v_quote_item.quantity
        )
      LOOP
        INSERT INTO construction_quote_items (
          construction_project_id,
          quote_id,
          quote_type,
          quote_item_id,
          composition_id,
          product_id,
          material_id,
          item_type,
          quantity_required,
          quantity_in_stock,
          quantity_to_produce,
          unit,
          status,
          notes
        ) VALUES (
          construction_project_id_param,
          quote_id_param,
          quote_type_param,
          v_quote_item.id,
          v_quote_item.composition_id,
          CASE WHEN v_stock_info.item_type = 'product' THEN v_stock_info.item_reference_id ELSE NULL END,
          CASE WHEN v_stock_info.item_type = 'material' THEN v_stock_info.item_reference_id ELSE NULL END,
          v_stock_info.item_type,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce,
          v_stock_info.unit,
          CASE
            WHEN v_stock_info.has_sufficient_stock THEN 'available_for_delivery'
            WHEN v_stock_info.quantity_in_stock > 0 THEN 'partially_available'
            ELSE 'in_production'
          END,
          format('Item: %s | Necessario: %s | Estoque: %s',
            v_stock_info.item_name,
            v_stock_info.quantity_required,
            v_stock_info.quantity_in_stock)
        ) RETURNING id INTO v_construction_item_id;

        v_items_created := v_items_created + 1;

        IF v_stock_info.quantity_in_stock > 0 THEN
          v_items_for_delivery := v_items_for_delivery || jsonb_build_object(
            'construction_item_id', v_construction_item_id,
            'item_type', v_stock_info.item_type,
            'item_id', v_stock_info.item_reference_id,
            'item_name', v_stock_info.item_name,
            'quantity', v_stock_info.quantity_in_stock,
            'unit', v_stock_info.unit
          );
        END IF;

        IF v_stock_info.item_type = 'product' AND v_stock_info.quantity_to_produce > 0 THEN
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';

          v_order_number := 'OP-' || v_next_number;

          INSERT INTO production_orders (
            order_number,
            product_id,
            quantity,
            priority,
            status,
            notes
          ) VALUES (
            v_order_number,
            v_stock_info.item_reference_id,
            v_stock_info.quantity_to_produce,
            'high',
            'open',
            format('Ordem para obra: %s | Produto: %s', v_project_record.name, v_stock_info.item_name)
          ) RETURNING id INTO v_production_order_id;

          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;

          v_orders_created := v_orders_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_items_for_delivery) > 0 THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(delivery_number FROM '[0-9]+') AS INTEGER)), 0
    ) + 1
    INTO v_next_number
    FROM deliveries
    WHERE delivery_number ~ '^E-[0-9]+$';

    v_delivery_number := 'E-' || v_next_number;

    INSERT INTO deliveries (
      delivery_number,
      customer_id,
      status,
      notes,
      auto_created
    ) VALUES (
      v_delivery_number,
      v_project_record.customer_id,
      'open',
      format('Entrega para obra: %s', v_project_record.name),
      true
    ) RETURNING id INTO v_delivery_id;

    FOR v_item_record IN
      SELECT * FROM jsonb_to_recordset(v_items_for_delivery)
      AS x(
        construction_item_id uuid,
        item_type text,
        item_id uuid,
        item_name text,
        quantity decimal,
        unit text
      )
    LOOP
      INSERT INTO delivery_items (
        delivery_id,
        product_id,
        material_id,
        item_type,
        quantity,
        loaded_quantity,
        unit
      ) VALUES (
        v_delivery_id,
        CASE WHEN v_item_record.item_type = 'product' THEN v_item_record.item_id ELSE NULL END,
        CASE WHEN v_item_record.item_type = 'material' THEN v_item_record.item_id ELSE NULL END,
        v_item_record.item_type,
        v_item_record.quantity,
        0,
        v_item_record.unit
      );

      UPDATE construction_quote_items
      SET delivery_id = v_delivery_id
      WHERE id = v_item_record.construction_item_id;
    END LOOP;

    v_deliveries_created := v_deliveries_created + 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Processamento concluído com sucesso',
    'compositions_processed', v_total_items,
    'items_created', v_items_created,
    'production_orders_created', v_orders_created,
    'deliveries_created', v_deliveries_created
  );
END;
$$ LANGUAGE plpgsql;