/*
  # Rollback Fase 4: Restaurar tabelas legado, backups e mapeamentos ao schema public

  Restaura as tabelas de backup, mapeamentos e servicos legados que foram arquivadas.

  Tabelas restauradas:
  - service_categories
  - services
  - customers_backup
  - customers_clientes_mapping
  - backup_customers_20260329
  - backup_customers_clientes_mapping_20260329
  - archive_operation_log (o log do proprio processo de arquivamento)
*/

-- Restaurar service_categories
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'service_categories'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'service_categories'
  ) THEN
    ALTER TABLE archived_engineering_20260329.service_categories SET SCHEMA public;
  END IF;
END $$;

-- Restaurar services
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'services'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'services'
  ) THEN
    ALTER TABLE archived_engineering_20260329.services SET SCHEMA public;
  END IF;
END $$;

-- Restaurar customers_backup
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'customers_backup'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customers_backup'
  ) THEN
    ALTER TABLE archived_engineering_20260329.customers_backup SET SCHEMA public;
  END IF;
END $$;

-- Restaurar customers_clientes_mapping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'customers_clientes_mapping'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customers_clientes_mapping'
  ) THEN
    ALTER TABLE archived_engineering_20260329.customers_clientes_mapping SET SCHEMA public;
  END IF;
END $$;

-- Restaurar backup_customers_20260329
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'backup_customers_20260329'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'backup_customers_20260329'
  ) THEN
    ALTER TABLE archived_engineering_20260329.backup_customers_20260329 SET SCHEMA public;
  END IF;
END $$;

-- Restaurar backup_customers_clientes_mapping_20260329
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'backup_customers_clientes_mapping_20260329'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'backup_customers_clientes_mapping_20260329'
  ) THEN
    ALTER TABLE archived_engineering_20260329.backup_customers_clientes_mapping_20260329 SET SCHEMA public;
  END IF;
END $$;

-- Restaurar archive_operation_log (o log do processo de arquivamento)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'archive_operation_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'archive_operation_log'
  ) THEN
    ALTER TABLE archived_engineering_20260329.archive_operation_log SET SCHEMA public;
  END IF;
END $$;
