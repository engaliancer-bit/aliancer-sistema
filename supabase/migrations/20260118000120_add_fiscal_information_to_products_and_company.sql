/*
  # Adicionar Informações Fiscais para Emissão de NF-e

  ## Resumo
  Adiciona campos fiscais necessários para geração de arquivos XML/CSV compatíveis
  com sistemas de emissão de Nota Fiscal Eletrônica (NF-e).

  ## Alterações nas Tabelas Existentes

  ### products
  Novos campos fiscais:
  - ncm (text) - Nomenclatura Comum do Mercosul (8 dígitos)
  - cfop (text) - Código Fiscal de Operações e Prestações
  - cst_icms (text) - Código de Situação Tributária do ICMS
  - aliquota_icms (decimal) - Alíquota de ICMS (%)
  - aliquota_pis (decimal) - Alíquota de PIS (%)
  - aliquota_cofins (decimal) - Alíquota de COFINS (%)
  - aliquota_ipi (decimal) - Alíquota de IPI (%)
  - origem_produto (text) - Origem do produto (0-Nacional, 1-Estrangeira)
  - unidade_tributavel (text) - Unidade tributável (UN, M3, KG, etc)

  ### company_settings
  Novos campos fiscais:
  - regime_tributario (text) - Regime tributário
  - inscricao_estadual (text) - Inscrição Estadual
  - inscricao_municipal (text) - Inscrição Municipal
  - cnae_principal (text) - CNAE Principal
  - crt (text) - Código de Regime Tributário

  ## Notas
  - Campos são opcionais para não quebrar funcionalidades existentes
  - Valores padrão definidos para produtos comuns no segmento
  - Sistema permitirá exportação mesmo sem todos os campos preenchidos
*/

-- Adicionar campos fiscais à tabela products
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cfop text DEFAULT '5102';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_icms text DEFAULT '00';
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_icms decimal(5,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_pis decimal(5,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_cofins decimal(5,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_ipi decimal(5,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origem_produto text DEFAULT '0';
ALTER TABLE products ADD COLUMN IF NOT EXISTS unidade_tributavel text DEFAULT 'UN';

-- Adicionar campos fiscais à tabela company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS regime_tributario text DEFAULT 'simples_nacional';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS inscricao_estadual text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS inscricao_municipal text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS cnae_principal text;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS crt text DEFAULT '1';

-- Criar índices para otimização de consultas fiscais
CREATE INDEX IF NOT EXISTS idx_products_ncm ON products(ncm);
CREATE INDEX IF NOT EXISTS idx_products_cfop ON products(cfop);
