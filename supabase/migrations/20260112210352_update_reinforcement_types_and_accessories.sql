/*
  # Atualização dos Tipos de Armadura e Acessórios

  ## Descrição
  Reorganiza o sistema para separar claramente armaduras de acessórios:
  - Adiciona novos tipos de armadura que antes estavam em acessórios
  - Remove o vínculo obrigatório de material para armaduras
  - Separa completamente a gestão de armaduras dos acessórios

  ## Alterações

  ### 1. Tabela product_reinforcements
    - Atualiza o CHECK constraint para incluir novos tipos:
      - 'lifting_hooks' - Armadura de içamento
      - 'threaded_bar_hooks' - Ganchos da barra roscada
    - Remove a obrigatoriedade do campo material_id
    - Adiciona campo description para melhor identificação

  ### 2. Tabela product_accessories
    - Atualiza o CHECK constraint para remover tipos que são armaduras:
      - Remove 'lifting_bar' (agora é 'lifting_hooks' em armaduras)
      - Remove 'threaded_hook' (agora é 'threaded_bar_hooks' em armaduras)

  ## Segurança
    - Mantém RLS habilitado em ambas as tabelas
    - Políticas existentes continuam válidas

  ## Notas Importantes
    - Todos os tipos de armadura agora fazem parte da composição de custos
    - A separação facilita o cálculo de custos e precificação
*/

-- Adicionar campo description à tabela product_reinforcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_reinforcements' AND column_name = 'description'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN description text DEFAULT '';
    COMMENT ON COLUMN product_reinforcements.description IS 'Descrição adicional da armadura';
  END IF;
END $$;

-- Remover obrigatoriedade do material_id em product_reinforcements
ALTER TABLE product_reinforcements ALTER COLUMN material_id DROP NOT NULL;

-- Atualizar o CHECK constraint de reinforcement_type para incluir novos tipos
DO $$
BEGIN
  -- Remove constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'product_reinforcements' 
    AND constraint_name LIKE '%reinforcement_type%'
  ) THEN
    ALTER TABLE product_reinforcements DROP CONSTRAINT IF EXISTS product_reinforcements_reinforcement_type_check;
  END IF;
  
  -- Adiciona novo constraint com todos os tipos
  ALTER TABLE product_reinforcements ADD CONSTRAINT product_reinforcements_reinforcement_type_check 
    CHECK (reinforcement_type IN ('longitudinal', 'transversal', 'lifting_hooks', 'threaded_bar_hooks'));
END $$;

-- Atualizar o CHECK constraint de accessory_type para remover tipos que são armaduras
DO $$
BEGIN
  -- Remove constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'product_accessories' 
    AND constraint_name LIKE '%accessory_type%'
  ) THEN
    ALTER TABLE product_accessories DROP CONSTRAINT IF EXISTS product_accessories_accessory_type_check;
  END IF;
  
  -- Adiciona novo constraint sem os tipos de armadura
  ALTER TABLE product_accessories ADD CONSTRAINT product_accessories_accessory_type_check 
    CHECK (accessory_type IN ('threaded_bar', 'release_agent', 'cloth', 'other'));
END $$;

-- Comentários atualizados
COMMENT ON COLUMN product_reinforcements.reinforcement_type IS 'Tipo: longitudinal (principal), transversal (estribos), lifting_hooks (içamento), threaded_bar_hooks (ganchos da barra roscada)';
COMMENT ON COLUMN product_reinforcements.material_id IS 'Material do estoque (opcional). Para ferro, use materiais cadastrados com "ferro" no nome';
COMMENT ON COLUMN product_accessories.accessory_type IS 'Tipo: threaded_bar (barra roscada), release_agent (desmoldante), cloth (estopa), other (outros). Armaduras são gerenciadas separadamente';
