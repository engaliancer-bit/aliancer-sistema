/*
  # Corrigir autenticação em project_ia_jobs

  1. Alterações
    - Adiciona default auth.uid() na coluna created_by
    - Garante que created_by seja preenchido automaticamente
    - Melhora segurança e rastreabilidade

  2. Segurança
    - RLS já está habilitado
    - Policies existentes validam created_by = auth.uid()
*/

-- Adicionar default auth.uid() na coluna created_by
ALTER TABLE project_ia_jobs
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Atualizar registros existentes sem created_by
UPDATE project_ia_jobs
SET created_by = (
  SELECT id 
  FROM auth.users 
  LIMIT 1
)
WHERE created_by IS NULL;

-- Tornar coluna NOT NULL (agora que tem default)
ALTER TABLE project_ia_jobs
ALTER COLUMN created_by SET NOT NULL;

-- Comentário
COMMENT ON COLUMN project_ia_jobs.created_by IS 'ID do usuário que criou o job (preenchido automaticamente via auth.uid())';
