/*
  # Corrigir view projects_to_collect para incluir status "entregue"
  
  1. Alterações
    - Recriar view para incluir projetos com status "finalizado" OU "entregue"
    - Manter apenas projetos com saldo a receber (balance > 0)
    - Adicionar coluna property_id para facilitar navegação
    
  2. Objetivo
    - Mostrar todos os projetos finalizados/entregues com valores pendentes
    - Permitir gestão completa de cobranças
*/

-- Remover view antiga
DROP VIEW IF EXISTS projects_to_collect;

-- Recriar view incluindo status "entregue"
CREATE OR REPLACE VIEW projects_to_collect AS
SELECT 
  ep.id,
  ep.name AS project_name,
  ep.status,
  ep.grand_total,
  ep.total_received,
  ep.balance AS balance_due,
  ep.created_at,
  ep.actual_completion_date,
  ep.property_id,
  c.id AS customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
WHERE ep.status IN ('finalizado', 'entregue')
  AND ep.balance > 0
ORDER BY ep.actual_completion_date DESC NULLS LAST, ep.created_at DESC;