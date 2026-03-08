/*
  # Clean up duplicates and add unique constraint to customer_revenue

  1. Delete duplicate entries, keeping only the most recent one
  2. Add unique constraint on (customer_id, origin_type, origin_id)
  3. Fix the sync trigger to properly handle payment registration
*/

-- Delete duplicates, keeping only the latest by created_at
DELETE FROM customer_revenue cr1
WHERE EXISTS (
  SELECT 1
  FROM customer_revenue cr2
  WHERE cr1.customer_id = cr2.customer_id
    AND cr1.origin_type = cr2.origin_type
    AND cr1.origin_id = cr2.origin_id
    AND cr1.created_at < cr2.created_at
);

-- Add unique constraint for upserts
ALTER TABLE customer_revenue
ADD CONSTRAINT customer_revenue_origin_unique 
UNIQUE (customer_id, origin_type, origin_id);

-- Recreate the trigger function
DROP TRIGGER IF EXISTS trigger_sync_quote_payment_to_revenue ON quote_payments CASCADE;
DROP FUNCTION IF EXISTS sync_quote_payment_to_customer_revenue();

CREATE OR REPLACE FUNCTION sync_quote_payment_to_customer_revenue()
RETURNS TRIGGER AS $$
DECLARE
  v_quote_record RECORD;
  v_total_paid decimal;
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

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Get total paid for this quote
    SELECT COALESCE(SUM(payment_amount), 0)
    INTO v_total_paid
    FROM quote_payments
    WHERE quote_id = v_quote_record.id;

    -- Upsert into customer_revenue
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
    VALUES (
      v_quote_record.customer_id,
      'quote',
      v_quote_record.id,
      'Orçamento #' || v_quote_record.id::text,
      v_quote_record.total_value,
      v_total_paid,
      v_quote_record.total_value - v_total_paid,
      NEW.payment_date,
      NEW.payment_amount,
      NEW.payment_method,
      NEW.receipt_number,
      NEW.notes
    )
    ON CONFLICT (customer_id, origin_type, origin_id) DO UPDATE
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
    -- Get total paid for this quote after deletion
    SELECT COALESCE(SUM(payment_amount), 0)
    INTO v_total_paid
    FROM quote_payments
    WHERE quote_id = v_quote_record.id;

    -- Update customer_revenue
    UPDATE customer_revenue
    SET
      paid_amount = v_total_paid,
      balance = v_quote_record.total_value - v_total_paid,
      updated_at = now()
    WHERE origin_type = 'quote'
    AND origin_id = v_quote_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_quote_payment_to_revenue
AFTER INSERT OR UPDATE OR DELETE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION sync_quote_payment_to_customer_revenue();
