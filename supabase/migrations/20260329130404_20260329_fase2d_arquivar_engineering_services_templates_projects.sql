
/*
  # Fase 2d: Arquivar engineering_services, templates e engineering_projects (tabela raiz)

  ## Ordem
  1. engineering_service_checklist_items (depende de engineering_service_templates)
  2. engineering_services
  3. engineering_service_templates (referenciada por ai_document_templates - já arquivada)
  4. template_checklist_items, template_services (dependem de engineering_project_templates)
  5. engineering_project_templates
  6. engineering_projects (tabela raiz - por último)
*/

-- engineering_service_checklist_items
ALTER TABLE public.engineering_service_checklist_items 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'engineering_service_checklist_items', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_services
ALTER TABLE public.engineering_services 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'engineering_services', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_service_templates
ALTER TABLE public.engineering_service_templates 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'engineering_service_templates', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- template_checklist_items (depende de engineering_project_templates)
ALTER TABLE public.template_checklist_items 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'template_checklist_items', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- template_services (depende de engineering_project_templates)
ALTER TABLE public.template_services 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'template_services', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_project_templates
ALTER TABLE public.engineering_project_templates 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'engineering_project_templates', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- engineering_projects (tabela raiz - última a ser arquivada nesta fase)
ALTER TABLE public.engineering_projects 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase2d', 'engineering_projects', 'SET SCHEMA', 'concluido', 'Tabela raiz arquivada - FASE 2 CONCLUIDA');
END $$;
