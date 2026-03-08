/*
  # Create production orders table and update quotes

  1. New Tables
    - `production_orders`
      - `id` (uuid, primary key) - Unique identifier for each production order
      - `quote_id` (uuid, foreign key) - Reference to the quote that generated this order
      - `customer_id` (uuid, foreign key) - Reference to customer
      - `product_id` (uuid, foreign key) - Reference to product being produced
      - `total_quantity` (integer) - Total quantity ordered
      - `produced_quantity` (integer) - Quantity already produced
      - `remaining_quantity` (integer) - Quantity remaining to produce
      - `status` (text) - Order status: 'open', 'in_progress', 'completed', 'cancelled'
      - `notes` (text) - Optional notes
      - `created_at` (timestamptz) - When the order was created
      - `updated_at` (timestamptz) - When the order was last updated
      - `completed_at` (timestamptz) - When the order was completed

  2. Changes to quotes table
    - Add `production_order_id` (uuid) - Reference to production order if generated

  3. Security
    - Enable RLS on `production_orders` table
    - Add policies for anonymous and authenticated users to manage production orders

  4. Indexes
    - Add indexes for improved query performance on customer_id, product_id, and status
*/

CREATE TABLE IF NOT EXISTS production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  total_quantity integer NOT NULL DEFAULT 0,
  produced_quantity integer NOT NULL DEFAULT 0,
  remaining_quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check;
ALTER TABLE production_orders ADD CONSTRAINT production_orders_status_check 
  CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'production_order_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN production_order_id uuid REFERENCES production_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view production orders"
  ON production_orders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert production orders"
  ON production_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update production orders"
  ON production_orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete production orders"
  ON production_orders FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS production_orders_customer_id_idx ON production_orders(customer_id);
CREATE INDEX IF NOT EXISTS production_orders_product_id_idx ON production_orders(product_id);
CREATE INDEX IF NOT EXISTS production_orders_status_idx ON production_orders(status);
CREATE INDEX IF NOT EXISTS production_orders_quote_id_idx ON production_orders(quote_id);
CREATE INDEX IF NOT EXISTS production_orders_created_at_idx ON production_orders(created_at DESC);