/*
  # Add Business Unit to Employees Table

  1. Changes
    - Add `business_unit` column to `employees` table
      - Values: 'factory', 'engineering', 'construction'
      - Default: 'factory' (for backward compatibility with existing records)
      - Allows tracking which business unit each employee belongs to
  
  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'business_unit'
  ) THEN
    ALTER TABLE employees ADD COLUMN business_unit text NOT NULL DEFAULT 'factory';
    
    ALTER TABLE employees ADD CONSTRAINT employees_business_unit_check 
      CHECK (business_unit IN ('factory', 'engineering', 'construction'));
  END IF;
END $$;