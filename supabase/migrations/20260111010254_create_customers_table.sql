/*
  # Create customers table

  1. New Tables
    - `customers`
      - `id` (uuid, primary key) - Unique identifier for each customer
      - `name` (text) - Customer full name
      - `cpf` (text, unique) - Brazilian tax identification number
      - `street` (text) - Street address
      - `neighborhood` (text) - Neighborhood/district
      - `city` (text) - City name
      - `email` (text) - Customer email address
      - `phone` (text) - Customer phone number
      - `created_at` (timestamptz) - Timestamp when the customer was registered
      - `updated_at` (timestamptz) - Timestamp when the customer was last updated
      
  2. Security
    - Enable RLS on `customers` table
    - Add policy for public access to read all customers
    - Add policy for public access to insert customers
    - Add policy for public access to update customers
    - Add policy for public access to delete customers
    
  3. Notes
    - CPF field is unique to prevent duplicate customer registrations
    - All fields except id and timestamps are required for complete customer records
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text UNIQUE NOT NULL,
  street text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to customers"
  ON customers
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to customers"
  ON customers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to customers"
  ON customers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to customers"
  ON customers
  FOR DELETE
  USING (true);