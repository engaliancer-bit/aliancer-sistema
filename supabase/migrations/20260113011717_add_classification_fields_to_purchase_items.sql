/*
  # Adicionar campos de classificação aos itens de compra

  1. Alterações
    - Adiciona coluna `cost_category_id` para referenciar a categoria de custo
    - Adiciona coluna `classification_status` com valores 'pending' ou 'classified'
    - Adiciona coluna `is_for_resale` para identificar itens para revenda
    - Adiciona coluna `is_asset` para identificar ativos/investimentos
    - Adiciona coluna `notes` para observações sobre a classificação
    - Adiciona coluna `classified_at` para data/hora da classificação
    
  2. Valores Padrão
    - Novos itens iniciam com status 'pending' (pendente de classificação)
    - Campos booleanos iniciam como false
    
  3. Segurança
    - Mantém as políticas RLS existentes
*/

-- Adicionar colunas de classificação se não existirem
DO $$ 
BEGIN
  -- cost_category_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'cost_category_id'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN cost_category_id uuid REFERENCES cost_categories(id);
  END IF;

  -- classification_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'classification_status'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN classification_status text DEFAULT 'pending';
  END IF;

  -- is_for_resale
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'is_for_resale'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN is_for_resale boolean DEFAULT false;
  END IF;

  -- is_asset
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'is_asset'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN is_asset boolean DEFAULT false;
  END IF;

  -- notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'notes'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN notes text;
  END IF;

  -- classified_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_items' AND column_name = 'classified_at'
  ) THEN
    ALTER TABLE purchase_items ADD COLUMN classified_at timestamptz;
  END IF;
END $$;

-- Atualizar itens existentes que são investimentos para marcar como ativos
UPDATE purchase_items 
SET is_asset = true 
WHERE item_category = 'investimento' AND is_asset = false;
