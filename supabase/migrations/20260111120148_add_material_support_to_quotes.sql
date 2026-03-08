/*
  # Adicionar Suporte para Insumos nos Orçamentos
  
  1. Alterações na Tabela `quotes`
    - `item_type` (text) - Tipo do item: 'product' ou 'material'
    - `material_id` (uuid) - Referência ao insumo (se item_type = 'material')
    - Tornar product_id opcional
  
  2. Descrição
    - Permite que orçamentos incluam tanto produtos quanto insumos de revenda
    - Mantém compatibilidade com orçamentos existentes (product_id)
    - Adiciona flexibilidade para vender insumos diretamente
*/

-- Adicionar coluna para tipo de item
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'product' CHECK (item_type IN ('product', 'material'));

-- Adicionar coluna para material_id
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES materials(id) ON DELETE SET NULL;

-- Tornar product_id opcional
ALTER TABLE quotes
ALTER COLUMN product_id DROP NOT NULL;

-- Adicionar constraint para garantir que ou product_id ou material_id esteja preenchido
ALTER TABLE quotes
ADD CONSTRAINT check_item_exists CHECK (
  (item_type = 'product' AND product_id IS NOT NULL AND material_id IS NULL) OR
  (item_type = 'material' AND material_id IS NOT NULL AND product_id IS NULL)
);