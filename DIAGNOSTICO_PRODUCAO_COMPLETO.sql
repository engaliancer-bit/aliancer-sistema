-- ============================================================
-- DIAGNÓSTICO COMPLETO - RESUMO DE PRODUÇÃO
-- ============================================================

-- 1. Verificar produções recentes e seus dados
SELECT
  'PRODUÇÕES RECENTES (últimas 10)' as secao;

SELECT
  p.id,
  p.product_id,
  prod.name as produto,
  p.quantity as quantidade,
  p.production_date as data,
  p.custos_no_momento IS NOT NULL as tem_custos,
  jsonb_typeof(p.custos_no_momento) as tipo_custos,
  jsonb_typeof(p.custos_no_momento->'materials') as tipo_materials,
  (SELECT COUNT(*) FROM jsonb_object_keys(p.custos_no_momento->'materials')) as qtd_materials_json,
  (SELECT COUNT(*) FROM production_items pi WHERE pi.production_id = p.id) as qtd_items_tabela,
  p.created_at
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
ORDER BY p.created_at DESC
LIMIT 10;

-- 2. Verificar se há produções SEM custos_no_momento
SELECT
  'PRODUÇÕES SEM CUSTOS_NO_MOMENTO' as secao;

SELECT
  COUNT(*) as total_sem_custos,
  MIN(production_date) as data_mais_antiga,
  MAX(production_date) as data_mais_recente
FROM production
WHERE custos_no_momento IS NULL;

-- 3. Verificar se há produções COM custos mas SEM production_items
SELECT
  'PRODUÇÕES COM CUSTOS MAS SEM ITEMS' as secao;

SELECT
  COUNT(*) as total
FROM production p
WHERE p.custos_no_momento IS NOT NULL
  AND jsonb_typeof(p.custos_no_momento->'materials') = 'object'
  AND NOT EXISTS (
    SELECT 1 FROM production_items pi WHERE pi.production_id = p.id
  );

-- 4. Ver exemplo de estrutura custos_no_momento
SELECT
  'EXEMPLO DE ESTRUTURA CUSTOS_NO_MOMENTO' as secao;

SELECT
  p.id,
  p.production_date,
  prod.name as produto,
  p.quantity,
  jsonb_pretty(p.custos_no_momento) as estrutura_completa
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.custos_no_momento IS NOT NULL
  AND jsonb_typeof(p.custos_no_momento->'materials') = 'object'
ORDER BY p.created_at DESC
LIMIT 3;

-- 5. Verificar totais gerais
SELECT
  'TOTAIS GERAIS' as secao;

SELECT
  'Total de produções' as metrica,
  COUNT(*) as valor
FROM production
UNION ALL
SELECT
  'Produções com custos_no_momento',
  COUNT(*)
FROM production
WHERE custos_no_momento IS NOT NULL
UNION ALL
SELECT
  'Produções com materials no JSON',
  COUNT(*)
FROM production
WHERE jsonb_typeof(custos_no_momento->'materials') = 'object'
UNION ALL
SELECT
  'Production_items total',
  COUNT(*)
FROM production_items
UNION ALL
SELECT
  'Produções distintas em production_items',
  COUNT(DISTINCT production_id)
FROM production_items;

-- 6. Testar função get_resumo_producao_dia para hoje
SELECT
  'TESTE get_resumo_producao_dia PARA HOJE' as secao;

SELECT * FROM get_resumo_producao_dia(CURRENT_DATE);

-- 7. Testar função get_resumo_produtos_dia para hoje
SELECT
  'TESTE get_resumo_produtos_dia PARA HOJE' as secao;

SELECT * FROM get_resumo_produtos_dia(CURRENT_DATE);

-- 8. Ver produções de hoje especificamente
SELECT
  'PRODUÇÕES DE HOJE' as secao;

SELECT
  p.id,
  prod.name as produto,
  p.quantity,
  p.custos_no_momento IS NOT NULL as tem_custos,
  (SELECT COUNT(*) FROM production_items pi WHERE pi.production_id = p.id) as qtd_items
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.production_date = CURRENT_DATE;

-- 9. Ver production_items de hoje
SELECT
  'PRODUCTION_ITEMS DE HOJE' as secao;

SELECT
  pi.material_name,
  SUM(pi.quantity) as total_quantidade,
  pi.unit,
  SUM(pi.total_cost) as custo_total
FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
WHERE p.production_date = CURRENT_DATE
GROUP BY pi.material_name, pi.unit;
