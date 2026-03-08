/*
  # Adicionar campo de localização para armaduras (base ou aba)

  ## Descrição
  Adiciona campo `reinforcement_location` para diferenciar se a armadura pertence
  à parte base da peça ou à aba (flange) em produtos pré-moldados.

  ## 1. Alterações na tabela `mold_reinforcements`
  - Adiciona campo `reinforcement_location` (text)
    - Valores: 'base' (parte principal) ou 'flange' (aba)
    - Default: 'base' (compatibilidade com dados existentes)

  ## 2. Alterações na tabela `product_reinforcements`
  - Adiciona campo `reinforcement_location` (text)
    - Valores: 'base' (parte principal) ou 'flange' (aba)
    - Default: 'base' (compatibilidade com dados existentes)

  ## 3. Notas
  - Todas as armaduras existentes serão automaticamente classificadas como 'base'
  - Para produtos/fôrmas com aba, novas armaduras podem ser cadastradas com location='flange'
  - Isso permite configuração completa de armaduras tanto para a base quanto para a aba
*/

-- Adicionar campo reinforcement_location na tabela mold_reinforcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mold_reinforcements' AND column_name = 'reinforcement_location'
  ) THEN
    ALTER TABLE mold_reinforcements 
    ADD COLUMN reinforcement_location text DEFAULT 'base' 
    CHECK (reinforcement_location IN ('base', 'flange'));
  END IF;
END $$;

-- Adicionar campo reinforcement_location na tabela product_reinforcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_reinforcements' AND column_name = 'reinforcement_location'
  ) THEN
    ALTER TABLE product_reinforcements 
    ADD COLUMN reinforcement_location text DEFAULT 'base' 
    CHECK (reinforcement_location IN ('base', 'flange'));
  END IF;
END $$;

-- Adicionar comentários
COMMENT ON COLUMN mold_reinforcements.reinforcement_location IS 'Localização da armadura: base (parte principal) ou flange (aba)';
COMMENT ON COLUMN product_reinforcements.reinforcement_location IS 'Localização da armadura: base (parte principal) ou flange (aba)';

-- Criar índices para melhorar performance em consultas filtradas por localização
CREATE INDEX IF NOT EXISTS idx_mold_reinforcements_location ON mold_reinforcements(reinforcement_location);
CREATE INDEX IF NOT EXISTS idx_product_reinforcements_location ON product_reinforcements(reinforcement_location);