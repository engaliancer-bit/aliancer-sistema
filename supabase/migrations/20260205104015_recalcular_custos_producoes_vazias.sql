/*
  # Recalcular Custos de Produções com custos_no_momento Vazio
  
  ## Problema
  Algumas produções foram cadastradas com custos_no_momento vazio:
  ```json
  {
    "materials": {},
    "total_cost": 0
  }
  ```
  
  Mas os produtos TÊM materiais cadastrados (receita, armaduras, acessórios).
  
  ## Solução
  1. Identificar produções com custos vazios
  2. Buscar materiais ATUAIS do produto
  3. Recalcular custos usando material_cost do produto
  4. Atualizar custos_no_momento
  5. Trigger vai popular production_items automaticamente
  
  ## Estratégia
  Como não temos o preço histórico dos materiais na época da produção,
  vamos usar o custo cadastrado no produto (material_cost) que é a soma
  de todos os materiais calculados no cadastro do produto.
*/

-- FUNÇÃO: Recalcular custos de uma produção baseado no produto atual
CREATE OR REPLACE FUNCTION recalcular_custos_producao(p_production_id UUID)
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
BEGIN
  -- Buscar produção
  SELECT * INTO v_production
  FROM production
  WHERE id = p_production_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produção % não encontrada', p_production_id;
  END IF;
  
  -- Buscar produto
  SELECT * INTO v_product
  FROM products
  WHERE id = v_production.product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  
  -- Se produto tem material_cost cadastrado, distribuir proporcionalmente
  IF v_product.material_cost > 0 THEN
    -- Buscar receita se existir
    IF v_product.recipe_id IS NOT NULL THEN
      SELECT * INTO v_recipe
      FROM recipes
      WHERE id = v_product.recipe_id;
      
      -- Calcular volume/peso de concreto
      IF v_recipe.specific_weight > 0 AND v_product.concrete_volume_m3 > 0 THEN
        DECLARE
          v_concrete_weight_kg DECIMAL;
          v_material_percentage DECIMAL;
          v_material_quantity DECIMAL;
          v_unit_cost DECIMAL;
        BEGIN
          v_concrete_weight_kg := v_product.concrete_volume_m3 * v_recipe.specific_weight;
          
          -- Buscar materiais da receita através de product_material_weights
          FOR v_material IN
            SELECT
              m.id as material_id,
              m.name as material_name,
              m.unit,
              m.current_price,
              pmw.weight as quantity_per_unit
            FROM product_material_weights pmw
            INNER JOIN materials m ON m.id = pmw.material_id
            WHERE pmw.product_id = v_product.id
          LOOP
            v_quantity_needed := v_material.quantity_per_unit * v_production.quantity;
            v_material_cost := v_quantity_needed * v_material.current_price;
            
            v_material_obj := jsonb_build_object(
              'material_id', v_material.material_id,
              'name', v_material.material_name,
              'quantity', v_quantity_needed,
              'unit', v_material.unit,
              'unit_price', v_material.current_price,
              'total', v_material_cost
            );
            
            v_materials := v_materials || jsonb_build_object(v_material.material_id::text, v_material_obj);
            v_total_cost := v_total_cost + v_material_cost;
          END LOOP;
        END;
      END IF;
    END IF;
    
    -- Buscar armaduras
    FOR v_material IN
      SELECT
        m.id as material_id,
        m.name as material_name,
        m.unit,
        m.current_price,
        pr.total_length_meters as length_per_unit
      FROM product_reinforcements pr
      INNER JOIN materials m ON m.id = pr.material_id
      WHERE pr.product_id = v_product.id
    LOOP
      v_quantity_needed := v_material.length_per_unit * v_production.quantity;
      v_material_cost := v_quantity_needed * v_material.current_price;
      
      v_material_obj := jsonb_build_object(
        'material_id', v_material.material_id,
        'name', v_material.material_name,
        'quantity', v_quantity_needed,
        'unit', v_material.unit,
        'unit_price', v_material.current_price,
        'total', v_material_cost
      );
      
      v_materials := v_materials || jsonb_build_object(v_material.material_id::text, v_material_obj);
      v_total_cost := v_total_cost + v_material_cost;
    END LOOP;
    
    -- Buscar acessórios
    FOR v_material IN
      SELECT
        m.id as material_id,
        m.name as material_name,
        m.unit,
        m.current_price,
        pa.quantity_per_unit
      FROM product_accessories pa
      INNER JOIN materials m ON m.id = pa.material_id
      WHERE pa.product_id = v_product.id
    LOOP
      v_quantity_needed := v_material.quantity_per_unit * v_production.quantity;
      v_material_cost := v_quantity_needed * v_material.current_price;
      
      v_material_obj := jsonb_build_object(
        'material_id', v_material.material_id,
        'name', v_material.material_name,
        'quantity', v_quantity_needed,
        'unit', v_material.unit,
        'unit_price', v_material.current_price,
        'total', v_material_cost
      );
      
      v_materials := v_materials || jsonb_build_object(v_material.material_id::text, v_material_obj);
      v_total_cost := v_total_cost + v_material_cost;
    END LOOP;
  END IF;
  
  -- Montar JSONB final
  RETURN jsonb_build_object(
    'materials', v_materials,
    'total_cost', v_total_cost,
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
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RECALCULANDO PRODUÇÕES COM CUSTOS VAZIOS';
  RAISE NOTICE '============================================';
  
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
      v_custos_recalculados := recalcular_custos_producao(v_production.id);
      
      -- Verificar se conseguiu calcular algo
      IF (
        SELECT COUNT(*) 
        FROM jsonb_object_keys(v_custos_recalculados->'materials')
      ) > 0 THEN
        -- Atualizar produção
        UPDATE production
        SET custos_no_momento = v_custos_recalculados
        WHERE id = v_production.id;
        
        v_total_recalculadas := v_total_recalculadas + 1;
        
        IF v_total_recalculadas % 10 = 0 THEN
          RAISE NOTICE 'Recalculadas % produções...', v_total_recalculadas;
        END IF;
      ELSE
        RAISE NOTICE 'Produção % (%) - Produto sem materiais cadastrados',
          v_production.id, v_production.product_name;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ERRO ao recalcular produção %: %', v_production.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'RECÁLCULO CONCLUÍDO';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Produções processadas: %', v_total_processadas;
  RAISE NOTICE 'Produções recalculadas: %', v_total_recalculadas;
  RAISE NOTICE '============================================';
END $$;
