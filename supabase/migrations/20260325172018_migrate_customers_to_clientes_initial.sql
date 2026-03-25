
/*
  # Migracao inicial: inserir em clientes os customers sem correspondencia por CPF

  Insere apenas os registros de `customers` que NAO possuem correspondencia
  pelo CPF/CNPJ em `clientes`. Os 200 registros ja existentes sao preservados.

  Tambem atualiza os dados cadastrais dos 25 registros que existem em ambas
  as tabelas com mesmo CPF mas dados potencialmente diferentes.
*/

DO $$
BEGIN
  PERFORM set_config('app.syncing_customers', 'true', true);

  -- 1. Atualiza dados dos customers que ja existem em clientes (mesmo CPF)
  UPDATE clientes cl SET
    nome_razao_social  = c.name,
    tipo_pessoa        = convert_person_type_to_enum(c.person_type),
    telefone           = COALESCE(c.phone, ''),
    email              = COALESCE(c.email, ''),
    inscricao_estadual = c.state_registration,
    nome_conjuge       = c.spouse_name,
    cpf_conjuge        = c.spouse_cpf,
    regime_casamento   = convert_marital_regime_to_clientes(c.marital_regime),
    estado_civil       = c.marital_status_type,
    endereco_completo  = jsonb_build_object(
      'rua',    COALESCE(c.street, ''),
      'bairro', COALESCE(c.neighborhood, ''),
      'cidade', COALESCE(c.city, '')
    ),
    updated_at = NOW()
  FROM customers c
  WHERE cl.cpf_cnpj = c.cpf;

  -- 2. Insere customers que ainda nao existem em clientes
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
  )
  SELECT
    c.name,
    c.cpf,
    convert_person_type_to_enum(c.person_type),
    COALESCE(c.phone, ''),
    COALESCE(c.email, ''),
    c.state_registration,
    c.spouse_name,
    c.spouse_cpf,
    convert_marital_regime_to_clientes(c.marital_regime),
    c.marital_status_type,
    jsonb_build_object(
      'rua',    COALESCE(c.street, ''),
      'bairro', COALESCE(c.neighborhood, ''),
      'cidade', COALESCE(c.city, '')
    ),
    NULL,
    c.created_at,
    c.updated_at
  FROM customers c
  WHERE NOT EXISTS (
    SELECT 1 FROM clientes cl WHERE cl.cpf_cnpj = c.cpf
  );

  PERFORM set_config('app.syncing_customers', 'false', true);
END $$;
