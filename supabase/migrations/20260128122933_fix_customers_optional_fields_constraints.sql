/*
  # Corrige Constraints de Campos Opcionais em Customers

  1. Problema Identificado
    - As constraints CHECK para `marital_status_type` e `marital_regime` estavam rejeitando valores NULL
    - Quando campos opcionais são deixados em branco, o sistema envia NULL
    - As constraints precisam aceitar NULL explicitamente

  2. Mudanças
    - Atualizar constraint `customers_marital_status_type_check` para aceitar NULL
    - Atualizar constraint `customers_marital_regime_check` para aceitar NULL
    - Isso permite cadastro de clientes sem informar estado civil ou regime de bens

  3. Notas
    - NULL é diferente de string vazia ''
    - NULL significa "não informado" e é válido para campos opcionais
    - As validações de valores específicos continuam funcionando quando o campo é preenchido
*/

-- Remover constraints antigas
ALTER TABLE customers 
  DROP CONSTRAINT IF EXISTS customers_marital_status_type_check;

ALTER TABLE customers 
  DROP CONSTRAINT IF EXISTS customers_marital_regime_check;

-- Recriar constraints aceitando NULL
ALTER TABLE customers
  ADD CONSTRAINT customers_marital_status_type_check 
  CHECK (marital_status_type IS NULL OR marital_status_type IN ('solteiro', 'casamento', 'uniao_estavel'));

ALTER TABLE customers
  ADD CONSTRAINT customers_marital_regime_check 
  CHECK (marital_regime IS NULL OR marital_regime IN ('comunhao_parcial', 'comunhao_universal', 'separacao_total', 'participacao_final'));

-- Comentários atualizados
COMMENT ON COLUMN customers.marital_status_type IS 
  'Estado civil do cliente: solteiro, casamento, uniao_estavel ou NULL (não informado)';

COMMENT ON COLUMN customers.marital_regime IS 
  'Regime de bens: comunhao_parcial, comunhao_universal, separacao_total, participacao_final ou NULL (não informado)';
