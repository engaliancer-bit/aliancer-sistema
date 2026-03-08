/*
  # Update quotes.paid_amount when payments are recorded

  1. Issue: When recording payments, quotes.paid_amount was not being updated
  2. This caused the statement to show incorrect payment amounts
  3. Solution: Add trigger to update quotes.paid_amount from quote_payments total
*/

-- Create or update trigger function to sync paid_amount to quotes
DROP TRIGGER IF EXISTS trigger_update_quote_paid_amount ON quote_payments CASCADE;
DROP FUNCTION IF EXISTS update_quote_paid_amount();

CREATE OR REPLACE FUNCTION update_quote_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid decimal;
BEGIN
  -- Get total paid for this quote
  SELECT COALESCE(SUM(payment_amount), 0)
  INTO v_total_paid
  FROM quote_payments
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);

  -- Update quotes.paid_amount
  UPDATE quotes
  SET 
    paid_amount = v_total_paid,
    payment_status = CASE
      WHEN v_total_paid >= total_value THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    updated_at = now()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quote_paid_amount
AFTER INSERT OR UPDATE OR DELETE ON quote_payments
FOR EACH ROW
EXECUTE FUNCTION update_quote_paid_amount();

-- Also update customer_revenue payment_amount to match actual balance
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
    -- Get total paid for this quote (after this payment is recorded)
    SELECT COALESCE(SUM(payment_amount), 0)
    INTO v_total_paid
    FROM quote_payments
    WHERE quote_id = v_quote_record.id;

    -- Upsert into customer_revenue with latest payment info
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
      total_amount = EXCLUDED.total_amount,
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
      payment_date = CURRENT_DATE,
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

-- Backfill: Update all quotes.paid_amount from quote_payments
UPDATE quotes q
SET 
  paid_amount = COALESCE((
    SELECT SUM(qp.payment_amount)
    FROM quote_payments qp
    WHERE qp.quote_id = q.id
  ), 0),
  payment_status = CASE
    WHEN COALESCE((
      SELECT SUM(qp.payment_amount)
      FROM quote_payments qp
      WHERE qp.quote_id = q.id
    ), 0) >= q.total_value THEN 'paid'
    WHEN COALESCE((
      SELECT SUM(qp.payment_amount)
      FROM quote_payments qp
      WHERE qp.quote_id = q.id
    ), 0) > 0 THEN 'partial'
    ELSE 'unpaid'
  END,
  updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM quote_payments WHERE quote_id = q.id
);
