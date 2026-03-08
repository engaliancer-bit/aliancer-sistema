/*
  # Corrigir Trigger de Status de Entregas

  1. Problema
    - Trigger `update_delivery_status_on_load()` tenta usar status 'completed'
    - Constraint de deliveries só permite: 'open', 'in_progress', 'closed'
    - Isso causa erro: "new row for relation 'deliveries' violates check constraint 'deliveries_status_check'"

  2. Solução
    - Atualizar trigger para usar 'closed' ao invés de 'completed'
    - Manter lógica existente, apenas corrigir o status

  3. Segurança
    - Não afeta dados existentes
    - Corrige apenas a função do trigger
*/

-- Recriar função com status correto
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

  -- Se todos carregados e entrega está aberta, mudar para 'closed' (corrigido de 'completed')
  IF v_all_loaded THEN
    UPDATE deliveries
    SET status = 'closed'
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