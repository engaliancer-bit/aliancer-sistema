/*
  # Adicionar Status e Ordem de Produção ao Sistema de Orçamentos

  1. Alterações
    - Adicionar campo `status` à tabela `ribbed_slab_quotes`
      - Valores: 'draft', 'sent', 'approved', 'rejected', 'in_production'
      - Default: 'draft'
    - Adicionar campo `production_order_id` para vincular ordem de produção
    - Adicionar campo `approved_at` para registrar data de aprovação
    - Adicionar campo `approved_by` para registrar quem aprovou

  2. Índices
    - Criar índice para busca por status
    - Criar índice para busca por ordem de produção
*/

DO $$
BEGIN
  -- Adicionar campo de status se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'status'
  ) THEN
    ALTER TABLE ribbed_slab_quotes
    ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'in_production'));
  END IF;

  -- Adicionar campo production_order_id se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'production_order_id'
  ) THEN
    ALTER TABLE ribbed_slab_quotes
    ADD COLUMN production_order_id uuid REFERENCES production_orders(id);
  END IF;

  -- Adicionar campo approved_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE ribbed_slab_quotes
    ADD COLUMN approved_at timestamptz;
  END IF;

  -- Adicionar campo approved_by se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ribbed_slab_quotes' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE ribbed_slab_quotes
    ADD COLUMN approved_by text;
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_quotes_status ON ribbed_slab_quotes(status);
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_quotes_production_order ON ribbed_slab_quotes(production_order_id);