
/*
  # Fix missing revenue_id in customer_statement
  
  1. Problem
    - 11 entries in customer_statement have NULL revenue_id
    - These need to be linked with their corresponding customer_revenue records
  
  2. Solution
    - Update each statement entry with the matching revenue_id
    - Match based on customer_id, reference_type, and reference_id
    - This allows the refund button to display properly in the customer statement
    
  3. Data Corrections
    - Multiple statement entries can point to the same revenue record
    - This is valid for partial payments in construction work
*/

UPDATE customer_statement cs
SET revenue_id = cr.id
FROM customer_revenue cr
WHERE cs.revenue_id IS NULL
  AND cs.customer_id = cr.customer_id
  AND cs.reference_type = cr.origin_type
  AND cs.reference_id = cr.origin_id
  AND cs.transaction_type = 'payment';

-- Verify the update
SELECT 
  COUNT(*) as total_entries,
  COUNT(revenue_id) as entries_with_revenue_id,
  COUNT(*) - COUNT(revenue_id) as entries_still_without_revenue_id
FROM customer_statement;
