/*
  # Add Status Field to Ribbed Slab Quotes

  1. Changes
    - Add `status` field to `ribbed_slab_quotes` table
    - Default status is 'pending'
    - Possible values: 'pending', 'approved', 'rejected'

  2. Notes
    - This allows filtering approved quotes for deliveries
    - Existing records will have status 'approved' by default for compatibility
*/

-- Add status field to ribbed_slab_quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'status'
  ) THEN
    ALTER TABLE ribbed_slab_quotes 
    ADD COLUMN status text DEFAULT 'approved' 
    CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Set existing records to approved
UPDATE ribbed_slab_quotes
SET status = 'approved'
WHERE status IS NULL;