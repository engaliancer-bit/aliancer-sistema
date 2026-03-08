/*
  # Sistema de Padrão de Estribos para Formas

  1. Alterações na Tabela `molds`
    - `standard_length_meters` (numeric) - Comprimento padrão da forma em metros (ex: 10.00)
    - `standard_stirrup_count` (integer) - Quantidade padrão de estribos para o comprimento padrão (ex: 66)
    - `standard_stirrup_spacing_cm` (numeric) - Espaçamento entre estribos em cm (calculado automaticamente)

  2. Alterações na Tabela `product_reinforcements`
    - `is_standard_pattern` (boolean) - Marca se este estribo segue o padrão de proporcionalidade

  3. Funcionalidade
    - Ao cadastrar uma forma, define-se o comprimento padrão e quantidade de estribos
    - Ao cadastrar um produto usando essa forma, os estribos marcados como "padrão" terão
      a quantidade calculada proporcionalmente ao comprimento do produto
    - Exemplo: Forma com 66 estribos para 10m → Produto de 5m terá 33 estribos automaticamente

  4. Segurança
    - Políticas RLS já existentes cobrem as novas colunas
*/

-- Adicionar campos de padrão de estribos à tabela molds
ALTER TABLE molds 
ADD COLUMN IF NOT EXISTS standard_length_meters numeric(10, 2),
ADD COLUMN IF NOT EXISTS standard_stirrup_count integer,
ADD COLUMN IF NOT EXISTS standard_stirrup_spacing_cm numeric(10, 2);

-- Adicionar comentários para documentação
COMMENT ON COLUMN molds.standard_length_meters IS 
  'Comprimento padrão da forma em metros para cálculo proporcional de estribos';
  
COMMENT ON COLUMN molds.standard_stirrup_count IS 
  'Quantidade padrão de estribos para o comprimento padrão';
  
COMMENT ON COLUMN molds.standard_stirrup_spacing_cm IS 
  'Espaçamento calculado entre estribos em centímetros (calculado = (comprimento_padrão * 100) / quantidade_estribos)';

-- Adicionar campo para marcar estribo como padrão na tabela product_reinforcements
ALTER TABLE product_reinforcements
ADD COLUMN IF NOT EXISTS is_standard_pattern boolean DEFAULT false;

COMMENT ON COLUMN product_reinforcements.is_standard_pattern IS 
  'Indica se este estribo transversal segue o padrão de proporcionalidade definido na forma';

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_product_reinforcements_standard_pattern 
  ON product_reinforcements(product_id, reinforcement_type, is_standard_pattern)
  WHERE is_standard_pattern = true;
