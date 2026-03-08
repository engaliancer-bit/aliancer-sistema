/*
  # Adicionar código do produto

  1. Alterações
    - Adiciona coluna `code` na tabela `products`
      - Tipo: text
      - Único: true (não permite códigos duplicados)
      - Pode ser nulo inicialmente para produtos existentes
    
  2. Notas
    - Códigos de produto ajudam na identificação rápida
    - Campo único garante que não haja duplicação
    - Produtos existentes podem receber código posteriormente
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'code'
  ) THEN
    ALTER TABLE products ADD COLUMN code text UNIQUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);