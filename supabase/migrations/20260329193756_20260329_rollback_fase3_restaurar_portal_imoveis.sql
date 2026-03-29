/*
  # Rollback Fase 3: Restaurar tabelas do Portal do Cliente e Imoveis ao schema public

  Restaura as tabelas do portal do cliente, imoveis, cobrancas recorrentes,
  receitas e pagamentos que foram arquivadas.

  Tabelas restauradas:
  - properties (root)
  - whatsapp_notifications
  - document_deadlines
  - client_notifications
  - customer_access_tokens
  - customer_credits
  - customer_revenue (se ainda no archive)
  - customer_statement
  - installment_payments
  - payment_receipts
  - quote_installments
  - service_requests
  - service_approvals
*/

-- Restaurar properties (dependencias: customers que ja esta em public)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'properties'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'properties'
  ) THEN
    ALTER TABLE archived_engineering_20260329.properties SET SCHEMA public;
  END IF;
END $$;

-- Restaurar whatsapp_notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'whatsapp_notifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'whatsapp_notifications'
  ) THEN
    ALTER TABLE archived_engineering_20260329.whatsapp_notifications SET SCHEMA public;
  END IF;
END $$;

-- Restaurar document_deadlines
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'document_deadlines'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'document_deadlines'
  ) THEN
    ALTER TABLE archived_engineering_20260329.document_deadlines SET SCHEMA public;
  END IF;
END $$;

-- Restaurar client_notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'client_notifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'client_notifications'
  ) THEN
    ALTER TABLE archived_engineering_20260329.client_notifications SET SCHEMA public;
  END IF;
END $$;

-- Restaurar customer_access_tokens
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'customer_access_tokens'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customer_access_tokens'
  ) THEN
    ALTER TABLE archived_engineering_20260329.customer_access_tokens SET SCHEMA public;
  END IF;
END $$;

-- Restaurar customer_credits
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'customer_credits'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customer_credits'
  ) THEN
    ALTER TABLE archived_engineering_20260329.customer_credits SET SCHEMA public;
  END IF;
END $$;

-- Restaurar customer_revenue (se ainda no archive)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'customer_revenue'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customer_revenue'
  ) THEN
    ALTER TABLE archived_engineering_20260329.customer_revenue SET SCHEMA public;
  END IF;
END $$;

-- Restaurar customer_statement
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'customer_statement'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customer_statement'
  ) THEN
    ALTER TABLE archived_engineering_20260329.customer_statement SET SCHEMA public;
  END IF;
END $$;

-- Restaurar installment_payments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'installment_payments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'installment_payments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.installment_payments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar payment_receipts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'payment_receipts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'payment_receipts'
  ) THEN
    ALTER TABLE archived_engineering_20260329.payment_receipts SET SCHEMA public;
  END IF;
END $$;

-- Restaurar quote_installments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'quote_installments'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'quote_installments'
  ) THEN
    ALTER TABLE archived_engineering_20260329.quote_installments SET SCHEMA public;
  END IF;
END $$;

-- Restaurar service_requests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'service_requests'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'service_requests'
  ) THEN
    ALTER TABLE archived_engineering_20260329.service_requests SET SCHEMA public;
  END IF;
END $$;

-- Restaurar service_approvals
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'archived_engineering_20260329'
    AND table_name = 'service_approvals'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'service_approvals'
  ) THEN
    ALTER TABLE archived_engineering_20260329.service_approvals SET SCHEMA public;
  END IF;
END $$;
