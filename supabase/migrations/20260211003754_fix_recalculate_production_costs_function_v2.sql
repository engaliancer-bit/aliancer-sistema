/*
  # Correção: Função recalculate_production_material_costs

  ## Problema
  Função tinha erro ao tentar usar jsonb_populate_record sem tipo definido.

  ## Solução
  Acessar valores do JSONB usando ->> ao invés de jsonb_populate_record
*/

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
  v_existing_qty numeric;
  v_existing_total numeric;
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
    RETURN v_custos;
  END IF;

  -- 1. RECEITA (se produto tem recipe_id)
  IF v_recipe_id IS NOT NULL THEN
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
      v_item_cost := v_material.recipe_quantity * v_quantity * v_material.unit_cost;

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

  -- 2. ARMADURAS
  IF v_product_type IN ('artifact', 'premolded', 'ferragens_diversas') OR v_recipe_id IS NULL THEN
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

      -- Se já existe, somar quantidade e custo
      IF v_material_costs ? v_material.material_id::text THEN
        v_existing_qty := (v_material_costs->v_material.material_id::text->>'quantity')::numeric;
        v_existing_total := (v_material_costs->v_material.material_id::text->>'total')::numeric;
        
        v_material_costs := jsonb_set(
          v_material_costs,
          ARRAY[v_material.material_id::text, 'quantity'],
          to_jsonb(v_existing_qty + (v_material.length_per_unit * v_quantity))
        );
        v_material_costs := jsonb_set(
          v_material_costs,
          ARRAY[v_material.material_id::text, 'total'],
          to_jsonb(v_existing_total + v_item_cost)
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

  -- 3. ACESSÓRIOS
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

    -- Se já existe, somar
    IF v_material_costs ? v_material.material_id::text THEN
      v_existing_qty := (v_material_costs->v_material.material_id::text->>'quantity')::numeric;
      v_existing_total := (v_material_costs->v_material.material_id::text->>'total')::numeric;
      
      v_material_costs := jsonb_set(
        v_material_costs,
        ARRAY[v_material.material_id::text, 'quantity'],
        to_jsonb(v_existing_qty + (v_material.quantity_per_unit * v_quantity))
      );
      v_material_costs := jsonb_set(
        v_material_costs,
        ARRAY[v_material.material_id::text, 'total'],
        to_jsonb(v_existing_total + v_item_cost)
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

  -- Montar objeto final
  v_custos := jsonb_build_object(
    'materials', v_material_costs,
    'total_cost', v_total_cost,
    'calculated_at', now()
  );
  
  RETURN v_custos;
END;
$$;

-- Agora reprocessar as produções com custos vazios
UPDATE production
SET custos_no_momento = recalculate_production_material_costs(id)
WHERE production_date >= CURRENT_DATE - INTERVAL '30 days'
  AND (
    custos_no_momento IS NULL 
    OR custos_no_momento->'materials' = '{}'::jsonb
    OR (custos_no_momento->>'total_cost')::numeric = 0
  );
