/*
  # Add missing element types to budget_elements constraint

  ## Problem
  The element_type CHECK constraint was missing several valid types that the
  frontend tries to insert, causing silent failures when users try to add
  sub-etapas with these types:
  - tubulao
  - viga_cinta
  - verga

  ## Changes
  - Drop the existing element_type check constraint
  - Recreate it with all valid types including the missing ones
*/

ALTER TABLE budget_elements DROP CONSTRAINT IF EXISTS budget_elements_element_type_check;

ALTER TABLE budget_elements ADD CONSTRAINT budget_elements_element_type_check
  CHECK (element_type = ANY (ARRAY[
    'sapata', 'bloco_fundacao', 'radier', 'estaca', 'baldrame', 'alicerce',
    'pilar_fundacao', 'tubulao', 'viga', 'pilar', 'laje', 'escada',
    'parede_alvenaria', 'parede_drywall', 'muro',
    'revestimento_piso', 'revestimento_parede', 'revestimento_teto',
    'porta', 'janela', 'esquadria',
    'instalacao_eletrica', 'instalacao_hidraulica', 'instalacao_gas',
    'pintura', 'impermeabilizacao', 'cobertura',
    'pavimentacao_asfalto', 'pavimentacao_concreto', 'pavimentacao_intertravado',
    'drenagem', 'contencao', 'terraplanagem',
    'outros', 'canteiro_obras', 'instalacoes_provisorias', 'tapume',
    'locacao_terreno', 'limpeza_terreno',
    'bacia_sanitaria', 'pia_cozinha', 'lavatorio_cuba', 'torneira_registro',
    'chuveiro_ducha', 'tanque_lavanderia', 'item_louca_metal',
    'viga_cinta', 'verga'
  ]));
