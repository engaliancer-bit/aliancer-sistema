/*
  # Adicionar Campos de Controle de Preços

  ## Novos Campos
  
  ### Tabela `products`
  - `minimum_price` (numeric) - Preço mínimo de venda permitido
  - `maximum_discount_percent` (numeric) - Desconto máximo permitido em %
  
  ### Tabela `materials`
  - `minimum_resale_price` (numeric) - Preço mínimo de revenda permitido
  - `maximum_discount_percent` (numeric) - Desconto máximo permitido em %
  
  ## Benefícios
  1. Controle de margem mínima de lucro
  2. Prevenção de vendas abaixo do custo
  3. Limite de desconto por produto/material
  4. Auxílio na precificação e negociação
  
  ## Uso
  - Campo opcional (pode ser NULL)
  - Se NULL, não há restrição
  - Se preenchido, sistema pode alertar quando:
    - Preço de venda < minimum_price
    - Desconto aplicado > maximum_discount_percent
*/

-- Adicionar campos de controle de preço na tabela products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS minimum_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maximum_discount_percent numeric DEFAULT NULL;

-- Adicionar campos de controle de preço na tabela materials
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS minimum_resale_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maximum_discount_percent numeric DEFAULT NULL;

-- Adicionar constraints de validação
ALTER TABLE products
  ADD CONSTRAINT check_minimum_price_positive 
    CHECK (minimum_price IS NULL OR minimum_price >= 0),
  ADD CONSTRAINT check_maximum_discount_valid 
    CHECK (maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100));

ALTER TABLE materials
  ADD CONSTRAINT check_minimum_resale_price_positive 
    CHECK (minimum_resale_price IS NULL OR minimum_resale_price >= 0),
  ADD CONSTRAINT check_materials_maximum_discount_valid 
    CHECK (maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100));

-- Comentários descritivos
COMMENT ON COLUMN products.minimum_price IS 
  'Preço mínimo de venda permitido. Sistema pode alertar se venda for abaixo deste valor.';

COMMENT ON COLUMN products.maximum_discount_percent IS 
  'Desconto máximo permitido em porcentagem (0-100). Sistema pode alertar se desconto exceder este valor.';

COMMENT ON COLUMN materials.minimum_resale_price IS 
  'Preço mínimo de revenda permitido. Sistema pode alertar se venda for abaixo deste valor.';

COMMENT ON COLUMN materials.maximum_discount_percent IS 
  'Desconto máximo permitido em porcentagem (0-100). Sistema pode alertar se desconto exceder este valor.';
