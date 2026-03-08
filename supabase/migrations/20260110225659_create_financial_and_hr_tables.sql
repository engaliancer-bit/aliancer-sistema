/*
  # Create Financial and HR Management Tables

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `name` (text) - Employee name
      - `role` (text) - Job role/position
      - `base_salary` (numeric) - Monthly base salary
      - `benefits` (numeric) - Monthly benefits value
      - `hire_date` (date) - Date of hire
      - `active` (boolean) - Employment status
      - `created_at` (timestamptz)
    
    - `overtime_records`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `hours` (numeric) - Hours worked
      - `rate_multiplier` (numeric) - Overtime rate (1.5, 2.0, etc)
      - `date` (date) - Date of overtime
      - `created_at` (timestamptz)
    
    - `payroll_charges`
      - `id` (uuid, primary key)
      - `name` (text) - Charge name (INSS, FGTS, etc)
      - `percentage` (numeric) - Percentage rate
      - `description` (text) - Description
      - `active` (boolean)
      - `created_at` (timestamptz)
    
    - `indirect_costs`
      - `id` (uuid, primary key)
      - `name` (text) - Cost name
      - `category` (text) - Category: overhead, utilities, maintenance, etc
      - `amount` (numeric) - Monthly amount
      - `allocation_method` (text) - How to allocate: per_unit, per_batch, monthly
      - `active` (boolean)
      - `created_at` (timestamptz)
    
    - `depreciation_assets`
      - `id` (uuid, primary key)
      - `name` (text) - Asset name
      - `purchase_value` (numeric) - Original purchase price
      - `purchase_date` (date)
      - `useful_life_years` (numeric) - Expected useful life
      - `residual_value` (numeric) - Expected value at end of life
      - `active` (boolean)
      - `created_at` (timestamptz)
    
    - `investments`
      - `id` (uuid, primary key)
      - `name` (text) - Investment name
      - `category` (text) - equipment, infrastructure, technology, etc
      - `amount` (numeric) - Investment amount
      - `date` (date) - Investment date
      - `description` (text)
      - `created_at` (timestamptz)
    
    - `production_costs`
      - `id` (uuid, primary key)
      - `production_id` (uuid, foreign key) - Link to production record
      - `material_cost` (numeric) - Total material cost
      - `labor_cost` (numeric) - Total labor cost
      - `indirect_cost` (numeric) - Allocated indirect costs
      - `depreciation_cost` (numeric) - Allocated depreciation
      - `total_cost` (numeric) - Sum of all costs
      - `cost_per_unit` (numeric) - Cost divided by quantity produced
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for anonymous access (as per existing pattern)
*/

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  benefits numeric NOT NULL DEFAULT 0,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to employees"
  ON employees FOR ALL
  USING (true)
  WITH CHECK (true);

-- Overtime records table
CREATE TABLE IF NOT EXISTS overtime_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  hours numeric NOT NULL,
  rate_multiplier numeric NOT NULL DEFAULT 1.5,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to overtime_records"
  ON overtime_records FOR ALL
  USING (true)
  WITH CHECK (true);

-- Payroll charges table (INSS, FGTS, etc)
CREATE TABLE IF NOT EXISTS payroll_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  percentage numeric NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to payroll_charges"
  ON payroll_charges FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indirect costs table
CREATE TABLE IF NOT EXISTS indirect_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  allocation_method text NOT NULL DEFAULT 'monthly',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE indirect_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to indirect_costs"
  ON indirect_costs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Depreciation assets table
CREATE TABLE IF NOT EXISTS depreciation_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purchase_value numeric NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  useful_life_years numeric NOT NULL DEFAULT 10,
  residual_value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE depreciation_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to depreciation_assets"
  ON depreciation_assets FOR ALL
  USING (true)
  WITH CHECK (true);

-- Investments table
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to investments"
  ON investments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Production costs table
CREATE TABLE IF NOT EXISTS production_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES production(id) ON DELETE CASCADE,
  material_cost numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  indirect_cost numeric NOT NULL DEFAULT 0,
  depreciation_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to production_costs"
  ON production_costs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default payroll charges (Brazilian standards)
INSERT INTO payroll_charges (name, percentage, description) VALUES
  ('INSS Empresa', 20.0, 'Contribuição patronal INSS'),
  ('FGTS', 8.0, 'Fundo de Garantia do Tempo de Serviço'),
  ('Férias', 11.11, 'Provisão de férias (1/12 + 1/3)'),
  ('13º Salário', 8.33, 'Provisão de 13º salário (1/12)')
ON CONFLICT DO NOTHING;