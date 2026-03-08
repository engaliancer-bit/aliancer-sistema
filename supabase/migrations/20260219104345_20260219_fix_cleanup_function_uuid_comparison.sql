/*
  # Fix Cleanup Function - Proper UUID Comparison
  
  Use COALESCE with NULL instead of empty string for UUID fields
*/

DROP FUNCTION IF EXISTS cleanup_duplicate_payments() CASCADE;

CREATE OR REPLACE FUNCTION cleanup_duplicate_payments()
RETURNS TABLE(duplicate_pairs_found integer, cleaned integer) AS $$
DECLARE
  v_duplicate_pairs integer := 0;
  v_cleaned integer := 0;
  v_income_id uuid;
  v_expense_id uuid;
BEGIN
  -- Find duplicate payment entries with proper NULL handling for UUIDs
  FOR v_income_id, v_expense_id IN
    SELECT cf_income.id, cf_expense.id
    FROM cash_flow cf_income
    JOIN cash_flow cf_expense ON 
      cf_income.amount = cf_expense.amount AND
      cf_income.date = cf_expense.date AND
      cf_income.type = 'income' AND 
      cf_expense.type = 'expense' AND
      COALESCE(cf_income.sale_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
        COALESCE(cf_expense.sale_id, '00000000-0000-0000-0000-000000000000'::uuid) AND
      COALESCE(cf_income.purchase_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
        COALESCE(cf_expense.purchase_id, '00000000-0000-0000-0000-000000000000'::uuid)
    WHERE cf_income.payment_status IS NULL 
      AND cf_expense.payment_status IS NULL
      AND cf_income.customer_revenue_id IS NOT NULL
  LOOP
    v_duplicate_pairs := v_duplicate_pairs + 1;
    
    UPDATE cash_flow 
    SET 
      payment_status = 'confirmed',
      original_amount = amount
    WHERE id = v_income_id;
    
    DELETE FROM cash_flow WHERE id = v_expense_id;
    v_cleaned := v_cleaned + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_duplicate_pairs, v_cleaned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
