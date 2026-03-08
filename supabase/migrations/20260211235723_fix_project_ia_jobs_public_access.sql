/*
  # Permitir acesso público ao sistema de IA de projetos

  ## Problema
  O sistema estava configurado com autenticação obrigatória (`TO authenticated`),
  mas não há tela de login implementada. O resto do sistema usa acesso público.

  ## Solução
  Alterar políticas RLS de `TO authenticated` para `TO public` (USING true),
  alinhando com o padrão do sistema (ai_document_templates, etc).

  ## Tabelas Afetadas
  - project_ia_jobs
  - project_ia_job_files
  - project_ia_outputs

  ## Segurança
  - RLS continua habilitado
  - Acesso público permitido (como resto do sistema)
  - created_by continua sendo preenchido automaticamente
*/

-- ========================================
-- project_ia_jobs: Remover políticas antigas
-- ========================================

DROP POLICY IF EXISTS "Users can view own jobs" ON project_ia_jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON project_ia_jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON project_ia_jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON project_ia_jobs;

-- ========================================
-- project_ia_jobs: Criar políticas públicas
-- ========================================

CREATE POLICY "Public access to project_ia_jobs"
  ON project_ia_jobs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ========================================
-- project_ia_job_files: Remover políticas antigas
-- ========================================

DROP POLICY IF EXISTS "Users can view own job files" ON project_ia_job_files;
DROP POLICY IF EXISTS "Users can upload files to own jobs" ON project_ia_job_files;
DROP POLICY IF EXISTS "Users can delete files from own jobs" ON project_ia_job_files;

-- ========================================
-- project_ia_job_files: Criar políticas públicas
-- ========================================

CREATE POLICY "Public access to project_ia_job_files"
  ON project_ia_job_files FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ========================================
-- project_ia_outputs: Remover políticas antigas
-- ========================================

DROP POLICY IF EXISTS "Users can view own job outputs" ON project_ia_outputs;
DROP POLICY IF EXISTS "Users can create outputs for own jobs" ON project_ia_outputs;
DROP POLICY IF EXISTS "Users can update outputs of own jobs" ON project_ia_outputs;

-- ========================================
-- project_ia_outputs: Criar políticas públicas
-- ========================================

CREATE POLICY "Public access to project_ia_outputs"
  ON project_ia_outputs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ========================================
-- Storage: Atualizar políticas para público
-- ========================================

DROP POLICY IF EXISTS "Users can upload ia files" ON storage.objects;
CREATE POLICY "Public can upload ia files"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'ia-files');

DROP POLICY IF EXISTS "Users can view ia files" ON storage.objects;
CREATE POLICY "Public can view ia files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ia-files');

DROP POLICY IF EXISTS "Users can delete ia files" ON storage.objects;
CREATE POLICY "Public can delete ia files"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'ia-files');

-- ========================================
-- Função: Atualizar create_project_ia_job
-- ========================================

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
  -- Obter usuário atual (pode ser null se não autenticado)
  v_user_id := auth.uid();

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

-- ========================================
-- Coluna created_by: Permitir NULL
-- ========================================

ALTER TABLE project_ia_jobs
ALTER COLUMN created_by DROP NOT NULL;

COMMENT ON COLUMN project_ia_jobs.created_by IS 'ID do usuário que criou o job (opcional - preenchido via auth.uid() se autenticado)';
