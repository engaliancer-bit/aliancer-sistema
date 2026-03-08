/*
  # Correção: Recalcular Custos de Produção de Materiais

  ## Problema
  Produções registradas estão com `custos_no_momento` contendo `materials: {}` vazio.
  Isso ocorre porque:
  1. Query do frontend não buscava `product_type` e `total_weight`
  2. Função calculateProductionCosts não buscava reinforcements para produtos tipo "artifact" e "ferragens_diversas"
  3. Coluna materials.cost_per_unit não existe (é unit_cost)

  ## Solução Aplicada
  ### Frontend (src/components/DailyProduction.tsx)
  - ✅ Adicionado product_type e total_weight às queries de produtos
  
  ### Backend (src/lib/productionCosts.ts)
  - ✅ Corrigido nome do campo: cost_per_unit → unit_cost
  - ✅ Buscar reinforcements para tipos: premolded, artifact, ferragens_diversas, ou quando não tem receita

  ## Esta Migration
  Recalcula custos das produções que estão com materials vazio baseado em:
  1. Receitas (recipe_items) - quando produto tem recipe_id
  2. Armaduras (product_reinforcements) - ferragens
  3. Acessórios (product_accessories) - materiais adicionais
  
  ## Impacto
  - Produções com materials: {} terão custos recalculados
  - production_items será populado automaticamente via trigger
  - Relatórios de consumo passarão a funcionar
*/

-- Função auxiliar para calcular custo de materiais de uma produção
CREATE OR REPLACE FUNCTION recalculate_production_material_costs(p_production_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_product_id uuid;
  v_recipe_id uuid;
  v_quantity numeric;
  v_product_type text;
  v_total_weight numeric;
  v_custos jsonb := '{"materials": {}, "total_cost": 0}'::jsonb;
  v_material_costs jsonb := '{}'::jsonb;
  v_total_cost numeric := 0;
  v_material record;
  v_material_data record;
  v_item_cost numeric;
BEGIN
  -- Buscar dados da produção e produto
  SELECT 
    p.product_id,
    p.quantity,
    pr.recipe_id,
    pr.product_type,
    COALESCE(pr.total_weight, 0)
  INTO v_product_id, v_quantity, v_recipe_id, v_product_type, v_total_weight
  FROM production p
  INNER JOIN products pr ON pr.id = p.product_id
  WHERE p.id = p_production_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Produção % não encontrada', p_production_id;
    RETURN v_custos;
  END IF;

  RAISE NOTICE 'Recalculando produção %: produto=%, qtd=%, tipo=%, recipe=%', 
    p_production_id, v_product_id, v_quantity, v_product_type, v_recipe_id;

  -- 1. RECEITA (se produto tem recipe_id)
  IF v_recipe_id IS NOT NULL THEN
    RAISE NOTICE '  → Processando receita %', v_recipe_id;
    
    FOR v_material IN (
      SELECT 
        ri.material_id,
        m.name as material_name,
        m.unit as material_unit,
        COALESCE(m.unit_cost, 0) as unit_cost,
        ri.quantity as recipe_quantity
      FROM recipe_items ri
      INNER JOIN materials m ON m.id = ri.material_id
      WHERE ri.recipe_id = v_recipe_id
    ) LOOP
      -- Calcular quantidade consumida (receita multiplicada pela quantidade produzida)
      v_item_cost := v_material.recipe_quantity * v_quantity * v_material.unit_cost;
      
      RAISE NOTICE '    - Material: %, qtd=%, custo_unit=%, total=%',
        v_material.material_name, 
        v_material.recipe_quantity * v_quantity,
        v_material.unit_cost,
        v_item_cost;

      -- Adicionar ao objeto de custos
      v_material_costs := jsonb_set(
        v_material_costs,
        ARRAY[v_material.material_id::text],
        jsonb_build_object(
          'material_id', v_material.material_id,
          'name', v_material.material_name,
          'unit', v_material.material_unit,
          'quantity', v_material.recipe_quantity * v_quantity,
          'unit_price', v_material.unit_cost,
          'total', v_item_cost
        )
      );

      v_total_cost := v_total_cost + v_item_cost;
    END LOOP;
  END IF;

  -- 2. ARMADURAS (product_reinforcements) - para artefatos, premoldados e ferragens
  IF v_product_type IN ('artifact', 'premolded', 'ferragens_diversas') OR v_recipe_id IS NULL THEN
    RAISE NOTICE '  → Processando armaduras (tipo: %)', v_product_type;
    
    FOR v_material IN (
      SELECT 
        pr.material_id,
        m.name as material_name,
        m.unit as material_unit,
        COALESCE(m.unit_cost, 0) as unit_cost,
        pr.total_length_meters as length_per_unit
      FROM product_reinforcements pr
      INNER JOIN materials m ON m.id = pr.material_id
      WHERE pr.product_id = v_product_id
    ) LOOP
      v_item_cost := v_material.length_per_unit * v_quantity * v_material.unit_cost;
      
      RAISE NOTICE '    - Armadura: %, length=%, custo_unit=%, total=%',
        v_material.material_name,
        v_material.length_per_unit * v_quantity,
        v_material.unit_cost,
        v_item_cost;

      -- Se já existe no objeto (veio da receita), somar quantidade
      IF v_material_costs ? v_material.material_id::text THEN
        v_material_data := jsonb_populate_record(null::record, v_material_costs->v_material.material_id::text);
        v_material_costs := jsonb_set(
          v_material_costs,
          ARRAY[v_material.material_id::text, 'quantity'],
          to_jsonb((v_material_data->>'quantity')::numeric + (v_material.length_per_unit * v_quantity))
        );
        v_material_costs := jsonb_set(
          v_material_costs,
          ARRAY[v_material.material_id::text, 'total'],
          to_jsonb((v_material_data->>'total')::numeric + v_item_cost)
        );
      ELSE
        v_material_costs := jsonb_set(
          v_material_costs,
          ARRAY[v_material.material_id::text],
          jsonb_build_object(
            'material_id', v_material.material_id,
            'name', v_material.material_name,
            'unit', v_material.material_unit,
            'quantity', v_material.length_per_unit * v_quantity,
            'unit_price', v_material.unit_cost,
            'total', v_item_cost
          )
        );
      END IF;

      v_total_cost := v_total_cost + v_item_cost;
    END LOOP;
  END IF;

  -- 3. ACESSÓRIOS/MATERIAIS (product_accessories com item_type = 'material')
  RAISE NOTICE '  → Processando acessórios';
  
  FOR v_material IN (
    SELECT 
      pa.material_id,
      m.name as material_name,
      m.unit as material_unit,
      COALESCE(m.unit_cost, 0) as unit_cost,
      pa.quantity as quantity_per_unit
    FROM product_accessories pa
    INNER JOIN materials m ON m.id = pa.material_id
    WHERE pa.product_id = v_product_id
      AND pa.item_type = 'material'
      AND pa.material_id IS NOT NULL
  ) LOOP
    v_item_cost := v_material.quantity_per_unit * v_quantity * v_material.unit_cost;
    
    RAISE NOTICE '    - Acessório: %, qtd=%, custo_unit=%, total=%',
      v_material.material_name,
      v_material.quantity_per_unit * v_quantity,
      v_material.unit_cost,
      v_item_cost;

    -- Se já existe, somar
    IF v_material_costs ? v_material.material_id::text THEN
      v_material_data := jsonb_populate_record(null::record, v_material_costs->v_material.material_id::text);
      v_material_costs := jsonb_set(
        v_material_costs,
        ARRAY[v_material.material_id::text, 'quantity'],
        to_jsonb((v_material_data->>'quantity')::numeric + (v_material.quantity_per_unit * v_quantity))
      );
      v_material_costs := jsonb_set(
        v_material_costs,
        ARRAY[v_material.material_id::text, 'total'],
        to_jsonb((v_material_data->>'total')::numeric + v_item_cost)
      );
    ELSE
      v_material_costs := jsonb_set(
        v_material_costs,
        ARRAY[v_material.material_id::text],
        jsonb_build_object(
          'material_id', v_material.material_id,
          'name', v_material.material_name,
          'unit', v_material.material_unit,
          'quantity', v_material.quantity_per_unit * v_quantity,
          'unit_price', v_material.unit_cost,
          'total', v_item_cost
        )
      );
    END IF;

    v_total_cost := v_total_cost + v_item_cost;
  END LOOP;

  -- Montar objeto final de custos
  v_custos := jsonb_build_object(
    'materials', v_material_costs,
    'total_cost', v_total_cost,
    'calculated_at', now()
  );

  RAISE NOTICE '  ✓ Total calculado: R$ %', v_total_cost;
  
  RETURN v_custos;
END;
$$;

-- Reprocessar produções com custos vazios dos últimos 30 dias
DO $$
DECLARE
  v_production record;
  v_new_costs jsonb;
  v_count integer := 0;
BEGIN
  RAISE NOTICE '=== REPROCESSANDO PRODUÇÕES COM CUSTOS VAZIOS ===';
  
  FOR v_production IN (
    SELECT 
      p.id,
      p.production_date,
      pr.name as product_name,
      p.quantity,
      jsonb_typeof(p.custos_no_momento->'materials') as tipo_materials,
      jsonb_object_keys(COALESCE(p.custos_no_momento->'materials', '{}'::jsonb)) as num_materials
    FROM production p
    INNER JOIN products pr ON pr.id = p.product_id
    WHERE p.production_date >= CURRENT_DATE - INTERVAL '30 days'
      AND (
        p.custos_no_momento IS NULL 
        OR p.custos_no_momento->'materials' = '{}'::jsonb
        OR (p.custos_no_momento->>'total_cost')::numeric = 0
      )
    ORDER BY p.production_date DESC, p.created_at DESC
  ) LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'Produção: % - % - % unidades',
      v_production.id,
      v_production.product_name,
      v_production.quantity;

    -- Recalcular custos
    v_new_costs := recalculate_production_material_costs(v_production.id);

    -- Atualizar production
    UPDATE production
    SET custos_no_momento = v_new_costs
    WHERE id = v_production.id;

    v_count := v_count + 1;
    
    RAISE NOTICE '✓ Atualizado com custos: %', v_new_costs->>'total_cost';
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== TOTAL REPROCESSADO: % produções ===', v_count;
END $$;

-- Comentários finais
COMMENT ON FUNCTION recalculate_production_material_costs IS 
'Recalcula custos de materiais de uma produção baseado em receitas, armaduras e acessórios do produto';
