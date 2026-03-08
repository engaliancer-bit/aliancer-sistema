/*
  # Add customer_id column to cash_flow

  1. Modified Tables
    - `cash_flow`
      - Added `customer_id` (uuid, nullable) - Links a cash flow entry directly to a customer
      - Added foreign key constraint to `customers.id`

  2. Indexes
    - Added index on `customer_id` for efficient customer-based lookups

  3. Notes
    - This allows factory revenue entries to be linked to specific customers
    - The existing `construction_work_id` column can then be used in conjunction
      to link revenue to a customer's specific construction work
    - All existing data remains unaffected (column is nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_flow_customer_id ON cash_flow(customer_id);
