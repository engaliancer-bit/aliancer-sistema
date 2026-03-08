/*
  # Sistema de Alertas de Estoque Mínimo

  1. Alterações nas Tabelas Existentes
    - Adiciona coluna `minimum_stock` à tabela `products`
      - Armazena a quantidade mínima de estoque desejada
      - Valor padrão: 0 (sem alerta)
    - Adiciona coluna `minimum_stock` à tabela `materials`
      - Armazena a quantidade mínima de estoque desejada
      - Valor padrão: 0 (sem alerta)

  2. Nova Tabela: stock_alerts
    - `id` (uuid, primary key) - Identificador único do alerta
    - `item_type` (text) - Tipo do item: 'product' ou 'material'
    - `item_id` (uuid) - ID do produto ou material
    - `status` (text) - Status do alerta: 'pending', 'order_placed', 'resolved'
    - `current_stock` (decimal) - Estoque atual quando o alerta foi gerado
    - `minimum_stock` (decimal) - Estoque mínimo configurado
    - `last_supplier_id` (uuid, nullable) - ID do último fornecedor
    - `created_at` (timestamp) - Data de criação do alerta
    - `order_placed_at` (timestamp, nullable) - Data quando pedido foi realizado
    - `resolved_at` (timestamp, nullable) - Data quando alerta foi resolvido
    - `notes` (text, nullable) - Observações adicionais

  3. Segurança
    - Habilita RLS na tabela `stock_alerts`
    - Políticas para permitir acesso anônimo (compatível com sistema atual)
*/

-- Adicionar campo minimum_stock à tabela products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'minimum_stock'
  ) THEN
    ALTER TABLE products ADD COLUMN minimum_stock DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar campo minimum_stock à tabela materials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'minimum_stock'
  ) THEN
    ALTER TABLE materials ADD COLUMN minimum_stock DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Criar tabela stock_alerts
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'material')),
  item_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'order_placed', 'resolved')),
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(10,2) NOT NULL,
  last_supplier_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  order_placed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- Habilitar RLS
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para acesso anônimo (compatível com sistema atual)
CREATE POLICY "Permitir leitura de alertas"
  ON stock_alerts FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção de alertas"
  ON stock_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de alertas"
  ON stock_alerts FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão de alertas"
  ON stock_alerts FOR DELETE
  USING (true);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_stock_alerts_item ON stock_alerts(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at ON stock_alerts(created_at DESC);
