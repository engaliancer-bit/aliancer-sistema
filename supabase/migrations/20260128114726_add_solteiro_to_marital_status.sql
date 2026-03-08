/*
  # Adicionar Opção "Solteiro" ao Estado Civil

  1. Mudanças
    - Atualizar constraint da coluna `marital_status_type` em `customers`
    - Adicionar 'solteiro' como opção válida junto com 'casamento' e 'uniao_estavel'

  2. Notas
    - Quando estado civil é 'solteiro', os campos spouse_name, spouse_cpf e marital_regime não são obrigatórios
    - Esta mudança permite cadastro mais completo e flexível dos clientes
*/

-- Remover constraint antigo
ALTER TABLE customers 
  DROP CONSTRAINT IF EXISTS customers_marital_status_type_check;

-- Adicionar novo constraint com 'solteiro' incluído
ALTER TABLE customers
  ADD CONSTRAINT customers_marital_status_type_check 
  CHECK (marital_status_type IN ('solteiro', 'casamento', 'uniao_estavel'));

-- Comentário atualizado
COMMENT ON COLUMN customers.marital_status_type IS 
  'Estado civil do cliente: solteiro, casamento ou uniao_estavel. 
   Quando solteiro, os campos de cônjuge não são necessários.';
