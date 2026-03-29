/*
  # Rollback Fase 2: Restaurar tabelas de AI, Meetings e Geo-validacao ao schema public

  Restaura as tabelas do sistema de IA de documentos, reunioes, geo-validacao
  e tabelas auxiliares que foram arquivadas.

  Tabelas restauradas:
  - Projetos de IA: project_ia_jobs, project_ia_job_files, project_ia_outputs
  - Sistema AI documentos: ai_document_templates, ai_document_sections, ai_document_section_contents,
    ai_generated_documents, ai_generation_jobs, ai_document_revisions, ai_document_attachments,
    ai_system_config
  - Geo-validacao: geo_validations, geo_validation_audit_log, geo_validation_prompts, geo_validation_reports
  - Reunioes: meetings, meeting_topics, meeting_tasks
  - Auxiliares: technical_responsibles, shared_links, shared_link_accesses
  - Projetos: project_checklist_items, project_additional_costs, project_concrete_markers,
    project_payments, project_progress_history, project_receipts, project_services,
    project_services_assignments
*/

-- Restaurar project_ia_jobs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_ia_jobs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_ia_jobs'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_ia_jobs SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_ia_job_files
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_ia_job_files'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_ia_job_files'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_ia_job_files SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_ia_outputs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_ia_outputs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_ia_outputs'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_ia_outputs SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_system_config (sem dependencias)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_system_config'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_system_config'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_system_config SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_document_templates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_document_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_document_templates'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_document_templates SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_document_sections
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_document_sections'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_document_sections'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_document_sections SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_generated_documents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_generated_documents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_generated_documents'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_generated_documents SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_generation_jobs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_generation_jobs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_generation_jobs'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_generation_jobs SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_document_section_contents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_document_section_contents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_document_section_contents'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_document_section_contents SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_document_revisions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_document_revisions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_document_revisions'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_document_revisions SET SCHEMA public;
  END IF;
END $$;

-- Restaurar ai_document_attachments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'ai_document_attachments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'ai_document_attachments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.ai_document_attachments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar geo_validations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'geo_validations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'geo_validations'
  ) THEN
    ALTER TABLE archived_engineering_20260329.geo_validations SET SCHEMA public;
  END IF;
END $$;

-- Restaurar geo_validation_audit_log
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'geo_validation_audit_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'geo_validation_audit_log'
  ) THEN
    ALTER TABLE archived_engineering_20260329.geo_validation_audit_log SET SCHEMA public;
  END IF;
END $$;

-- Restaurar geo_validation_prompts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'geo_validation_prompts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'geo_validation_prompts'
  ) THEN
    ALTER TABLE archived_engineering_20260329.geo_validation_prompts SET SCHEMA public;
  END IF;
END $$;

-- Restaurar geo_validation_reports
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'geo_validation_reports'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'geo_validation_reports'
  ) THEN
    ALTER TABLE archived_engineering_20260329.geo_validation_reports SET SCHEMA public;
  END IF;
END $$;

-- Restaurar meetings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'meetings'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'meetings'
  ) THEN
    ALTER TABLE archived_engineering_20260329.meetings SET SCHEMA public;
  END IF;
END $$;

-- Restaurar meeting_topics
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'meeting_topics'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'meeting_topics'
  ) THEN
    ALTER TABLE archived_engineering_20260329.meeting_topics SET SCHEMA public;
  END IF;
END $$;

-- Restaurar meeting_tasks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'meeting_tasks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'meeting_tasks'
  ) THEN
    ALTER TABLE archived_engineering_20260329.meeting_tasks SET SCHEMA public;
  END IF;
END $$;

-- Restaurar technical_responsibles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'technical_responsibles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'technical_responsibles'
  ) THEN
    ALTER TABLE archived_engineering_20260329.technical_responsibles SET SCHEMA public;
  END IF;
END $$;

-- Restaurar shared_links
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'shared_links'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'shared_links'
  ) THEN
    ALTER TABLE archived_engineering_20260329.shared_links SET SCHEMA public;
  END IF;
END $$;

-- Restaurar shared_link_accesses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'shared_link_accesses'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'shared_link_accesses'
  ) THEN
    ALTER TABLE archived_engineering_20260329.shared_link_accesses SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_checklist_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_checklist_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_checklist_items'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_checklist_items SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_additional_costs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_additional_costs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_additional_costs'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_additional_costs SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_concrete_markers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_concrete_markers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_concrete_markers'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_concrete_markers SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_payments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_payments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_payments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_payments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_progress_history
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_progress_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_progress_history'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_progress_history SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_receipts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_receipts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_receipts'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_receipts SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_services
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_services'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_services'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_services SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_services_assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_services_assignments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_services_assignments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_services_assignments SET SCHEMA public;
  END IF;
END $$;
