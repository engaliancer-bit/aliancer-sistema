-- =============================================================================
-- MIGRATION: Fix Production Integer Types and Create Sub-Orders Table
-- Execute this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/<YOUR_PROJECT>/sql
-- =============================================================================

-- 1. Convert production_order_items.quantity to NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_order_items' AND column_name = 'quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE production_order_items ALTER COLUMN quantity TYPE NUMERIC(10,3) USING quantity::NUMERIC(10,3);
  END IF;
END $$;

-- 2. Convert production_order_items.produced_quantity to NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_order_items' AND column_name = 'produced_quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE production_order_items ALTER COLUMN produced_quantity TYPE NUMERIC(10,3) USING produced_quantity::NUMERIC(10,3);
  END IF;
END $$;

-- 3. Convert production_orders.total_quantity to NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'total_quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE production_orders ALTER COLUMN total_quantity TYPE NUMERIC(10,3) USING total_quantity::NUMERIC(10,3);
  END IF;
END $$;

-- 4. Convert production_orders.produced_quantity to NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'produced_quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE production_orders ALTER COLUMN produced_quantity TYPE NUMERIC(10,3) USING produced_quantity::NUMERIC(10,3);
  END IF;
END $$;

-- 5. Convert production_orders.remaining_quantity to NUMERIC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'remaining_quantity' AND data_type = 'integer'
  ) THEN
    ALTER TABLE production_orders ALTER COLUMN remaining_quantity TYPE NUMERIC(10,3) USING remaining_quantity::NUMERIC(10,3);
  END IF;
END $$;

-- 6. Create production_sub_orders table
CREATE TABLE IF NOT EXISTS production_sub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  production_order_item_id uuid NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  total_in_item integer NOT NULL,
  qr_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  produced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT production_sub_orders_qr_token_unique UNIQUE (qr_token)
);

-- 7. Enable RLS
ALTER TABLE production_sub_orders ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_sub_orders' AND policyname = 'Anyone can view production sub orders') THEN
    CREATE POLICY "Anyone can view production sub orders" ON production_sub_orders FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_sub_orders' AND policyname = 'Anyone can insert production sub orders') THEN
    CREATE POLICY "Anyone can insert production sub orders" ON production_sub_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_sub_orders' AND policyname = 'Anyone can update production sub orders') THEN
    CREATE POLICY "Anyone can update production sub orders" ON production_sub_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_sub_orders' AND policyname = 'Anyone can delete production sub orders') THEN
    CREATE POLICY "Anyone can delete production sub orders" ON production_sub_orders FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

-- 9. Performance indexes
CREATE INDEX IF NOT EXISTS idx_production_sub_orders_order_id ON production_sub_orders(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_sub_orders_item_id ON production_sub_orders(production_order_item_id);
CREATE INDEX IF NOT EXISTS idx_production_sub_orders_qr_token ON production_sub_orders(qr_token);

-- Done!
