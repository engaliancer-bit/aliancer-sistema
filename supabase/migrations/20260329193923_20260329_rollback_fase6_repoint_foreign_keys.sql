/*
  # Rollback Fase 6: Repontar chaves estrangeiras para o schema public

  As tabelas foram restauradas ao schema public, mas os constraints de FK ainda
  apontam para as copias no schema de arquivo. Esta migracao:
  1. Remove os FK constraints que apontam para o schema arquivado
  2. Recria os FK constraints apontando para public.engineering_projects
     e public.engineering_finance_entries

  Tabelas afetadas (FKs para engineering_projects):
  - ai_generated_documents
  - client_notifications
  - engineering_project_advances
  - engineering_project_alerts
  - engineering_project_attachments
  - engineering_project_costs
  - engineering_project_document_updates
  - engineering_project_markers
  - engineering_project_payments
  - engineering_project_services
  - engineering_project_stage_history
  - engineering_project_stages
  - engineering_project_transfers
  - engineering_recurring_charges
  - geo_validation_reports
  - geo_validations
  - meetings
  - project_additional_costs
  - project_checklist_items
  - project_concrete_markers
  - project_ia_jobs
  - project_payments
  - project_progress_history
  - project_receipts
  - project_responsibility_transfers
  - project_services
  - project_services_assignments
  - properties
  - service_approvals

  Tabelas afetadas (FKs para engineering_finance_entries):
  - engineering_payroll_schedule
  - engineering_project_advances
  - engineering_recurring_charges
  - monthly_extra_payments
  - overtime_records
  - payroll_schedule
*/

-- Drop e recriar FK: ai_generated_documents -> engineering_projects
ALTER TABLE public.ai_generated_documents
  DROP CONSTRAINT IF EXISTS ai_generated_documents_project_id_fkey;
ALTER TABLE public.ai_generated_documents
  ADD CONSTRAINT ai_generated_documents_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: client_notifications -> engineering_projects
ALTER TABLE public.client_notifications
  DROP CONSTRAINT IF EXISTS client_notifications_project_id_fkey;
ALTER TABLE public.client_notifications
  ADD CONSTRAINT client_notifications_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_finance_entries -> engineering_projects
ALTER TABLE public.engineering_finance_entries
  DROP CONSTRAINT IF EXISTS engineering_finance_entries_project_id_fkey;
ALTER TABLE public.engineering_finance_entries
  ADD CONSTRAINT engineering_finance_entries_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_payroll_schedule -> engineering_finance_entries
ALTER TABLE public.engineering_payroll_schedule
  DROP CONSTRAINT IF EXISTS engineering_payroll_schedule_finance_entry_id_fkey;
ALTER TABLE public.engineering_payroll_schedule
  ADD CONSTRAINT engineering_payroll_schedule_finance_entry_id_fkey
  FOREIGN KEY (finance_entry_id) REFERENCES public.engineering_finance_entries(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_advances -> engineering_finance_entries
ALTER TABLE public.engineering_project_advances
  DROP CONSTRAINT IF EXISTS engineering_project_advances_finance_entry_id_fkey;
ALTER TABLE public.engineering_project_advances
  ADD CONSTRAINT engineering_project_advances_finance_entry_id_fkey
  FOREIGN KEY (finance_entry_id) REFERENCES public.engineering_finance_entries(id) ON DELETE SET NULL;

-- Drop e recriar FK: engineering_project_advances -> engineering_projects
ALTER TABLE public.engineering_project_advances
  DROP CONSTRAINT IF EXISTS engineering_project_advances_project_id_fkey;
ALTER TABLE public.engineering_project_advances
  ADD CONSTRAINT engineering_project_advances_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_alerts -> engineering_projects
ALTER TABLE public.engineering_project_alerts
  DROP CONSTRAINT IF EXISTS engineering_project_alerts_project_id_fkey;
ALTER TABLE public.engineering_project_alerts
  ADD CONSTRAINT engineering_project_alerts_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_attachments -> engineering_projects
ALTER TABLE public.engineering_project_attachments
  DROP CONSTRAINT IF EXISTS engineering_project_attachments_project_id_fkey;
ALTER TABLE public.engineering_project_attachments
  ADD CONSTRAINT engineering_project_attachments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_costs -> engineering_projects
ALTER TABLE public.engineering_project_costs
  DROP CONSTRAINT IF EXISTS engineering_project_costs_project_id_fkey;
ALTER TABLE public.engineering_project_costs
  ADD CONSTRAINT engineering_project_costs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_document_updates -> engineering_projects
ALTER TABLE public.engineering_project_document_updates
  DROP CONSTRAINT IF EXISTS engineering_project_document_updates_project_id_fkey;
ALTER TABLE public.engineering_project_document_updates
  ADD CONSTRAINT engineering_project_document_updates_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_markers -> engineering_projects
ALTER TABLE public.engineering_project_markers
  DROP CONSTRAINT IF EXISTS engineering_project_markers_project_id_fkey;
ALTER TABLE public.engineering_project_markers
  ADD CONSTRAINT engineering_project_markers_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_payments -> engineering_projects
ALTER TABLE public.engineering_project_payments
  DROP CONSTRAINT IF EXISTS engineering_project_payments_project_id_fkey;
ALTER TABLE public.engineering_project_payments
  ADD CONSTRAINT engineering_project_payments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_services -> engineering_projects
ALTER TABLE public.engineering_project_services
  DROP CONSTRAINT IF EXISTS engineering_project_services_project_id_fkey;
ALTER TABLE public.engineering_project_services
  ADD CONSTRAINT engineering_project_services_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_stage_history -> engineering_projects
ALTER TABLE public.engineering_project_stage_history
  DROP CONSTRAINT IF EXISTS engineering_project_stage_history_project_id_fkey;
ALTER TABLE public.engineering_project_stage_history
  ADD CONSTRAINT engineering_project_stage_history_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_stages -> engineering_projects
ALTER TABLE public.engineering_project_stages
  DROP CONSTRAINT IF EXISTS engineering_project_stages_project_id_fkey;
ALTER TABLE public.engineering_project_stages
  ADD CONSTRAINT engineering_project_stages_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_project_transfers -> engineering_projects
ALTER TABLE public.engineering_project_transfers
  DROP CONSTRAINT IF EXISTS engineering_project_transfers_project_id_fkey;
ALTER TABLE public.engineering_project_transfers
  ADD CONSTRAINT engineering_project_transfers_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: engineering_recurring_charges -> engineering_finance_entries
ALTER TABLE public.engineering_recurring_charges
  DROP CONSTRAINT IF EXISTS engineering_recurring_charges_payment_id_fkey;
ALTER TABLE public.engineering_recurring_charges
  ADD CONSTRAINT engineering_recurring_charges_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.engineering_finance_entries(id) ON DELETE SET NULL;

-- Drop e recriar FK: engineering_recurring_charges -> engineering_projects
ALTER TABLE public.engineering_recurring_charges
  DROP CONSTRAINT IF EXISTS engineering_recurring_charges_project_id_fkey;
ALTER TABLE public.engineering_recurring_charges
  ADD CONSTRAINT engineering_recurring_charges_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: geo_validation_reports -> engineering_projects
ALTER TABLE public.geo_validation_reports
  DROP CONSTRAINT IF EXISTS geo_validation_reports_project_id_fkey;
ALTER TABLE public.geo_validation_reports
  ADD CONSTRAINT geo_validation_reports_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: geo_validations -> engineering_projects
ALTER TABLE public.geo_validations
  DROP CONSTRAINT IF EXISTS geo_validations_project_id_fkey;
ALTER TABLE public.geo_validations
  ADD CONSTRAINT geo_validations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: meetings -> engineering_projects
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_project_id_fkey;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE SET NULL;

-- Drop e recriar FK: monthly_extra_payments -> engineering_finance_entries
ALTER TABLE public.monthly_extra_payments
  DROP CONSTRAINT IF EXISTS monthly_extra_payments_finance_entry_id_fkey;
ALTER TABLE public.monthly_extra_payments
  ADD CONSTRAINT monthly_extra_payments_finance_entry_id_fkey
  FOREIGN KEY (finance_entry_id) REFERENCES public.engineering_finance_entries(id) ON DELETE CASCADE;

-- Drop e recriar FK: overtime_records -> engineering_finance_entries
ALTER TABLE public.overtime_records
  DROP CONSTRAINT IF EXISTS overtime_records_finance_entry_id_fkey;
ALTER TABLE public.overtime_records
  ADD CONSTRAINT overtime_records_finance_entry_id_fkey
  FOREIGN KEY (finance_entry_id) REFERENCES public.engineering_finance_entries(id) ON DELETE CASCADE;

-- Drop e recriar FK: payroll_schedule -> engineering_finance_entries
ALTER TABLE public.payroll_schedule
  DROP CONSTRAINT IF EXISTS payroll_schedule_finance_entry_id_fkey;
ALTER TABLE public.payroll_schedule
  ADD CONSTRAINT payroll_schedule_finance_entry_id_fkey
  FOREIGN KEY (finance_entry_id) REFERENCES public.engineering_finance_entries(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_additional_costs -> engineering_projects
ALTER TABLE public.project_additional_costs
  DROP CONSTRAINT IF EXISTS project_additional_costs_engineering_project_id_fkey;
ALTER TABLE public.project_additional_costs
  ADD CONSTRAINT project_additional_costs_engineering_project_id_fkey
  FOREIGN KEY (engineering_project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_checklist_items -> engineering_projects
ALTER TABLE public.project_checklist_items
  DROP CONSTRAINT IF EXISTS project_checklist_items_project_id_fkey;
ALTER TABLE public.project_checklist_items
  ADD CONSTRAINT project_checklist_items_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_concrete_markers -> engineering_projects
ALTER TABLE public.project_concrete_markers
  DROP CONSTRAINT IF EXISTS project_concrete_markers_engineering_project_id_fkey;
ALTER TABLE public.project_concrete_markers
  ADD CONSTRAINT project_concrete_markers_engineering_project_id_fkey
  FOREIGN KEY (engineering_project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_ia_jobs -> engineering_projects
ALTER TABLE public.project_ia_jobs
  DROP CONSTRAINT IF EXISTS project_ia_jobs_project_id_fkey;
ALTER TABLE public.project_ia_jobs
  ADD CONSTRAINT project_ia_jobs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_payments -> engineering_projects
ALTER TABLE public.project_payments
  DROP CONSTRAINT IF EXISTS project_payments_project_id_fkey;
ALTER TABLE public.project_payments
  ADD CONSTRAINT project_payments_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_progress_history -> engineering_projects
ALTER TABLE public.project_progress_history
  DROP CONSTRAINT IF EXISTS project_progress_history_project_id_fkey;
ALTER TABLE public.project_progress_history
  ADD CONSTRAINT project_progress_history_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_receipts -> engineering_projects
ALTER TABLE public.project_receipts
  DROP CONSTRAINT IF EXISTS project_receipts_project_id_fkey;
ALTER TABLE public.project_receipts
  ADD CONSTRAINT project_receipts_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_responsibility_transfers -> engineering_projects
ALTER TABLE public.project_responsibility_transfers
  DROP CONSTRAINT IF EXISTS project_responsibility_transfers_project_id_fkey;
ALTER TABLE public.project_responsibility_transfers
  ADD CONSTRAINT project_responsibility_transfers_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_services -> engineering_projects
ALTER TABLE public.project_services
  DROP CONSTRAINT IF EXISTS project_services_project_id_fkey;
ALTER TABLE public.project_services
  ADD CONSTRAINT project_services_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: project_services_assignments -> engineering_projects
ALTER TABLE public.project_services_assignments
  DROP CONSTRAINT IF EXISTS project_services_assignments_engineering_project_id_fkey;
ALTER TABLE public.project_services_assignments
  ADD CONSTRAINT project_services_assignments_engineering_project_id_fkey
  FOREIGN KEY (engineering_project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;

-- Drop e recriar FK: properties -> engineering_projects
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_project_id_fkey;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE SET NULL;

-- Drop e recriar FK: service_approvals -> engineering_projects
ALTER TABLE public.service_approvals
  DROP CONSTRAINT IF EXISTS service_approvals_project_id_fkey;
ALTER TABLE public.service_approvals
  ADD CONSTRAINT service_approvals_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.engineering_projects(id) ON DELETE CASCADE;
