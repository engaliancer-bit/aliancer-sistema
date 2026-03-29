/*
  # Rollback Fase 6b: Corrigir FK residual de engineering_finance_entries

  O constraint engineering_finance_entries_project_id_fkey ainda aponta para
  o schema arquivado. Esta migracao corrige isso.

  Nota: A tabela engineering_finance_entries esta em public, mas o FK foi
  recreado apontando para o archive. Isso ocorre porque a tabela em public
  foi criada antes de repontar os FKs. Recriamos o FK corretamente.
*/

-- Recriar FK de engineering_finance_entries para public.engineering_projects
ALTER TABLE public.engineering_finance_entries
  DROP CONSTRAINT IF EXISTS engineering_finance_entries_project_id_fkey;

ALTER TABLE public.engineering_finance_entries
  ADD CONSTRAINT engineering_finance_entries_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;
