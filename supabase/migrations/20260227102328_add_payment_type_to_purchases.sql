/*
  # Add payment_type to purchases table

  1. Modified Tables
    - `purchases`
      - `payment_type` (text, default 'vista') - tracks if invoice was paid cash or installments
      - `installments_count` (integer, default 1) - number of installments for the invoice

  2. Purpose
    - Allows tracking payment method at the invoice (nota fiscal) level
    - Supports unified installment payments across all items in a single invoice
    - Previously, each item generated separate installments; now the invoice total is split

  3. Important Notes
    - Existing rows default to 'vista' (cash payment)
    - No data is lost or modified
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE purchases ADD COLUMN payment_type text DEFAULT 'vista';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'installments_count'
  ) THEN
    ALTER TABLE purchases ADD COLUMN installments_count integer DEFAULT 1;
  END IF;
END $$;
