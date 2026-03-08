/*
  # Add mortar types to recipes and recipe_id to budget_global_params

  ## Changes

  ### 1. recipes table
  - Expand the `concrete_type` column CHECK constraint to allow mortar types:
    - 'argamassa_assentamento' - Argamassa de Assentamento
    - 'argamassa_reboco' - Argamassa de Reboco
    - 'argamassa_emboco' - Argamassa de Emboco
    - 'argamassa_chapisco' - Argamassa de Chapisco
    - 'argamassa_contrapiso' - Argamassa de Contrapiso
  - The `specific_weight` field already exists and will be used for all mix types

  ### 2. budget_global_params table
  - Add `recipe_id` column (uuid, nullable FK to recipes)
    - When set, links this budget parameter to a recipe (traco) for automatic material consumption calculation

  ## Security
  - No RLS changes needed (tables already have policies)

  ## Notes
  - We must drop the existing CHECK constraint and recreate it with the expanded set of values
  - All existing data remains intact
*/

-- Step 1: Drop the existing CHECK constraint on concrete_type (if any)
DO $$
BEGIN
  -- Find and drop the check constraint on recipes.concrete_type
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'recipes' AND ccu.column_name = 'concrete_type'
      AND cc.constraint_schema = 'public'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE recipes DROP CONSTRAINT ' || quote_ident(cc.constraint_name)
      FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
      WHERE ccu.table_name = 'recipes' AND ccu.column_name = 'concrete_type'
        AND cc.constraint_schema = 'public'
      LIMIT 1
    );
  END IF;
END $$;

-- Step 2: Add the new expanded CHECK constraint
ALTER TABLE recipes
  ADD CONSTRAINT recipes_concrete_type_check
  CHECK (concrete_type IN (
    'dry',
    'plastic',
    'argamassa_assentamento',
    'argamassa_reboco',
    'argamassa_emboco',
    'argamassa_chapisco',
    'argamassa_contrapiso'
  ));

-- Step 3: Add recipe_id to budget_global_params
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_global_params' AND column_name = 'recipe_id'
  ) THEN
    ALTER TABLE budget_global_params
      ADD COLUMN recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 4: Index for recipe_id lookups
CREATE INDEX IF NOT EXISTS idx_budget_global_params_recipe_id
  ON budget_global_params(recipe_id);
