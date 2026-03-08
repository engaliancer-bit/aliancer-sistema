/*
  # Payment Receipt Generation System

  1. New Tables
    - `payment_receipts`
      - `id` (uuid, primary key) - Receipt unique identifier
      - `payment_id` (uuid, foreign key to engineering_project_payments)
      - `receipt_number` (integer) - Sequential receipt number
      - `qr_code_data` (text) - JSON encoded QR code authentication data
      - `company_name` (text) - Company name at time of generation
      - `generated_by_user_id` (uuid) - User who generated the receipt
      - `generated_at` (timestamptz) - Receipt generation timestamp

  2. Changes to Existing Tables
    - Add `receipt_number` column to `engineering_project_payments`
    - Add `receipt_generated_at` column for tracking when receipt was generated

  3. Security
    - Enable RLS on `payment_receipts` table
    - Public access for reading receipt data (needed for verification)
    - Authenticated users can create receipts

  4. Indexes
    - Index on `payment_id` for fast lookups
    - Index on `receipt_number` for sequential generation
    - Index on `generated_at` for chronological queries

  5. Helper Functions
    - `get_next_receipt_number()` - Returns next sequential receipt number
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_receipts') THEN
    CREATE TABLE payment_receipts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id uuid NOT NULL REFERENCES engineering_project_payments(id) ON DELETE CASCADE,
      receipt_number integer NOT NULL UNIQUE,
      qr_code_data text NOT NULL,
      company_name text NOT NULL DEFAULT 'ALIANCER ENGENHARIA E TOPOGRAFIA LTDA',
      generated_by_user_id uuid,
      generated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz DEFAULT now(),
      UNIQUE(payment_id)
    );

    ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Public can read payment receipts"
      ON payment_receipts FOR SELECT
      USING (true);

    CREATE POLICY "Authenticated users can create receipts"
      ON payment_receipts FOR INSERT
      TO authenticated
      WITH CHECK (true);

    CREATE INDEX idx_payment_receipts_payment_id ON payment_receipts(payment_id);
    CREATE INDEX idx_payment_receipts_receipt_number ON payment_receipts(receipt_number);
    CREATE INDEX idx_payment_receipts_generated_at ON payment_receipts(generated_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_project_payments' AND column_name = 'receipt_number'
  ) THEN
    ALTER TABLE engineering_project_payments ADD COLUMN receipt_number integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_project_payments' AND column_name = 'receipt_generated_at'
  ) THEN
    ALTER TABLE engineering_project_payments ADD COLUMN receipt_generated_at timestamptz;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_next_receipt_number()
RETURNS integer AS $$
BEGIN
  RETURN COALESCE((SELECT MAX(receipt_number) FROM payment_receipts), 0) + 1;
END;
$$ LANGUAGE plpgsql;
