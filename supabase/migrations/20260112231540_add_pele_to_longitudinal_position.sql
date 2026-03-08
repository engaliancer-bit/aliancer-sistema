/*
  # Adicionar opção "pele" à posição longitudinal

  1. Alterações
    - Remove a constraint existente de `longitudinal_position`
    - Adiciona nova constraint incluindo 'pele' como opção válida
    - Opções válidas: 'superior', 'middle', 'inferior', 'pele'

  2. Notas
    - "pele" é a armadura que fica na camada externa do concreto
    - A operação é segura e não afeta dados existentes
*/

-- Remover constraint antiga
ALTER TABLE product_reinforcements 
  DROP CONSTRAINT IF EXISTS product_reinforcements_longitudinal_position_check;

-- Adicionar nova constraint com a opção 'pele'
ALTER TABLE product_reinforcements 
  ADD CONSTRAINT product_reinforcements_longitudinal_position_check 
  CHECK (longitudinal_position IN ('superior', 'middle', 'inferior', 'pele'));

-- Atualizar comentário
COMMENT ON COLUMN product_reinforcements.longitudinal_position IS 'Posição da armadura longitudinal: superior, middle, inferior, pele (camada externa). NULL para armaduras transversais';