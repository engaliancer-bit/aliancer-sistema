/*
  # Adicionar Identificador para Armaduras Longitudinais

  1. Alterações
    - Adiciona campo `identifier` à tabela `product_reinforcements`
      - Permite identificar armaduras longitudinais como A, B, C, etc.
      - NULL para outros tipos de armadura (transversal, içamento, etc.)
    
  2. Notas
    - Identificador é opcional e usado principalmente para armaduras longitudinais
    - Facilita a organização quando há múltiplas armaduras longitudinais
*/

-- Adicionar campo identifier
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_reinforcements' AND column_name = 'identifier'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN identifier text;
    COMMENT ON COLUMN product_reinforcements.identifier IS 'Identificador da armadura (A, B, C, etc.) - usado principalmente para armaduras longitudinais';
  END IF;
END $$;