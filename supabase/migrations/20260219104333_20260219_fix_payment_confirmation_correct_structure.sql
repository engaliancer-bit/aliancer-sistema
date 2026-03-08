/*
  # Fix Payment Confirmation - Use Correct cash_flow Structure
  
  1. Previous Mistake
    - Tried to add debit_amount column, but cash_flow uses type='income'/'expense' and amount
    - No customer_id field - uses sale_id, purchase_id, construction_work_id
  
  2. Correct Approach
    - cash_flow already has payment_status, payment_confirmed_date, payment_method fields
    - Just need to ensure we use them correctly
    - Remove incorrect columns and use existing structure
  
  3. New Fields (if not exist)
    - payment_confirmed_by: user who confirmed
    - original_amount: store original for audit
    - Payment confirmation: set payment_status='confirmed' and keep amount as-is
*/

-- Remove incorrect columns if they were added
DO $$
BEGIN
  -- Remove payment_confirmed_by if it's the wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_confirmed_by'
    AND data_type != 'uuid'
  ) THEN
    ALTER TABLE cash_flow DROP COLUMN IF EXISTS payment_confirmed_by;
  END IF;
END $$;

-- Add correct payment_confirmed_by if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'payment_confirmed_by'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN payment_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add original_amount if missing (to store original payment value)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'original_amount'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN original_amount numeric(12,2);
  END IF;
END $$;

-- Drop old incorrect function
DROP FUNCTION IF EXISTS cleanup_duplicate_payments() CASCADE;

-- Create new cleanup function for the real structure
CREATE OR REPLACE FUNCTION cleanup_duplicate_payments()
RETURNS TABLE(duplicate_pairs_found integer, cleaned integer) AS $$
DECLARE
  v_duplicate_pairs integer := 0;
  v_cleaned integer := 0;
  v_income_id uuid;
  v_expense_id uuid;
BEGIN
  -- Find duplicate payment entries:
  -- income entry (type='income') matched with expense entry (type='expense')
  -- Same amount, same date, same reference (sale_id/purchase_id/construction_work_id)
  -- Only clean if income has payment_status != 'confirmed'
  
  FOR v_income_id, v_expense_id IN
    SELECT cf_income.id, cf_expense.id
    FROM cash_flow cf_income
    JOIN cash_flow cf_expense ON 
      cf_income.amount = cf_expense.amount AND
      cf_income.date = cf_expense.date AND
      cf_income.type = 'income' AND 
      cf_expense.type = 'expense' AND
      COALESCE(cf_income.sale_id, '') = COALESCE(cf_expense.sale_id, '') AND
      COALESCE(cf_income.purchase_id, '') = COALESCE(cf_expense.purchase_id, '')
    WHERE cf_income.payment_status IS NULL 
      AND cf_expense.payment_status IS NULL
      AND cf_income.customer_revenue_id IS NOT NULL
  LOOP
    v_duplicate_pairs := v_duplicate_pairs + 1;
    
    -- Mark income as confirmed (payment received)
    UPDATE cash_flow 
    SET 
      payment_status = 'confirmed',
      original_amount = amount
    WHERE id = v_income_id;
    
    -- Delete the duplicate expense entry
    DELETE FROM cash_flow WHERE id = v_expense_id;
    v_cleaned := v_cleaned + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_duplicate_pairs, v_cleaned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_duplicate_payments() IS 'Removes duplicate income/expense pairs created by old sync triggers.';
