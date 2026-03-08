/*
  # Add quantity field to quotes table

  1. Changes to quotes table
    - Add `quantity` (integer) - Quantity of products in the quote

  2. Notes
    - Default value is 0
    - Required field for generating production orders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quantity integer NOT NULL DEFAULT 0;
  END IF;
END $$;