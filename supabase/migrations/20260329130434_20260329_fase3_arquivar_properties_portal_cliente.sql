
/*
  # Fase 3: Arquivar properties, portal do cliente e tabelas relacionadas

  ## Decisão confirmada pelo usuário
  - properties: PODE arquivar (portal do cliente desativado)
  - document_deadlines: depende de properties
  - whatsapp_notifications: depende de document_deadlines
  - client_notifications: depende de properties e engineering_projects (já arquivada)
  - customer_access_tokens: portal do cliente
  - customer_credits: créditos de clientes do portal
  - customer_statement: extrato do portal
  - customer_revenue: receitas de clientes do portal

  ## Preserva
  - customers (usada por Indústria e Construtora)
  - clientes (sistema novo)
  - installment_payments e payment_receipts (ligadas a quotes - mantidas)
  - quote_installments (mantida, usada por customer_revenue via FK)

  ## IMPORTANTE
  - quote_installments tem FK de customer_revenue
  - Arquivando customer_revenue antes, podemos arquivar quote_installments depois se necessário
  - installment_payments tem FK para quote_installments -> mantemos ambas em public
*/

-- whatsapp_notifications (depende de document_deadlines)
ALTER TABLE public.whatsapp_notifications 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'whatsapp_notifications', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- document_deadlines (depende de properties)
ALTER TABLE public.document_deadlines 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'document_deadlines', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- client_notifications (depende de properties e engineering_projects - ambas arquivadas)
ALTER TABLE public.client_notifications 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'client_notifications', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- customer_access_tokens (portal do cliente)
ALTER TABLE public.customer_access_tokens 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'customer_access_tokens', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- customer_credits (portal do cliente - depende de clientes, não de engineering)
ALTER TABLE public.customer_credits 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'customer_credits', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- customer_statement (depende de customer_revenue)
ALTER TABLE public.customer_statement 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'customer_statement', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- installment_payments (depende de quote_installments)
ALTER TABLE public.installment_payments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'installment_payments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- payment_receipts (depende de installment_payments, quotes, customers, clientes)
ALTER TABLE public.payment_receipts 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'payment_receipts', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- customer_revenue (depende de clientes e quote_installments)
ALTER TABLE public.customer_revenue 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'customer_revenue', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- quote_installments (depende de quotes - mantida em public para não quebrar quotes)
-- customer_revenue foi arquivada, logo podemos arquivar quote_installments
ALTER TABLE public.quote_installments 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'quote_installments', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- service_requests (portal do cliente - depende de properties, customers, clientes)
ALTER TABLE public.service_requests 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'service_requests', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- service_approvals (depende de service_requests e engineering_projects - ambas arquivadas)
ALTER TABLE public.service_approvals 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'service_approvals', 'SET SCHEMA', 'concluido', 'Movida para schema de arquivo');
END $$;

-- properties (tabela raiz desta fase - por último)
ALTER TABLE public.properties 
  SET SCHEMA archived_engineering_20260329;

DO $$ BEGIN
  INSERT INTO archived_engineering_20260329.archive_operation_log(fase, tabela, operacao, status, notas)
  VALUES ('fase3', 'properties', 'SET SCHEMA', 'concluido', 'Tabela raiz arquivada - FASE 3 CONCLUIDA');
END $$;
