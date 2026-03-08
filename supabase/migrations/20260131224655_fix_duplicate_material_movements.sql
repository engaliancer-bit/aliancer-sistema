/*
  # Correção de Movimentos de Materiais Duplicados

  ## Problema Identificado
  Movimentos de materiais estavam sendo registrados múltiplas vezes para a mesma produção:
  - Produtos com receita também tinham product_material_weights, causando duplicação
  - Produtos premoldados com múltiplas armaduras do mesmo material criavam movimentos duplicados
  - Exemplo: "Poste de cerca" tinha 2x areia, 2x cimento, 2x pedrisco
  - Exemplo: "Pilares" tinham até 5x o mesmo ferro

  ## Correção
  1. Remove movimentos duplicados mantendo apenas um por (production_id, material_id)
  2. A quantidade do movimento mantido é a SOMA de todos os movimentos duplicados
  3. As notas são consolidadas

  ## Impacto
  - Remove duplicações existentes no histórico
  - O código do frontend já foi corrigido para não criar novas duplicações
*/

-- Criar uma tabela temporária com informações de duplicação
CREATE TEMP TABLE temp_duplicate_info AS
SELECT 
  production_id,
  material_id,
  movement_type,
  movement_date,
  SUM(quantity) as total_quantity,
  string_agg(DISTINCT notes, ' | ') as consolidated_notes,
  COUNT(*) as duplicate_count
FROM material_movements
WHERE production_id IS NOT NULL
  AND movement_type = 'saida'
GROUP BY production_id, material_id, movement_type, movement_date
HAVING COUNT(*) > 1;

-- Criar tabela com os IDs a manter (primeiro de cada grupo)
CREATE TEMP TABLE temp_keep_ids AS
SELECT DISTINCT ON (production_id, material_id)
  id as keep_id,
  production_id,
  material_id
FROM material_movements
WHERE production_id IS NOT NULL
  AND movement_type = 'saida'
  AND (production_id, material_id) IN (
    SELECT production_id, material_id FROM temp_duplicate_info
  )
ORDER BY production_id, material_id, created_at ASC;

-- Atualizar os movimentos que serão mantidos com as quantidades e notas corretas
UPDATE material_movements mm
SET 
  quantity = tdi.total_quantity,
  notes = COALESCE(tdi.consolidated_notes, mm.notes)
FROM temp_keep_ids tki
JOIN temp_duplicate_info tdi 
  ON tki.production_id = tdi.production_id 
  AND tki.material_id = tdi.material_id
WHERE mm.id = tki.keep_id;

-- Deletar os movimentos duplicados (mantendo apenas um por grupo)
DELETE FROM material_movements
WHERE production_id IS NOT NULL
  AND movement_type = 'saida'
  AND (production_id, material_id) IN (
    SELECT production_id, material_id FROM temp_duplicate_info
  )
  AND id NOT IN (
    SELECT keep_id FROM temp_keep_ids
  );

-- Criar índices para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_material_movements_production_material 
ON material_movements(production_id, material_id) 
WHERE production_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_material_movements_date_type_production 
ON material_movements(movement_date, movement_type, production_id) 
WHERE production_id IS NOT NULL;