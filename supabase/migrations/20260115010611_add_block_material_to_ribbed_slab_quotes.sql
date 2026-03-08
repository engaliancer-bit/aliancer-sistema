/*
  # Adicionar Material de Tavela ao Orçamento

  1. Alterações
    - Adicionar `block_material_id` (uuid) - Referência ao insumo de tavela
    - Adicionar `block_unit_price` (decimal) - Valor unitário da tavela
    
  2. Descrição
    - Permite importar o insumo de tavela da tabela de materiais
    - Armazena o valor unitário para cálculo de custos
    - Será usado no cálculo total de materiais do orçamento
*/

-- Adicionar campos de material de tavela
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'block_material_id'
  ) THEN
    ALTER TABLE ribbed_slab_quotes 
    ADD COLUMN block_material_id uuid REFERENCES materials(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'block_unit_price'
  ) THEN
    ALTER TABLE ribbed_slab_quotes 
    ADD COLUMN block_unit_price decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_quotes_block_material_id 
ON ribbed_slab_quotes(block_material_id);