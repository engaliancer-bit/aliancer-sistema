/*
  # Adicionar Status "in_progress" para Entregas

  ## Problema
  Quando há múltiplas entregas pendentes (status='open'), ao fechar uma entrega,
  outra abria automaticamente sem que o usuário iniciasse o carregamento.

  ## Solução
  Adicionar novo status 'in_progress' para distinguir:
  - 'open': Entrega criada e pendente, mas NÃO iniciada pelo usuário
  - 'in_progress': Entrega que o usuário INICIOU o carregamento ativamente
  - 'closed': Entrega finalizada

  ## Alterações
  1. Modificar tipo do campo status para incluir 'in_progress'
  2. Criar índice para consultas eficientes de entregas em progresso
  
  ## Regras de Negócio
  - Apenas UMA entrega pode estar com status 'in_progress' por vez
  - Entregas 'open' ficam aguardando sem interferir
  - Pode haver múltiplas entregas 'open' simultaneamente
  - Usuário pode estornar de 'in_progress' para 'open' (botão de estorno)
*/

-- Primeiro, atualizar o tipo do campo status
ALTER TABLE deliveries 
DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE deliveries 
ADD CONSTRAINT deliveries_status_check 
CHECK (status IN ('open', 'in_progress', 'closed'));

-- Criar índice para entregas em progresso
CREATE INDEX IF NOT EXISTS idx_deliveries_in_progress 
ON deliveries(status) 
WHERE status = 'in_progress';

-- Garantir que não há mais de uma entrega 'in_progress'
CREATE OR REPLACE FUNCTION check_single_delivery_in_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se está mudando para 'in_progress', verificar se já existe outra
  IF NEW.status = 'in_progress' THEN
    IF EXISTS (
      SELECT 1 
      FROM deliveries 
      WHERE status = 'in_progress' 
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe uma entrega em progresso. Finalize ou estorne a entrega atual antes de iniciar outra.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para validar apenas uma entrega em progresso
DROP TRIGGER IF EXISTS trigger_check_single_delivery_in_progress ON deliveries;
CREATE TRIGGER trigger_check_single_delivery_in_progress
  BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION check_single_delivery_in_progress();
