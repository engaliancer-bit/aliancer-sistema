/*
  # Fix customer_id missing in financial tables

  ## Problem
  A previous migration (20260329123446_remove_customer_id_from_financial_tables.sql)
  renamed customer_id to cliente_id in several financial tables. However, the frontend
  code still references customer_id in queries, inserts, and filters, causing all
  financial entries (receitas/despesas) to disappear from the UI.

  ## Affected Tables
  - customer_revenue: code queries/inserts customer_id but column is now cliente_id
  - customer_statement: code filters by customer_id but column is now cliente_id
  - cash_flow: code queries customer_id but column is now cliente_id
  - customer_credits: code queries customer_id but column is now cliente_id

  ## Solution
  Add customer_id as a virtual computed column (GENERATED ALWAYS AS) that mirrors
  cliente_id, providing backward compatibility for all existing frontend code.
  Also ensure INSERT/UPDATE compatibility via triggers.

  ## Notes
  - Uses a trigger-based approach since PostgreSQL doesn't support FK references
    in GENERATED columns
  - Existing data is preserved (no data loss)
  - Frontend code can continue using customer_id
  - cliente_id remains as the authoritative column for the legacy system
*/

-- =============================================
-- customer_revenue: add customer_id column
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_revenue' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.customer_revenue ADD COLUMN customer_id uuid;
    -- Populate from cliente_id
    UPDATE public.customer_revenue SET customer_id = cliente_id WHERE customer_id IS NULL AND cliente_id IS NOT NULL;
  END IF;
END $$;

-- Keep customer_id in sync with cliente_id via trigger
CREATE OR REPLACE FUNCTION sync_customer_revenue_ids()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT/UPDATE: if customer_id provided but not cliente_id, copy to cliente_id
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NULL THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  -- If cliente_id provided but not customer_id, copy to customer_id
  IF NEW.cliente_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.cliente_id;
  END IF;
  -- If both provided, prefer customer_id as source of truth
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NOT NULL AND NEW.customer_id != NEW.cliente_id THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_revenue_ids ON public.customer_revenue;
CREATE TRIGGER trg_sync_customer_revenue_ids
  BEFORE INSERT OR UPDATE ON public.customer_revenue
  FOR EACH ROW EXECUTE FUNCTION sync_customer_revenue_ids();

-- =============================================
-- customer_statement: add customer_id column
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_statement' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.customer_statement ADD COLUMN customer_id uuid;
    UPDATE public.customer_statement SET customer_id = cliente_id WHERE customer_id IS NULL AND cliente_id IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_customer_statement_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NULL THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  IF NEW.cliente_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.cliente_id;
  END IF;
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NOT NULL AND NEW.customer_id != NEW.cliente_id THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_statement_ids ON public.customer_statement;
CREATE TRIGGER trg_sync_customer_statement_ids
  BEFORE INSERT OR UPDATE ON public.customer_statement
  FOR EACH ROW EXECUTE FUNCTION sync_customer_statement_ids();

-- =============================================
-- cash_flow: add customer_id column
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_flow' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.cash_flow ADD COLUMN customer_id uuid;
    UPDATE public.cash_flow SET customer_id = cliente_id WHERE customer_id IS NULL AND cliente_id IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_cash_flow_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NULL THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  IF NEW.cliente_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.cliente_id;
  END IF;
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NOT NULL AND NEW.customer_id != NEW.cliente_id THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cash_flow_ids ON public.cash_flow;
CREATE TRIGGER trg_sync_cash_flow_ids
  BEFORE INSERT OR UPDATE ON public.cash_flow
  FOR EACH ROW EXECUTE FUNCTION sync_cash_flow_ids();

-- =============================================
-- customer_credits: add customer_id column
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_credits' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.customer_credits ADD COLUMN customer_id uuid;
    UPDATE public.customer_credits SET customer_id = cliente_id WHERE customer_id IS NULL AND cliente_id IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_customer_credits_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NULL THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  IF NEW.cliente_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.cliente_id;
  END IF;
  IF NEW.customer_id IS NOT NULL AND NEW.cliente_id IS NOT NULL AND NEW.customer_id != NEW.cliente_id THEN
    NEW.cliente_id := NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_credits_ids ON public.customer_credits;
CREATE TRIGGER trg_sync_customer_credits_ids
  BEFORE INSERT OR UPDATE ON public.customer_credits
  FOR EACH ROW EXECUTE FUNCTION sync_customer_credits_ids();

-- =============================================
-- Verify backfill completed
-- =============================================
-- Ensure all rows have customer_id populated from cliente_id
UPDATE public.customer_revenue SET customer_id = cliente_id 
  WHERE customer_id IS NULL AND cliente_id IS NOT NULL;

UPDATE public.customer_statement SET customer_id = cliente_id 
  WHERE customer_id IS NULL AND cliente_id IS NOT NULL;

UPDATE public.cash_flow SET customer_id = cliente_id 
  WHERE customer_id IS NULL AND cliente_id IS NOT NULL;

UPDATE public.customer_credits SET customer_id = cliente_id 
  WHERE customer_id IS NULL AND cliente_id IS NOT NULL;
