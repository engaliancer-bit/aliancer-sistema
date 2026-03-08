/*
  # Add Payment Tracking to Quotes System

  1. New Tables
    - `quote_payments`: Individual payment records for each quote
      - `id` (uuid, primary key)
      - `quote_id` (uuid, foreign key to quotes)
      - `payment_amount` (decimal) - Amount paid in this transaction
      - `payment_date` (date) - Date payment was received
      - `payment_method` (text) - Payment method used
      - `receipt_number` (text, nullable) - Receipt or transaction ID
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamp)
      - `created_by` (uuid, nullable) - User who recorded payment

  2. Modified Tables
    - `quotes`: Add columns for payment tracking
      - `paid_amount` (decimal, default 0) - Cumulative payments received
      - `payment_status` (text, default 'unpaid') - 'unpaid' | 'partial' | 'paid'

  3. Functions & Triggers
    - `update_quote_payment_status()`: Auto-calculates payment_status and updates paid_amount
    - Triggers on quote_payments INSERT/UPDATE/DELETE to maintain consistency
    - Automatic sync with customer_revenue table

  4. Security
    - Enable RLS on quote_payments table
    - Public read/write access (matching existing system)
*/

-- Add columns to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE quotes ADD COLUMN paid_amount decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE quotes ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;

-- Create quote_payments table
CREATE TABLE IF NOT EXISTS quote_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  payment_amount decimal(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL CHECK (payment_method IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'cheque', 'transferencia')),
  receipt_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quote_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies - public access matching existing system
CREATE POLICY "Allow public read quote_payments"
  ON quote_payments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert quote_payments"
  ON quote_payments FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update quote_payments"
  ON quote_payments FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete quote_payments"
  ON quote_payments FOR DELETE
  TO public
  USING (true);

-- Create function to update quote payment status
CREATE OR REPLACE FUNCTION update_quote_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid decimal(12,2);
  quote_total decimal(12,2);
  new_status text;
BEGIN
  -- Get total paid for this quote
  SELECT COALESCE(SUM(payment_amount), 0)
  INTO total_paid
  FROM quote_payments
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);

  -- Get quote total value
  SELECT total_value
  INTO quote_total
  FROM quotes
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  -- Determine status
  IF total_paid >= quote_total THEN
    new_status := 'paid';
  ELSIF total_paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'unpaid';
  END IF;

  -- Update quote
  UPDATE quotes
  SET 
    paid_amount = total_paid,
    payment_status = new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_quote_payment_status_insert ON quote_payments;
DROP TRIGGER IF EXISTS trigger_update_quote_payment_status_update ON quote_payments;
DROP TRIGGER IF EXISTS trigger_update_quote_payment_status_delete ON quote_payments;

CREATE TRIGGER trigger_update_quote_payment_status_insert
AFTER INSERT ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_payment_status();

CREATE TRIGGER trigger_update_quote_payment_status_update
AFTER UPDATE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_payment_status();

CREATE TRIGGER trigger_update_quote_payment_status_delete
AFTER DELETE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_payment_status();

-- Create or update customer_revenue entries when quote payments are recorded
CREATE OR REPLACE FUNCTION sync_quote_payment_to_customer_revenue()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_record RECORD;
  v_existing_revenue_id uuid;
BEGIN
  -- Get quote details
  SELECT q.*, c.id as customer_id, c.name as customer_name
  INTO v_quote_record
  FROM quotes q
  JOIN customers c ON q.customer_id = c.id
  WHERE q.id = COALESCE(NEW.quote_id, OLD.quote_id);

  IF v_quote_record IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Check if there's already a customer_revenue record for this quote
  SELECT id INTO v_existing_revenue_id
  FROM customer_revenue
  WHERE origin_type = 'quote' 
  AND origin_id = v_quote_record.id
  LIMIT 1;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Recalculate totals
    WITH payment_totals AS (
      SELECT 
        COALESCE(SUM(payment_amount), 0) as total_paid
      FROM quote_payments
      WHERE quote_id = v_quote_record.id
    )
    INSERT INTO customer_revenue (
      customer_id,
      origin_type,
      origin_id,
      origin_description,
      total_amount,
      paid_amount,
      balance,
      payment_date,
      payment_amount,
      payment_method,
      receipt_number,
      notes
    )
    SELECT
      v_quote_record.customer_id,
      'quote',
      v_quote_record.id,
      'Orçamento #' || v_quote_record.id::text,
      v_quote_record.total_value,
      pt.total_paid,
      v_quote_record.total_value - pt.total_paid,
      NEW.payment_date,
      NEW.payment_amount,
      NEW.payment_method,
      NEW.receipt_number,
      NEW.notes
    FROM payment_totals pt
    ON CONFLICT (quote_id) DO UPDATE
    SET
      paid_amount = EXCLUDED.paid_amount,
      balance = EXCLUDED.balance,
      payment_date = EXCLUDED.payment_date,
      payment_amount = EXCLUDED.payment_amount,
      payment_method = EXCLUDED.payment_method,
      receipt_number = EXCLUDED.receipt_number,
      notes = EXCLUDED.notes,
      updated_at = now();

  ELSIF TG_OP = 'DELETE' THEN
    -- Recalculate totals after deletion
    WITH payment_totals AS (
      SELECT 
        COALESCE(SUM(payment_amount), 0) as total_paid
      FROM quote_payments
      WHERE quote_id = v_quote_record.id
    )
    UPDATE customer_revenue
    SET
      paid_amount = pt.total_paid,
      balance = v_quote_record.total_value - pt.total_paid,
      updated_at = now()
    FROM payment_totals pt
    WHERE origin_type = 'quote'
    AND origin_id = v_quote_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for customer_revenue sync
DROP TRIGGER IF EXISTS trigger_sync_quote_payment_to_revenue ON quote_payments;

CREATE TRIGGER trigger_sync_quote_payment_to_revenue
AFTER INSERT OR UPDATE OR DELETE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION sync_quote_payment_to_customer_revenue();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_id ON quote_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_payment_date ON quote_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_quotes_payment_status ON quotes(payment_status);
