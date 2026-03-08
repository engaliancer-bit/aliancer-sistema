/*
  Sistema de Calculo de Precos para Produtos

  Alteracoes:
  1. Adiciona campos de precificacao na tabela products
     - production_cost: custo de producao (editavel)
     - tax_percentage: percentual de impostos
     - final_sale_price: preco final de venda com impostos

  2. Notas Importantes
     - production_cost pode ser diferente do custo calculado pelos materiais
     - sale_price e o preco base de venda (sem impostos)
     - final_sale_price e o preco final (com impostos)
     - margin_percentage e calculada sobre o production_cost
*/

-- Adicionar campos de precificacao aos produtos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'production_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN production_cost numeric DEFAULT 0 CHECK (production_cost >= 0);
    COMMENT ON COLUMN products.production_cost IS 'Custo de producao do produto (editavel manualmente)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'tax_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN tax_percentage numeric DEFAULT 0 CHECK (tax_percentage >= 0 AND tax_percentage <= 100);
    COMMENT ON COLUMN products.tax_percentage IS 'Percentual de impostos aplicado sobre o preco de venda';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'final_sale_price'
  ) THEN
    ALTER TABLE products ADD COLUMN final_sale_price numeric DEFAULT 0 CHECK (final_sale_price >= 0);
    COMMENT ON COLUMN products.final_sale_price IS 'Preco final de venda incluindo impostos';
  END IF;
END $$;