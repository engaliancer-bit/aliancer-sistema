-- ============================================================
-- DEBUG - Marco de Concreto com Custo Errado
-- ============================================================

-- 1. Ver produções de Marco de Concreto no dia 04/02/2026
SELECT
  'PRODUÇÕES DE MARCO NO DIA 04/02/2026' as secao;

SELECT
  p.id,
  p.product_id,
  prod.name as produto,
  p.quantity as quantidade,
  p.production_date,
  jsonb_pretty(p.custos_no_momento) as custos_salvos
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.production_date = '2026-02-04'
  AND prod.name ILIKE '%marco%';

-- 2. Ver o que está em production_items para esse marco
SELECT
  'PRODUCTION_ITEMS DO MARCO' as secao;

SELECT
  pi.production_id,
  pi.material_name,
  pi.quantity as quantidade_material,
  pi.unit as unidade,
  pi.unit_cost as custo_unitario,
  pi.total_cost as custo_total_material
FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
WHERE p.production_date = '2026-02-04'
  AND p.product_id IN (
    SELECT id FROM products WHERE name ILIKE '%marco%'
  );

-- 3. Ver o custo cadastrado no produto
SELECT
  'CUSTOS CADASTRADOS NO PRODUTO MARCO' as secao;

SELECT
  prod.id,
  prod.name,
  prod.unit_price as preco_venda,
  prod.recipe_id,
  rec.name as receita,
  rec.specific_weight as peso_especifico,
  (SELECT COUNT(*) FROM product_reinforcements WHERE product_id = prod.id) as qtd_armaduras,
  (SELECT COUNT(*) FROM product_accessories WHERE product_id = prod.id) as qtd_acessorios,
  (SELECT SUM(pmw.weight) FROM product_material_weights pmw WHERE pmw.product_id = prod.id) as peso_total_materiais
FROM products prod
LEFT JOIN recipes rec ON rec.id = prod.recipe_id
WHERE prod.name ILIKE '%marco%';

-- 4. Ver receita e seus materiais
SELECT
  'MATERIAIS DA RECEITA DO MARCO' as secao;

SELECT
  rm.recipe_id,
  rec.name as receita,
  m.name as material,
  rm.percentage as percentual,
  m.current_price as preco_atual,
  m.unit as unidade
FROM recipe_materials rm
INNER JOIN materials m ON m.id = rm.material_id
INNER JOIN recipes rec ON rec.id = rm.recipe_id
WHERE rec.id IN (
  SELECT recipe_id FROM products WHERE name ILIKE '%marco%'
);

-- 5. Ver armaduras do marco
SELECT
  'ARMADURAS DO MARCO' as secao;

SELECT
  pr.product_id,
  prod.name as produto,
  pr.reinforcement_type as tipo,
  m.name as material,
  pr.diameter as diametro,
  pr.quantity as quantidade,
  pr.length_per_unit as comprimento_por_unidade,
  m.current_price as preco_por_metro,
  (pr.quantity * pr.length_per_unit * m.current_price) as custo_total_armadura
FROM product_reinforcements pr
INNER JOIN products prod ON prod.id = pr.product_id
INNER JOIN materials m ON m.id = pr.material_id
WHERE prod.name ILIKE '%marco%';

-- 6. Testar função relatorio_producao_completo para o dia
SELECT
  'RESULTADO DA FUNÇÃO relatorio_producao_completo' as secao;

SELECT * FROM relatorio_producao_completo('2026-02-04', '2026-02-04');

-- 7. Testar função relatorio_total_produtos para o dia
SELECT
  'RESULTADO DA FUNÇÃO relatorio_total_produtos' as secao;

SELECT * FROM relatorio_total_produtos('2026-02-04', '2026-02-04');

-- 8. Testar função relatorio_consumo_insumos para o dia
SELECT
  'RESULTADO DA FUNÇÃO relatorio_consumo_insumos' as secao;

SELECT * FROM relatorio_consumo_insumos('2026-02-04', '2026-02-04');

-- 9. Calcular manualmente o que DEVERIA ser o custo
SELECT
  'CÁLCULO MANUAL DO CUSTO ESPERADO' as secao;

WITH materiais_receita AS (
  SELECT
    'Receita (traço)' as origem,
    m.name as material,
    rm.percentage as percentual,
    3.1184 + 4.3284 + 1.2474 + 0.0142 as peso_total_traco, -- soma dos pesos informados
    (rm.percentage / 100.0) * (3.1184 + 4.3284 + 1.2474 + 0.0142) as quantidade_material,
    m.current_price as preco_unitario,
    (rm.percentage / 100.0) * (3.1184 + 4.3284 + 1.2474 + 0.0142) * m.current_price as custo_parcial
  FROM recipe_materials rm
  INNER JOIN materials m ON m.id = rm.material_id
  WHERE rm.recipe_id IN (SELECT recipe_id FROM products WHERE name ILIKE '%marco%')
),
armaduras AS (
  SELECT
    'Armadura' as origem,
    m.name as material,
    NULL as percentual,
    0.30 as quantidade_material, -- 0,30 metros informados
    m.current_price as preco_unitario,
    0.30 * m.current_price as custo_parcial
  FROM product_reinforcements pr
  INNER JOIN materials m ON m.id = pr.material_id
  WHERE pr.product_id IN (SELECT id FROM products WHERE name ILIKE '%marco%')
)
SELECT
  origem,
  material,
  quantidade_material,
  preco_unitario,
  custo_parcial
FROM materiais_receita
UNION ALL
SELECT
  origem,
  material,
  quantidade_material,
  preco_unitario,
  custo_parcial
FROM armaduras
UNION ALL
SELECT
  'TOTAL' as origem,
  '' as material,
  NULL as quantidade_material,
  NULL as preco_unitario,
  (SELECT SUM(custo_parcial) FROM materiais_receita) +
  (SELECT SUM(custo_parcial) FROM armaduras) as custo_parcial;
