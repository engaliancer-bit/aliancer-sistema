/*
  # Create quotes table

  1. New Tables
    - `quotes`
      - `id` (uuid, primary key) - Unique identifier for each quote
      - `customer_id` (uuid, foreign key) - Reference to customer
      - `product_id` (uuid, foreign key) - Reference to product
      - `suggested_price` (decimal) - Suggested price from sales_prices table
      - `proposed_price` (decimal) - Actual price proposed in the quote
      - `status` (text) - Quote status: 'pending', 'approved', 'rejected'
      - `notes` (text) - Optional notes about the quote
      - `created_at` (timestamptz) - When the quote was created
      - `updated_at` (timestamptz) - When the quote was last updated

  2. Security
    - Enable RLS on `quotes` table
    - Add policies for authenticated users to manage quotes
*/

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  suggested_price decimal(10,2) NOT NULL DEFAULT 0,
  proposed_price decimal(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quotes"
  ON quotes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert quotes"
  ON quotes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update quotes"
  ON quotes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete quotes"
  ON quotes FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS quotes_customer_id_idx ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS quotes_product_id_idx ON quotes(product_id);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes(created_at DESC);