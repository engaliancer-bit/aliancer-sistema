/*
  # Merge ITR and CIB Fields into Single Field

  1. Changes
    - Add new column `itr_cib` to properties table to store ITR/CIB number
    - Migrate existing ITR data to new field
    - Remove old `itr` and `cib_number` columns
    
  2. Notes
    - This consolidates the ITR and CIB information into a single field
    - Existing ITR data will be preserved in the new field
    - The new field can accommodate both ITR format (YYYY/NNNNNNNNNN) and CIB format
*/

-- Add new column for merged ITR/CIB field
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS itr_cib text DEFAULT '';

-- Migrate existing ITR data to new field
UPDATE properties 
SET itr_cib = COALESCE(itr, '')
WHERE itr IS NOT NULL AND itr != '';

-- Migrate existing CIB data to new field (if ITR is empty)
UPDATE properties 
SET itr_cib = COALESCE(cib_number, '')
WHERE (itr IS NULL OR itr = '') AND cib_number IS NOT NULL AND cib_number != '';

-- Drop old columns
ALTER TABLE properties DROP COLUMN IF EXISTS itr;
ALTER TABLE properties DROP COLUMN IF EXISTS cib_number;