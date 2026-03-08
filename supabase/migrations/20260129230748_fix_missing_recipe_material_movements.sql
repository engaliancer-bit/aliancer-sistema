/*
  # Corrigir Movimentos de Materiais Faltantes de Receitas

  1. Problema
    - Produções registradas não estavam criando movimentos de materiais para insumos cadastrados nas receitas
    - Apenas materiais em product_material_weights eram registrados
    - Isso causava insumos faltando no resumo de consumo diário

  2. Solução
    - Identificar produções que têm produtos com receitas
    - Verificar se os movimentos de materiais das receitas existem
    - Criar os movimentos faltantes com base nos recipe_items

  3. Impacto
    - Corrige dados históricos
    - Garante que todos os insumos apareçam no resumo de consumo
*/

-- Criar movimentos de materiais para produções que têm receita mas não têm movimentos
INSERT INTO material_movements (
  material_id,
  movement_type,
  quantity,
  movement_date,
  production_id,
  notes
)
SELECT
  ri.material_id,
  'saida' as movement_type,
  ri.quantity * p.quantity as quantity,
  p.production_date as movement_date,
  p.id as production_id,
  CONCAT(
    'Consumo da receita para produção de ',
    p.quantity,
    ' ',
    COALESCE(pr.unit, 'un'),
    ' de ',
    COALESCE(pr.name, 'produto'),
    ' (corrigido automaticamente)'
  ) as notes
FROM production p
INNER JOIN products pr ON pr.id = p.product_id
INNER JOIN recipes r ON r.id = pr.recipe_id
INNER JOIN recipe_items ri ON ri.recipe_id = r.id
WHERE NOT EXISTS (
  -- Verificar se já existe movimento deste material para esta produção
  SELECT 1
  FROM material_movements mm
  WHERE mm.production_id = p.id
  AND mm.material_id = ri.material_id
  AND mm.movement_type = 'saida'
)
ORDER BY p.production_date, p.created_at;

-- Log das correções
DO $$
DECLARE
  v_count integer;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Criados % movimentos de materiais para produções com receitas', v_count;
END $$;
