/*
  # Fix create_production_atomic - Remove recipe_id field

  ## Problem
  The create_production_atomic function was trying to insert a 'recipe_id' field 
  into the 'production' table, but this column does not exist in the table schema.
  
  ## Changes
  1. Remove 'recipe_id' from the INSERT statement in create_production_atomic
  2. Remove 'recipe_id' from the INSERT statement in create_production_with_costs  
  3. Keep p_recipe_id parameter for cost calculation purposes
  4. Add detailed error logging to help debug issues
  
  ## Table Structure
  The 'production' table has these columns:
  - id, product_id, quantity, production_date, notes, created_at
  - production_order_id, production_type, production_order_item_id
  - custos_no_momento (JSONB - stores historical costs including recipe info)
  
  ## Note
  The recipe_id is still used to calculate costs (calculate_production_costs function)
  but is not stored directly in the production table. Recipe information is stored
  in the custos_no_momento JSONB field.
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS create_production_atomic(uuid, uuid, numeric, date, uuid, uuid, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS create_production_with_costs(uuid, uuid, numeric, uuid, uuid, text);

-- Recreate create_production_atomic without recipe_id in INSERT
CREATE OR REPLACE FUNCTION create_production_atomic(
  p_product_id UUID,
  p_recipe_id UUID,  -- Still used for cost calculation, but not inserted
  p_quantity NUMERIC,
  p_production_date DATE,
  p_employee_id UUID DEFAULT NULL,
  p_production_order_item_id UUID DEFAULT NULL,
  p_production_type TEXT DEFAULT 'stock',
  p_notes TEXT DEFAULT NULL,
  p_custos JSONB DEFAULT NULL,
  p_material_movements JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_production_id UUID;
  v_movement JSONB;
BEGIN
  -- Log de entrada para debug
  RAISE NOTICE 'create_production_atomic - Início';
  RAISE NOTICE '  p_product_id: %', p_product_id;
  RAISE NOTICE '  p_recipe_id: %', p_recipe_id;
  RAISE NOTICE '  p_quantity: %', p_quantity;
  RAISE NOTICE '  p_production_date: %', p_production_date;
  RAISE NOTICE '  p_production_type: %', p_production_type;

  -- 1. Se custos não foram fornecidos, calcular automaticamente
  IF p_custos IS NULL OR p_custos = '{}'::jsonb THEN
    RAISE NOTICE 'Calculando custos automaticamente...';
    p_custos := calculate_production_costs(p_recipe_id, p_quantity);
  END IF;

  -- 2. Criar registro de produção com custos históricos
  -- CORREÇÃO: Removido recipe_id do INSERT
  RAISE NOTICE 'Inserindo na tabela production...';
  BEGIN
    INSERT INTO production (
      product_id,
      quantity,
      production_date,
      production_order_item_id,
      production_type,
      notes,
      custos_no_momento
    ) VALUES (
      p_product_id,
      p_quantity,
      p_production_date,
      p_production_order_item_id,
      p_production_type,
      p_notes,
      p_custos
    )
    RETURNING id INTO v_production_id;
    
    RAISE NOTICE 'Produção criada com ID: %', v_production_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao inserir produção: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

  -- 3. Inserir production_items a partir do JSONB custos_no_momento
  IF p_custos IS NOT NULL AND jsonb_typeof(p_custos->'materials') = 'object' THEN
    RAISE NOTICE 'Extraindo production_items dos custos...';
    PERFORM extract_production_items_from_custos(v_production_id, p_custos);
  END IF;

  -- 4. Criar movimentos de materiais se fornecidos
  IF jsonb_array_length(p_material_movements) > 0 THEN
    RAISE NOTICE 'Criando % movimentos de materiais...', jsonb_array_length(p_material_movements);
    FOR v_movement IN SELECT * FROM jsonb_array_elements(p_material_movements)
    LOOP
      INSERT INTO material_movements (
        material_id,
        movement_type,
        quantity,
        movement_date,
        reference_id,
        reference_type,
        notes
      ) VALUES (
        (v_movement->>'material_id')::uuid,
        COALESCE(v_movement->>'movement_type', 'saida'),
        (v_movement->>'quantity')::decimal,
        p_production_date,
        v_production_id,
        'production',
        v_movement->>'notes'
      );
    END LOOP;
  END IF;

  RAISE NOTICE 'create_production_atomic - Concluído com sucesso';
  RETURN v_production_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'ERRO CRÍTICO em create_production_atomic: % (SQLSTATE: %, DETAIL: %)', 
    SQLERRM, SQLSTATE, COALESCE(pg_exception_detail(), 'sem detalhes');
END;
$$;

-- Recreate create_production_with_costs without recipe_id in INSERT
CREATE OR REPLACE FUNCTION create_production_with_costs(
  p_product_id UUID,
  p_recipe_id UUID,  -- Still used for cost calculation, but not inserted
  p_quantity NUMERIC,
  p_employee_id UUID,
  p_production_order_item_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_production_id UUID;
  v_costs JSONB;
  r RECORD;
BEGIN
  -- Calcular custos no momento
  v_costs := calculate_production_costs(p_recipe_id, p_quantity);

  -- Criar registro de produção com custos históricos
  -- CORREÇÃO: Removido recipe_id do INSERT
  INSERT INTO production (
    product_id,
    quantity,
    production_order_item_id,
    notes,
    custos_no_momento,
    production_date
  ) VALUES (
    p_product_id,
    p_quantity,
    p_production_order_item_id,
    p_notes,
    v_costs,
    CURRENT_DATE
  )
  RETURNING id INTO v_production_id;

  -- Atualizar estoque de materiais (debitar) atomicamente
  FOR r IN
    SELECT 
      ri.material_id,
      ri.quantity_per_unit * p_quantity as total_quantity
    FROM recipe_items ri
    WHERE ri.recipe_id = p_recipe_id
  LOOP
    -- Criar movimento de material
    INSERT INTO material_movements (
      material_id,
      movement_type,
      quantity,
      reference_id,
      reference_type,
      movement_date,
      notes
    ) VALUES (
      r.material_id,
      'producao',
      -r.total_quantity,
      v_production_id,
      'producao',
      CURRENT_DATE,
      'Consumo automático de produção'
    );
  END LOOP;

  RETURN v_production_id;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION create_production_atomic IS 
  'Creates production record atomically. Note: p_recipe_id is used for cost calculation but not stored in production table (stored in custos_no_momento JSONB).';

COMMENT ON FUNCTION create_production_with_costs IS 
  'Creates production with automatic cost calculation and material movements. Note: p_recipe_id is used for cost calculation but not stored in production table.';