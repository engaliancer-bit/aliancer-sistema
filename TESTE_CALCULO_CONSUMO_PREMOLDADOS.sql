/**
 * TESTE E VALIDAÇÃO - Cálculo de Consumo de Pré-Moldados
 *
 * Execute estas queries no Supabase SQL Editor para validar
 * que o cálculo de consumo está correto.
 */

-- ============================================================
-- 1. VERIFICAR PRODUTOS PRÉ-MOLDADOS COM TRAÇO
-- ============================================================

SELECT
  p.name AS produto,
  p.product_type AS tipo,
  p.concrete_volume_m3 AS volume_m3,
  r.name AS traco,
  r.specific_weight AS peso_especifico,
  p.total_weight AS peso_peca,
  -- Cálculo esperado do peso
  (p.concrete_volume_m3 * r.specific_weight) AS peso_calculado,
  -- Diferença (deve ser próxima de zero)
  ABS(p.total_weight - (p.concrete_volume_m3 * r.specific_weight)) AS diferenca,
  p.material_cost AS custo_materiais
FROM products p
LEFT JOIN recipes r ON r.id = p.recipe_id
WHERE p.product_type = 'premolded'
  AND p.concrete_volume_m3 IS NOT NULL
  AND p.concrete_volume_m3 > 0
  AND r.specific_weight IS NOT NULL
  AND r.specific_weight > 0
ORDER BY p.name;

-- ============================================================
-- 2. VALIDAR CONSUMO DE UM PRODUTO ESPECÍFICO (EXEMPLO)
-- ============================================================

-- Substitua 'Pilar pré moldado de 18x25 - H=5,00' pelo nome do seu produto
WITH produto_teste AS (
  SELECT
    p.id,
    p.name,
    p.concrete_volume_m3,
    p.total_weight,
    p.recipe_id,
    r.specific_weight,
    r.name AS recipe_name
  FROM products p
  LEFT JOIN recipes r ON r.id = p.recipe_id
  WHERE p.name ILIKE '%pilar%18%25%5%' -- Ajuste conforme necessário
    AND p.product_type = 'premolded'
  LIMIT 1
),
materiais_traco AS (
  SELECT
    ri.recipe_id,
    ri.material_id,
    m.name AS material_name,
    ri.quantity AS qtd_traco,
    m.unit AS unidade
  FROM recipe_items ri
  JOIN materials m ON m.id = ri.material_id
  WHERE ri.recipe_id = (SELECT recipe_id FROM produto_teste)
),
soma_traco AS (
  SELECT
    recipe_id,
    SUM(qtd_traco) AS peso_total_traco
  FROM materiais_traco
  GROUP BY recipe_id
)
SELECT
  pt.name AS produto,
  pt.concrete_volume_m3 AS volume_m3,
  pt.specific_weight AS peso_especifico_kg_m3,
  pt.total_weight AS peso_peca_kg,
  st.peso_total_traco AS peso_total_traco_kg,
  -- Multiplicador
  (pt.total_weight / st.peso_total_traco) AS multiplicador,
  -- Materiais
  mt.material_name AS material,
  mt.qtd_traco AS qtd_no_traco_kg,
  -- Consumo calculado
  (mt.qtd_traco * (pt.total_weight / st.peso_total_traco)) AS consumo_calculado_kg,
  mt.unidade
FROM produto_teste pt
CROSS JOIN soma_traco st
JOIN materiais_traco mt ON mt.recipe_id = pt.recipe_id
ORDER BY mt.material_name;

-- ============================================================
-- 3. EXEMPLO MANUAL DE CÁLCULO
-- ============================================================

-- Dados do exemplo do usuário:
-- Volume: 0,244330 m³
-- Massa específica: 2419 kg/m³
-- Traço: Areia 2,5kg, Pedrisco 3,47kg, Cimento 1kg, Aditivo 0,011kg

WITH dados_exemplo AS (
  SELECT
    0.244330::numeric AS volume_m3,
    2419::numeric AS peso_especifico,
    2.5::numeric AS areia,
    3.47::numeric AS pedrisco,
    1.0::numeric AS cimento,
    0.011::numeric AS aditivo
),
calculos AS (
  SELECT
    volume_m3,
    peso_especifico,
    (volume_m3 * peso_especifico) AS peso_peca,
    (areia + pedrisco + cimento + aditivo) AS peso_total_traco,
    areia,
    pedrisco,
    cimento,
    aditivo
  FROM dados_exemplo
)
SELECT
  'Volume' AS item,
  volume_m3::text AS valor,
  'm³' AS unidade
FROM calculos
UNION ALL
SELECT
  'Peso Específico',
  peso_especifico::text,
  'kg/m³'
FROM calculos
UNION ALL
SELECT
  'Peso da Peça',
  peso_peca::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Peso Total do Traço',
  peso_total_traco::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Multiplicador',
  (peso_peca / peso_total_traco)::text,
  '-'
FROM calculos
UNION ALL
SELECT
  '---',
  '---',
  '---'
UNION ALL
SELECT
  'Areia (traço)',
  areia::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Areia (consumo)',
  (areia * (peso_peca / peso_total_traco))::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Pedrisco (traço)',
  pedrisco::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Pedrisco (consumo)',
  (pedrisco * (peso_peca / peso_total_traco))::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Cimento (traço)',
  cimento::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Cimento (consumo)',
  (cimento * (peso_peca / peso_total_traco))::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Aditivo (traço)',
  aditivo::text,
  'kg'
FROM calculos
UNION ALL
SELECT
  'Aditivo (consumo)',
  (aditivo * (peso_peca / peso_total_traco))::text,
  'kg'
FROM calculos;

-- ============================================================
-- 4. LISTAR TODOS OS PRODUTOS PRÉ-MOLDADOS COM CONSUMO
-- ============================================================

SELECT
  p.name AS produto,
  p.concrete_volume_m3 AS volume,
  r.specific_weight AS peso_esp,
  p.total_weight AS peso_peca,
  (
    SELECT COUNT(*)
    FROM recipe_items ri
    WHERE ri.recipe_id = p.recipe_id
  ) AS num_materiais,
  (
    SELECT SUM(ri.quantity)
    FROM recipe_items ri
    WHERE ri.recipe_id = p.recipe_id
  ) AS peso_traco_total,
  CASE
    WHEN p.total_weight > 0 AND (SELECT SUM(ri.quantity) FROM recipe_items ri WHERE ri.recipe_id = p.recipe_id) > 0
    THEN p.total_weight / (SELECT SUM(ri.quantity) FROM recipe_items ri WHERE ri.recipe_id = p.recipe_id)
    ELSE 0
  END AS multiplicador,
  p.material_cost AS custo
FROM products p
LEFT JOIN recipes r ON r.id = p.recipe_id
WHERE p.product_type = 'premolded'
  AND p.recipe_id IS NOT NULL
ORDER BY p.name;

-- ============================================================
-- 5. VERIFICAR INCONSISTÊNCIAS
-- ============================================================

-- Produtos pré-moldados sem volume
SELECT
  p.name AS produto,
  'Sem volume de concreto' AS problema
FROM products p
WHERE p.product_type = 'premolded'
  AND (p.concrete_volume_m3 IS NULL OR p.concrete_volume_m3 = 0)

UNION ALL

-- Produtos com traço mas sem peso específico
SELECT
  p.name AS produto,
  'Traço sem peso específico' AS problema
FROM products p
LEFT JOIN recipes r ON r.id = p.recipe_id
WHERE p.product_type = 'premolded'
  AND p.recipe_id IS NOT NULL
  AND (r.specific_weight IS NULL OR r.specific_weight = 0)

UNION ALL

-- Produtos com peso da peça diferente do calculado
SELECT
  p.name AS produto,
  'Peso da peça divergente (diferença > 1kg)' AS problema
FROM products p
LEFT JOIN recipes r ON r.id = p.recipe_id
WHERE p.product_type = 'premolded'
  AND p.concrete_volume_m3 IS NOT NULL
  AND p.concrete_volume_m3 > 0
  AND r.specific_weight IS NOT NULL
  AND r.specific_weight > 0
  AND ABS(p.total_weight - (p.concrete_volume_m3 * r.specific_weight)) > 1

UNION ALL

-- Produtos sem materiais no traço
SELECT
  p.name AS produto,
  'Traço sem materiais' AS problema
FROM products p
WHERE p.product_type = 'premolded'
  AND p.recipe_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM recipe_items ri WHERE ri.recipe_id = p.recipe_id
  );

-- ============================================================
-- 6. COMPARAR CONSUMO ANTES E DEPOIS (SIMULAÇÃO)
-- ============================================================

WITH produto_exemplo AS (
  SELECT
    0.244330::numeric AS volume_m3,
    2419::numeric AS peso_especifico,
    2.5::numeric AS areia_traco,
    3.47::numeric AS pedrisco_traco,
    1.0::numeric AS cimento_traco,
    0.011::numeric AS aditivo_traco
),
calculos AS (
  SELECT
    *,
    (volume_m3 * peso_especifico) AS peso_peca,
    (areia_traco + pedrisco_traco + cimento_traco + aditivo_traco) AS peso_total_traco
  FROM produto_exemplo
)
SELECT
  'Areia' AS material,
  areia_traco AS qtd_traco,
  -- ANTES (errado): qtd × volume
  (areia_traco * volume_m3) AS consumo_antes_ERRADO,
  -- DEPOIS (correto): qtd × multiplicador
  (areia_traco * (peso_peca / peso_total_traco)) AS consumo_depois_CORRETO,
  -- Diferença
  ((areia_traco * (peso_peca / peso_total_traco)) / (areia_traco * volume_m3)) AS proporcao_aumento
FROM calculos

UNION ALL

SELECT
  'Pedrisco',
  pedrisco_traco,
  (pedrisco_traco * volume_m3),
  (pedrisco_traco * (peso_peca / peso_total_traco)),
  ((pedrisco_traco * (peso_peca / peso_total_traco)) / (pedrisco_traco * volume_m3))
FROM calculos

UNION ALL

SELECT
  'Cimento',
  cimento_traco,
  (cimento_traco * volume_m3),
  (cimento_traco * (peso_peca / peso_total_traco)),
  ((cimento_traco * (peso_peca / peso_total_traco)) / (cimento_traco * volume_m3))
FROM calculos

UNION ALL

SELECT
  'Aditivo',
  aditivo_traco,
  (aditivo_traco * volume_m3),
  (aditivo_traco * (peso_peca / peso_total_traco)),
  ((aditivo_traco * (peso_peca / peso_total_traco)) / (aditivo_traco * volume_m3))
FROM calculos;

-- ============================================================
-- 7. VERIFICAR PRODUÇÃO COM CONSUMO CORRETO
-- ============================================================

-- Buscar produções recentes de produtos pré-moldados
SELECT
  pr.date AS data,
  p.name AS produto,
  pr.quantity AS quantidade,
  p.total_weight AS peso_unitario,
  (pr.quantity * p.total_weight) AS peso_total_produzido,
  -- Buscar consumo de materiais
  (
    SELECT COUNT(*)
    FROM material_movements mm
    WHERE mm.production_id = pr.id
      AND mm.movement_type = 'production'
  ) AS num_materiais_consumidos
FROM production pr
JOIN products p ON p.id = pr.product_id
WHERE p.product_type = 'premolded'
  AND pr.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY pr.date DESC
LIMIT 20;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================

/*
Para o exemplo do usuário (Pilar 18x25 - H=5,00):

Query 3 deve retornar algo como:

| item                 | valor      | unidade |
|---------------------|-----------|---------|
| Volume              | 0.244330  | m³      |
| Peso Específico     | 2419      | kg/m³   |
| Peso da Peça        | 591.03    | kg      |
| Peso Total do Traço | 6.981     | kg      |
| Multiplicador       | 84.65     | -       |
| ---                 | ---       | ---     |
| Areia (traço)       | 2.5       | kg      |
| Areia (consumo)     | 211.63    | kg      |
| Pedrisco (traço)    | 3.47      | kg      |
| Pedrisco (consumo)  | 293.74    | kg      |
| Cimento (traço)     | 1.0       | kg      |
| Cimento (consumo)   | 84.65     | kg      |
| Aditivo (traço)     | 0.011     | kg      |
| Aditivo (consumo)   | 0.93      | kg      |

✅ CORRETO se os valores de consumo estiverem nesta proporção!
*/
