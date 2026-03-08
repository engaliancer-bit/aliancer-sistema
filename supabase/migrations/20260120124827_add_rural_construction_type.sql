/*
  # Adicionar tipo de obra "Construção Rural"

  ## Descrição
  Atualiza a constraint do campo construction_type na tabela construction_works
  para incluir a opção 'rural' (Construção Rural).

  ## Mudanças
  1. Remove a constraint existente do campo construction_type
  2. Adiciona nova constraint incluindo 'rural' como opção válida
*/

-- Remove a constraint existente
ALTER TABLE construction_works
  DROP CONSTRAINT IF EXISTS construction_works_construction_type_check;

-- Adiciona nova constraint com a opção 'rural'
ALTER TABLE construction_works
  ADD CONSTRAINT construction_works_construction_type_check
  CHECK (construction_type IN ('residencial', 'comercial', 'industrial', 'rural'));
