/*
  # Simplificar Função de Criação de Produção Atômica

  1. Mudanças
    - Criar função RPC simplificada que aceita custos e materiais pré-calculados
    - Permite frontend calcular a lógica complexa mas garante transação atômica
    - Mantém flexibilidade da aplicação
*/

-- Função simplificada que aceita custos e movimentos pré-calculados
CREATE OR REPLACE FUNCTION create_production_atomic(
  p_product_id UUID,
  p_recipe_id UUID,
  p_quantity DECIMAL,
  p_production_date DATE,
  p_employee_id UUID DEFAULT NULL,
  p_production_order_item_id UUID DEFAULT NULL,
  p_production_type TEXT DEFAULT 'stock',
  p_notes TEXT DEFAULT NULL,
  p_custos JSONB DEFAULT NULL,
  p_material_movements JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_production_id UUID;
  v_movement JSONB;
BEGIN
  -- 1. Se custos não foram fornecidos, calcular automaticamente
  IF p_custos IS NULL OR p_custos = '{}'::jsonb THEN
    p_custos := calculate_production_costs(p_recipe_id, p_quantity);
  END IF;
  
  -- 2. Criar registro de produção com custos históricos
  INSERT INTO production (
    product_id,
    recipe_id,
    quantity,
    production_date,
    employee_id,
    production_order_item_id,
    production_type,
    notes,
    custos_no_momento
  ) VALUES (
    p_product_id,
    p_recipe_id,
    p_quantity,
    p_production_date,
    p_employee_id,
    p_production_order_item_id,
    p_production_type,
    p_notes,
    p_custos
  )
  RETURNING id INTO v_production_id;
  
  -- 3. Criar movimentos de materiais se fornecidos
  IF jsonb_array_length(p_material_movements) > 0 THEN
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
  
  RETURN v_production_id;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION create_production_atomic IS 
'Cria produção com custos históricos e movimentos de materiais atomicamente. Aceita custos e movimentos pré-calculados ou calcula automaticamente.';
