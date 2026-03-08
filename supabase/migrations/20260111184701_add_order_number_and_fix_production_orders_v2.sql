/*
  # Adicionar order_number e Ajustar production_orders para Alertas de Estoque

  1. Alterações na Tabela production_orders
    - Adiciona coluna `order_number` (integer, unique)
      - Número sequencial da ordem de produção para exibição
      - Facilita identificação e referência das ordens
    - Torna `customer_id` opcional (nullable)
      - Permite criar ordens sem cliente (a partir de alertas de estoque)
      - Ordens criadas manualmente ainda podem ter cliente associado

  2. Índices
    - Índice único para order_number
    - Índice para buscar ordens sem cliente

  3. Notas
    - Ordens criadas a partir de alertas não têm cliente associado
    - O order_number é único e sequencial em toda a tabela
    - Valores existentes de order_number serão gerados automaticamente
*/

-- Adicionar campo order_number à tabela production_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE production_orders ADD COLUMN order_number INTEGER;
  END IF;
END $$;

-- Gerar valores de order_number para registros existentes usando CTE
DO $$
BEGIN
  WITH numbered_orders AS (
    SELECT 
      id, 
      ROW_NUMBER() OVER (ORDER BY created_at) as new_order_number
    FROM production_orders
    WHERE order_number IS NULL
  )
  UPDATE production_orders po
  SET order_number = no.new_order_number
  FROM numbered_orders no
  WHERE po.id = no.id;
END $$;

-- Tornar order_number NOT NULL após preencher valores
ALTER TABLE production_orders ALTER COLUMN order_number SET NOT NULL;

-- Adicionar constraint de unicidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_order_number_unique'
  ) THEN
    ALTER TABLE production_orders ADD CONSTRAINT production_orders_order_number_unique UNIQUE (order_number);
  END IF;
END $$;

-- Tornar customer_id nullable (permitir ordens sem cliente)
ALTER TABLE production_orders ALTER COLUMN customer_id DROP NOT NULL;

-- Criar índice para order_number
CREATE INDEX IF NOT EXISTS idx_production_orders_order_number ON production_orders(order_number);

-- Criar índice para ordens sem cliente (criadas a partir de alertas)
CREATE INDEX IF NOT EXISTS idx_production_orders_no_customer ON production_orders(customer_id) WHERE customer_id IS NULL;

-- Comentários explicativos
COMMENT ON COLUMN production_orders.order_number IS 
  'Número sequencial único da ordem de produção para identificação e exibição';

COMMENT ON COLUMN production_orders.customer_id IS 
  'ID do cliente (opcional - null para ordens criadas a partir de alertas de estoque)';
