
/*
  # Fase 2a: Arquivar tabelas filhas de engineering_projects

  ## Ordem de arquivamento (filhas primeiro para evitar violação de FK)
  Tabelas sem dependentes diretos ou com dependentes já arquivados:
  - engineering_project_costs
  - engineering_project_markers  
  - engineering_project_document_updates
  - engineering_project_alerts
  - engineering_project_attachments
  - engineering_project_transfers
  - engineering_project_stage_history
  - engineering_project_responsibility_transfers (alias: project_responsibility_transfers)
  - engineering_recurring_charges

  ## Preserva
  - Nenhuma FK para Industria ou Construtora nessas tabelas
*/

-- engineering_project_costs
ALTER TABLE public.engineering_project_costs 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_costs', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_markers
ALTER TABLE public.engineering_project_markers 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_markers', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_document_updates
ALTER TABLE public.engineering_project_document_updates 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_document_updates', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_alerts
ALTER TABLE public.engineering_project_alerts 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_alerts', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_attachments
ALTER TABLE public.engineering_project_attachments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_attachments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_transfers
ALTER TABLE public.engineering_project_transfers 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_transfers', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_stage_history
ALTER TABLE public.engineering_project_stage_history 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_project_stage_history', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_recurring_charges
ALTER TABLE public.engineering_recurring_charges 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2a', 'engineering_recurring_charges', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;
