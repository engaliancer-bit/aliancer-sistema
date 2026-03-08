/*
  # Add Employment Type and Monthly Extra Payments

  1. Changes to Existing Tables
    - Add `employment_type` to `employees` table
      - Values: 'CLT' or 'Pro-labore'
      - Determines INSS calculation (CLT: 11%, Pró-labore: 20%)
  
  2. New Tables
    - `monthly_extra_payments`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `month` (text) - Format: YYYY-MM
      - `payment_type` (text) - Values: '13th_full', '13th_half', 'vacation'
      - `vacation_days` (numeric) - Number of vacation days (only for vacation type)
      - `amount` (numeric) - Calculated payment amount
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on new table
    - Add policies for anonymous access

  4. Important Notes
    - CLT employees: INSS is 11% (employee contribution)
    - Pró-labore: INSS is 20% (self-employed contribution)
    - 13th salary can be paid in full or half installments
    - Vacation payments are proportional to days taken
    - Monthly cost calculation considers actual payments in the month
*/

-- Add employment_type to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'employment_type'
  ) THEN
    ALTER TABLE employees ADD COLUMN employment_type text NOT NULL DEFAULT 'CLT';
  END IF;
END $$;

-- Create monthly_extra_payments table
CREATE TABLE IF NOT EXISTS monthly_extra_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month text NOT NULL,
  payment_type text NOT NULL,
  vacation_days numeric DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_type CHECK (payment_type IN ('13th_full', '13th_half', 'vacation'))
);

ALTER TABLE monthly_extra_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to monthly_extra_payments"
  ON monthly_extra_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_extra_payments_employee_month 
  ON monthly_extra_payments(employee_id, month);

CREATE INDEX IF NOT EXISTS idx_monthly_extra_payments_month 
  ON monthly_extra_payments(month);
