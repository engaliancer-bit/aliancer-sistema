/*
  # Add Sales Prices and Targets

  1. Changes to Existing Tables
    - `products`
      - Add `sale_price` (numeric) - Selling price per unit
      - Add `margin_percentage` (numeric) - Profit margin percentage
      - Add `last_price_update` (timestamptz) - When price was last updated
  
  2. New Tables
    - `sales_targets`
      - `id` (uuid, primary key)
      - `year` (integer) - Target year
      - `month` (integer) - Target month (1-12)
      - `target_amount` (numeric) - Financial target for the period
      - `target_units` (numeric) - Units target for the period (optional)
      - `description` (text) - Description of the target
      - `created_at` (timestamptz)
    
    - `daily_sales_summary`
      - `id` (uuid, primary key)
      - `date` (date) - Summary date
      - `total_produced_value` (numeric) - Total value of production
      - `total_units` (numeric) - Total units produced
      - `total_cost` (numeric) - Total production cost
      - `gross_profit` (numeric) - Profit before expenses
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on all new tables
    - Add policies for anonymous access
*/

-- Add sale price fields to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sale_price'
  ) THEN
    ALTER TABLE products ADD COLUMN sale_price numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'margin_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN margin_percentage numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'last_price_update'
  ) THEN
    ALTER TABLE products ADD COLUMN last_price_update timestamptz DEFAULT now();
  END IF;
END $$;

-- Sales targets table
CREATE TABLE IF NOT EXISTS sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  target_units numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to sales_targets"
  ON sales_targets FOR ALL
  USING (true)
  WITH CHECK (true);

-- Daily sales summary table
CREATE TABLE IF NOT EXISTS daily_sales_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  total_produced_value numeric NOT NULL DEFAULT 0,
  total_units numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  gross_profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_sales_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to daily_sales_summary"
  ON daily_sales_summary FOR ALL
  USING (true)
  WITH CHECK (true);