/*
  # Adicionar Vínculo de Ordem de Produção aos Alertas de Estoque

  1. Alterações na Tabela stock_alerts
    - Adiciona coluna `production_order_id` (uuid, nullable)
      - Armazena o ID da ordem de produção gerada a partir do alerta
      - Permite rastrear qual ordem foi criada para resolver o alerta de produto
    - Adiciona foreign key para a tabela production_orders

  2. Índices
    - Índice para buscar alertas por ordem de produção

  3. Notas
    - Este campo é usado apenas para alertas de produtos (item_type = 'product')
    - Para alertas de insumos, este campo permanece null
    - Quando uma ordem é criada a partir de um alerta, o ID é registrado aqui
*/

-- Adicionar campo production_order_id à tabela stock_alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_alerts' AND column_name = 'production_order_id'
  ) THEN
    ALTER TABLE stock_alerts ADD COLUMN production_order_id UUID;
  END IF;
END $$;

-- Adicionar foreign key para production_orders (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'production_orders'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_stock_alerts_production_order'
  ) THEN
    ALTER TABLE stock_alerts
      ADD CONSTRAINT fk_stock_alerts_production_order
      FOREIGN KEY (production_order_id)
      REFERENCES production_orders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para buscar alertas por ordem de produção
CREATE INDEX IF NOT EXISTS idx_stock_alerts_production_order 
  ON stock_alerts(production_order_id)
  WHERE production_order_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN stock_alerts.production_order_id IS 
  'ID da ordem de produção gerada para resolver este alerta (apenas para produtos)';
