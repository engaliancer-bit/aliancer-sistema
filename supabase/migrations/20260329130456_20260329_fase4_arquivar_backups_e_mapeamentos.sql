
/*
  # Fase 4: Arquivar tabelas de backup legadas e mapeamentos

  ## Tabelas nesta fase
  - backup_customers_20260329 (backup criado em 2026-03-29)
  - backup_customers_clientes_mapping_20260329 (backup de mapeamento)
  - customers_backup (backup mais antigo)
  - customers_clientes_mapping (mapeamento legado entre customers e clientes)
  - service_categories (categorias de serviços de engenharia)
  - services (serviços gerais - se exclusivo de engenharia)

  ## PRESERVA
  - customers (em public - usada por Indústria e Construtora)
  - clientes (em public - sistema novo)
*/

-- backup_customers_20260329
ALTER TABLE public.backup_customers_20260329 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase4', 'backup_customers_20260329', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- backup_customers_clientes_mapping_20260329
ALTER TABLE public.backup_customers_clientes_mapping_20260329 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase4', 'backup_customers_clientes_mapping_20260329', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- customers_backup
ALTER TABLE public.customers_backup 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase4', 'customers_backup', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- customers_clientes_mapping
ALTER TABLE public.customers_clientes_mapping 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase4', 'customers_clientes_mapping', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- service_categories (categorias de serviços de engenharia)
ALTER TABLE public.service_categories 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase4', 'service_categories', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- services (serviços gerais do módulo engenharia)
ALTER TABLE public.services 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase4', 'services', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- Registrar conclusão do arquivamento
INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
VALUES ('conclusao', 'ALL', 'ARQUIVAMENTO_COMPLETO', 'concluido', 
        'Arquivamento do módulo de engenharia legado concluído em ' || now()::text || 
        '. Schema: archived_engineering_20260329. Preservados: Industria, Construtora, Sistema Novo.');
