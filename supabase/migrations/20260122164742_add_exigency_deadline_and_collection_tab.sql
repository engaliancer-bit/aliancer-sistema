/*
  # Adicionar Prazo de Exigência e Aba de Cobrança

  ## Descrição
  Adiciona campo de prazo para exigências e melhora o sistema de alertas para projetos
  de engenharia. Também cria sistema para listar projetos finalizados com saldo devedor.

  ## Mudanças

  1. Novos Campos em `engineering_projects`:
     - `exigency_deadline` (date): Data limite para resolver exigências
     - Campo calculado para determinar urgência do alerta baseado na proximidade do prazo

  2. Sistema de Alertas:
     - Alerta intensifica 5 dias antes do prazo quando status for "em_exigencia"
     - Função auxiliar para calcular dias restantes

  3. Views:
     - `projects_with_urgent_exigencies`: Lista projetos com exigências urgentes
     - `projects_to_collect`: Lista projetos finalizados com saldo devedor

  ## Notas Importantes
  - O campo `exigency_deadline` só deve ser preenchido quando status = 'em_exigencia'
  - Alertas devem aumentar de intensidade conforme se aproxima do prazo
  - Sistema de "Projetos a Cobrar" é baseado em projetos "finalizado" com saldo devedor
*/

-- Adicionar campo de prazo de exigência
ALTER TABLE engineering_projects
ADD COLUMN IF NOT EXISTS exigency_deadline date;

-- Comentário explicativo
COMMENT ON COLUMN engineering_projects.exigency_deadline IS 
'Data limite para resolver exigências quando projeto está com status em_exigencia';

-- Criar índice para buscar projetos com prazo de exigência próximo
CREATE INDEX IF NOT EXISTS idx_projects_exigency_deadline 
ON engineering_projects(exigency_deadline) 
WHERE status = 'em_exigencia' AND exigency_deadline IS NOT NULL;

-- Função para calcular dias restantes até prazo de exigência
CREATE OR REPLACE FUNCTION get_days_until_exigency_deadline(deadline date)
RETURNS integer AS $$
BEGIN
  IF deadline IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN EXTRACT(DAY FROM (deadline - CURRENT_DATE));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View para facilitar consulta de projetos com exigências urgentes
CREATE OR REPLACE VIEW projects_with_urgent_exigencies AS
SELECT 
  ep.*,
  get_days_until_exigency_deadline(ep.exigency_deadline) as days_remaining,
  c.name as customer_name,
  p.name as property_name,
  CASE 
    WHEN get_days_until_exigency_deadline(ep.exigency_deadline) <= 0 THEN 'vencido'
    WHEN get_days_until_exigency_deadline(ep.exigency_deadline) <= 5 THEN 'urgente'
    WHEN get_days_until_exigency_deadline(ep.exigency_deadline) <= 10 THEN 'atencao'
    ELSE 'normal'
  END as urgency_level
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
JOIN properties p ON p.id = ep.property_id
WHERE ep.status = 'em_exigencia'
  AND ep.exigency_deadline IS NOT NULL
ORDER BY ep.exigency_deadline ASC;

-- Conceder permissões na view
ALTER TABLE projects_with_urgent_exigencies OWNER TO postgres;
GRANT SELECT ON projects_with_urgent_exigencies TO anon, authenticated;

-- View para projetos a cobrar (finalizados com saldo devedor)
CREATE OR REPLACE VIEW projects_to_collect AS
SELECT 
  ep.id,
  ep.name as project_name,
  ep.status,
  ep.grand_total,
  ep.total_received,
  ep.balance as balance_due,
  ep.created_at,
  ep.actual_completion_date,
  c.id as customer_id,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
WHERE ep.status = 'finalizado'
  AND ep.balance > 0
ORDER BY ep.actual_completion_date DESC NULLS LAST, ep.created_at DESC;

-- Conceder permissões na view
ALTER TABLE projects_to_collect OWNER TO postgres;
GRANT SELECT ON projects_to_collect TO anon, authenticated;

-- Comentários
COMMENT ON VIEW projects_with_urgent_exigencies IS 
'View que lista projetos com exigências e calcula urgência baseado no prazo';

COMMENT ON VIEW projects_to_collect IS 
'View que lista projetos finalizados que ainda possuem saldo devedor (a cobrar)';
