/*
  # Recalcular Custos Usando recipe_items e Armaduras
  
  ## Problema Identificado
  Produções foram salvas com custos_no_momento vazio, mas os produtos TÊM:
  - recipe_items com materiais (traço)
  - product_reinforcements com armaduras
  
  ## Exemplo: Marco de Concreto
  - Receita TCP AL001 com 4 materiais (areia, pedrisco, cimento, aditivo)
  - Armadura: 0.30m de ferro CA-50 5/16
  - Peso total: 8.83kg
  
  ## Solução
  Recalcular usando dados REAIS do banco:
  1. Buscar recipe_items do produto
  2. Calcular consumo proporcional por peso
  3. Buscar product_reinforcements
  4. Multiplicar pela quantidade produzida
  5. Atualizar custos_no_momento
  6. Trigger vai popular production_items
*/

-- FUNÇÃO: Recalcular custos baseado em recipe_items + armaduras
CREATE OR REPLACE FUNCTION recalcular_custos_producao_v2(p_production_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_production RECORD;
  v_product RECORD;
  v_recipe RECORD;
  v_materials JSONB := '{}'::jsonb;
  v_total_cost DECIMAL := 0;
  v_material RECORD;
  v_material_obj JSONB;
  v_quantity_needed DECIMAL;
  v_material_cost DECIMAL;
  v_total_recipe_weight DECIMAL;
  v_multiplier DECIMAL;
BEGIN
  -- Buscar produção
  SELECT * INTO v_production
  FROM production
  WHERE id = p_production_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Buscar produto
  SELECT * INTO v_product
  FROM products
  WHERE id = v_production.product_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- 1. RECEITA - Calcular a partir de recipe_items
  IF v_product.recipe_id IS NOT NULL THEN
    -- Buscar receita
    SELECT * INTO v_recipe
    FROM recipes
    WHERE id = v_product.recipe_id;
    
    IF FOUND THEN
      -- Calcular peso total da receita
      SELECT COALESCE(SUM(quantity), 0) INTO v_total_recipe_weight
      FROM recipe_items
      WHERE recipe_id = v_product.recipe_id;
      
      IF v_total_recipe_weight > 0 AND v_product.total_weight > 0 THEN
        -- Multiplicador = peso_produto / peso_receita
        v_multiplier := v_product.total_weight / v_total_recipe_weight;
        
        -- Iterar sobre materiais da receita
        FOR v_material IN
          SELECT
            ri.material_id,
            m.name as material_name,
            ri.quantity as recipe_quantity,
            m.unit,
            m.unit_cost
          FROM recipe_items ri
          INNER JOIN materials m ON m.id = ri.material_id
          WHERE ri.recipe_id = v_product.recipe_id
        LOOP
          -- Consumo = (quantidade_receita * multiplicador) * quantidade_produzida
          v_quantity_needed := (v_material.recipe_quantity * v_multiplier) * v_production.quantity;
          v_material_cost := v_quantity_needed * v_material.unit_cost;
          
          v_material_obj := jsonb_build_object(
            'material_id', v_material.material_id,
            'name', v_material.material_name,
            'quantity', ROUND(v_quantity_needed, 4),
            'unit', v_material.unit,
            'unit_price', v_material.unit_cost,
            'total', ROUND(v_material_cost, 2)
          );
          
          v_materials := v_materials || jsonb_build_object(v_material.material_id::text, v_material_obj);
          v_total_cost := v_total_cost + v_material_cost;
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  -- 2. ARMADURAS - Multiplicar comprimento por quantidade
  FOR v_material IN
    SELECT
      pr.material_id,
      m.name as material_name,
      pr.total_length_meters,
      m.unit,
      m.unit_cost
    FROM product_reinforcements pr
    INNER JOIN materials m ON m.id = pr.material_id
    WHERE pr.product_id = v_product.id
  LOOP
    v_quantity_needed := v_material.total_length_meters * v_production.quantity;
    v_material_cost := v_quantity_needed * v_material.unit_cost;
    
    v_material_obj := jsonb_build_object(
      'material_id', v_material.material_id,
      'name', v_material.material_name,
      'quantity', ROUND(v_quantity_needed, 4),
      'unit', v_material.unit,
      'unit_price', v_material.unit_cost,
      'total', ROUND(v_material_cost, 2)
    );
    
    v_materials := v_materials || jsonb_build_object(v_material.material_id::text, v_material_obj);
    v_total_cost := v_total_cost + v_material_cost;
  END LOOP;
  
  -- 3. ACESSÓRIOS
  FOR v_material IN
    SELECT
      pa.material_id,
      m.name as material_name,
      pa.quantity as quantity_per_unit,
      m.unit,
      m.unit_cost
    FROM product_accessories pa
    INNER JOIN materials m ON m.id = pa.material_id
    WHERE pa.product_id = v_product.id
      AND pa.item_type = 'material'
  LOOP
    v_quantity_needed := v_material.quantity_per_unit * v_production.quantity;
    v_material_cost := v_quantity_needed * v_material.unit_cost;
    
    v_material_obj := jsonb_build_object(
      'material_id', v_material.material_id,
      'name', v_material.material_name,
      'quantity', ROUND(v_quantity_needed, 4),
      'unit', v_material.unit,
      'unit_price', v_material.unit_cost,
      'total', ROUND(v_material_cost, 2)
    );
    
    v_materials := v_materials || jsonb_build_object(v_material.material_id::text, v_material_obj);
    v_total_cost := v_total_cost + v_material_cost;
  END LOOP;
  
  -- Retornar JSONB formatado
  RETURN jsonb_build_object(
    'materials', v_materials,
    'total_cost', ROUND(v_total_cost, 2),
    'calculated_at', now(),
    'recalculated', true
  );
END;
$$;

-- EXECUTAR RECÁLCULO PARA TODAS AS PRODUÇÕES COM CUSTOS VAZIOS
DO $$
DECLARE
  v_production RECORD;
  v_custos_recalculados JSONB;
  v_total_recalculadas INT := 0;
  v_total_processadas INT := 0;
  v_total_sem_materiais INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'RECALCULANDO PRODUÇÕES COM CUSTOS VAZIOS (V2)';
  RAISE NOTICE '===============================================';
  
  FOR v_production IN
    SELECT
      p.id,
      p.product_id,
      prod.name as product_name,
      p.quantity,
      p.production_date
    FROM production p
    INNER JOIN products prod ON prod.id = p.product_id
    WHERE p.custos_no_momento IS NOT NULL
      AND (
        jsonb_typeof(p.custos_no_momento->'materials') != 'object'
        OR (
          SELECT COUNT(*) 
          FROM jsonb_object_keys(p.custos_no_momento->'materials')
        ) = 0
      )
    ORDER BY p.production_date DESC
  LOOP
    BEGIN
      v_total_processadas := v_total_processadas + 1;
      
      -- Recalcular custos
      v_custos_recalculados := recalcular_custos_producao_v2(v_production.id);
      
      -- Verificar se conseguiu calcular algo
      IF v_custos_recalculados IS NOT NULL AND (
        SELECT COUNT(*) 
        FROM jsonb_object_keys(v_custos_recalculados->'materials')
      ) > 0 THEN
        -- Atualizar produção (trigger vai popular production_items)
        UPDATE production
        SET custos_no_momento = v_custos_recalculados
        WHERE id = v_production.id;
        
        v_total_recalculadas := v_total_recalculadas + 1;
        
        IF v_total_recalculadas <= 5 THEN
          RAISE NOTICE 'Recalculada: % (%) - % materiais, custo: R$ %',
            v_production.product_name,
            v_production.production_date,
            (SELECT COUNT(*) FROM jsonb_object_keys(v_custos_recalculados->'materials')),
            (v_custos_recalculados->>'total_cost')::decimal;
        END IF;
        
        IF v_total_recalculadas % 50 = 0 THEN
          RAISE NOTICE 'Processadas % produções...', v_total_recalculadas;
        END IF;
      ELSE
        v_total_sem_materiais := v_total_sem_materiais + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ERRO ao recalcular produção %: %', v_production.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'RECÁLCULO CONCLUÍDO';
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'Produções processadas: %', v_total_processadas;
  RAISE NOTICE 'Produções recalculadas: %', v_total_recalculadas;
  RAISE NOTICE 'Sem materiais cadastrados: %', v_total_sem_materiais;
  RAISE NOTICE '===============================================';
END $$;
