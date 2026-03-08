/*
  # Adicionar controle de quantidade carregada aos itens de entrega

  1. Alterações
    - Adiciona coluna `loaded_quantity` à tabela `delivery_items`
      - Permite rastrear quanto foi carregado de cada item
      - Permite carregamentos parciais e múltiplas cargas
    - Adiciona coluna `loaded_at` para registrar quando o item foi carregado
    - Adiciona índice para melhor performance nas consultas

  2. Regras de Negócio
    - loaded_quantity pode ser menor que quantity (carga parcial)
    - loaded_quantity inicia como 0 por padrão
    - Uma entrega fica "in_progress" enquanto houver itens com loaded_quantity < quantity
    - Uma entrega só vai para "completed" quando todos os itens tiverem loaded_quantity >= quantity
*/

-- Adicionar coluna de quantidade carregada
ALTER TABLE delivery_items
ADD COLUMN IF NOT EXISTS loaded_quantity decimal(10,2) DEFAULT 0 NOT NULL;

-- Adicionar coluna de data de carregamento
ALTER TABLE delivery_items
ADD COLUMN IF NOT EXISTS loaded_at timestamptz;

-- Criar índice para consultas de itens pendentes
CREATE INDEX IF NOT EXISTS idx_delivery_items_loaded_status
ON delivery_items(delivery_id, loaded_quantity, quantity);

-- Atualizar itens existentes de entregas completadas para marcar como carregados
UPDATE delivery_items di
SET
  loaded_quantity = di.quantity,
  loaded_at = NOW()
FROM deliveries d
WHERE
  di.delivery_id = d.id
  AND d.status = 'completed'
  AND di.loaded_quantity = 0;

-- Criar view para status de carregamento por entrega
CREATE OR REPLACE VIEW delivery_loading_status AS
SELECT
  d.id as delivery_id,
  d.quote_id,
  d.status,
  COUNT(di.id) as total_items,
  COUNT(di.id) FILTER (WHERE di.loaded_quantity >= di.quantity) as items_loaded,
  COUNT(di.id) FILTER (WHERE di.loaded_quantity < di.quantity) as items_pending,
  SUM(di.quantity) as total_quantity,
  SUM(di.loaded_quantity) as total_loaded_quantity,
  CASE
    WHEN COUNT(di.id) FILTER (WHERE di.loaded_quantity >= di.quantity) = COUNT(di.id) THEN 'fully_loaded'
    WHEN COUNT(di.id) FILTER (WHERE di.loaded_quantity > 0) > 0 THEN 'partially_loaded'
    ELSE 'not_loaded'
  END as loading_status
FROM deliveries d
LEFT JOIN delivery_items di ON di.delivery_id = d.id
GROUP BY d.id, d.quote_id, d.status;

-- Habilitar RLS na view
ALTER VIEW delivery_loading_status SET (security_invoker = on);

-- Criar função para atualizar status da entrega baseado no carregamento
CREATE OR REPLACE FUNCTION update_delivery_status_on_load()
RETURNS TRIGGER AS $$
DECLARE
  v_all_loaded boolean;
BEGIN
  -- Verificar se todos os itens da entrega foram carregados
  SELECT
    COUNT(*) = COUNT(*) FILTER (WHERE loaded_quantity >= quantity)
  INTO v_all_loaded
  FROM delivery_items
  WHERE delivery_id = NEW.delivery_id;

  -- Se todos carregados e entrega está aberta, mudar para completed
  IF v_all_loaded THEN
    UPDATE deliveries
    SET status = 'completed'
    WHERE
      id = NEW.delivery_id
      AND status IN ('open', 'in_progress');
  -- Se parcialmente carregado, mudar para in_progress
  ELSIF NEW.loaded_quantity > 0 THEN
    UPDATE deliveries
    SET status = 'in_progress'
    WHERE
      id = NEW.delivery_id
      AND status = 'open';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para atualizar status automaticamente
DROP TRIGGER IF EXISTS trigger_update_delivery_status_on_load ON delivery_items;
CREATE TRIGGER trigger_update_delivery_status_on_load
  AFTER UPDATE OF loaded_quantity ON delivery_items
  FOR EACH ROW
  WHEN (NEW.loaded_quantity IS DISTINCT FROM OLD.loaded_quantity)
  EXECUTE FUNCTION update_delivery_status_on_load();