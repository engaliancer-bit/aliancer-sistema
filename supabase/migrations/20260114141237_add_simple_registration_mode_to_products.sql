/*
  # Add Simple Registration Mode to Products
  
  1. Changes to products table
    - Add is_simple_registration: indica se o produto foi cadastrado no modo simplificado
    - Add manual_unit_cost: custo unitário informado manualmente (modo simplificado)
    - Add manual_tax_percentage: percentual de imposto informado manualmente
    - Add manual_profit_margin_percentage: margem de lucro informada manualmente
    - Add manual_final_price: preço final calculado no modo simplificado
    
  2. Purpose
    - Permite dois modos de cadastro: detalhado (com traço, armaduras) e simplificado (valores manuais)
    - No modo simplificado, não há controle de estoque de insumos
    - No modo detalhado, mantém o funcionamento atual completo
*/

-- Add fields for simple registration mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'is_simple_registration'
  ) THEN
    ALTER TABLE products ADD COLUMN is_simple_registration boolean DEFAULT false;
    COMMENT ON COLUMN products.is_simple_registration IS 'Indica se o produto foi cadastrado no modo simplificado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'manual_unit_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN manual_unit_cost numeric(15,2);
    COMMENT ON COLUMN products.manual_unit_cost IS 'Custo unitário informado manualmente (modo simplificado)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'manual_tax_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN manual_tax_percentage numeric(5,2);
    COMMENT ON COLUMN products.manual_tax_percentage IS 'Percentual de imposto informado manualmente (ex: 18.50 para 18.5%)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'manual_profit_margin_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN manual_profit_margin_percentage numeric(5,2);
    COMMENT ON COLUMN products.manual_profit_margin_percentage IS 'Margem de lucro informada manualmente (ex: 30.00 para 30%)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'manual_final_price'
  ) THEN
    ALTER TABLE products ADD COLUMN manual_final_price numeric(15,2);
    COMMENT ON COLUMN products.manual_final_price IS 'Preço final calculado no modo simplificado';
  END IF;
END $$;

-- Create index for filtering simple/detailed products
CREATE INDEX IF NOT EXISTS idx_products_is_simple_registration 
  ON products(is_simple_registration);
