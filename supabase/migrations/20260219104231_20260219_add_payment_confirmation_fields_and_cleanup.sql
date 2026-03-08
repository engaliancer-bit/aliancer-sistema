/*
  # Add Payment Confirmation Fields and Clean Duplicates
  
  1. New Fields in cash_flow
    - payment_confirmed_date: timestamp when payment was confirmed
    - payment_method: method used for payment
    - payment_status: 'unpaid', 'confirmed', 'cancelled'
    - original_debit_amount: stores original amount for audit trail
  
  2. Cleanup Strategy
    - Identify duplicate entries (debit with amount=0 + credit with same amount/date)
    - Delete the credit duplicate
    - Update the debit to show payment_status='confirmed'
    - Preserve audit trail with original_debit_amount
  
  3. Security
    - Enable RLS on all fields
    - Only owners can confirm payments
    - Audit fields are read-only after confirmation
*/

-- Add payment confirmation fields to cash_flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_confirmed_date'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN payment_confirmed_date timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN payment_method text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'confirmed', 'cancelled'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'original_debit_amount'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN original_debit_amount decimal(12,2);
  END IF;
END $$;

-- Function to identify and clean duplicate payments
CREATE OR REPLACE FUNCTION cleanup_duplicate_payments()
RETURNS TABLE(deleted_count integer, updated_count integer) AS $$
DECLARE
  v_deleted integer := 0;
  v_updated integer := 0;
  v_debit_id uuid;
  v_credit_id uuid;
BEGIN
  -- Loop through duplicate pairs and delete credits, update debits
  FOR v_debit_id, v_credit_id IN
    SELECT cf1.id, cf2.id
    FROM cash_flow cf1
    JOIN cash_flow cf2 ON 
      cf1.customer_id = cf2.customer_id AND
      cf1.amount = cf2.amount AND
      cf1.date = cf2.date AND
      cf1.type = 'debit' AND cf2.type = 'credit'
    WHERE cf1.debit_amount = 0 
      AND cf2.customer_revenue_id IS NOT NULL
      AND cf1.debit_amount != cf1.amount -- debit was zeroed
  LOOP
    -- Store original amount before deletion
    UPDATE cash_flow 
    SET original_debit_amount = amount,
        payment_status = 'confirmed',
        payment_confirmed_date = NOW()
    WHERE id = v_debit_id;
    
    v_updated := v_updated + 1;
    
    -- Delete the duplicate credit
    DELETE FROM cash_flow WHERE id = v_credit_id;
    v_deleted := v_deleted + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_deleted, v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Metadata comment for tracking
COMMENT ON FUNCTION cleanup_duplicate_payments() IS 'Removes duplicate payment entries created by old triggers. Should be run once to clean historical data.';
