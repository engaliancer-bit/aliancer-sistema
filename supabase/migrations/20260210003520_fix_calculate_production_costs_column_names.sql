/*
  # Fix: Corrigir nomes de colunas em calculate_production_costs

  ## Problema
  A função estava usando nomes de colunas incorretos:
  - `ri.quantity_per_unit` → deve ser `ri.quantity`
  - `m.cost_per_unit` → deve ser `m.unit_cost`

  ## Solução
  Recriar a função com os nomes corretos das colunas.
*/

DROP FUNCTION IF EXISTS calculate_production_costs(uuid, numeric);

CREATE OR REPLACE FUNCTION calculate_production_costs(
  p_recipe_id UUID,
  p_quantity NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_costs JSONB := '{}'::jsonb;
  v_materials JSONB := '{}'::jsonb;
  v_total_cost NUMERIC := 0;
  v_material RECORD;
BEGIN
  RAISE NOTICE 'calculate_production_costs - recipe_id: %, quantity: %', p_recipe_id, p_quantity;
  
  IF p_recipe_id IS NULL THEN
    RAISE NOTICE 'Recipe ID é NULL, retornando custos vazios';
    RETURN jsonb_build_object(
      'materials', '{}'::jsonb,
      'total_cost', 0,
      'calculated_at', now()
    );
  END IF;

  -- Buscar materiais da receita e calcular custos
  FOR v_material IN
    SELECT 
      ri.material_id,
      ri.quantity,  -- CORRIGIDO: quantity ao invés de quantity_per_unit
      m.name,
      m.unit,
      COALESCE(m.unit_cost, 0) as unit_cost  -- CORRIGIDO: unit_cost ao invés de cost_per_unit
    FROM recipe_items ri
    INNER JOIN materials m ON m.id = ri.material_id
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    DECLARE
      v_total_quantity NUMERIC;
      v_item_total NUMERIC;
    BEGIN
      -- Calcular quantidade total e custo
      v_total_quantity := v_material.quantity * p_quantity;
      v_item_total := v_material.unit_cost * v_total_quantity;
      v_total_cost := v_total_cost + v_item_total;

      -- Adicionar ao objeto de materiais
      v_materials := v_materials || jsonb_build_object(
        v_material.material_id::text,
        jsonb_build_object(
          'material_id', v_material.material_id,
          'name', v_material.name,
          'quantity', v_total_quantity,
          'unit', v_material.unit,
          'unit_price', v_material.unit_cost,
          'total', v_item_total
        )
      );

      RAISE NOTICE '  Material: % - Qtd: % % - Custo unit: R$ % - Total: R$ %',
        v_material.name, v_total_quantity, v_material.unit, v_material.unit_cost, v_item_total;
    END;
  END LOOP;

  -- Montar resultado final
  v_costs := jsonb_build_object(
    'materials', v_materials,
    'total_cost', v_total_cost,
    'calculated_at', now()
  );

  RAISE NOTICE 'Custos calculados - Total: R$ %', v_total_cost;

  RETURN v_costs;
END;
$$;

COMMENT ON FUNCTION calculate_production_costs IS 
  'Calcula custos de produção baseado na receita. USA: ri.quantity e m.unit_cost';
