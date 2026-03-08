/*
  # Corrigir Movimentos de Materiais Faltantes de Acessórios (Ferragens Diversas)

  1. Problema
    - Produções de produtos tipo "ferragens_diversas" não criavam movimentos de materiais
    - Apenas materiais em receitas, pesos e armaduras eram registrados
    - Produtos como "Grade divisória de pocilga" usam product_accessories para definir materiais
    - Isso causava insumos faltando no resumo de consumo

  2. Solução
    - Identificar produções que têm produtos com acessórios do tipo 'material'
    - Verificar se os movimentos de materiais dos acessórios existem
    - Criar os movimentos faltantes com base nos product_accessories

  3. Impacto
    - Corrige dados históricos de ferragens diversas
    - Garante que todos os materiais de acessórios apareçam no resumo
*/

-- Criar movimentos de materiais para produções que têm acessórios mas não têm movimentos
INSERT INTO material_movements (
  material_id,
  movement_type,
  quantity,
  movement_date,
  production_id,
  notes
)
SELECT
  pa.material_id,
  'saida' as movement_type,
  pa.quantity * p.quantity as quantity,
  p.production_date as movement_date,
  p.id as production_id,
  CONCAT(
    'Consumo de acessório/material para produção de ',
    p.quantity,
    ' ',
    COALESCE(pr.unit, 'un'),
    ' de ',
    COALESCE(pr.name, 'produto'),
    ' (corrigido automaticamente)'
  ) as notes
FROM production p
INNER JOIN products pr ON pr.id = p.product_id
INNER JOIN product_accessories pa ON pa.product_id = pr.id
WHERE pa.item_type = 'material'
  AND pa.material_id IS NOT NULL
  AND NOT EXISTS (
    -- Verificar se já existe movimento deste material para esta produção
    SELECT 1
    FROM material_movements mm
    WHERE mm.production_id = p.id
    AND mm.material_id = pa.material_id
    AND mm.movement_type = 'saida'
  )
ORDER BY p.production_date, p.created_at;

-- Log das correções
DO $$
DECLARE
  v_count integer;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Criados % movimentos de materiais para produções com acessórios', v_count;
END $$;
