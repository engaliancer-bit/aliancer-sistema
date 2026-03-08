/*
  # Adicionar Informações do Cônjuge aos Clientes

  1. Alterações
    - Adiciona campos de cônjuge à tabela `customers`:
      - `spouse_name` (text) - Nome completo do cônjuge
      - `spouse_cpf` (text) - CPF do cônjuge
      - `marital_status_type` (text) - Tipo: 'casamento' ou 'uniao_estavel'
      - `marital_regime` (text) - Regime de bens: 'comunhao_parcial', 'comunhao_universal', 'separacao_total', 'participacao_final'

  2. Notas
    - Campos opcionais (nullable) pois nem todos os clientes têm cônjuge
    - Campos aplicáveis apenas para pessoa física
    - Permite cadastro completo para questões de escritura e documentação
*/

-- Adicionar colunas de informação do cônjuge
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS spouse_name text,
  ADD COLUMN IF NOT EXISTS spouse_cpf text,
  ADD COLUMN IF NOT EXISTS marital_status_type text CHECK (marital_status_type IN ('casamento', 'uniao_estavel')),
  ADD COLUMN IF NOT EXISTS marital_regime text CHECK (marital_regime IN ('comunhao_parcial', 'comunhao_universal', 'separacao_total', 'participacao_final'));

-- Criar índice para busca por CPF do cônjuge
CREATE INDEX IF NOT EXISTS idx_customers_spouse_cpf ON customers(spouse_cpf) WHERE spouse_cpf IS NOT NULL;
