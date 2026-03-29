/*
  # Rollback Fase 1: Restaurar tabelas do modulo de Engenharia ao schema public

  Restaura as tabelas do modulo de engenharia que foram arquivadas no schema
  archived_engineering_20260329 de volta ao schema public.

  Tabelas restauradas nesta migracao (ordem: raiz primeiro, dependentes depois):
  - engineering_project_templates
  - engineering_service_templates
  - engineering_services
  - engineering_service_checklist_items
  - template_services
  - template_checklist_items
  - engineering_project_stages
  - engineering_project_template_stages
  - engineering_project_services
  - engineering_project_payments
  - engineering_expense_categories
  - engineering_payroll_schedule
  - engineering_project_advances
  - monthly_extra_payments
  - overtime_records
  - payroll_charges
  - payroll_schedule
  - project_responsibility_transfers
  - engineering_project_costs
  - engineering_project_markers
  - engineering_project_document_updates
  - engineering_project_alerts
  - engineering_project_attachments
  - engineering_project_transfers
  - engineering_project_stage_history
  - engineering_recurring_charges
  - engineering_projects_backup

  Nota: engineering_projects e engineering_finance_entries ja estao em public.
*/

-- Restaurar engineering_project_templates (depende de engineering_projects que ja esta em public)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_templates'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_templates SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_service_templates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_service_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_service_templates'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_service_templates SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_services
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_services'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_services'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_services SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_service_checklist_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_service_checklist_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_service_checklist_items'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_service_checklist_items SET SCHEMA public;
  END IF;
END $$;

-- Restaurar template_services
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'template_services'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'template_services'
  ) THEN
    ALTER TABLE archived_engineering_20260329.template_services SET SCHEMA public;
  END IF;
END $$;

-- Restaurar template_checklist_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'template_checklist_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'template_checklist_items'
  ) THEN
    ALTER TABLE archived_engineering_20260329.template_checklist_items SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_stages
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_stages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_stages'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_stages SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_template_stages
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_template_stages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_template_stages'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_template_stages SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_services
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_services'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_services'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_services SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_payments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_payments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_payments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_payments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_expense_categories
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_expense_categories'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_expense_categories'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_expense_categories SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_payroll_schedule
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_payroll_schedule'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_payroll_schedule'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_payroll_schedule SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_advances
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_advances'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_advances'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_advances SET SCHEMA public;
  END IF;
END $$;

-- Restaurar monthly_extra_payments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'monthly_extra_payments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'monthly_extra_payments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.monthly_extra_payments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar overtime_records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'overtime_records'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'overtime_records'
  ) THEN
    ALTER TABLE archived_engineering_20260329.overtime_records SET SCHEMA public;
  END IF;
END $$;

-- Restaurar payroll_charges
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'payroll_charges'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'payroll_charges'
  ) THEN
    ALTER TABLE archived_engineering_20260329.payroll_charges SET SCHEMA public;
  END IF;
END $$;

-- Restaurar payroll_schedule
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'payroll_schedule'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'payroll_schedule'
  ) THEN
    ALTER TABLE archived_engineering_20260329.payroll_schedule SET SCHEMA public;
  END IF;
END $$;

-- Restaurar project_responsibility_transfers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'project_responsibility_transfers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'project_responsibility_transfers'
  ) THEN
    ALTER TABLE archived_engineering_20260329.project_responsibility_transfers SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_costs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_costs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_costs'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_costs SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_markers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_markers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_markers'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_markers SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_document_updates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_document_updates'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_document_updates'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_document_updates SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_alerts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_alerts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_alerts'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_alerts SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_attachments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_attachments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_attachments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_attachments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_transfers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_transfers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_transfers'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_transfers SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_project_stage_history
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_project_stage_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_project_stage_history'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_project_stage_history SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_recurring_charges
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_recurring_charges'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_recurring_charges'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_recurring_charges SET SCHEMA public;
  END IF;
END $$;

-- Restaurar engineering_projects_backup
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'engineering_projects_backup'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'engineering_projects_backup'
  ) THEN
    ALTER TABLE archived_engineering_20260329.engineering_projects_backup SET SCHEMA public;
  END IF;
END $$;
