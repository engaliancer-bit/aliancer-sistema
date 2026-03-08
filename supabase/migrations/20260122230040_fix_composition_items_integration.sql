/*
  # Corrigir Integração com Tabela Composition Items
  
  1. Correções
    - Atualizar função check_composition_stock para usar composition_items
    - Atualizar função process_quote_approval_for_construction
    - Adicionar suporte para itens do tipo 'product' nas composições
  
  2. Melhorias
    - Melhor tratamento de erros
    - Logs mais detalhados
    - Validação de dados
*/

-- Função corrigida para verificar estoque de uma composição
CREATE OR REPLACE FUNCTION check_composition_stock(
  composition_id_param uuid, 
  quantity_multiplier decimal
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  quantity_required decimal,
  quantity_in_stock decimal,
  quantity_to_produce decimal,
  has_sufficient_stock boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.product_id,
    p.name as product_name,
    (ci.quantity * quantity_multiplier) as quantity_required,
    get_product_stock(ci.product_id) as quantity_in_stock,
    GREATEST(
      (ci.quantity * quantity_multiplier) - get_product_stock(ci.product_id),
      0
    ) as quantity_to_produce,
    get_product_stock(ci.product_id) >= (ci.quantity * quantity_multiplier) as has_sufficient_stock
  FROM composition_items ci
  JOIN products p ON p.id = ci.product_id
  WHERE ci.composition_id = composition_id_param
  AND ci.item_type = 'product'
  AND ci.product_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Função corrigida para processar aprovação de orçamento vinculado a obra
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
  v_order_number text;
  v_next_number int;
  v_result jsonb;
  v_items_created int := 0;
  v_orders_created int := 0;
  v_total_items int := 0;
  v_construction_item_id uuid;
  v_has_products boolean;
BEGIN
  RAISE NOTICE 'Processando orçamento % do tipo % para obra %', 
    quote_id_param, quote_type_param, construction_project_id_param;
  
  -- Processar itens do orçamento baseado no tipo
  IF quote_type_param = 'quote' THEN
    -- Processar quote_items
    FOR v_quote_item IN 
      SELECT qi.id, qi.composition_id, qi.quantity
      FROM quote_items qi
      WHERE qi.quote_id = quote_id_param
      AND qi.composition_id IS NOT NULL
    LOOP
      v_total_items := v_total_items + 1;
      
      -- Verificar se a composição tem produtos
      SELECT EXISTS(
        SELECT 1 FROM composition_items 
        WHERE composition_id = v_quote_item.composition_id 
        AND item_type = 'product'
        AND product_id IS NOT NULL
      ) INTO v_has_products;
      
      IF NOT v_has_products THEN
        RAISE NOTICE 'Composição % não tem produtos, pulando...', v_quote_item.composition_id;
        CONTINUE;
      END IF;
      
      RAISE NOTICE 'Processando composição % com quantidade %', 
        v_quote_item.composition_id, v_quote_item.quantity;
      
      -- Para cada produto na composição
      FOR v_stock_info IN 
        SELECT * FROM check_composition_stock(
          v_quote_item.composition_id, 
          v_quote_item.quantity
        )
      LOOP
        RAISE NOTICE 'Produto %: necessário=%, estoque=%, produzir=%', 
          v_stock_info.product_name,
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
          quantity_required,
          quantity_in_stock,
          quantity_to_produce,
          status,
          notes
        ) VALUES (
          construction_project_id_param,
          quote_id_param,
          quote_type_param,
          v_quote_item.id,
          v_quote_item.composition_id,
          v_stock_info.product_id,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce,
          CASE 
            WHEN v_stock_info.has_sufficient_stock THEN 'available_for_delivery'
            WHEN v_stock_info.quantity_in_stock > 0 THEN 'partially_available'
            ELSE 'in_production'
          END,
          CASE
            WHEN v_stock_info.has_sufficient_stock THEN 
              format('Estoque disponível: %.0f unidades', v_stock_info.quantity_in_stock)
            WHEN v_stock_info.quantity_in_stock > 0 THEN
              format('Estoque parcial: %.0f de %.0f unidades. Faltam %.0f', 
                v_stock_info.quantity_in_stock, 
                v_stock_info.quantity_required,
                v_stock_info.quantity_to_produce)
            ELSE
              format('Aguardando produção: %.0f unidades', v_stock_info.quantity_to_produce)
          END
        ) RETURNING id INTO v_construction_item_id;
        
        v_items_created := v_items_created + 1;
        
        -- Se precisa produzir, criar ordem de produção
        IF v_stock_info.quantity_to_produce > 0 THEN
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';
          
          v_order_number := 'OP-' || v_next_number;
          
          RAISE NOTICE 'Criando ordem %: % x %.0f un', 
            v_order_number, v_stock_info.product_name, v_stock_info.quantity_to_produce;
          
          INSERT INTO production_orders (
            order_number,
            product_id,
            quantity,
            priority,
            status,
            notes
          ) VALUES (
            v_order_number,
            v_stock_info.product_id,
            v_stock_info.quantity_to_produce,
            'high',
            'open',
            format('Ordem para obra - Produto: %s | Orçamento aprovado', 
              v_stock_info.product_name)
          ) RETURNING id INTO v_production_order_id;
          
          -- Vincular ordem ao item da obra
          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;
          
          v_orders_created := v_orders_created + 1;
          
          RAISE NOTICE 'Ordem % criada com sucesso!', v_order_number;
        END IF;
      END LOOP;
    END LOOP;
    
  ELSIF quote_type_param = 'ribbed_slab' THEN
    -- Processar ribbed_slab_rooms
    FOR v_quote_item IN 
      SELECT 
        rsr.id, 
        rsr.composition_id,
        CEIL(rsr.area / NULLIF(c.coverage_area_m2, 0)) as quantity
      FROM ribbed_slab_rooms rsr
      JOIN ribbed_slab_floors rsf ON rsf.id = rsr.floor_id
      JOIN compositions c ON c.id = rsr.composition_id
      WHERE rsf.quote_id = quote_id_param
      AND rsr.composition_id IS NOT NULL
      AND c.coverage_area_m2 > 0
    LOOP
      v_total_items := v_total_items + 1;
      
      -- Verificar se a composição tem produtos
      SELECT EXISTS(
        SELECT 1 FROM composition_items 
        WHERE composition_id = v_quote_item.composition_id 
        AND item_type = 'product'
        AND product_id IS NOT NULL
      ) INTO v_has_products;
      
      IF NOT v_has_products THEN
        RAISE NOTICE 'Composição % não tem produtos, pulando...', v_quote_item.composition_id;
        CONTINUE;
      END IF;
      
      RAISE NOTICE 'Processando laje treliçada - composição % com quantidade %', 
        v_quote_item.composition_id, v_quote_item.quantity;
      
      -- Para cada produto na composição
      FOR v_stock_info IN 
        SELECT * FROM check_composition_stock(
          v_quote_item.composition_id, 
          v_quote_item.quantity
        )
      LOOP
        RAISE NOTICE 'Produto %: necessário=%, estoque=%, produzir=%', 
          v_stock_info.product_name,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce;
        
        INSERT INTO construction_quote_items (
          construction_project_id,
          quote_id,
          quote_type,
          quote_item_id,
          composition_id,
          product_id,
          quantity_required,
          quantity_in_stock,
          quantity_to_produce,
          status,
          notes
        ) VALUES (
          construction_project_id_param,
          quote_id_param,
          quote_type_param,
          v_quote_item.id,
          v_quote_item.composition_id,
          v_stock_info.product_id,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce,
          CASE 
            WHEN v_stock_info.has_sufficient_stock THEN 'available_for_delivery'
            WHEN v_stock_info.quantity_in_stock > 0 THEN 'partially_available'
            ELSE 'in_production'
          END,
          CASE
            WHEN v_stock_info.has_sufficient_stock THEN 
              format('Estoque disponível: %.0f unidades', v_stock_info.quantity_in_stock)
            WHEN v_stock_info.quantity_in_stock > 0 THEN
              format('Estoque parcial: %.0f de %.0f un. Faltam %.0f', 
                v_stock_info.quantity_in_stock, 
                v_stock_info.quantity_required,
                v_stock_info.quantity_to_produce)
            ELSE
              format('Aguardando produção: %.0f unidades', v_stock_info.quantity_to_produce)
          END
        ) RETURNING id INTO v_construction_item_id;
        
        v_items_created := v_items_created + 1;
        
        IF v_stock_info.quantity_to_produce > 0 THEN
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';
          
          v_order_number := 'OP-' || v_next_number;
          
          RAISE NOTICE 'Criando ordem %: % x %.0f un', 
            v_order_number, v_stock_info.product_name, v_stock_info.quantity_to_produce;
          
          INSERT INTO production_orders (
            order_number,
            product_id,
            quantity,
            priority,
            status,
            notes
          ) VALUES (
            v_order_number,
            v_stock_info.product_id,
            v_stock_info.quantity_to_produce,
            'high',
            'open',
            format('Laje treliçada - Produto: %s', v_stock_info.product_name)
          ) RETURNING id INTO v_production_order_id;
          
          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;
          
          v_orders_created := v_orders_created + 1;
          
          RAISE NOTICE 'Ordem % criada com sucesso!', v_order_number;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'total_composition_items', v_total_items,
    'construction_items_created', v_items_created,
    'production_orders_created', v_orders_created,
    'message', format(
      '%s composições analisadas | %s produtos registrados | %s ordens de produção criadas',
      v_total_items, v_items_created, v_orders_created
    )
  );
  
  RAISE NOTICE 'Resultado final: %', v_result;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao processar orçamento: % - %', SQLSTATE, SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql;
