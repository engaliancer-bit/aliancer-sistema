/*
  # Add Cancelled Status to Deliveries and Quote Rejection Trigger

  ## Summary
  This migration fixes the stock management issue where rejecting an approved quote
  did not release the reserved stock. It also cleans up orphaned open deliveries
  from already-rejected quotes.

  ## Changes

  ### 1. Modified Tables
  - `deliveries`: Add 'cancelled' to the status CHECK constraint

  ### 2. New Functions
  - `cancel_deliveries_on_quote_rejection()`: Cancels all open/in_progress deliveries
    when a quote status changes from 'approved' to 'rejected', releasing reserved stock.

  ### 3. New Triggers
  - `trigger_cancel_deliveries_on_quote_rejection`: Fires AFTER UPDATE on quotes table
    whenever status changes to 'rejected'

  ### 4. Retroactive Cleanup
  - Cancels any existing open deliveries linked to already-rejected quotes
    (orphaned reservations from before this fix)

  ## Important Notes
  1. The product_stock_view already filters by status IN ('open', 'in_progress'),
     so cancelled deliveries are automatically excluded from stock calculations.
  2. This is non-destructive - deliveries are SET to 'cancelled', not deleted,
     preserving audit history.
*/

-- Step 1: Drop the existing CHECK constraint and add the new one with 'cancelled'
ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled'));

-- Step 2: Create the function to cancel deliveries when a quote is rejected
CREATE OR REPLACE FUNCTION cancel_deliveries_on_quote_rejection()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status changes TO 'rejected' FROM 'approved'
  IF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    UPDATE deliveries
    SET 
      status = 'cancelled',
      updated_at = NOW()
    WHERE 
      quote_id = NEW.id
      AND status IN ('open', 'in_progress');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger on the quotes table
DROP TRIGGER IF EXISTS trigger_cancel_deliveries_on_quote_rejection ON quotes;

CREATE TRIGGER trigger_cancel_deliveries_on_quote_rejection
  AFTER UPDATE OF status ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION cancel_deliveries_on_quote_rejection();

-- Step 4: Retroactively cancel orphaned open deliveries from already-rejected quotes
UPDATE deliveries d
SET 
  status = 'cancelled',
  updated_at = NOW()
FROM quotes q
WHERE 
  d.quote_id = q.id
  AND q.status = 'rejected'
  AND d.status IN ('open', 'in_progress');
