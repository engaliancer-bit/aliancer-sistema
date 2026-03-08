/*
  # Adicionar campo de umidade da massa aos traços

  1. Alterações
    - Adiciona coluna `moisture_percentage` (decimal) à tabela `recipes`
      - Representa o percentual de umidade da massa (ex: 6% = 6.00)
      - Usado em traços do tipo TCS (dry) para cálculo do peso total
      - Campo opcional, padrão 0

  2. Propósito
    - Em traços de concreto seco (TCS), a umidade precisa ser considerada
    - O peso da umidade é adicionado ao peso total dos insumos
    - Exemplo: Se a soma dos insumos é 100kg e umidade é 6%, peso total = 106kg
*/

-- Adicionar coluna de percentual de umidade
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS moisture_percentage decimal(5,2) DEFAULT 0 CHECK (moisture_percentage >= 0 AND moisture_percentage <= 100);

-- Comentário explicativo
COMMENT ON COLUMN recipes.moisture_percentage IS 'Percentual de umidade da massa (0-100%). Usado em traços TCS para ajustar o peso total. Ex: 6.00 significa 6% de umidade.';