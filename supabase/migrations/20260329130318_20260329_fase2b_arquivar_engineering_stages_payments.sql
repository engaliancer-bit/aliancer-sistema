
/*
  # Fase 2b: Arquivar tabelas de stages, payments e advances de engineering

  ## Tabelas nesta fase
  - project_responsibility_transfers (depende de engineering_project_stages)
  - engineering_project_advances (depende de engineering_project_payments)
  - engineering_project_payments (depois de advances ser arquivada)
  - engineering_project_stages (depois de stage_history, alerts, transfers)
  - engineering_project_template_stages
  - engineering_project_services
*/

-- project_responsibility_transfers (depende de engineering_project_stages)
ALTER TABLE public.project_responsibility_transfers 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'project_responsibility_transfers', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_advances (FK para engineering_project_payments - precisa ir antes)
ALTER TABLE public.engineering_project_advances 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_project_advances', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_finance_entries (referenciada por advances, payroll, overtime, etc.)
-- Precisa ser removida antes das tabelas que a referenciam
-- monthly_extra_payments e overtime_records referenciam engineering_finance_entries
ALTER TABLE public.monthly_extra_payments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'monthly_extra_payments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.overtime_records 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'overtime_records', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.payroll_charges 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'payroll_charges', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.payroll_schedule 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'payroll_schedule', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.engineering_payroll_schedule 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_payroll_schedule', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.engineering_finance_entries 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_finance_entries', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.engineering_expense_categories 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_expense_categories', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_payments (depois de advances)
ALTER TABLE public.engineering_project_payments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_project_payments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_services
ALTER TABLE public.engineering_project_services 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_project_services', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_stages (depois de stage_history, alerts, transfers, services)
ALTER TABLE public.engineering_project_stages 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_project_stages', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_template_stages
ALTER TABLE public.engineering_project_template_stages 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2b', 'engineering_project_template_stages', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;
