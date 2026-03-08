/*
  # Adicionar tipo de item aos acessórios de produtos

  1. Mudanças
    - Adiciona coluna `item_type` à tabela `product_accessories`
      - Permite indicar se o item é um material ou produto
      - Valores possíveis: 'material' ou 'product'
      - Valor padrão: 'material' para compatibilidade com dados existentes
*/

-- Adicionar coluna item_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_accessories' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE product_accessories ADD COLUMN item_type text NOT NULL DEFAULT 'material' CHECK (item_type IN ('material', 'product'));
    COMMENT ON COLUMN product_accessories.item_type IS 'Tipo do item: material (insumo) ou product (produto acabado)';
  END IF;
END $$;
