/*
  # Rollback Fase 7: Remover schema de arquivamento (agora vazio)

  Todas as tabelas foram restauradas ao schema public e os FK constraints
  foram repontados corretamente. Agora removemos as copias residuais no
  schema de arquivo e o proprio schema.
*/

-- Remover copia residual de engineering_projects do schema de arquivo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_projects'
  ) THEN
    DROP TABLE archived_engineering_20260329.engineering_projects CASCADE;
  END IF;
END $$;

-- Remover copia residual de engineering_finance_entries do schema de arquivo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_finance_entries'
  ) THEN
    DROP TABLE archived_engineering_20260329.engineering_finance_entries CASCADE;
  END IF;
END $$;

-- Remover o schema de arquivamento (agora vazio)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata
    WHERE schema_name = 'archived_engineering_20260329'
  ) THEN
    DROP SCHEMA archived_engineering_20260329 CASCADE;
  END IF;
END $$;
