/*
  # Add recipe_id and caixaria_items to budget_foundation_params

  ## Summary
  Extends the foundation parameter models to support:
  1. A per-model concrete recipe (traco) override via recipe_id
  2. Custom caixaria (formwork) items stored in the dimensions JSON

  ## Changes
  ### Modified Tables
  - `budget_foundation_params`:
    - New column `recipe_id` (uuid, nullable) — FK to recipes table, allows per-model recipe override
    - The `dimensions` JSONB column already stores arbitrary fields; caixaria_items will be stored there

  ## Security
  - No RLS changes needed (table already has RLS policies)
  
  ## Notes
  - recipe_id is nullable: if NULL, the system falls back to the global param (traco_concreto_sapata etc.)
  - caixaria_items are stored inside the dimensions JSONB as an array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_foundation_params' AND column_name = 'recipe_id'
  ) THEN
    ALTER TABLE budget_foundation_params
      ADD COLUMN recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budget_foundation_params_recipe_id
  ON budget_foundation_params(recipe_id)
  WHERE recipe_id IS NOT NULL;
