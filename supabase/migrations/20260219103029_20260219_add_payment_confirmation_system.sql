/*
  # Add Payment Confirmation System to Cash Flow

  1. New Columns
    - `payment_status` (text): Track confirmation status (pendente, confirmado, cancelado)
    - `payment_confirmed_date` (date): When payment was confirmed
    - `payment_confirmed_by` (uuid): Which user confirmed the payment
  
  2. Changes
    - Add columns to cash_flow table
    - Create indexes for performance
    - Set default values for existing records
    - Maintain backward compatibility

  3. Security
    - RLS policies already in place for cash_flow table
    - Audit trail via payment_confirmed_by column

  4. Migration Strategy
    - All new columns are nullable to maintain existing data integrity
    - Default status is 'pendente' for new records
    - Existing records will have NULL status (treated as 'pendente')
*/

DO $$
BEGIN
  -- Add payment_status column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE cash_flow
    ADD COLUMN payment_status text DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'confirmado', 'cancelado'));
  END IF;

  -- Add payment_confirmed_date column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_confirmed_date'
  ) THEN
    ALTER TABLE cash_flow
    ADD COLUMN payment_confirmed_date date;
  END IF;

  -- Add payment_confirmed_by column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_confirmed_by'
  ) THEN
    ALTER TABLE cash_flow
    ADD COLUMN payment_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Create index for payment_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cash_flow' AND indexname = 'idx_cash_flow_payment_status'
  ) THEN
    CREATE INDEX idx_cash_flow_payment_status ON cash_flow(payment_status);
  END IF;

  -- Create index for payment_confirmed_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cash_flow' AND indexname = 'idx_cash_flow_payment_confirmed_date'
  ) THEN
    CREATE INDEX idx_cash_flow_payment_confirmed_date ON cash_flow(payment_confirmed_date);
  END IF;

  -- Create composite index for common queries if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cash_flow' AND indexname = 'idx_cash_flow_payment_queries'
  ) THEN
    CREATE INDEX idx_cash_flow_payment_queries ON cash_flow(date, payment_status);
  END IF;

END $$;
