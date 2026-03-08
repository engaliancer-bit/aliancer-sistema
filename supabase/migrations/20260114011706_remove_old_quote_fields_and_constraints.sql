/*
  # Remover Campos Antigos e Constraints da Tabela Quotes

  1. Problema
    - A constraint `check_item_exists` impede o salvamento de novos orçamentos
    - Esta constraint foi criada quando os itens eram armazenados na tabela `quotes`
    - Agora os itens são armazenados na tabela `quote_items`

  2. Alterações
    - Remove a constraint `check_item_exists`
    - Remove campos que não são mais utilizados:
      - `item_type` (agora em quote_items)
      - `product_id` (agora em quote_items)
      - `material_id` (agora em quote_items)
      - `composition_id` (agora em quote_items)
      - `quantity` (agora em quote_items)
      - `suggested_price` (agora em quote_items)
      - `proposed_price` (agora em quote_items)

  3. Segurança
    - Mantém RLS e políticas existentes
    - Não afeta a estrutura de quote_items
*/

-- Remover constraint check_item_exists
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS check_item_exists;

-- Remover campos antigos que não são mais utilizados
DO $$
BEGIN
  -- Remover item_type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE quotes DROP COLUMN item_type;
  END IF;

  -- Remover product_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE quotes DROP COLUMN product_id;
  END IF;

  -- Remover material_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'material_id'
  ) THEN
    ALTER TABLE quotes DROP COLUMN material_id;
  END IF;

  -- Remover composition_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'composition_id'
  ) THEN
    ALTER TABLE quotes DROP COLUMN composition_id;
  END IF;

  -- Remover quantity
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE quotes DROP COLUMN quantity;
  END IF;

  -- Remover suggested_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'suggested_price'
  ) THEN
    ALTER TABLE quotes DROP COLUMN suggested_price;
  END IF;

  -- Remover proposed_price
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'proposed_price'
  ) THEN
    ALTER TABLE quotes DROP COLUMN proposed_price;
  END IF;
END $$;
