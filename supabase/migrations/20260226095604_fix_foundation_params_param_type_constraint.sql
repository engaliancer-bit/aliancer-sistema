/*
  # Fix budget_foundation_params param_type constraint

  ## Problem
  The param_type CHECK constraint was missing several valid types:
  - estaca
  - tubulao
  - viga_cinta
  - verga

  ## Changes
  - Drop the existing param_type check constraint
  - Recreate it with all valid types
*/

ALTER TABLE budget_foundation_params DROP CONSTRAINT IF EXISTS budget_foundation_params_param_type_check;

ALTER TABLE budget_foundation_params ADD CONSTRAINT budget_foundation_params_param_type_check
  CHECK (param_type = ANY (ARRAY[
    'sapata', 'baldrame', 'pilar', 'pilar_fundacao', 'alicerce',
    'estaca', 'tubulao', 'viga_cinta', 'verga'
  ]));
