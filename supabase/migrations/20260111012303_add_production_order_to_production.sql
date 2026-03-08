/*
  # Add production order reference to production table

  1. Changes to production table
    - Add `production_order_id` (uuid) - Reference to production order if production is linked to an order
    - Add `production_type` (text) - Type of production: 'stock' (for inventory) or 'order' (for production order)

  2. Notes
    - If production_type is 'order', the production is linked to a production order and won't be added to inventory
    - If production_type is 'stock', the production is for inventory (current behavior)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production' AND column_name = 'production_order_id'
  ) THEN
    ALTER TABLE production ADD COLUMN production_order_id uuid REFERENCES production_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production' AND column_name = 'production_type'
  ) THEN
    ALTER TABLE production ADD COLUMN production_type text NOT NULL DEFAULT 'stock';
  END IF;
END $$;

ALTER TABLE production DROP CONSTRAINT IF EXISTS production_type_check;
ALTER TABLE production ADD CONSTRAINT production_type_check 
  CHECK (production_type IN ('stock', 'order'));

CREATE INDEX IF NOT EXISTS production_order_id_idx ON production(production_order_id);