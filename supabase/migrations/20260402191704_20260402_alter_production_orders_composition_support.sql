/*
  # Producao por Composicao — Suporte a OP unica por composicao

  ## Objetivo
  Permitir que uma Ordem de Producao (OP) seja criada para uma composicao inteira,
  em vez de criar uma OP separada para cada produto filho da composicao.

  ## Alteracoes

  ### Tabela `production_orders`
  - `product_id`: alterado de NOT NULL para NULLABLE (OPs de composicao nao tem produto unico)
  - `composition_id` (uuid, nullable): referencia a composicao que originou a OP
  - `composition_name` (text, nullable): nome da composicao armazenado no momento da criacao

  ### Seguranca
  - Nenhuma alteracao em RLS (politicas existentes cobrem os novos campos)
  - Dados existentes nao sao alterados
*/

-- Tornar product_id opcional em production_orders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE production_orders ALTER COLUMN product_id DROP NOT NULL;
  END IF;
END $$;

-- Adicionar composition_id se nao existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'composition_id'
  ) THEN
    ALTER TABLE production_orders ADD COLUMN composition_id uuid REFERENCES compositions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adicionar composition_name se nao existir (desnormalizado para historico)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'composition_name'
  ) THEN
    ALTER TABLE production_orders ADD COLUMN composition_name text;
  END IF;
END $$;

-- Indice para busca rapida de OPs por composicao e orcamento
CREATE INDEX IF NOT EXISTS idx_production_orders_composition_id
  ON production_orders(composition_id)
  WHERE composition_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_orders_quote_composition
  ON production_orders(quote_id, composition_id)
  WHERE composition_id IS NOT NULL;
