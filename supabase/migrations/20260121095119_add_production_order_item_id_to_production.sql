/*
  # Adicionar production_order_item_id à tabela production

  1. Alterações
    - Adiciona coluna `production_order_item_id` (uuid, nullable) à tabela production
      - Referência ao item específico da ordem de produção
      - Permite rastrear qual item de uma ordem multi-produto foi produzido
      - Complementa o campo production_order_id existente

  2. Motivo
    - Ordens de produção agora suportam múltiplos produtos (via production_order_items)
    - Necessário identificar qual item específico está sendo produzido
    - Permite controle granular de produção por item

  3. Segurança
    - Sem alterações nas políticas RLS (já existentes na tabela)
*/

-- Adicionar campo production_order_item_id à tabela production
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production' AND column_name = 'production_order_item_id'
  ) THEN
    ALTER TABLE production ADD COLUMN production_order_item_id uuid REFERENCES production_order_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_production_order_item_id ON production(production_order_item_id);

-- Comentário explicativo
COMMENT ON COLUMN production.production_order_item_id IS 
  'ID do item específico da ordem de produção (para ordens com múltiplos produtos)';