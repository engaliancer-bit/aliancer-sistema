/*
  # Add movement_date column to material_movements

  1. Changes
    - Add `movement_date` column to track when the movement actually occurred
    - This is separate from `created_at` which tracks when the record was created
    - Defaults to current date for existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'material_movements' AND column_name = 'movement_date'
  ) THEN
    ALTER TABLE material_movements ADD COLUMN movement_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;