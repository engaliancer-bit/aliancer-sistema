/*
  # Adicionar Campos Fiscais em Produtos e Materiais

  1. Novos Campos
    - `ncm` (text) - Nomenclatura Comum do Mercosul (8 dígitos)
    - `cfop` (text) - Código Fiscal de Operações e Prestações (4 dígitos)
    - `csosn` (text) - Código de Situação da Operação no Simples Nacional (3 ou 4 dígitos)
  
  2. Tabelas Afetadas
    - `products` - Recebe os 3 campos fiscais
    - `materials` - Recebe os 3 campos fiscais (para insumos de revenda)
  
  3. Notas
    - Todos os campos são opcionais inicialmente
    - Prepara o sistema para futura emissão de nota fiscal
*/

-- Adicionar campos fiscais na tabela products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS ncm text,
ADD COLUMN IF NOT EXISTS cfop text,
ADD COLUMN IF NOT EXISTS csosn text;

-- Adicionar comentários para documentação
COMMENT ON COLUMN products.ncm IS 'Nomenclatura Comum do Mercosul - Código de 8 dígitos';
COMMENT ON COLUMN products.cfop IS 'Código Fiscal de Operações e Prestações - Código de 4 dígitos';
COMMENT ON COLUMN products.csosn IS 'Código de Situação da Operação no Simples Nacional - Código de 3 ou 4 dígitos';

-- Adicionar campos fiscais na tabela materials
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS ncm text,
ADD COLUMN IF NOT EXISTS cfop text,
ADD COLUMN IF NOT EXISTS csosn text;

-- Adicionar comentários para documentação
COMMENT ON COLUMN materials.ncm IS 'Nomenclatura Comum do Mercosul - Código de 8 dígitos';
COMMENT ON COLUMN materials.cfop IS 'Código Fiscal de Operações e Prestações - Código de 4 dígitos';
COMMENT ON COLUMN materials.csosn IS 'Código de Situação da Operação no Simples Nacional - Código de 3 ou 4 dígitos';

-- Criar índices para melhorar performance em consultas fiscais
CREATE INDEX IF NOT EXISTS idx_products_ncm ON products(ncm) WHERE ncm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_materials_ncm ON materials(ncm) WHERE ncm IS NOT NULL;
