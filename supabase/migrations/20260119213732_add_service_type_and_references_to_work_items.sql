/*
  # Adicionar tipo "Serviço" e referências aos itens de obra

  ## Descrição
  Expande o sistema de itens de obra para suportar serviços e referências diretas aos cadastros originais.

  ## Alterações

  1. **construction_work_items** - Novos campos e tipo:
     - Adiciona tipo 'service' ao campo item_type
     - Adiciona `product_id` (FK -> products) - Referência ao produto original
     - Adiciona `material_id` (FK -> materials) - Referência ao material original
     - Adiciona `composition_id` (FK -> compositions) - Referência à composição original
     - Adiciona `unit` (text) - Unidade de medida do item

  ## Comportamento
  - Quando selecionar "Produto", busca da tabela products
  - Quando selecionar "Insumo", busca da tabela materials
  - Quando selecionar "Composição", busca da tabela compositions
  - Quando selecionar "Serviço", permite digitação manual
  
  ## Segurança
  - Mantém políticas RLS existentes
*/

-- Adicionar tipo 'service' ao campo item_type
ALTER TABLE construction_work_items 
  DROP CONSTRAINT IF EXISTS construction_work_items_item_type_check;

ALTER TABLE construction_work_items 
  ADD CONSTRAINT construction_work_items_item_type_check 
  CHECK (item_type IN ('product', 'material', 'composition', 'service'));

-- Adicionar colunas de referência aos cadastros originais
ALTER TABLE construction_work_items 
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS composition_id uuid REFERENCES compositions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit text;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_construction_work_items_product ON construction_work_items(product_id);
CREATE INDEX IF NOT EXISTS idx_construction_work_items_material ON construction_work_items(material_id);
CREATE INDEX IF NOT EXISTS idx_construction_work_items_composition ON construction_work_items(composition_id);

-- Comentários para documentação
COMMENT ON COLUMN construction_work_items.product_id IS 'Referência ao produto original (quando item_type = product)';
COMMENT ON COLUMN construction_work_items.material_id IS 'Referência ao material original (quando item_type = material)';
COMMENT ON COLUMN construction_work_items.composition_id IS 'Referência à composição original (quando item_type = composition)';
COMMENT ON COLUMN construction_work_items.unit IS 'Unidade de medida do item (un, m³, kg, etc)';
