
/*
  # Fase 1: Criar schema de arquivo e tabela de log

  ## Objetivo
  Preparar a infraestrutura para arquivamento seguro do módulo de engenharia legado.

  ## O que esta migração faz
  1. Cria o schema `archived_engineering_20260329`
  2. Cria tabela de log `archive_operation_log` para registrar cada passo
  3. Registra inventário inicial das tabelas a serem arquivadas

  ## Preserva integralmente
  - Módulo Indústria: products, materials, production, sales, deliveries, quotes, etc.
  - Módulo Construtora: construction_works, construction_projects, budgets, etc.
  - Sistema Novo: clientes, e qualquer tabela do novo sistema

  ## Notas
  - customers, quotes, sales NÃO serão arquivadas (usadas por Indústria e Construtora)
  - properties SERÁ arquivada (portal do cliente desativado)
*/

-- Criar schema de arquivo
CREATE SCHEMA IF NOT EXISTS archived_engineering_20260329;

-- Tabela de log de operações de arquivamento
CREATE TABLE IF NOT EXISTS archived_engineering_20260329.archive_operation_log (
  id             serial PRIMARY KEY,
  fase           text NOT NULL,
  tabela         text NOT NULL,
  operacao       text NOT NULL,
  status         text NOT NULL DEFAULT 'pendente',
  registros_antes bigint,
  registros_depois bigint,
  erro           text,
  executado_em   timestamptz DEFAULT now(),
  notas          text
);

-- Registrar inventário inicial com contagem de registros
DO $$
DECLARE
  v_count bigint;
  v_tables text[] := ARRAY[
    -- Fase 2: Tabelas exclusivas de Engenharia
    'engineering_project_costs',
    'engineering_project_markers',
    'engineering_project_document_updates',
    'engineering_project_alerts',
    'engineering_project_attachments',
    'engineering_project_transfers',
    'engineering_project_stage_history',
    'engineering_project_stages',
    'engineering_project_template_stages',
    'engineering_project_template_stages',
    'engineering_project_advances',
    'engineering_project_payments',
    'engineering_project_services',
    'engineering_recurring_charges',
    'engineering_finance_entries',
    'engineering_expense_categories',
    'engineering_payroll_schedule',
    'engineering_service_checklist_items',
    'engineering_service_templates',
    'engineering_services',
    'engineering_project_templates',
    'engineering_projects',
    -- project_* tables
    'project_receipts',
    'project_responsibility_transfers',
    'project_services_assignments',
    'project_services',
    'project_progress_history',
    'project_ia_outputs',
    'project_ia_job_files',
    'project_ia_jobs',
    'project_concrete_markers',
    'project_checklist_items',
    'project_additional_costs',
    'project_payments',
    -- AI tables
    'ai_document_attachments',
    'ai_document_revisions',
    'ai_document_section_contents',
    'ai_document_sections',
    'ai_document_templates',
    'ai_generated_documents',
    'ai_generation_jobs',
    'ai_system_config',
    -- Geo validation
    'geo_validation_audit_log',
    'geo_validation_prompts',
    'geo_validations',
    'geo_validation_reports',
    -- Meetings
    'meeting_tasks',
    'meeting_topics',
    'meetings',
    -- Misc engenharia
    'technical_responsibles',
    'shared_link_accesses',
    'shared_links',
    -- Fase 3: Properties e portal
    'whatsapp_notifications',
    'document_deadlines',
    'client_notifications',
    'customer_access_tokens',
    'customer_credits',
    'customer_statement',
    'customer_revenue',
    'installment_payments',
    'quote_installments',
    'payment_receipts',
    'properties',
    -- Fase 4: Backups legados
    'backup_customers_20260329',
    'backup_customers_clientes_mapping_20260329',
    'customers_backup',
    'customers_clientes_mapping'
  ];
  v_tbl text;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', v_tbl) INTO v_count;
      INSERT INTO archived_engineering_20260329.archive_operation_log 
        (fase, tabela, operacao, status, registros_antes, notas)
      VALUES ('inventario', v_tbl, 'contagem_inicial', 'registrado', v_count, 
              'Inventário inicial antes do arquivamento - ' || now()::text);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO archived_engineering_20260329.archive_operation_log 
        (fase, tabela, operacao, status, erro)
      VALUES ('inventario', v_tbl, 'contagem_inicial', 'erro', SQLERRM);
    END;
  END LOOP;
END $$;
