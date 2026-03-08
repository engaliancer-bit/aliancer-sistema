/*
  # Fix budget_elements element_type check constraint

  ## Problem
  The existing constraint "budget_elements_element_type_check" is missing 12 element types
  that exist in the frontend code, causing inserts to fail with a constraint violation error
  for elements like Canteiro de Obras, Instalacoes Provisorias, Tapume, etc.

  ## Changes
  - Drop the existing restrictive constraint
  - Recreate it with all valid element types including:
    - Servicos Preliminares: canteiro_obras, instalacoes_provisorias, tapume, locacao_terreno, limpeza_terreno
    - Loucas e Metais: bacia_sanitaria, pia_cozinha, lavatorio_cuba, torneira_registro, chuveiro_ducha, tanque_lavanderia, item_louca_metal

  ## All valid types after fix (43 total)
  Foundations, Structure, Walls, Openings, Coatings, Roofing, Painting,
  Installations, Paving, Earthwork, Fixtures, Preliminary Services, Other
*/

ALTER TABLE budget_elements
  DROP CONSTRAINT IF EXISTS budget_elements_element_type_check;

ALTER TABLE budget_elements
  ADD CONSTRAINT budget_elements_element_type_check
  CHECK (element_type = ANY (ARRAY[
    'sapata',
    'bloco_fundacao',
    'radier',
    'estaca',
    'baldrame',
    'viga',
    'pilar',
    'laje',
    'escada',
    'parede_alvenaria',
    'parede_drywall',
    'muro',
    'revestimento_piso',
    'revestimento_parede',
    'revestimento_teto',
    'porta',
    'janela',
    'esquadria',
    'instalacao_eletrica',
    'instalacao_hidraulica',
    'instalacao_gas',
    'pintura',
    'impermeabilizacao',
    'cobertura',
    'pavimentacao_asfalto',
    'pavimentacao_concreto',
    'pavimentacao_intertravado',
    'drenagem',
    'contencao',
    'terraplanagem',
    'outros',
    'canteiro_obras',
    'instalacoes_provisorias',
    'tapume',
    'locacao_terreno',
    'limpeza_terreno',
    'bacia_sanitaria',
    'pia_cozinha',
    'lavatorio_cuba',
    'torneira_registro',
    'chuveiro_ducha',
    'tanque_lavanderia',
    'item_louca_metal'
  ]));
