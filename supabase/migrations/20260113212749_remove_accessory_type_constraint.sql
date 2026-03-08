/*
  # Remove constraint from product_accessories accessory_type
  
  1. Changes
    - Remove CHECK constraint from `product_accessories.accessory_type`
    - Allow free text entry for accessory types instead of predefined values
    
  2. Reason
    - User requested that accessory types be manually entered without suggestions
    - This provides more flexibility for custom material types
*/

-- Remove a constraint que limita os valores de accessory_type
ALTER TABLE product_accessories DROP CONSTRAINT IF EXISTS product_accessories_accessory_type_check;

-- Atualiza o comentário da coluna
COMMENT ON COLUMN product_accessories.accessory_type IS 'Tipo de material auxiliar (texto livre)';
