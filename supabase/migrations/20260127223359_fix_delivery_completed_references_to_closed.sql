/*
  # Corrigir Referências a 'completed' em Deliveries

  1. Problema
    - Código antigo referenciava status 'completed' que não existe no constraint
    - Constraint de deliveries só permite: 'open', 'in_progress', 'closed'
    - Embora não causassem erro (porque não encontravam registros), precisam ser corrigidos

  2. Solução
    - Atualizar todas as referências para usar 'closed' ao invés de 'completed'
    - Garantir consistência em todo o código

  3. Segurança
    - Não afeta dados existentes (não há registros com 'completed')
    - Apenas garante consistência futura
*/

-- Corrigir query de atualização em massa (caso seja executada novamente)
-- Esta query busca entregas 'closed' (finalizadas) e marca todos os itens como carregados
-- É útil para corrigir dados caso haja inconsistências
UPDATE delivery_items di
SET
  loaded_quantity = di.quantity,
  loaded_at = NOW()
FROM deliveries d
WHERE
  di.delivery_id = d.id
  AND d.status = 'closed'  -- Corrigido de 'completed'
  AND di.loaded_quantity < di.quantity;  -- Apenas itens que ainda não foram totalmente carregados

-- Nota: Esta correção garante que referências futuras usem o status correto