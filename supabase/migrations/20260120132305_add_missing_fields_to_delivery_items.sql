/*
  # Adicionar Campos Faltantes em delivery_items

  ## Descrição
  Esta migration adiciona os campos que faltam na tabela `delivery_items` para suportar
  diferentes tipos de itens (produtos, insumos, composições) e suas respectivas referências.

  ## Alterações
  1. Adiciona campos novos:
     - `item_type` (text) - Tipo do item: 'product', 'material', 'composition'
     - `item_id` (uuid) - ID genérico do item (pode referenciar product, material ou composition)
     - `item_name` (text) - Nome do item para cache e histórico
     - `material_id` (uuid) - Referência específica para materials
     - `composition_id` (uuid) - Referência específica para compositions
     - `customer_id` (uuid) - Referência ao cliente da entrega

  2. Foreign Keys:
     - Adiciona foreign key de material_id para materials
     - Adiciona foreign key de composition_id para compositions
     - Adiciona foreign key de customer_id para customers

  3. Índices:
     - Cria índices para melhorar performance nas consultas
*/

-- Adicionar campo item_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE delivery_items ADD COLUMN item_type text;
  END IF;
END $$;

-- Adicionar campo item_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_items' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE delivery_items ADD COLUMN item_id uuid;
  END IF;
END $$;

-- Adicionar campo item_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_items' AND column_name = 'item_name'
  ) THEN
    ALTER TABLE delivery_items ADD COLUMN item_name text;
  END IF;
END $$;

-- Adicionar campo material_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_items' AND column_name = 'material_id'
  ) THEN
    ALTER TABLE delivery_items ADD COLUMN material_id uuid REFERENCES materials(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar campo composition_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_items' AND column_name = 'composition_id'
  ) THEN
    ALTER TABLE delivery_items ADD COLUMN composition_id uuid REFERENCES compositions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar campo customer_id em deliveries se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_delivery_items_material_id ON delivery_items(material_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_composition_id ON delivery_items(composition_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_item_type ON delivery_items(item_type);
CREATE INDEX IF NOT EXISTS idx_delivery_items_item_id ON delivery_items(item_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);

-- Atualizar os campos existentes para manter consistência
-- Preencher material_id e composition_id baseado nos dados existentes
UPDATE delivery_items
SET 
  material_id = item_id,
  item_type = 'material'
WHERE item_type = 'material' AND material_id IS NULL;

UPDATE delivery_items
SET 
  composition_id = item_id,
  item_type = 'composition'
WHERE item_type = 'composition' AND composition_id IS NULL;

UPDATE delivery_items
SET 
  item_type = 'product'
WHERE item_type IS NULL AND product_id IS NOT NULL;