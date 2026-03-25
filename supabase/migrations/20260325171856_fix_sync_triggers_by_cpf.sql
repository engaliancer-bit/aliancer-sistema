
/*
  # Correcao dos triggers de sincronizacao: usar CPF/CNPJ como chave

  ## Problema identificado
  As tabelas `customers` e `clientes` tem IDs independentes, e cada uma
  possui suas proprias tabelas filhas referenciando seu ID. Nao e possivel
  sincronizar por ID sem quebrar as foreign keys existentes.

  ## Solucao correta
  Sincronizar apenas os DADOS CADASTRAIS (nome, telefone, email, endereco, etc.)
  usando CPF/CNPJ como chave de correspondencia entre as duas tabelas.

  ## Comportamento dos triggers
  - Quando um cliente e CRIADO em `customers` e nao existe em `clientes` pelo
    mesmo CPF, um novo registro e criado em `clientes` com um novo UUID.
  - Quando um cliente e ATUALIZADO em `customers`, os dados correspondentes
    em `clientes` (pelo CPF) sao atualizados.
  - Quando um cliente e DELETADO em `customers`, o registro correspondente
    em `clientes` (pelo CPF) tambem e deletado, SE nao tiver references ativas.
  - O mesmo ocorre no sentido inverso (clientes -> customers).

  ## Nota importante
  Os IDs permanecem independentes. As relacoes existentes nao sao afetadas.
*/

-- ============================================================
-- Remove os triggers anteriores baseados em ID
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_customer_to_cliente ON customers;
DROP TRIGGER IF EXISTS trg_sync_customer_delete_to_cliente ON customers;
DROP TRIGGER IF EXISTS trg_sync_cliente_to_customer ON clientes;
DROP TRIGGER IF EXISTS trg_sync_cliente_delete_to_customer ON clientes;

-- ============================================================
-- 1. Trigger customers -> clientes (INSERT e UPDATE por CPF)
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

  -- Atualiza se ja existe em clientes com mesmo CPF, caso contrario insere
  IF EXISTS (SELECT 1 FROM clientes WHERE cpf_cnpj = NEW.cpf) THEN
    UPDATE clientes SET
      nome_razao_social  = NEW.name,
      tipo_pessoa        = convert_person_type_to_enum(NEW.person_type),
      telefone           = COALESCE(NEW.phone, ''),
      email              = COALESCE(NEW.email, ''),
      inscricao_estadual = NEW.state_registration,
      nome_conjuge       = NEW.spouse_name,
      cpf_conjuge        = NEW.spouse_cpf,
      regime_casamento   = NEW.marital_regime,
      estado_civil       = NEW.marital_status_type,
      endereco_completo  = jsonb_build_object(
        'rua',    COALESCE(NEW.street, ''),
        'bairro', COALESCE(NEW.neighborhood, ''),
        'cidade', COALESCE(NEW.city, '')
      ),
      updated_at = NOW()
    WHERE cpf_cnpj = NEW.cpf;
  ELSE
    INSERT INTO clientes (
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
    ) VALUES (
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
        'rua',    COALESCE(NEW.street, ''),
        'bairro', COALESCE(NEW.neighborhood, ''),
        'cidade', COALESCE(NEW.city, '')
      ),
      NULL,
      NEW.created_at,
      NEW.updated_at
    );
  END IF;

  PERFORM set_config('app.syncing_customers', 'false', true);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Trigger customers -> clientes (DELETE por CPF)
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
  -- Tenta deletar; se houver FK constraint, o erro sera silenciado
  BEGIN
    DELETE FROM clientes WHERE cpf_cnpj = OLD.cpf;
  EXCEPTION WHEN foreign_key_violation THEN
    NULL; -- Registro referenciado em outro lugar, nao deleta
  END;
  PERFORM set_config('app.syncing_customers', 'false', true);
  RETURN OLD;
END;
$$;

-- ============================================================
-- 3. Trigger clientes -> customers (INSERT e UPDATE por CPF)
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

  IF EXISTS (SELECT 1 FROM customers WHERE cpf = NEW.cpf_cnpj) THEN
    UPDATE customers SET
      name                = NEW.nome_razao_social,
      person_type         = lower(NEW.tipo_pessoa::text),
      phone               = COALESCE(NEW.telefone, ''),
      email               = COALESCE(NEW.email, ''),
      state_registration  = NEW.inscricao_estadual,
      spouse_name         = NEW.nome_conjuge,
      spouse_cpf          = NEW.cpf_conjuge,
      marital_regime      = NEW.regime_casamento,
      marital_status_type = NEW.estado_civil,
      street              = COALESCE(NEW.endereco_completo->>'rua', ''),
      neighborhood        = COALESCE(NEW.endereco_completo->>'bairro', ''),
      city                = COALESCE(NEW.endereco_completo->>'cidade', ''),
      updated_at          = NOW()
    WHERE cpf = NEW.cpf_cnpj;
  ELSE
    INSERT INTO customers (
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
    ) VALUES (
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
    );
  END IF;

  PERFORM set_config('app.syncing_clientes', 'false', true);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Trigger clientes -> customers (DELETE por CPF)
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
  BEGIN
    DELETE FROM customers WHERE cpf = OLD.cpf_cnpj;
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  PERFORM set_config('app.syncing_clientes', 'false', true);
  RETURN OLD;
END;
$$;

-- ============================================================
-- 5. Recriar triggers com as funcoes corrigidas
-- ============================================================
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
