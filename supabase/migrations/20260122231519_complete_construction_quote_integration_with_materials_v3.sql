/*
  # Integração Completa: Orçamento-Obra com Materiais e Produtos
  
  1. Novas Funcionalidades
    - Verificação de estoque de MATERIAIS (insumos)
    - Verificação de estoque de PRODUTOS
    - Criação automática de ENTREGAS para items com estoque
    - Criação automática de ORDENS DE PRODUÇÃO para produtos sem estoque
    - Sistema de atualização de status quando produção é finalizada
  
  2. Fluxo Completo
    - Item com estoque → Cria entrega automaticamente
    - Item sem estoque (produto) → Cria ordem de produção
    - Quando ordem finaliza → Atualiza status para "disponível para entrega"
    - Quando item é entregue → Atualiza status para "entregue"
  
  3. Segurança
    - RLS policies mantidas
    - Validações de dados
    - Logs detalhados
*/

-- Função para obter estoque de material
CREATE OR REPLACE FUNCTION get_material_stock(material_id_param uuid)
RETURNS decimal AS $$
DECLARE
  v_stock decimal;
BEGIN
  SELECT COALESCE(stock_quantity, 0)
  INTO v_stock
  FROM materials
  WHERE id = material_id_param;
  
  RETURN COALESCE(v_stock, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para verificar estoque completo de uma composição (materiais + produtos)
CREATE OR REPLACE FUNCTION check_composition_full_stock(
  composition_id_param uuid, 
  quantity_multiplier decimal
)
RETURNS TABLE(
  item_id uuid,
  item_type text,
  item_reference_id uuid,
  item_name text,
  quantity_required decimal,
  quantity_in_stock decimal,
  quantity_to_produce decimal,
  has_sufficient_stock boolean,
  unit text
) AS $$
BEGIN
  RETURN QUERY
  -- Produtos
  SELECT 
    ci.id as item_id,
    'product'::text as item_type,
    ci.product_id as item_reference_id,
    p.name as item_name,
    (ci.quantity * quantity_multiplier) as quantity_required,
    get_product_stock(ci.product_id) as quantity_in_stock,
    GREATEST(
      (ci.quantity * quantity_multiplier) - get_product_stock(ci.product_id),
      0
    ) as quantity_to_produce,
    get_product_stock(ci.product_id) >= (ci.quantity * quantity_multiplier) as has_sufficient_stock,
    ci.unit
  FROM composition_items ci
  JOIN products p ON p.id = ci.product_id
  WHERE ci.composition_id = composition_id_param
  AND ci.item_type = 'product'
  AND ci.product_id IS NOT NULL
  
  UNION ALL
  
  -- Materiais
  SELECT 
    ci.id as item_id,
    'material'::text as item_type,
    ci.material_id as item_reference_id,
    m.name as item_name,
    (ci.quantity * quantity_multiplier) as quantity_required,
    get_material_stock(ci.material_id) as quantity_in_stock,
    GREATEST(
      (ci.quantity * quantity_multiplier) - get_material_stock(ci.material_id),
      0
    ) as quantity_to_produce,
    get_material_stock(ci.material_id) >= (ci.quantity * quantity_multiplier) as has_sufficient_stock,
    ci.unit
  FROM composition_items ci
  JOIN materials m ON m.id = ci.material_id
  WHERE ci.composition_id = composition_id_param
  AND ci.item_type = 'material'
  AND ci.material_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Adicionar campos para rastrear materiais em construction_quote_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'construction_quote_items' 
    AND column_name = 'material_id'
  ) THEN
    ALTER TABLE construction_quote_items 
    ADD COLUMN material_id uuid REFERENCES materials(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'construction_quote_items' 
    AND column_name = 'item_type'
  ) THEN
    ALTER TABLE construction_quote_items 
    ADD COLUMN item_type text CHECK (item_type IN ('product', 'material'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'construction_quote_items' 
    AND column_name = 'unit'
  ) THEN
    ALTER TABLE construction_quote_items 
    ADD COLUMN unit text;
  END IF;
END $$;

-- Função principal: Processar orçamento e criar ordens/entregas
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
      SELECT 
        rsr.id, 
        rsr.composition_id,
        rsr.area,
        CEIL(rsr.area / NULLIF(c.coverage_area_m2, 0)) as quantity
      FROM ribbed_slab_rooms rsr
      JOIN ribbed_slab_floors rsf ON rsf.id = rsr.floor_id
      LEFT JOIN compositions c ON c.id = rsr.composition_id
      WHERE rsf.quote_id = quote_id_param
      AND rsr.composition_id IS NOT NULL
      AND COALESCE(c.coverage_area_m2, 0) > 0
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
          format('Laje - Item: %s | Necessario: %s', v_stock_info.item_name, v_stock_info.quantity_required)
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
            format('Laje trelicada - Obra: %s', v_project_record.name)
          ) RETURNING id INTO v_production_order_id;
          
          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;
          
          v_orders_created := v_orders_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  -- Criar entrega automática se houver items com estoque
  IF jsonb_array_length(v_items_for_delivery) > 0 THEN
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(delivery_number FROM '[0-9]+') AS INTEGER)), 0
    ) + 1
    INTO v_next_number
    FROM deliveries
    WHERE delivery_number ~ '^ENT-[0-9]+$';
    
    v_delivery_number := 'ENT-' || v_next_number;
    
    INSERT INTO deliveries (
      delivery_number,
      customer_id,
      delivery_date,
      status,
      notes,
      construction_project_id
    ) VALUES (
      v_delivery_number,
      v_project_record.customer_id,
      CURRENT_DATE,
      'open',
      format('Entrega automatica - Obra: %s', v_project_record.name),
      construction_project_id_param
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
        quantity,
        unit_price,
        notes
      ) VALUES (
        v_delivery_id,
        CASE WHEN v_item_record.item_type = 'product' THEN v_item_record.item_id ELSE NULL END,
        CASE WHEN v_item_record.item_type = 'material' THEN v_item_record.item_id ELSE NULL END,
        v_item_record.quantity,
        0,
        format('Item com estoque: %s', v_item_record.item_name)
      );
      
      UPDATE construction_quote_items
      SET delivery_id = v_delivery_id
      WHERE id = v_item_record.construction_item_id;
    END LOOP;
    
    v_deliveries_created := 1;
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'total_composition_items', v_total_items,
    'construction_items_created', v_items_created,
    'production_orders_created', v_orders_created,
    'deliveries_created', v_deliveries_created,
    'message', format(
      '%s composicoes | %s items | %s ordens de producao | %s entregas',
      v_total_items, v_items_created, v_orders_created, v_deliveries_created
    )
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar status quando ordem de produção for finalizada
CREATE OR REPLACE FUNCTION update_construction_items_on_production_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE construction_quote_items
    SET 
      status = 'available_for_delivery',
      notes = notes || format(' | Producao concluida - Ordem %s', NEW.order_number),
      updated_at = CURRENT_TIMESTAMP
    WHERE production_order_id = NEW.id
    AND status != 'delivered';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_construction_items_on_production_completion 
ON production_orders;

CREATE TRIGGER trigger_update_construction_items_on_production_completion
AFTER UPDATE ON production_orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION update_construction_items_on_production_completion();

-- Trigger para atualizar status quando item for entregue
CREATE OR REPLACE FUNCTION update_construction_items_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_delivery RECORD;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT * INTO v_delivery FROM deliveries WHERE id = NEW.id;
    
    IF v_delivery.construction_project_id IS NOT NULL THEN
      UPDATE construction_quote_items
      SET 
        status = 'delivered',
        notes = notes || format(' | Entregue - %s', NEW.delivery_number),
        updated_at = CURRENT_TIMESTAMP
      WHERE delivery_id = NEW.id
      AND status != 'delivered';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_construction_items_on_delivery 
ON deliveries;

CREATE TRIGGER trigger_update_construction_items_on_delivery
AFTER UPDATE ON deliveries
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION update_construction_items_on_delivery();
