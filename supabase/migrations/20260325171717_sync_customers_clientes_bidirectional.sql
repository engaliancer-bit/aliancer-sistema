
/*
  # Sincronizacao bidirecional entre customers e clientes

  ## Objetivo
  Manter as tabelas `customers` (sistema legado) e `clientes` (sistema novo)
  sincronizadas automaticamente via triggers bidirecionais.

  ## Mapeamento de campos
  - customers.name           -> clientes.nome_razao_social
  - customers.cpf            -> clientes.cpf_cnpj
  - customers.person_type    -> clientes.tipo_pessoa (pf->PF, pj->PJ)
  - customers.phone          -> clientes.telefone
  - customers.email          -> clientes.email
  - customers.state_registration -> clientes.inscricao_estadual
  - customers.spouse_name    -> clientes.nome_conjuge
  - customers.spouse_cpf     -> clientes.cpf_conjuge
  - customers.marital_regime -> clientes.regime_casamento
  - customers.marital_status_type -> clientes.estado_civil
  - customers.street + neighborhood + city -> clientes.endereco_completo (JSONB)
*/

-- ============================================================
-- 1. Funcao auxiliar: converte person_type para tipo_pessoa_enum
-- ============================================================
CREATE OR REPLACE FUNCTION convert_person_type_to_enum(pt text)
RETURNS tipo_pessoa_enum
LANGUAGE plpgsql
AS $$
BEGIN
  IF upper(pt) = 'PJ' THEN
    RETURN 'PJ'::tipo_pessoa_enum;
  ELSE
    RETURN 'PF'::tipo_pessoa_enum;
  END IF;
END;
$$;

-- ============================================================
-- 2. Trigger customers -> clientes (INSERT e UPDATE)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_customer_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_syncing boolean;
BEGIN
  BEGIN
    v_syncing := current_setting('app.syncing_clientes', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_syncing := false;
  END;

  IF v_syncing THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_customers', 'true', true);

  INSERT INTO clientes (
    id,
    nome_razao_social,
    cpf_cnpj,
    tipo_pessoa,
    telefone,
    email,
    inscricao_estadual,
    nome_conjuge,
    cpf_conjuge,
    regime_casamento,
    estado_civil,
    endereco_completo,
    owner_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.cpf,
    convert_person_type_to_enum(NEW.person_type),
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.email, ''),
    NEW.state_registration,
    NEW.spouse_name,
    NEW.spouse_cpf,
    NEW.marital_regime,
    NEW.marital_status_type,
    jsonb_build_object(
      'rua', COALESCE(NEW.street, ''),
      'bairro', COALESCE(NEW.neighborhood, ''),
      'cidade', COALESCE(NEW.city, '')
    ),
    NULL,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    nome_razao_social  = EXCLUDED.nome_razao_social,
    cpf_cnpj           = EXCLUDED.cpf_cnpj,
    tipo_pessoa        = EXCLUDED.tipo_pessoa,
    telefone           = EXCLUDED.telefone,
    email              = EXCLUDED.email,
    inscricao_estadual = EXCLUDED.inscricao_estadual,
    nome_conjuge       = EXCLUDED.nome_conjuge,
    cpf_conjuge        = EXCLUDED.cpf_conjuge,
    regime_casamento   = EXCLUDED.regime_casamento,
    estado_civil       = EXCLUDED.estado_civil,
    endereco_completo  = EXCLUDED.endereco_completo,
    updated_at         = EXCLUDED.updated_at;

  PERFORM set_config('app.syncing_customers', 'false', true);

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Trigger customers -> clientes (DELETE)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_customer_delete_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_syncing boolean;
BEGIN
  BEGIN
    v_syncing := current_setting('app.syncing_clientes', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_syncing := false;
  END;

  IF v_syncing THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('app.syncing_customers', 'true', true);
  DELETE FROM clientes WHERE id = OLD.id;
  PERFORM set_config('app.syncing_customers', 'false', true);

  RETURN OLD;
END;
$$;

-- ============================================================
-- 4. Trigger clientes -> customers (INSERT e UPDATE)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_cliente_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_syncing boolean;
BEGIN
  BEGIN
    v_syncing := current_setting('app.syncing_customers', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_syncing := false;
  END;

  IF v_syncing THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.syncing_clientes', 'true', true);

  INSERT INTO customers (
    id,
    name,
    cpf,
    person_type,
    phone,
    email,
    state_registration,
    spouse_name,
    spouse_cpf,
    marital_regime,
    marital_status_type,
    street,
    neighborhood,
    city,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.nome_razao_social,
    NEW.cpf_cnpj,
    lower(NEW.tipo_pessoa::text),
    COALESCE(NEW.telefone, ''),
    COALESCE(NEW.email, ''),
    NEW.inscricao_estadual,
    NEW.nome_conjuge,
    NEW.cpf_conjuge,
    NEW.regime_casamento,
    NEW.estado_civil,
    COALESCE(NEW.endereco_completo->>'rua', ''),
    COALESCE(NEW.endereco_completo->>'bairro', ''),
    COALESCE(NEW.endereco_completo->>'cidade', ''),
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name                = EXCLUDED.name,
    cpf                 = EXCLUDED.cpf,
    person_type         = EXCLUDED.person_type,
    phone               = EXCLUDED.phone,
    email               = EXCLUDED.email,
    state_registration  = EXCLUDED.state_registration,
    spouse_name         = EXCLUDED.spouse_name,
    spouse_cpf          = EXCLUDED.spouse_cpf,
    marital_regime      = EXCLUDED.marital_regime,
    marital_status_type = EXCLUDED.marital_status_type,
    street              = EXCLUDED.street,
    neighborhood        = EXCLUDED.neighborhood,
    city                = EXCLUDED.city,
    updated_at          = EXCLUDED.updated_at;

  PERFORM set_config('app.syncing_clientes', 'false', true);

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Trigger clientes -> customers (DELETE)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_cliente_delete_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_syncing boolean;
BEGIN
  BEGIN
    v_syncing := current_setting('app.syncing_customers', true)::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_syncing := false;
  END;

  IF v_syncing THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('app.syncing_clientes', 'true', true);
  DELETE FROM customers WHERE id = OLD.id;
  PERFORM set_config('app.syncing_clientes', 'false', true);

  RETURN OLD;
END;
$$;

-- ============================================================
-- 6. Remover triggers existentes e recriar
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_customer_to_cliente ON customers;
DROP TRIGGER IF EXISTS trg_sync_customer_delete_to_cliente ON customers;
DROP TRIGGER IF EXISTS trg_sync_cliente_to_customer ON clientes;
DROP TRIGGER IF EXISTS trg_sync_cliente_delete_to_customer ON clientes;

CREATE TRIGGER trg_sync_customer_to_cliente
  AFTER INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION sync_customer_to_cliente();

CREATE TRIGGER trg_sync_customer_delete_to_cliente
  AFTER DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION sync_customer_delete_to_cliente();

CREATE TRIGGER trg_sync_cliente_to_customer
  AFTER INSERT OR UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION sync_cliente_to_customer();

CREATE TRIGGER trg_sync_cliente_delete_to_customer
  AFTER DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION sync_cliente_delete_to_customer();
