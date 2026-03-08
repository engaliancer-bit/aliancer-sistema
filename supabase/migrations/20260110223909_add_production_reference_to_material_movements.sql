/*
  # Add production reference to material movements

  1. Changes
    - Add `production_id` column to material_movements table
    - This links material movements to the production that consumed them
    - When a production is deleted, related movements are automatically deleted (CASCADE)
    - This ensures inventory is automatically corrected when production records are removed

  2. Notes
    - Column is nullable because manual material movements don't have a production reference
    - Foreign key with CASCADE delete ensures data integrity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'material_movements' AND column_name = 'production_id'
  ) THEN
    ALTER TABLE material_movements ADD COLUMN production_id uuid REFERENCES production(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_material_movements_production_id ON material_movements(production_id);
  END IF;
END $$;