/*
  # Sistema de Jobs Assíncronos e Otimizações de Performance
  
  ## Visão Geral
  Implementa processamento assíncrono para geração de documentos com IA,
  evitando travamento da UI e melhorando a experiência do usuário.
  
  ## Funcionalidades
  - Jobs em background para geração de documentos
  - Sistema de versionamento de documentos (v1, v2, v3...)
  - Storage para anexos (arquivos, imagens, PDFs)
  - Paginação em consultas
  - Status detalhado de processamento
  - Limites configuráveis
  
  ## Novas Tabelas
  
  ### 1. `ai_generation_jobs`
  Jobs de geração de documentos com controle de status
  
  ### 2. `ai_document_attachments`
  Anexos vinculados a documentos (Storage)
  
  ### 3. `ai_system_config`
  Configurações do sistema (limites, custos, etc)
  
  ## Alterações
  - Campo `generation_job_id` em documentos
  - Índices otimizados para paginação
  - Triggers para atualização automática
*/

-- Enum para status de job
DO $$ BEGIN
  CREATE TYPE generation_job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de anexo
DO $$ BEGIN
  CREATE TYPE attachment_file_type AS ENUM (
    'image',
    'pdf',
    'document',
    'spreadsheet',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Tabela de Jobs de Geração
CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo
  document_id uuid NOT NULL REFERENCES ai_generated_documents(id) ON DELETE CASCADE,
  
  -- Tipo de geração
  generation_type text NOT NULL,
  
  -- Status do job
  status generation_job_status DEFAULT 'pending',
  
  -- Progresso
  progress integer DEFAULT 0,
  total_sections integer DEFAULT 0,
  current_section text,
  
  -- Dados de entrada
  input_data jsonb DEFAULT '{}',
  
  -- Configuração
  config jsonb DEFAULT '{}',
  
  -- Resultado
  result_data jsonb,
  error_message text,
  error_stack text,
  
  -- Estatísticas
  tokens_used integer DEFAULT 0,
  estimated_cost decimal(10,4) DEFAULT 0,
  sections_generated integer DEFAULT 0,
  sections_failed integer DEFAULT 0,
  
  -- Controle de tempo
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  estimated_duration_seconds integer,
  
  -- Metadados
  created_by text,
  
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT valid_generation_type CHECK (
    generation_type IN ('full_document', 'single_section', 'regenerate_section', 'new_version')
  )
);

-- 2. Tabela de Anexos (Storage)
CREATE TABLE IF NOT EXISTS ai_document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo
  document_id uuid NOT NULL REFERENCES ai_generated_documents(id) ON DELETE CASCADE,
  section_id uuid REFERENCES ai_document_sections(id) ON DELETE SET NULL,
  
  -- Informações do arquivo
  file_name text NOT NULL,
  file_type attachment_file_type NOT NULL,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  
  -- Storage (NÃO guardar base64!)
  storage_bucket text DEFAULT 'ai-documents',
  storage_path text NOT NULL,
  storage_url text,
  
  -- Metadados
  description text,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT now(),
  
  -- Controle
  is_active boolean DEFAULT true,
  
  CONSTRAINT valid_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
  CONSTRAINT unique_storage_path UNIQUE(storage_bucket, storage_path)
);

-- 3. Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS ai_system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

-- Inserir configurações padrão
INSERT INTO ai_system_config (config_key, config_value, description) VALUES
  ('max_attachments_per_document', '5', 'Número máximo de anexos por documento'),
  ('max_attachment_size_mb', '50', 'Tamanho máximo de anexo em MB'),
  ('default_polling_interval_seconds', '3', 'Intervalo de polling para jobs em segundos'),
  ('max_tokens_per_section', '2000', 'Máximo de tokens por seção'),
  ('generation_timeout_minutes', '10', 'Timeout para geração em minutos'),
  ('enable_realtime_updates', 'false', 'Habilitar atualizações realtime (preferir polling)'),
  ('documents_per_page', '20', 'Documentos por página na listagem'),
  ('jobs_per_page', '50', 'Jobs por página no histórico'),
  ('versions_per_page', '10', 'Versões por página no histórico')
ON CONFLICT (config_key) DO NOTHING;

-- Adicionar campos aos documentos existentes
ALTER TABLE ai_generated_documents
  ADD COLUMN IF NOT EXISTS current_job_id uuid REFERENCES ai_generation_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_job_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attachments_count integer DEFAULT 0;

-- Adicionar índices para performance e paginação
CREATE INDEX IF NOT EXISTS idx_generation_jobs_document ON ai_generation_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON ai_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON ai_generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created ON ai_generation_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_attachments_document ON ai_document_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_active ON ai_document_attachments(is_active);
CREATE INDEX IF NOT EXISTS idx_document_attachments_uploaded ON ai_document_attachments(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_docs_pagination ON ai_generated_documents(created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_status_pagination ON ai_generated_documents(status, created_at DESC, id);

-- Função para iniciar job de geração
CREATE OR REPLACE FUNCTION start_generation_job(
  p_document_id uuid,
  p_generation_type text,
  p_input_data jsonb DEFAULT '{}',
  p_config jsonb DEFAULT '{}',
  p_created_by text DEFAULT 'system'
)
RETURNS uuid AS $$
DECLARE
  v_job_id uuid;
  v_sections_count integer;
BEGIN
  -- Contar seções do documento
  SELECT COUNT(*)
  INTO v_sections_count
  FROM ai_document_section_contents
  WHERE document_id = p_document_id;
  
  -- Criar job
  INSERT INTO ai_generation_jobs (
    document_id,
    generation_type,
    status,
    total_sections,
    input_data,
    config,
    created_by
  ) VALUES (
    p_document_id,
    p_generation_type,
    'pending',
    v_sections_count,
    p_input_data,
    p_config,
    p_created_by
  ) RETURNING id INTO v_job_id;
  
  -- Atualizar documento
  UPDATE ai_generated_documents
  SET 
    current_job_id = v_job_id,
    status = 'gerando',
    generation_started_at = now(),
    updated_by = p_created_by
  WHERE id = p_document_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar progresso do job
CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id uuid,
  p_progress integer,
  p_current_section text DEFAULT NULL,
  p_sections_generated integer DEFAULT NULL,
  p_tokens_used integer DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE ai_generation_jobs
  SET
    progress = GREATEST(progress, p_progress),
    current_section = COALESCE(p_current_section, current_section),
    sections_generated = COALESCE(p_sections_generated, sections_generated),
    tokens_used = COALESCE(p_tokens_used, tokens_used),
    status = CASE 
      WHEN p_progress >= 100 THEN 'completed'::generation_job_status
      WHEN p_progress > 0 AND status = 'pending'::generation_job_status THEN 'processing'::generation_job_status
      ELSE status
    END,
    started_at = CASE 
      WHEN started_at IS NULL AND p_progress > 0 THEN now()
      ELSE started_at
    END,
    completed_at = CASE 
      WHEN p_progress >= 100 THEN now()
      ELSE completed_at
    END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Função para completar job
CREATE OR REPLACE FUNCTION complete_generation_job(
  p_job_id uuid,
  p_success boolean,
  p_result_data jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_document_id uuid;
BEGIN
  -- Atualizar job
  UPDATE ai_generation_jobs
  SET
    status = CASE WHEN p_success THEN 'completed'::generation_job_status ELSE 'failed'::generation_job_status END,
    progress = CASE WHEN p_success THEN 100 ELSE progress END,
    completed_at = now(),
    result_data = p_result_data,
    error_message = p_error_message
  WHERE id = p_job_id
  RETURNING document_id INTO v_document_id;
  
  -- Atualizar documento
  IF p_success THEN
    UPDATE ai_generated_documents
    SET
      status = 'gerado',
      generation_completed_at = now(),
      current_job_id = NULL,
      last_job_completed_at = now()
    WHERE id = v_document_id;
  ELSE
    UPDATE ai_generated_documents
    SET
      status = 'rascunho',
      generation_error = p_error_message,
      current_job_id = NULL
    WHERE id = v_document_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para cancelar job
CREATE OR REPLACE FUNCTION cancel_generation_job(p_job_id uuid)
RETURNS void AS $$
DECLARE
  v_document_id uuid;
BEGIN
  UPDATE ai_generation_jobs
  SET
    status = 'cancelled',
    completed_at = now(),
    error_message = 'Cancelado pelo usuário'
  WHERE id = p_job_id
    AND status IN ('pending', 'processing')
  RETURNING document_id INTO v_document_id;
  
  IF v_document_id IS NOT NULL THEN
    UPDATE ai_generated_documents
    SET
      status = 'rascunho',
      current_job_id = NULL
    WHERE id = v_document_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar contador de anexos
CREATE OR REPLACE FUNCTION update_attachments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active THEN
    UPDATE ai_generated_documents
    SET attachments_count = attachments_count + 1
    WHERE id = NEW.document_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active THEN
    UPDATE ai_generated_documents
    SET attachments_count = attachments_count + CASE WHEN NEW.is_active THEN 1 ELSE -1 END
    WHERE id = NEW.document_id;
  ELSIF TG_OP = 'DELETE' AND OLD.is_active THEN
    UPDATE ai_generated_documents
    SET attachments_count = GREATEST(0, attachments_count - 1)
    WHERE id = OLD.document_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_document_attachments_count ON ai_document_attachments;
CREATE TRIGGER update_document_attachments_count
  AFTER INSERT OR UPDATE OR DELETE ON ai_document_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_attachments_count();

-- Função para limpar jobs antigos (manutenção)
CREATE OR REPLACE FUNCTION cleanup_old_generation_jobs(p_days_old integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM ai_generation_jobs
  WHERE completed_at < NOW() - (p_days_old || ' days')::interval
    AND status IN ('completed', 'failed', 'cancelled')
  RETURNING COUNT(*) INTO v_deleted_count;
  
  RETURN COALESCE(v_deleted_count, 0);
END;
$$ LANGUAGE plpgsql;

-- View para listagem paginada de documentos
CREATE OR REPLACE VIEW ai_documents_list AS
SELECT
  d.id,
  d.document_title,
  d.document_type,
  d.status,
  d.version,
  d.created_at,
  d.updated_at,
  d.attachments_count,
  d.tokens_used,
  d.estimated_cost,
  c.name as customer_name,
  p.name as project_name,
  pr.name as property_name,
  j.status as job_status,
  j.progress as job_progress,
  j.current_section as job_current_section
FROM ai_generated_documents d
JOIN customers c ON c.id = d.customer_id
JOIN engineering_projects p ON p.id = d.project_id
LEFT JOIN properties pr ON pr.id = d.property_id
LEFT JOIN ai_generation_jobs j ON j.id = d.current_job_id
ORDER BY d.created_at DESC;

-- Habilitar RLS
ALTER TABLE ai_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_system_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Public access to generation_jobs"
  ON ai_generation_jobs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to document_attachments"
  ON ai_document_attachments FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read system_config"
  ON ai_system_config FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public update system_config"
  ON ai_system_config FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Criar bucket no Storage (se não existir)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('ai-documents', 'ai-documents', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Política de Storage para ai-documents
DROP POLICY IF EXISTS "Public can upload ai-documents" ON storage.objects;
CREATE POLICY "Public can upload ai-documents"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'ai-documents');

DROP POLICY IF EXISTS "Public can read ai-documents" ON storage.objects;
CREATE POLICY "Public can read ai-documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ai-documents');

DROP POLICY IF EXISTS "Public can delete ai-documents" ON storage.objects;
CREATE POLICY "Public can delete ai-documents"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'ai-documents');
