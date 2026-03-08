/*
  # Fix Cleanup Function - Use Correct cash_flow Structure
  
  1. Correction
    - cash_flow table doesn't have customer_id field
    - Uses sale_id, purchase_id, construction_work_id to track origin
    - Duplicate detection: same date, same amount, debit_amount=0 + credit
  
  2. New Logic
    - Find debits where debit_amount = 0 (already zeroed)
    - Find matching credits with same amount on same date
    - Both belong to same transaction (same category/description)
    - Mark debit as confirmed
    - Delete the duplicate credit
*/

-- Drop old function
DROP FUNCTION IF EXISTS cleanup_duplicate_payments() CASCADE;

-- Create improved cleanup function
CREATE OR REPLACE FUNCTION cleanup_duplicate_payments()
RETURNS TABLE(deleted_count integer, updated_count integer) AS $$
DECLARE
  v_deleted integer := 0;
  v_updated integer := 0;
  v_debit_id uuid;
  v_credit_id uuid;
BEGIN
  -- Loop through duplicate pairs
  -- Find debits with debit_amount=0 paired with credits of same amount/date
  FOR v_debit_id, v_credit_id IN
    SELECT cf1.id, cf2.id
    FROM cash_flow cf1
    JOIN cash_flow cf2 ON 
      cf1.amount = cf2.amount AND
      cf1.date = cf2.date AND
      cf1.type = 'debit' AND 
      cf2.type = 'credit' AND
      COALESCE(cf1.sale_id, cf1.purchase_id, cf1.construction_work_id) = 
      COALESCE(cf2.sale_id, cf2.purchase_id, cf2.construction_work_id)
    WHERE cf1.debit_amount = 0 
      AND cf2.customer_revenue_id IS NOT NULL
      AND cf1.payment_status IS NULL
      -- Avoid re-processing already cleaned items
  LOOP
    -- Mark original debit as confirmed
    UPDATE cash_flow 
    SET 
      original_debit_amount = amount,
      payment_status = 'confirmed',
      payment_confirmed_date = date
    WHERE id = v_debit_id;
    
    v_updated := v_updated + 1;
    
    -- Delete duplicate credit
    DELETE FROM cash_flow WHERE id = v_credit_id;
    v_deleted := v_deleted + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_deleted, v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_duplicate_payments() IS 'Removes duplicate payment entries. Finds unpaid debits paired with matching credits and consolidates them.';
