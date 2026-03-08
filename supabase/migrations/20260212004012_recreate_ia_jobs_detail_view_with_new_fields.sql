/*
  # Recriar View project_ia_jobs_detail com Novos Campos

  1. Modificações
    - Dropar view existente
    - Recriar com campos de observabilidade: progress_percent, progress_stage, error_details, timeout_at, current_section
    - Manter compatibilidade com campo legacy 'progress'
    
  2. Objetivo
    - Permitir que o frontend acesse todos os novos campos de monitoramento
*/

-- Dropar view existente
DROP VIEW IF EXISTS project_ia_jobs_detail;

-- Recriar a view com os novos campos
CREATE VIEW project_ia_jobs_detail AS
SELECT 
  j.id,
  j.created_at,
  j.updated_at,
  j.status,
  j.progress, -- Legacy para compatibilidade
  j.progress_percent,
  j.progress_stage,
  j.current_section,
  j.started_at,
  j.completed_at,
  j.briefing,
  j.intake_answers,
  j.error_message,
  j.error_details,
  j.tokens_used,
  j.processing_time_seconds,
  j.timeout_at,
  p.name AS project_name,
  p.property_type,
  t.name AS template_name,
  t.document_type AS template_type,
  t.ia_doc_type,
  c.name AS customer_name,
  c.person_type AS customer_type,
  pr.name AS property_name,
  j.created_by,
  (SELECT COUNT(*) FROM project_ia_job_files f WHERE f.job_id = j.id) AS files_count,
  (SELECT COUNT(*) FROM project_ia_outputs o WHERE o.job_id = j.id) AS outputs_count,
  (SELECT MAX(o.version) FROM project_ia_outputs o WHERE o.job_id = j.id) AS latest_version
FROM project_ia_jobs j
LEFT JOIN engineering_projects p ON p.id = j.project_id
LEFT JOIN ai_document_templates t ON t.id = j.template_id
LEFT JOIN customers c ON c.id = j.customer_id
LEFT JOIN properties pr ON pr.id = j.property_id;

-- Garantir que a view seja acessível publicamente (seguindo padrão do sistema)
GRANT SELECT ON project_ia_jobs_detail TO public;

-- Comentário
COMMENT ON VIEW project_ia_jobs_detail IS 'View consolidada dos jobs de IA com dados do projeto, template, cliente e progresso em tempo real';
