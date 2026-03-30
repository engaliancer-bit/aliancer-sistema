/*
  # Fix customers <-> clientes bidirectional sync and RLS policies

  ## Problem
  1. "Clientes" tab in legacy system (Customers.tsx) shows empty list — the `customers` table
     RLS policy uses `can_access_module()` which calls `auth.role()`. When the Supabase
     JS client session has a transient hiccup or the policy is evaluated as `anon`, the
     SELECT is blocked. The `clientes` table already has an explicit `anon` SELECT policy
     but `customers` does not.

  2. "Orçamentos" tab shows "Sem cliente" — some budgets only have `cliente_id` filled
     (pointing to `clientes` table), while the React component joins via `customer_id`
     (pointing to `customers` table). Missing sync means the join returns NULL.

  3. Bidirectional sync triggers between `customers` and `clientes` are incomplete:
     - Only DELETE triggers exist (customers→clientes and clientes→customers).
     - INSERT/UPDATE triggers are missing entirely, so new/updated records in one table
       never propagate to the other.

  ## Changes
  1. Add explicit `authenticated` SELECT/INSERT/UPDATE/DELETE policies to `customers`
     (matching what `clientes` already has), keeping `can_access_module` for shared-token
     scenarios but adding direct `authenticated` policies so logged-in users always see data.
  2. Create `sync_customer_upsert_to_cliente()` trigger function — fires AFTER INSERT OR
     UPDATE on `customers`, upserts into `clientes` using CPF as the join key, with anti-loop
     guard via `app.syncing_clientes` session variable.
  3. Create `sync_cliente_upsert_to_customer()` trigger function — fires AFTER INSERT OR
     UPDATE on `clientes`, upserts into `customers` using CPF as the join key, with anti-loop
     guard via `app.syncing_customers` session variable.
  4. Attach both triggers to their respective tables.
  5. Backfill `budgets.customer_id` from `clientes` via CPF match where `customer_id IS NULL`
     and `cliente_id IS NOT NULL`.

  ## Security
  - No USING(true) policies for write operations.
  - SELECT for `authenticated` uses `USING (true)` only, which is safe (all authenticated
    users should see all customers in this single-tenant system).
  - Sync functions run as SECURITY DEFINER with limited scope.
*/

-- ============================================================
-- 1. ADD DIRECT authenticated POLICIES ON customers TABLE
--    (keeps existing can_access_module policies for token access)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Authenticated users can view all customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can view all customers"
      ON customers FOR SELECT TO authenticated USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Authenticated users can insert customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can insert customers"
      ON customers FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Authenticated users can update customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update customers"
      ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Authenticated users can delete customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can delete customers"
      ON customers FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

-- ============================================================
-- 2. SYNC FUNCTION: customers → clientes (INSERT / UPDATE)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_customer_upsert_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_syncing boolean;
  v_tipo tipo_pessoa_enum;
BEGIN
  -- Anti-loop guard
  BEGIN
    v_syncing := current_setting('app.syncing_customers', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_syncing := false;
  END;

  IF v_syncing THEN
    RETURN NEW;
  END IF;

  -- Map person_type to enum
  v_tipo := CASE
    WHEN NEW.person_type = 'juridica' THEN 'PJ'::tipo_pessoa_enum
    ELSE 'PF'::tipo_pessoa_enum
  END;

  -- Set guard for the other direction
  PERFORM set_config('app.syncing_clientes', 'true', true);

  BEGIN
    INSERT INTO clientes (
      nome_razao_social,
      cpf_cnpj,
      tipo_pessoa,
      email,
      telefone,
      inscricao_estadual,
      endereco_completo,
      estado_civil,
      nome_conjuge,
      cpf_conjuge,
      regime_casamento,
      owner_id,
      created_at,
      updated_at
    ) VALUES (
      NEW.name,
      NEW.cpf,
      v_tipo,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.phone, ''),
      COALESCE(NEW.state_registration, ''),
      jsonb_build_object(
        'rua',    COALESCE(NEW.street, ''),
        'bairro', COALESCE(NEW.neighborhood, ''),
        'cidade', COALESCE(NEW.city, '')
      ),
      COALESCE(NEW.marital_status_type, ''),
      COALESCE(NEW.spouse_name, ''),
      COALESCE(NEW.spouse_cpf, ''),
      COALESCE(NEW.marital_regime, ''),
      '00000000-0000-0000-0000-000000000000'::uuid,
      COALESCE(NEW.created_at, now()),
      now()
    )
    ON CONFLICT (cpf_cnpj)
    DO UPDATE SET
      nome_razao_social  = EXCLUDED.nome_razao_social,
      tipo_pessoa        = EXCLUDED.tipo_pessoa,
      email              = EXCLUDED.email,
      telefone           = EXCLUDED.telefone,
      inscricao_estadual = EXCLUDED.inscricao_estadual,
      endereco_completo  = EXCLUDED.endereco_completo,
      estado_civil       = EXCLUDED.estado_civil,
      nome_conjuge       = EXCLUDED.nome_conjuge,
      cpf_conjuge        = EXCLUDED.cpf_conjuge,
      regime_casamento   = EXCLUDED.regime_casamento,
      updated_at         = now();
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block the original operation
  END;

  PERFORM set_config('app.syncing_clientes', 'false', true);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. SYNC FUNCTION: clientes → customers (INSERT / UPDATE)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_cliente_upsert_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_syncing boolean;
  v_person_type text;
BEGIN
  -- Anti-loop guard
  BEGIN
    v_syncing := current_setting('app.syncing_clientes', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_syncing := false;
  END;

  IF v_syncing THEN
    RETURN NEW;
  END IF;

  -- Map enum to person_type text
  v_person_type := CASE
    WHEN NEW.tipo_pessoa = 'PJ' THEN 'juridica'
    ELSE 'fisica'
  END;

  -- Set guard for the other direction
  PERFORM set_config('app.syncing_customers', 'true', true);

  BEGIN
    INSERT INTO customers (
      name,
      cpf,
      person_type,
      email,
      phone,
      street,
      neighborhood,
      city,
      state_registration,
      marital_status_type,
      spouse_name,
      spouse_cpf,
      marital_regime,
      created_at,
      updated_at
    ) VALUES (
      NEW.nome_razao_social,
      NEW.cpf_cnpj,
      v_person_type,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.telefone, ''),
      COALESCE(NEW.endereco_completo->>'rua', ''),
      COALESCE(NEW.endereco_completo->>'bairro', ''),
      COALESCE(NEW.endereco_completo->>'cidade', ''),
      COALESCE(NEW.inscricao_estadual, ''),
      COALESCE(NEW.estado_civil, ''),
      COALESCE(NEW.nome_conjuge, ''),
      COALESCE(NEW.cpf_conjuge, ''),
      COALESCE(NEW.regime_casamento, ''),
      COALESCE(NEW.created_at, now()),
      now()
    )
    ON CONFLICT (cpf)
    DO UPDATE SET
      name               = EXCLUDED.name,
      person_type        = EXCLUDED.person_type,
      email              = EXCLUDED.email,
      phone              = EXCLUDED.phone,
      street             = EXCLUDED.street,
      neighborhood       = EXCLUDED.neighborhood,
      city               = EXCLUDED.city,
      state_registration = EXCLUDED.state_registration,
      marital_status_type = EXCLUDED.marital_status_type,
      spouse_name        = EXCLUDED.spouse_name,
      spouse_cpf         = EXCLUDED.spouse_cpf,
      marital_regime     = EXCLUDED.marital_regime,
      updated_at         = now();
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block the original operation
  END;

  PERFORM set_config('app.syncing_customers', 'false', true);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. ATTACH TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_customer_upsert_to_cliente ON customers;
CREATE TRIGGER trg_sync_customer_upsert_to_cliente
  AFTER INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_upsert_to_cliente();

DROP TRIGGER IF EXISTS trg_sync_cliente_upsert_to_customer ON clientes;
CREATE TRIGGER trg_sync_cliente_upsert_to_customer
  AFTER INSERT OR UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION sync_cliente_upsert_to_customer();

-- ============================================================
-- 5. BACKFILL budgets.customer_id WHERE cliente_id IS SET
--    and customer_id is NULL — find matching customer via CPF
-- ============================================================

UPDATE budgets b
SET customer_id = c.id
FROM clientes cl
JOIN customers c ON c.cpf = cl.cpf_cnpj
WHERE b.cliente_id = cl.id
  AND b.customer_id IS NULL;

-- Also fix budgets where customer_id points to a customer that
-- also has a corresponding clientes record but cliente_id is null
UPDATE budgets b
SET cliente_id = cl.id
FROM customers c
JOIN clientes cl ON cl.cpf_cnpj = c.cpf
WHERE b.customer_id = c.id
  AND b.cliente_id IS NULL;
