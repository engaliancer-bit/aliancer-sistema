/*
  # Corrigir Alertas Duplicados de Estoque

  1. Limpeza
    - Remove alertas duplicados existentes, mantendo apenas o mais recente de cada item

  2. Segurança
    - Adiciona índice único para evitar alertas duplicados do mesmo item com status ativo
    - Combinação única: item_type + item_id + status (quando status é 'pending' ou 'order_placed')

  3. Notas
    - O índice parcial permite múltiplos alertas 'resolved' para histórico
    - Garante apenas um alerta ativo por item
*/

-- Primeiro, vamos limpar os alertas duplicados mantendo apenas o mais recente
DO $$
BEGIN
  -- Para cada combinação de item_type e item_id com status pending ou order_placed
  -- manter apenas o alerta mais recente
  DELETE FROM stock_alerts
  WHERE id IN (
    SELECT id
    FROM (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          PARTITION BY item_type, item_id, status 
          ORDER BY created_at DESC
        ) as rn
      FROM stock_alerts
      WHERE status IN ('pending', 'order_placed')
    ) t
    WHERE t.rn > 1
  );
END $$;

-- Criar índice único parcial para evitar alertas duplicados
-- Permite apenas um alerta ativo (pending ou order_placed) por item
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_unique_active
  ON stock_alerts (item_type, item_id, status)
  WHERE status IN ('pending', 'order_placed');

-- Comentário explicativo
COMMENT ON INDEX idx_stock_alerts_unique_active IS 
  'Garante que cada item tenha apenas um alerta ativo (pending ou order_placed) por vez';
