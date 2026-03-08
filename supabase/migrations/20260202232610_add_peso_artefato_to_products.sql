/*
  # Adicionar coluna peso_artefato à tabela products

  1. Alterações
    - Adiciona coluna `peso_artefato` do tipo decimal(10,3) à tabela `products`
    - Coluna é nullable (opcional), usada apenas para produtos tipo 'artefato'
    - Unidade: quilogramas (kg)
    - Permite armazenar o peso unitário do artefato para cálculo de consumo de insumos

  2. Observações
    - Substitui o uso da coluna `total_weight` para artefatos
    - Facilita a identificação do peso específico para artefatos
    - Mantém compatibilidade com produtos existentes (nullable)
*/

-- Adicionar coluna peso_artefato à tabela products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS peso_artefato DECIMAL(10,3);

-- Adicionar comentário explicativo
COMMENT ON COLUMN products.peso_artefato IS 'Peso unitário do artefato em kg (usado apenas para produtos tipo artefato no cálculo de consumo de insumos)';

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_products_peso_artefato 
ON products(peso_artefato) 
WHERE peso_artefato IS NOT NULL;