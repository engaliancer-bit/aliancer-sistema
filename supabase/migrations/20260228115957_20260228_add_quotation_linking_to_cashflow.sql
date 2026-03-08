/*
  # Add Quotation Linking to Cash Flow

  1. New Columns
    - Add `quotation_id` column to `cash_flow` table to link income entries to approved quotations
    - This enables direct payment recording against quotations during revenue entry
  
  2. Relationships
    - Links `cash_flow.quotation_id` to `quotes.id`
    - When a payment is recorded against a quotation:
      - A corresponding entry is created in `quote_payments` table
      - Existing triggers automatically update `quotes.paid_amount` and `customer_revenue`
  
  3. Purpose
    - Allows users to link revenue entries directly to approved quotations
    - Automatically registers payments without requiring manual entry in customer statement
    - Improves workflow efficiency for factory finance module
  
  4. Notes
    - Column is nullable to maintain backward compatibility
    - Should only be populated for income entries (type = 'income')
    - Quotation must be status 'approved' and belong to the entry's customer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'quotation_id'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN quotation_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_flow_quotation_id ON cash_flow(quotation_id) WHERE quotation_id IS NOT NULL;
