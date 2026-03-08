/*
  # Adicionar Colunas de Observabilidade aos Jobs IA

  1. Novas Colunas
    - `progress_stage` (text) - Estágio legível: 'initializing', 'loading_data', 'generating_document', 'done', 'error'
    - `progress_percent` (integer 0-100) - Progresso numérico para barra
    - `error_details` (jsonb) - Detalhes técnicos do erro (stage, stack trace) para debug
    - `timeout_at` (timestamp) - Hora em que o job deve ser considerado travado
    
  2. Modificações
    - Adicionar índices para performance em queries de monitoramento
    - Criar função helper para marcar jobs como travados (timeout)
    
  3. Migração de Dados
    - Migrar `progress` existente para `progress_percent`
    - Mapear `status` para `progress_stage` inicial
    - Marcar jobs presos como 'error'
*/

-- Adicionar novas colunas
ALTER TABLE project_ia_jobs 
  ADD COLUMN IF NOT EXISTS progress_stage text DEFAULT 'initializing',
  ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  ADD COLUMN IF NOT EXISTS error_details jsonb,
  ADD COLUMN IF NOT EXISTS timeout_at timestamp with time zone;

-- Migrar dados existentes
UPDATE project_ia_jobs
SET 
  progress_percent = COALESCE(progress, 0),
  progress_stage = CASE 
    WHEN status = 'pending' THEN 'initializing'
    WHEN status = 'processing' AND current_section IS NULL THEN 'loading_data'
    WHEN status = 'processing' AND current_section IS NOT NULL THEN 'generating_document'
    WHEN status = 'completed' THEN 'done'
    WHEN status = 'failed' THEN 'error'
    WHEN status = 'cancelled' THEN 'error'
    ELSE 'initializing'
  END
WHERE progress_stage IS NULL OR progress_stage = 'initializing';

-- Marcar jobs presos como error (mais de 5 minutos em processing sem progresso)
UPDATE project_ia_jobs
SET 
  status = 'failed',
  progress_stage = 'error',
  error_message = 'Job travado - timeout após ' || 
    EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at)))/60 || ' minutos',
  error_details = jsonb_build_object(
    'stage', 'timeout',
    'last_section', current_section,
    'stuck_since', COALESCE(started_at, created_at),
    'timeout_reason', 'No progress for 5+ minutes'
  ),
  completed_at = NOW()
WHERE 
  status IN ('pending', 'processing')
  AND EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) > 300 -- 5 minutos
  AND (completed_at IS NULL);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_status_created 
  ON project_ia_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_progress_stage 
  ON project_ia_jobs(progress_stage) 
  WHERE status IN ('pending', 'processing');

-- Função para detectar e marcar jobs travados
CREATE OR REPLACE FUNCTION mark_stuck_ia_jobs()
RETURNS TABLE(job_id uuid, was_stuck_for_seconds numeric) AS $$
BEGIN
  RETURN QUERY
  WITH stuck_jobs AS (
    UPDATE project_ia_jobs
    SET 
      status = 'failed',
      progress_stage = 'error',
      progress_percent = 0,
      error_message = 'Job travado - timeout automático',
      error_details = jsonb_build_object(
        'stage', 'auto_timeout',
        'last_section', current_section,
        'last_progress', progress_percent,
        'stuck_since', COALESCE(started_at, created_at),
        'timeout_at', NOW()
      ),
      completed_at = NOW()
    WHERE 
      status IN ('pending', 'processing')
      AND EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) > 300
      AND completed_at IS NULL
    RETURNING 
      id,
      EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at))) as stuck_seconds
  )
  SELECT id, stuck_seconds FROM stuck_jobs;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON COLUMN project_ia_jobs.progress_stage IS 'Estágio atual: initializing, loading_data, generating_document, done, error';
COMMENT ON COLUMN project_ia_jobs.progress_percent IS 'Progresso numérico de 0-100 para barra visual';
COMMENT ON COLUMN project_ia_jobs.error_details IS 'Detalhes técnicos do erro em JSON (stage, stack, etc.)';
COMMENT ON COLUMN project_ia_jobs.timeout_at IS 'Timestamp quando job deve ser considerado travado';
