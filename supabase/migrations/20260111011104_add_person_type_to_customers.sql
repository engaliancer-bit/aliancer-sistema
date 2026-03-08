/*
  # Add person type to customers table

  1. Changes
    - Add `person_type` column to `customers` table
      - Values: 'pf' (Pessoa Física) or 'pj' (Pessoa Jurídica)
      - Default: 'pf'
    - Rename `cpf` column concept to support both CPF and CNPJ
      - Keep column name as `cpf` for backward compatibility, but it will store CPF or CNPJ
    
  2. Notes
    - The `person_type` field determines if the document is CPF (Pessoa Física) or CNPJ (Pessoa Jurídica)
    - Default value is 'pf' for existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'person_type'
  ) THEN
    ALTER TABLE customers ADD COLUMN person_type text NOT NULL DEFAULT 'pf';
  END IF;
END $$;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_person_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_person_type_check CHECK (person_type IN ('pf', 'pj'));