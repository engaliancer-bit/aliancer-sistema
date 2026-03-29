
/*
  # Fase 2c: Arquivar project_* tables, AI tables, geo_validation e meetings

  ## Tabelas nesta fase
  - project_receipts, project_services, project_services_assignments
  - project_progress_history, project_checklist_items, project_additional_costs
  - project_concrete_markers, project_payments
  - project_ia_outputs, project_ia_job_files, project_ia_jobs
  - AI document system tables
  - geo_validation tables
  - meetings tables
  - technical_responsibles, shared_links, shared_link_accesses
*/

-- project_receipts (depende de project_payments e engineering_projects)
ALTER TABLE public.project_receipts 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_receipts', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_services_assignments (depende de engineering_services e engineering_projects)
ALTER TABLE public.project_services_assignments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_services_assignments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_services
ALTER TABLE public.project_services 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_services', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_progress_history
ALTER TABLE public.project_progress_history 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_progress_history', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_checklist_items
ALTER TABLE public.project_checklist_items 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_checklist_items', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_additional_costs
ALTER TABLE public.project_additional_costs 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_additional_costs', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_concrete_markers
ALTER TABLE public.project_concrete_markers 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_concrete_markers', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_payments
ALTER TABLE public.project_payments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_payments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_ia_outputs (depende de project_ia_jobs)
ALTER TABLE public.project_ia_outputs 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_ia_outputs', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_ia_job_files (depende de project_ia_jobs)
ALTER TABLE public.project_ia_job_files 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_ia_job_files', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- project_ia_jobs
ALTER TABLE public.project_ia_jobs 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'project_ia_jobs', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- AI Document tables (ordem: filhas primeiro)
ALTER TABLE public.ai_document_attachments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_document_attachments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_document_revisions 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_document_revisions', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_document_section_contents 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_document_section_contents', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_generation_jobs 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_generation_jobs', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_generated_documents 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_generated_documents', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_document_sections 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_document_sections', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_document_templates 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_document_templates', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.ai_system_config 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'ai_system_config', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- Geo validation tables (public schema copies)
ALTER TABLE public.geo_validation_audit_log 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'geo_validation_audit_log', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.geo_validation_reports 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'geo_validation_reports', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.geo_validations 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'geo_validations', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.geo_validation_prompts 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'geo_validation_prompts', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- Meetings tables (filhas primeiro)
ALTER TABLE public.meeting_tasks 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'meeting_tasks', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.meeting_topics 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'meeting_topics', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

ALTER TABLE public.meetings 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'meetings', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- technical_responsibles
ALTER TABLE public.technical_responsibles 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'technical_responsibles', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- shared_link_accesses (filha)
ALTER TABLE public.shared_link_accesses 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'shared_link_accesses', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- shared_links (pai)
ALTER TABLE public.shared_links 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2c', 'shared_links', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;
