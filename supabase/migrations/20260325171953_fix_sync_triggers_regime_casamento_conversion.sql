
/*
  # Correcao dos triggers: conversao de regime_casamento para uppercase

  A tabela `clientes` tem constraint que exige valores em uppercase:
  COMUNHAO_PARCIAL, COMUNHAO_UNIVERSAL, SEPARACAO_BENS, PARTICIPACAO_FINAL_AQUESTOS

  A tabela `customers` armazena em lowercase:
  comunhao_parcial, comunhao_universal, separacao_bens, participacao_final_aquestos

  Os triggers precisam converter ao sincronizar em ambas direcoes.
*/

-- Funcao auxiliar para converter regime de casamento
CREATE OR REPLACE FUNCTION convert_marital_regime_to_clientes(regime text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF regime IS NULL THEN RETURN NULL; END IF;
  -- Ja esta em uppercase, retorna como esta
  IF regime = upper(regime) THEN RETURN regime; END IF;
  -- Converte lowercase para uppercase
  RETURN upper(regime);
END;
$$;

-- Funcao auxiliar para converter regime de casamento para customers (lowercase)
CREATE OR REPLACE FUNCTION convert_marital_regime_to_customers(regime text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF regime IS NULL THEN RETURN NULL; END IF;
  RETURN lower(regime);
END;
$$;

-- ============================================================
-- Recriar trigger customers -> clientes com conversao de regime
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

  IF EXISTS (SELECT 1 FROM clientes WHERE cpf_cnpj = NEW.cpf) THEN
    UPDATE clientes SET
      nome_razao_social  = NEW.name,
      tipo_pessoa        = convert_person_type_to_enum(NEW.person_type),
      telefone           = COALESCE(NEW.phone, ''),
      email              = COALESCE(NEW.email, ''),
      inscricao_estadual = NEW.state_registration,
      nome_conjuge       = NEW.spouse_name,
      cpf_conjuge        = NEW.spouse_cpf,
      regime_casamento   = convert_marital_regime_to_clientes(NEW.marital_regime),
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
      convert_marital_regime_to_clientes(NEW.marital_regime),
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
-- Recriar trigger clientes -> customers com conversao de regime
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
      marital_regime      = convert_marital_regime_to_customers(NEW.regime_casamento),
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
      convert_marital_regime_to_customers(NEW.regime_casamento),
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
