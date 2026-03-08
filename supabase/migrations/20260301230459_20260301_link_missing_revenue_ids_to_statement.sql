
/*
  # Link missing revenue_id to customer_statement entries
  
  1. Problem
    - 11 entries in customer_statement have NULL revenue_id
    - These were created before the revenue_id column was populated
    - The button to refund payments depends on revenue_id being set
  
  2. Solution
    - Match customer_statement entries with customer_revenue records
    - Use transaction_date, customer_id, reference_type, and credit_amount to match
    - Update the revenue_id field in customer_statement
  
  3. Important Notes
    - Only updates entries that have NULL revenue_id
    - Matches based on customer_id, transaction_type, transaction_date, and credit_amount
    - This allows the refund button to display properly in the customer statement
*/

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE customer_statement cs
  SET revenue_id = cr.id
  FROM customer_revenue cr
  WHERE cs.revenue_id IS NULL
    AND cs.customer_id = cr.customer_id
    AND cs.transaction_date = cr.payment_date
    AND cs.credit_amount = cr.payment_amount
    AND cs.transaction_type = 'payment'
    AND cr.origin_type = cs.reference_type
    AND cr.origin_id = cs.reference_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RAISE NOTICE 'Successfully linked % customer_statement entries with customer_revenue', v_count;
END $$;
