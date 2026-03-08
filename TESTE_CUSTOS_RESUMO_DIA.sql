-- TESTE: Verificar Custos no Resumo de Produção do Dia

-- 1. Verificar Marco de Concreto em 04/02/2026
SELECT
  product_name as "Produto",
  total_quantity as "Quantidade",
  unit as "Unidade",
  unit_price as "Preço Unit.",
  total_revenue as "Receita Total",
  total_cost as "Custo Total ✅",
  unit_cost as "Custo Unit. ✅",
  profit as "Lucro",
  profit_margin as "Margem %"
FROM get_resumo_produtos_dia('2026-02-04')
WHERE product_name ILIKE '%marco%';

-- RESULTADO ESPERADO:
-- Produto: Marco de concreto
-- Quantidade: 6
-- Unidade: unid
-- Preço Unit.: 40.00
-- Receita Total: 240.00
-- Custo Total: 14.80 ✅ (era 0.03)
-- Custo Unit.: 2.47 ✅
-- Lucro: 225.20
-- Margem %: 93.83


-- 2. Verificar TODOS os produtos do dia 04/02/2026
SELECT
  product_name,
  total_quantity,
  TO_CHAR(unit_price, 'FM999999990.00') as preco_unit,
  TO_CHAR(total_revenue, 'FM999999990.00') as receita,
  TO_CHAR(total_cost, 'FM999999990.00') as custo,
  TO_CHAR(unit_cost, 'FM999999990.00') as custo_unit,
  TO_CHAR(profit, 'FM999999990.00') as lucro,
  TO_CHAR(profit_margin, 'FM990.0') || '%' as margem
FROM get_resumo_produtos_dia('2026-02-04')
ORDER BY product_name;


-- 3. Comparar com dados da tabela production_items
SELECT
  prod.name as produto,
  p.quantity as qtd_produzida,
  (SELECT SUM(pi.total_cost) FROM production_items pi WHERE pi.production_id = p.id) as custo_items,
  (SELECT COUNT(*) FROM production_items pi WHERE pi.production_id = p.id) as num_materiais
FROM production p
INNER JOIN products prod ON prod.id = p.product_id
WHERE p.production_date = '2026-02-04'
  AND prod.name ILIKE '%marco%';

-- VERIFICAÇÃO:
-- Deve retornar custo_items = 14.80
-- Deve retornar num_materiais = 5


-- 4. Ver detalhes dos materiais consumidos
SELECT
  pi.material_name,
  pi.quantity,
  pi.unit,
  TO_CHAR(pi.unit_cost, 'FM999999990.00') as custo_unit,
  TO_CHAR(pi.total_cost, 'FM999999990.00') as custo_total
FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
INNER JOIN products prod ON prod.id = p.product_id
WHERE p.production_date = '2026-02-04'
  AND prod.name ILIKE '%marco%'
ORDER BY pi.total_cost DESC;

-- RESULTADO ESPERADO (5 materiais):
-- 1. CIMENTO OBRAS ESPECIAIS - 5.72
-- 2. CA-50 5/16-8.0MM - 3.88
-- 3. Areia média - 2.85
-- 4. Pedrisco - 1.79
-- 5. Aditivo CQ Flow - 0.56
-- TOTAL: 14.80 ✅


-- 5. Resumo consolidado do dia
SELECT
  COUNT(DISTINCT product_name) as total_produtos,
  SUM(total_quantity) as total_qtd,
  TO_CHAR(SUM(total_revenue), 'FM999999990.00') as receita_total,
  TO_CHAR(SUM(total_cost), 'FM999999990.00') as custo_total,
  TO_CHAR(SUM(profit), 'FM999999990.00') as lucro_total,
  TO_CHAR(
    CASE
      WHEN SUM(total_revenue) > 0 THEN
        (SUM(profit) / SUM(total_revenue)) * 100
      ELSE 0
    END,
    'FM990.0'
  ) || '%' as margem_media
FROM get_resumo_produtos_dia('2026-02-04');
