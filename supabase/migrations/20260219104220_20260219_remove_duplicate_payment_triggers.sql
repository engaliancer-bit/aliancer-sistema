/*
  # Remove Duplicate Payment Creation Triggers
  
  1. Problem
    - sync_customer_revenue_insert_to_cash_flow and sync_customer_revenue_update_to_cash_flow
    - These triggers create duplicate cash_flow entries when payments are confirmed
    - Result: Payment appears as both debit (zeroed) and credit (duplicate)
  
  2. Solution
    - Remove INSERT trigger on customer_revenue
    - Remove UPDATE trigger on customer_revenue
    - Payment confirmation will happen in-place by updating debit_amount to 0
    - No duplicate entries created
  
  3. Changes
    - Drop trigger: customer_revenue_insert_to_cash_flow
    - Drop trigger: customer_revenue_update_to_cash_flow
    - Drop function: sync_customer_revenue_insert_to_cash_flow
    - Drop function: sync_customer_revenue_update_to_cash_flow
  
  4. Impact
    - Eliminates duplicate lançamentos
    - Payments confirmed in existing cash_flow entry
    - Cleaner audit trail
*/

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS customer_revenue_insert_to_cash_flow ON customer_revenue CASCADE;
DROP TRIGGER IF EXISTS customer_revenue_update_to_cash_flow ON customer_revenue CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS sync_customer_revenue_insert_to_cash_flow() CASCADE;
DROP FUNCTION IF EXISTS sync_customer_revenue_update_to_cash_flow() CASCADE;
