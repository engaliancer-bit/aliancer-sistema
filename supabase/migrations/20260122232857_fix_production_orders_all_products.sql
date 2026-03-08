/*
  # Correção: Garantir Criação de Ordens para TODOS os Produtos
  
  1. Melhorias
    - Remove verificação que pode estar pulando items
    - Adiciona logs mais detalhados
    - Garante que TODOS os produtos sem estoque gerem ordem
    - Mantém funcionalidade de materiais e entregas
  
  2. O Que Muda
    - Simplifica lógica de verificação de items
    - Logs mais claros de cada etapa
    - Contador mais preciso de ordens criadas
*/

-- Função melhorada: Processar orçamento garantindo ordens para todos produtos
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
  v_project_record RECORD;
  v_items_for_delivery jsonb := '[]'::jsonb;
  v_item_record RECORD;
  v_composition_has_items boolean;
BEGIN
  RAISE NOTICE '=== PROCESSAMENTO INICIADO ===';
  
  -- Buscar informações da obra
  SELECT * INTO v_project_record
  FROM construction_projects
  WHERE id = construction_project_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra nao encontrada';
  END IF;
  
  RAISE NOTICE 'Obra: % | Cliente: %', v_project_record.name, v_project_record.customer_id;
  
  -- Processar itens do orçamento baseado no tipo
  IF quote_type_param = 'quote' THEN
    RAISE NOTICE 'Tipo: Orcamento Padrao';
    
    FOR v_quote_item IN 
      SELECT qi.id, qi.composition_id, qi.quantity
      FROM quote_items qi
      WHERE qi.quote_id = quote_id_param
      AND qi.composition_id IS NOT NULL
    LOOP
      v_total_items := v_total_items + 1;
      
      -- Verificar se a composição tem items
      SELECT EXISTS(
        SELECT 1 FROM composition_items 
        WHERE composition_id = v_quote_item.composition_id
      ) INTO v_composition_has_items;
      
      IF NOT v_composition_has_items THEN
        RAISE NOTICE 'Composicao % nao tem items cadastrados', v_quote_item.composition_id;
        CONTINUE;
      END IF;
      
      RAISE NOTICE 'Processando composicao % (Qtd: %)', v_quote_item.composition_id, v_quote_item.quantity;
      
      -- Para cada item na composição (produtos + materiais)
      FOR v_stock_info IN 
        SELECT * FROM check_composition_full_stock(
          v_quote_item.composition_id, 
          v_quote_item.quantity
        )
      LOOP
        RAISE NOTICE 'Item: % | Tipo: % | Necessario: % | Estoque: % | A Produzir: %',
          v_stock_info.item_name,
          v_stock_info.item_type,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce;
        
        -- Criar registro de item da obra
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
        
        -- Se tem estoque disponível, adicionar à lista de items para entrega
        IF v_stock_info.quantity_in_stock > 0 THEN
          RAISE NOTICE 'Adicionando a entrega: % unidades', v_stock_info.quantity_in_stock;
          v_items_for_delivery := v_items_for_delivery || jsonb_build_object(
            'construction_item_id', v_construction_item_id,
            'item_type', v_stock_info.item_type,
            'item_id', v_stock_info.item_reference_id,
            'item_name', v_stock_info.item_name,
            'quantity', v_stock_info.quantity_in_stock,
            'unit', v_stock_info.unit
          );
        END IF;
        
        -- CRÍTICO: Se é PRODUTO e quantity_to_produce > 0, criar ordem de produção
        IF v_stock_info.item_type = 'product' THEN
          IF v_stock_info.quantity_to_produce > 0 THEN
            SELECT COALESCE(
              MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
            ) + 1
            INTO v_next_number
            FROM production_orders
            WHERE order_number ~ '^OP-[0-9]+$';
            
            v_order_number := 'OP-' || v_next_number;
            
            RAISE NOTICE 'CRIANDO ORDEM: % para produto % | Quantidade: %',
              v_order_number,
              v_stock_info.item_name,
              v_stock_info.quantity_to_produce;
            
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
            RAISE NOTICE 'ORDEM CRIADA COM SUCESSO: %', v_order_number;
          ELSE
            RAISE NOTICE 'Produto tem estoque suficiente, ordem nao necessaria';
          END IF;
        ELSE
          RAISE NOTICE 'Item e material, ordem nao necessaria';
        END IF;
      END LOOP;
    END LOOP;
    
  ELSIF quote_type_param = 'ribbed_slab' THEN
    RAISE NOTICE 'Tipo: Laje Trelicada';
    
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
      ) INTO v_composition_has_items;
      
      IF NOT v_composition_has_items THEN
        RAISE NOTICE 'Composicao % nao tem items cadastrados', v_quote_item.composition_id;
        CONTINUE;
      END IF;
      
      RAISE NOTICE 'Processando laje - composicao % (Qtd: %)', v_quote_item.composition_id, v_quote_item.quantity;
      
      FOR v_stock_info IN 
        SELECT * FROM check_composition_full_stock(
          v_quote_item.composition_id, 
          v_quote_item.quantity
        )
      LOOP
        RAISE NOTICE 'Item: % | Tipo: % | Necessario: % | Estoque: %',
          v_stock_info.item_name,
          v_stock_info.item_type,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock;
        
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
          
          RAISE NOTICE 'CRIANDO ORDEM: % para produto %', v_order_number, v_stock_info.item_name;
          
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
          RAISE NOTICE 'ORDEM CRIADA: %', v_order_number;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  -- Criar entrega automática se houver items com estoque
  IF jsonb_array_length(v_items_for_delivery) > 0 THEN
    RAISE NOTICE 'Criando entrega automatica com % items', jsonb_array_length(v_items_for_delivery);
    
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
    
    RAISE NOTICE 'Entrega criada: %', v_delivery_number;
    
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
    RAISE NOTICE 'Entrega finalizada com sucesso';
  END IF;
  
  RAISE NOTICE '=== RESUMO FINAL ===';
  RAISE NOTICE 'Composicoes: %', v_total_items;
  RAISE NOTICE 'Items criados: %', v_items_created;
  RAISE NOTICE 'Ordens criadas: %', v_orders_created;
  RAISE NOTICE 'Entregas criadas: %', v_deliveries_created;
  
  v_result := jsonb_build_object(
    'success', true,
    'total_composition_items', v_total_items,
    'construction_items_created', v_items_created,
    'production_orders_created', v_orders_created,
    'deliveries_created', v_deliveries_created,
    'message', format(
      '%s composicoes | %s items | %s ordens | %s entregas',
      v_total_items, v_items_created, v_orders_created, v_deliveries_created
    )
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERRO: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql;
