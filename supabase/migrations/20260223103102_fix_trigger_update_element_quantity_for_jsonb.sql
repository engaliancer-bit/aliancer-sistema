/*
  # Fix trigger update_element_calculated_quantity to work with jsonb calc_element_params

  ## Problem
  The function calc_element_params was updated to return jsonb instead of a TABLE
  (in migration 20260223003918). However, the trigger update_element_calculated_quantity
  still uses the old TABLE-based SELECT syntax:
    SELECT quantity, unit, formula, category INTO ... FROM calc_element_params(...)
  
  This causes "column 'quantity' does not exist" errors on any INSERT or UPDATE of
  element_type or params in budget_elements (including confirm actions that update
  measurement_status, because the trigger fires BEFORE INSERT OR UPDATE OF element_type, params).

  Actually the confirm button only updates measurement_status so it should NOT fire the trigger.
  But initial inserts and edits do fire it, causing the error.

  ## Fix
  Rewrite the trigger function to read values from the jsonb result using ->>/->
  operators instead of the table column syntax.

  ## Column mapping (from jsonb result):
  - quantity: result->>'volume' OR result->>'area' OR result->>'metro_linear' OR result->>'pontos' OR result->>'quantidade'
  - unit: result->>'unit'
  - formula: result->>'resumo'

  ## Notes
  - The budget_calculation_logs INSERT is removed since that table doesn't exist
    in any migration, preventing a second possible error
*/

CREATE OR REPLACE FUNCTION update_element_calculated_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_result jsonb;
  v_qty    numeric;
  v_unit   text;
  v_form   text;
BEGIN
  v_result := calc_element_params(NEW.element_type, NEW.params);

  -- Extract quantity: prefer volume, then area, then metro_linear, then pontos, then quantidade
  v_qty := COALESCE(
    (v_result->>'volume')::numeric,
    (v_result->>'area')::numeric,
    (v_result->>'metro_linear')::numeric,
    (v_result->>'pontos')::numeric,
    (v_result->>'quantidade')::numeric,
    0
  );

  v_unit := COALESCE(v_result->>'unit', 'un');
  v_form := COALESCE(v_result->>'resumo', '');

  NEW.calculated_quantity := v_qty;
  NEW.calculated_unit     := v_unit;
  NEW.calc_summary        := v_form;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (drop first to ensure clean state)
DROP TRIGGER IF EXISTS trigger_update_element_quantity ON budget_elements;
CREATE TRIGGER trigger_update_element_quantity
  BEFORE INSERT OR UPDATE OF element_type, params ON budget_elements
  FOR EACH ROW
  EXECUTE FUNCTION update_element_calculated_quantity();
