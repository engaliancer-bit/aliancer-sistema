-- ============================================================================
-- QUERIES DE VALIDAÇÃO - RELATÓRIO DE CONSUMO DE INSUMOS
-- ============================================================================

-- 1. IDENTIFICAR AJUSTES DE ESTOQUE NO PERÍODO
-- Use esta query para ver quais produções serão excluídas do cálculo
-- ============================================================================
SELECT
  p.id,
  p.production_date,
  pr.name as produto,
  p.quantity,
  p.notes
FROM production p
JOIN products pr ON p.product_id = pr.id
WHERE p.production_date >= '2026-01-01'
  AND p.production_date <= '2026-01-31'
  AND p.notes ILIKE '%ajuste de estoque%'
ORDER BY p.production_date DESC, p.quantity DESC;

-- Exemplo de resultado esperado:
-- | id | production_date | produto | quantity | notes |
-- |----|----------------|---------|----------|-------|
-- | xxx | 2026-01-28 | Paver retangular 10x20x06 | 13916 | Ajuste de estoque (entrada) |


-- 2. CONSUMO AGREGADO DE INSUMOS - JANEIRO 2026 (EXCLUINDO AJUSTES)
-- Esta query replica exatamente a lógica do frontend
-- ============================================================================
WITH producoes_validas AS (
  SELECT id
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
),
consumo_agregado AS (
  SELECT
    m.id as material_id,
    m.name as material,
    SUM(mm.quantity) as quantidade_total,
    m.unit as unidade,
    m.unit_cost as valor_unitario,
    SUM(mm.quantity * m.unit_cost) as valor_total
  FROM material_movements mm
  JOIN materials m ON mm.material_id = m.id
  WHERE mm.production_id IN (SELECT id FROM producoes_validas)
    AND mm.movement_type = 'saida'
  GROUP BY m.id, m.name, m.unit, m.unit_cost
)
SELECT
  material,
  ROUND(quantidade_total::numeric, 2) as "Quantidade Total",
  unidade as "Unidade",
  'R$ ' || ROUND(valor_unitario::numeric, 2) as "Valor Unitário",
  'R$ ' || ROUND(valor_total::numeric, 2) as "Valor Total"
FROM consumo_agregado
ORDER BY material;

-- Exemplo de resultado esperado:
-- | material | Quantidade Total | Unidade | Valor Unitário | Valor Total |
-- |----------|-----------------|---------|----------------|-------------|
-- | Aditivo CQ Flow 377 1,45 | 125.50 | kg | R$ 5.50 | R$ 690.25 |
-- | Areia média | 5847.35 | kg | R$ 0.15 | R$ 877.10 |
-- | Pedrisco | 8122.90 | kg | R$ 0.20 | R$ 1624.58 |


-- 3. TOTAL GERAL DE CONSUMO NO PERÍODO
-- ============================================================================
WITH producoes_validas AS (
  SELECT id
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
)
SELECT
  'TOTAL GERAL' as descricao,
  COUNT(DISTINCT m.id) as total_materiais,
  'R$ ' || ROUND(SUM(mm.quantity * m.unit_cost)::numeric, 2) as custo_total
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
WHERE mm.production_id IN (SELECT id FROM producoes_validas)
  AND mm.movement_type = 'saida';

-- Exemplo de resultado esperado:
-- | descricao | total_materiais | custo_total |
-- |-----------|----------------|-------------|
-- | TOTAL GERAL | 15 | R$ 45234.87 |


-- 4. COMPARAR CONSUMO COM E SEM AJUSTES
-- Esta query mostra a diferença entre incluir e excluir ajustes
-- ============================================================================
WITH consumo_com_ajustes AS (
  SELECT
    'COM AJUSTES' as tipo,
    m.name as material,
    SUM(mm.quantity) as quantidade,
    SUM(mm.quantity * m.unit_cost) as custo
  FROM material_movements mm
  JOIN materials m ON mm.material_id = m.id
  JOIN production p ON mm.production_id = p.id
  WHERE p.production_date >= '2026-01-01'
    AND p.production_date <= '2026-01-31'
    AND mm.movement_type = 'saida'
  GROUP BY m.name
),
consumo_sem_ajustes AS (
  SELECT
    'SEM AJUSTES' as tipo,
    m.name as material,
    SUM(mm.quantity) as quantidade,
    SUM(mm.quantity * m.unit_cost) as custo
  FROM material_movements mm
  JOIN materials m ON mm.material_id = m.id
  JOIN production p ON mm.production_id = p.id
  WHERE p.production_date >= '2026-01-01'
    AND p.production_date <= '2026-01-31'
    AND (p.notes IS NULL OR p.notes NOT ILIKE '%ajuste de estoque%')
    AND mm.movement_type = 'saida'
  GROUP BY m.name
)
SELECT
  ca.material,
  ROUND(ca.quantidade::numeric, 2) as qtd_com_ajustes,
  ROUND(csa.quantidade::numeric, 2) as qtd_sem_ajustes,
  ROUND((ca.quantidade - csa.quantidade)::numeric, 2) as diferenca_qtd,
  'R$ ' || ROUND(ca.custo::numeric, 2) as custo_com_ajustes,
  'R$ ' || ROUND(csa.custo::numeric, 2) as custo_sem_ajustes,
  'R$ ' || ROUND((ca.custo - csa.custo)::numeric, 2) as diferenca_custo
FROM consumo_com_ajustes ca
FULL OUTER JOIN consumo_sem_ajustes csa ON ca.material = csa.material
ORDER BY ca.material;

-- Esta query mostra claramente o impacto dos ajustes de estoque no cálculo


-- 5. TOP 10 MATERIAIS MAIS CONSUMIDOS NO PERÍODO
-- ============================================================================
WITH producoes_validas AS (
  SELECT id
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
)
SELECT
  m.name as material,
  ROUND(SUM(mm.quantity)::numeric, 2) as quantidade_total,
  m.unit as unidade,
  'R$ ' || ROUND(SUM(mm.quantity * m.unit_cost)::numeric, 2) as valor_total,
  COUNT(DISTINCT mm.production_id) as num_producoes
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
WHERE mm.production_id IN (SELECT id FROM producoes_validas)
  AND mm.movement_type = 'saida'
GROUP BY m.id, m.name, m.unit
ORDER BY SUM(mm.quantity * m.unit_cost) DESC
LIMIT 10;

-- Mostra os materiais que mais impactam o custo de produção


-- 6. CONSUMO DIÁRIO NO PERÍODO (EXCLUINDO AJUSTES)
-- ============================================================================
WITH producoes_validas AS (
  SELECT id, production_date
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
)
SELECT
  p.production_date as data,
  COUNT(DISTINCT m.id) as materiais_diferentes,
  ROUND(SUM(mm.quantity * m.unit_cost)::numeric, 2) as custo_total_dia
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
JOIN producoes_validas p ON mm.production_id = p.id
WHERE mm.movement_type = 'saida'
GROUP BY p.production_date
ORDER BY p.production_date DESC;

-- Mostra o custo de insumos por dia


-- 7. CONSUMO POR PRODUTO NO PERÍODO
-- Esta query mostra quanto cada produto consumiu de insumos
-- ============================================================================
WITH producoes_validas AS (
  SELECT id, product_id, production_date, quantity
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
)
SELECT
  pr.name as produto,
  COUNT(DISTINCT p.id) as num_producoes,
  SUM(p.quantity) as quantidade_produzida,
  pr.unit as unidade,
  ROUND(SUM(mm.quantity * m.unit_cost)::numeric, 2) as custo_insumos,
  ROUND((SUM(mm.quantity * m.unit_cost) / SUM(p.quantity))::numeric, 4) as custo_por_unidade
FROM producoes_validas p
JOIN products pr ON p.product_id = pr.id
LEFT JOIN material_movements mm ON mm.production_id = p.id AND mm.movement_type = 'saida'
LEFT JOIN materials m ON mm.material_id = m.id
GROUP BY pr.id, pr.name, pr.unit
HAVING SUM(p.quantity) > 0
ORDER BY SUM(mm.quantity * m.unit_cost) DESC;

-- Mostra custo de insumos por produto e custo unitário


-- 8. VALIDAR DIA ESPECÍFICO (28 DE JANEIRO)
-- Esta query valida especificamente o dia do ajuste do Paver
-- ============================================================================
SELECT
  p.id,
  pr.name as produto,
  p.quantity as quantidade_produzida,
  p.notes,
  CASE
    WHEN p.notes ILIKE '%ajuste de estoque%' THEN 'EXCLUIR'
    ELSE 'INCLUIR'
  END as status_calculo,
  COALESCE(ROUND(SUM(mm.quantity * m.unit_cost)::numeric, 2), 0) as custo_insumos
FROM production p
JOIN products pr ON p.product_id = pr.id
LEFT JOIN material_movements mm ON mm.production_id = p.id AND mm.movement_type = 'saida'
LEFT JOIN materials m ON mm.material_id = m.id
WHERE p.production_date = '2026-01-28'
GROUP BY p.id, pr.name, p.quantity, p.notes
ORDER BY p.quantity DESC;

-- Deve mostrar que o Paver com 13916 peças tem status "EXCLUIR"


-- 9. CONSUMO POR CATEGORIA DE MATERIAL
-- Se você tiver categorias de materiais no futuro
-- ============================================================================
WITH producoes_validas AS (
  SELECT id
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
)
SELECT
  CASE
    WHEN m.name ILIKE '%cimento%' THEN 'Cimento'
    WHEN m.name ILIKE '%areia%' THEN 'Areia'
    WHEN m.name ILIKE '%pedrisco%' OR m.name ILIKE '%brita%' THEN 'Agregado'
    WHEN m.name ILIKE '%aditivo%' THEN 'Aditivo'
    WHEN m.name ILIKE '%ferro%' OR m.name ILIKE '%aço%' THEN 'Armadura'
    ELSE 'Outros'
  END as categoria,
  COUNT(DISTINCT m.id) as num_materiais,
  ROUND(SUM(mm.quantity * m.unit_cost)::numeric, 2) as valor_total
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
WHERE mm.production_id IN (SELECT id FROM producoes_validas)
  AND mm.movement_type = 'saida'
GROUP BY categoria
ORDER BY valor_total DESC;

-- Agrupa materiais em categorias para análise macro


-- 10. VERIFICAR CONSISTÊNCIA DOS DADOS
-- Esta query valida se há movimentos de materiais sem produção válida
-- ============================================================================
SELECT
  COUNT(*) as total_movimentos,
  COUNT(CASE WHEN p.id IS NULL THEN 1 END) as movimentos_sem_producao,
  COUNT(CASE WHEN p.notes ILIKE '%ajuste de estoque%' THEN 1 END) as movimentos_de_ajustes,
  COUNT(CASE WHEN p.id IS NOT NULL AND (p.notes IS NULL OR p.notes NOT ILIKE '%ajuste de estoque%') THEN 1 END) as movimentos_validos
FROM material_movements mm
LEFT JOIN production p ON mm.production_id = p.id
WHERE mm.movement_type = 'saida'
  AND mm.movement_date >= '2026-01-01'
  AND mm.movement_date <= '2026-01-31';

-- Verifica integridade dos dados


-- ============================================================================
-- QUERIES ÚTEIS PARA ANÁLISE
-- ============================================================================

-- Média de consumo por dia útil
WITH producoes_validas AS (
  SELECT id, production_date
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
),
consumo_por_dia AS (
  SELECT
    p.production_date,
    SUM(mm.quantity * m.unit_cost) as custo_dia
  FROM material_movements mm
  JOIN materials m ON mm.material_id = m.id
  JOIN producoes_validas p ON mm.production_id = p.id
  WHERE mm.movement_type = 'saida'
  GROUP BY p.production_date
)
SELECT
  COUNT(DISTINCT production_date) as dias_com_producao,
  'R$ ' || ROUND(SUM(custo_dia)::numeric, 2) as custo_total,
  'R$ ' || ROUND(AVG(custo_dia)::numeric, 2) as media_por_dia
FROM consumo_por_dia;


-- Projeção de consumo mensal baseado em dias úteis
WITH producoes_validas AS (
  SELECT id, production_date
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
),
consumo_por_dia AS (
  SELECT
    p.production_date,
    SUM(mm.quantity * m.unit_cost) as custo_dia
  FROM material_movements mm
  JOIN materials m ON mm.material_id = m.id
  JOIN producoes_validas p ON mm.production_id = p.id
  WHERE mm.movement_type = 'saida'
  GROUP BY p.production_date
),
media_diaria AS (
  SELECT AVG(custo_dia) as media
  FROM consumo_por_dia
)
SELECT
  'Média diária' as descricao,
  'R$ ' || ROUND(media::numeric, 2) as valor,
  'Projeção 22 dias úteis' as periodo,
  'R$ ' || ROUND((media * 22)::numeric, 2) as projecao_mensal
FROM media_diaria;
