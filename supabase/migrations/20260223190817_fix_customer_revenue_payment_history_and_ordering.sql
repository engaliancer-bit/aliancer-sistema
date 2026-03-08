/*
  # Fix Customer Revenue Payment History

  ## Summary
  Refactor the customer_revenue table to properly support multiple payment records
  per debt source (payment history), fix ordering by created_at, and add cash_flow
  integration trigger.

  ## Changes

  1. Drop the unique constraint that prevented multiple payments per debt
  2. Add a cash_flow trigger that creates an income entry whenever a customer_revenue
     record is inserted, and removes it when deleted
  3. Ensure the customer_statement trigger fires only on INSERT (not UPDATE)

  ## Notes
  - Existing records are preserved
  - The unique constraint is dropped to allow proper payment history (multiple payments per debt)
  - Each new payment gets its own row, building a proper audit trail
*/

-- Drop the unique constraint that prevents multiple payments per debt source
ALTER TABLE customer_revenue DROP CONSTRAINT IF EXISTS customer_revenue_origin_unique;

-- Create function to sync customer_revenue inserts to cash_flow
CREATE OR REPLACE FUNCTION sync_customer_revenue_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_business_unit text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_business_unit := CASE
      WHEN NEW.origin_type IN ('quote', 'ribbed_slab_quote') THEN 'factory'
      WHEN NEW.origin_type = 'construction_work' THEN 'construction'
      ELSE 'factory'
    END;

    INSERT INTO cash_flow (
      type,
      amount,
      description,
      date,
      payment_method,
      business_unit,
      customer_revenue_id
    ) VALUES (
      'income',
      NEW.payment_amount,
      'Recebimento: ' || COALESCE(NEW.origin_description, 'Cliente'),
      NEW.payment_date,
      COALESCE(NEW.payment_method, 'outros'),
      v_business_unit,
      NEW.id
    )
    ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM cash_flow WHERE customer_revenue_id = OLD.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_revenue_cash_flow ON customer_revenue;

CREATE TRIGGER trigger_sync_customer_revenue_cash_flow
  AFTER INSERT OR DELETE ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_revenue_to_cash_flow();

-- Fix the customer_statement trigger to only fire on INSERT (avoid duplicates on UPDATE)
DROP TRIGGER IF EXISTS trigger_create_statement_from_revenue ON customer_revenue;

CREATE TRIGGER trigger_create_statement_from_revenue
  AFTER INSERT ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION create_statement_entry_from_revenue();

-- Add index for efficient ordering by created_at
CREATE INDEX IF NOT EXISTS idx_customer_revenue_created_at 
  ON customer_revenue (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_revenue_customer_created 
  ON customer_revenue (customer_id, created_at DESC);
