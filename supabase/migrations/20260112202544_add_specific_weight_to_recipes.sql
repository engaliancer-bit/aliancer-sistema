/*
  # Add specific weight to recipes

  1. Changes
    - Add `specific_weight` column to `recipes` table
      - Type: numeric (decimal)
      - Default: 0
      - Represents the specific weight of concrete in kg/m³
      - Used to calculate total product weight from concrete volume
  
  2. Purpose
    - Enable automatic calculation of product weight for premolded items
    - Weight = specific_weight × concrete_volume_m3
    - This weight is then used for material cost calculations
*/

-- Add specific_weight column to recipes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'specific_weight'
  ) THEN
    ALTER TABLE recipes ADD COLUMN specific_weight numeric DEFAULT 0;
  END IF;
END $$;