/*
  # Sistema de IA para Projetos de Engenharia
  
  ## Visão Geral
  Cria sistema completo de geração de documentos com IA para projetos de engenharia.
  Inclui gerenciamento de jobs, arquivos anexados e outputs gerados.
  
  ## Tabelas Criadas
  
  ### 1. `project_ia_jobs`
  Jobs de geração de IA para projetos
  - Relacionado a projeto, template, cliente e imóvel
  - Armazena briefing e respostas do intake
  - Suporta versionamento de outputs
  
  ### 2. `project_ia_job_files`
  Arquivos anexados aos jobs
  - Armazena no bucket 'ia-files'
  - Suporta múltiplos arquivos por job
  
  ### 3. `project_ia_outputs`
  Outputs gerados pelos jobs
  - Versionamento automático
  - Markdown + resumo executivo + pendências
  - Suporta exportação para DOCX
  
  ## Segurança
  - RLS habilitado em todas as tabelas
  - Acesso restrito ao criador (created_by = auth.uid())
  - Preparado para evolução futura (portal do cliente)
  
  ## Índices
  - Otimizados para queries por projeto, status e versão
*/

-- Enum para status do job
DO $$ BEGIN
  CREATE TYPE project_ia_job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabela: project_ia_jobs
CREATE TABLE IF NOT EXISTS project_ia_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Relacionamentos
  project_id uuid REFERENCES engineering_projects(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES ai_document_templates(id) ON DELETE RESTRICT NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Status e controle
  status project_ia_job_status DEFAULT 'pending' NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Dados de entrada
  briefing text NOT NULL,
  intake_answers jsonb DEFAULT '{}'::jsonb NOT NULL,
  
  -- Progresso
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_section text,
  
  -- Erro
  error_message text,
  
  -- Metadados
  tokens_used integer DEFAULT 0,
  processing_time_seconds integer,
  
  CONSTRAINT valid_dates CHECK (
    (started_at IS NULL OR started_at >= created_at) AND
    (completed_at IS NULL OR (started_at IS NOT NULL AND completed_at >= started_at))
  )
);

-- Tabela: project_ia_job_files
CREATE TABLE IF NOT EXISTS project_ia_job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES project_ia_jobs(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Storage
  storage_bucket text DEFAULT 'ia-files' NOT NULL,
  storage_path text NOT NULL,
  
  -- Metadados do arquivo
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0),
  
  -- URL pública (gerada dinamicamente)
  storage_url text,
  
  -- Metadados adicionais
  uploaded_by uuid REFERENCES auth.users(id),
  description text,
  
  CONSTRAINT unique_job_file_path UNIQUE (job_id, storage_path)
);

-- Tabela: project_ia_outputs
CREATE TABLE IF NOT EXISTS project_ia_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES project_ia_jobs(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Versionamento
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  
  -- Conteúdo gerado
  output_markdown text NOT NULL,
  executive_summary text,
  pending_items jsonb DEFAULT '[]'::jsonb NOT NULL,
  
  -- Exportação DOCX
  docx_storage_path text,
  docx_generated_at timestamptz,
  
  -- Metadados
  word_count integer,
  section_count integer,
  placeholders_count integer DEFAULT 0,
  
  -- Auditoria
  generated_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  
  CONSTRAINT unique_job_version UNIQUE (job_id, version)
);

-- Índices para performance

-- project_ia_jobs
CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_project_created 
  ON project_ia_jobs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_status_created 
  ON project_ia_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_created_by 
  ON project_ia_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_customer 
  ON project_ia_jobs(customer_id);

CREATE INDEX IF NOT EXISTS idx_project_ia_jobs_template 
  ON project_ia_jobs(template_id);

-- project_ia_job_files
CREATE INDEX IF NOT EXISTS idx_project_ia_job_files_job 
  ON project_ia_job_files(job_id);

CREATE INDEX IF NOT EXISTS idx_project_ia_job_files_uploaded_by 
  ON project_ia_job_files(uploaded_by);

-- project_ia_outputs
CREATE INDEX IF NOT EXISTS idx_project_ia_outputs_job_version 
  ON project_ia_outputs(job_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_project_ia_outputs_generated_by 
  ON project_ia_outputs(generated_by);

-- Habilitar RLS
ALTER TABLE project_ia_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ia_job_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ia_outputs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: project_ia_jobs

-- Select: apenas o criador pode ver seus jobs
CREATE POLICY "Users can view own jobs"
  ON project_ia_jobs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Insert: usuários autenticados podem criar jobs
CREATE POLICY "Users can create jobs"
  ON project_ia_jobs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Update: apenas o criador pode atualizar
CREATE POLICY "Users can update own jobs"
  ON project_ia_jobs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Delete: apenas o criador pode deletar
CREATE POLICY "Users can delete own jobs"
  ON project_ia_jobs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies: project_ia_job_files

-- Select: apenas o criador do job pode ver os arquivos
CREATE POLICY "Users can view own job files"
  ON project_ia_job_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_job_files.job_id
      AND j.created_by = auth.uid()
    )
  );

-- Insert: apenas o criador do job pode adicionar arquivos
CREATE POLICY "Users can upload files to own jobs"
  ON project_ia_job_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_job_files.job_id
      AND j.created_by = auth.uid()
    )
  );

-- Delete: apenas o criador do job pode deletar arquivos
CREATE POLICY "Users can delete files from own jobs"
  ON project_ia_job_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_job_files.job_id
      AND j.created_by = auth.uid()
    )
  );

-- RLS Policies: project_ia_outputs

-- Select: apenas o criador do job pode ver os outputs
CREATE POLICY "Users can view own job outputs"
  ON project_ia_outputs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_outputs.job_id
      AND j.created_by = auth.uid()
    )
  );

-- Insert: apenas o criador do job pode adicionar outputs
CREATE POLICY "Users can create outputs for own jobs"
  ON project_ia_outputs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_outputs.job_id
      AND j.created_by = auth.uid()
    )
  );

-- Update: apenas o criador do job pode atualizar outputs
CREATE POLICY "Users can update outputs of own jobs"
  ON project_ia_outputs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_outputs.job_id
      AND j.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_ia_jobs j
      WHERE j.id = project_ia_outputs.job_id
      AND j.created_by = auth.uid()
    )
  );

-- Trigger: atualizar updated_at
CREATE OR REPLACE FUNCTION update_project_ia_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_ia_jobs_updated_at ON project_ia_jobs;
CREATE TRIGGER trigger_update_project_ia_jobs_updated_at
  BEFORE UPDATE ON project_ia_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_project_ia_jobs_updated_at();

-- Trigger: auto-incrementar versão
CREATE OR REPLACE FUNCTION auto_increment_output_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Se versão não foi especificada, calcular próxima
  IF NEW.version = 1 THEN
    SELECT COALESCE(MAX(version), 0) + 1
    INTO NEW.version
    FROM project_ia_outputs
    WHERE job_id = NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_increment_output_version ON project_ia_outputs;
CREATE TRIGGER trigger_auto_increment_output_version
  BEFORE INSERT ON project_ia_outputs
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_output_version();

-- Trigger: atualizar status do job quando output é criado
CREATE OR REPLACE FUNCTION update_job_status_on_output()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_ia_jobs
  SET 
    status = 'completed',
    completed_at = now(),
    progress = 100
  WHERE id = NEW.job_id
  AND status IN ('pending', 'processing');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_job_status_on_output ON project_ia_outputs;
CREATE TRIGGER trigger_update_job_status_on_output
  AFTER INSERT ON project_ia_outputs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_status_on_output();

-- Função: contar placeholders em markdown
CREATE OR REPLACE FUNCTION count_placeholders(markdown_text text)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM regexp_matches(markdown_text, '\[A COMPLETAR[^\]]*\]', 'g')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: calcular estatísticas do output
CREATE OR REPLACE FUNCTION calculate_output_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Contar palavras
  NEW.word_count := array_length(
    regexp_split_to_array(NEW.output_markdown, '\s+'), 
    1
  );
  
  -- Contar seções (linhas começando com #)
  NEW.section_count := (
    SELECT COUNT(*)
    FROM regexp_matches(NEW.output_markdown, '^#+\s+', 'gm')
  );
  
  -- Contar placeholders
  NEW.placeholders_count := count_placeholders(NEW.output_markdown);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_output_stats ON project_ia_outputs;
CREATE TRIGGER trigger_calculate_output_stats
  BEFORE INSERT OR UPDATE ON project_ia_outputs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_output_stats();

-- View: jobs com informações completas
CREATE OR REPLACE VIEW project_ia_jobs_detail AS
SELECT
  j.id,
  j.created_at,
  j.updated_at,
  j.status,
  j.progress,
  j.started_at,
  j.completed_at,
  j.briefing,
  j.intake_answers,
  j.error_message,
  j.tokens_used,
  j.processing_time_seconds,
  
  -- Projeto
  p.name as project_name,
  p.property_type,
  
  -- Template
  t.name as template_name,
  t.document_type as template_type,
  t.ia_doc_type,
  
  -- Cliente
  c.name as customer_name,
  c.person_type as customer_type,
  
  -- Imóvel
  pr.name as property_name,
  
  -- Criador
  j.created_by,
  
  -- Contagens
  (SELECT COUNT(*) FROM project_ia_job_files f WHERE f.job_id = j.id) as files_count,
  (SELECT COUNT(*) FROM project_ia_outputs o WHERE o.job_id = j.id) as outputs_count,
  (SELECT MAX(version) FROM project_ia_outputs o WHERE o.job_id = j.id) as latest_version
FROM project_ia_jobs j
LEFT JOIN engineering_projects p ON p.id = j.project_id
LEFT JOIN ai_document_templates t ON t.id = j.template_id
LEFT JOIN customers c ON c.id = j.customer_id
LEFT JOIN properties pr ON pr.id = j.property_id;

-- View: outputs com informações do job
CREATE OR REPLACE VIEW project_ia_outputs_detail AS
SELECT
  o.id,
  o.job_id,
  o.created_at,
  o.version,
  o.output_markdown,
  o.executive_summary,
  o.pending_items,
  o.docx_storage_path,
  o.docx_generated_at,
  o.word_count,
  o.section_count,
  o.placeholders_count,
  o.generated_by,
  o.reviewed_by,
  o.reviewed_at,
  
  -- Job info
  j.status as job_status,
  j.project_id,
  j.customer_id,
  
  -- Projeto
  p.name as project_name,
  
  -- Template
  t.name as template_name,
  
  -- Cliente
  c.name as customer_name
FROM project_ia_outputs o
INNER JOIN project_ia_jobs j ON j.id = o.job_id
LEFT JOIN engineering_projects p ON p.id = j.project_id
LEFT JOIN ai_document_templates t ON t.id = j.template_id
LEFT JOIN customers c ON c.id = j.customer_id;

-- Função: criar job de IA para projeto
CREATE OR REPLACE FUNCTION create_project_ia_job(
  p_project_id uuid,
  p_template_id uuid,
  p_briefing text,
  p_intake_answers jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_job_id uuid;
  v_customer_id uuid;
  v_property_id uuid;
  v_user_id uuid;
BEGIN
  -- Obter usuário atual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Obter customer_id e property_id do projeto
  SELECT customer_id, property_id
  INTO v_customer_id, v_property_id
  FROM engineering_projects
  WHERE id = p_project_id;
  
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;
  
  -- Criar job
  INSERT INTO project_ia_jobs (
    project_id,
    template_id,
    customer_id,
    property_id,
    briefing,
    intake_answers,
    created_by,
    status
  ) VALUES (
    p_project_id,
    p_template_id,
    v_customer_id,
    v_property_id,
    p_briefing,
    p_intake_answers,
    v_user_id,
    'pending'
  )
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: obter último output de um job
CREATE OR REPLACE FUNCTION get_latest_output(p_job_id uuid)
RETURNS project_ia_outputs AS $$
DECLARE
  v_output project_ia_outputs;
BEGIN
  SELECT *
  INTO v_output
  FROM project_ia_outputs
  WHERE job_id = p_job_id
  ORDER BY version DESC
  LIMIT 1;
  
  RETURN v_output;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentários descritivos
COMMENT ON TABLE project_ia_jobs IS 'Jobs de geração de documentos com IA para projetos de engenharia';
COMMENT ON TABLE project_ia_job_files IS 'Arquivos anexados aos jobs de IA';
COMMENT ON TABLE project_ia_outputs IS 'Outputs gerados pelos jobs de IA (versionados)';

COMMENT ON COLUMN project_ia_jobs.briefing IS 'Briefing geral do documento a ser gerado';
COMMENT ON COLUMN project_ia_jobs.intake_answers IS 'Respostas das perguntas de intake do template';
COMMENT ON COLUMN project_ia_jobs.progress IS 'Progresso da geração (0-100)';
COMMENT ON COLUMN project_ia_jobs.current_section IS 'Seção sendo processada no momento';

COMMENT ON COLUMN project_ia_outputs.output_markdown IS 'Documento gerado em formato Markdown';
COMMENT ON COLUMN project_ia_outputs.executive_summary IS 'Resumo executivo do documento';
COMMENT ON COLUMN project_ia_outputs.pending_items IS 'Lista de itens pendentes ([A COMPLETAR])';
COMMENT ON COLUMN project_ia_outputs.placeholders_count IS 'Quantidade de [A COMPLETAR] no documento';

-- Storage bucket para arquivos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ia-files', 'ia-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users can upload ia files" ON storage.objects;
CREATE POLICY "Users can upload ia files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ia-files'
  );

DROP POLICY IF EXISTS "Users can view ia files" ON storage.objects;
CREATE POLICY "Users can view ia files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ia-files'
  );

DROP POLICY IF EXISTS "Users can delete ia files" ON storage.objects;
CREATE POLICY "Users can delete ia files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ia-files'
  );
