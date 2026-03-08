-- TESTE: Validar Custo Teórico e Margem no Relatório de Produção

-- ========================================
-- 1. VERIFICAR PRODUTOS COM CUSTOS CONFIGURADOS
-- ========================================

SELECT
  name as produto,
  code as codigo,
  product_type as tipo,
  TO_CHAR(production_cost, 'FM999999990.00') as custo_producao,
  TO_CHAR(material_cost, 'FM999999990.00') as custo_material,
  TO_CHAR(manual_unit_cost, 'FM999999990.00') as custo_manual,
  TO_CHAR(sale_price, 'FM999999990.00') as preco_venda,
  TO_CHAR(final_sale_price, 'FM999999990.00') as preco_final
FROM products
WHERE production_cost > 0
   OR material_cost > 0
   OR manual_unit_cost > 0
ORDER BY name
LIMIT 10;


-- ========================================
-- 2. VERIFICAR PRODUÇÕES COM CUSTOS REAIS
-- ========================================

SELECT
  p.id,
  TO_CHAR(p.production_date, 'DD/MM/YYYY') as data,
  prod.name as produto,
  p.quantity as qtd,
  prod.unit as unidade,
  COALESCE((
    SELECT SUM(pi.total_cost)
    FROM production_items pi
    WHERE pi.production_id = p.id
  ), 0) as custo_real_total,
  CASE
    WHEN p.quantity > 0 THEN
      COALESCE((
        SELECT SUM(pi.total_cost)
        FROM production_items pi
        WHERE pi.production_id = p.id
      ), 0) / p.quantity
    ELSE 0
  END as custo_real_unitario,
  COALESCE(prod.production_cost, prod.material_cost, prod.manual_unit_cost, 0) as custo_teorico
FROM production p
INNER JOIN products prod ON prod.id = p.product_id
WHERE p.production_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY p.production_date DESC
LIMIT 10;


-- ========================================
-- 3. TESTAR FUNÇÃO relatorio_total_produtos
-- ========================================

SELECT
  TO_CHAR(production_date, 'DD/MM/YYYY') as data,
  product_name as produto,
  product_code as codigo,
  total_quantity as qtd,
  unit as unidade,
  production_count as num_producoes,

  -- Custos
  TO_CHAR(total_material_cost, 'FM999999990.00') as custo_materiais_total,
  TO_CHAR(avg_cost_per_unit, 'FM999999990.00') as custo_real_unit,
  TO_CHAR(product_unit_cost, 'FM999999990.00') as custo_teorico_unit,
  TO_CHAR(final_cost_per_unit, 'FM999999990.00') as custo_final_unit,

  -- Preço e Margem
  TO_CHAR(sales_price, 'FM999999990.00') as preco_venda,
  TO_CHAR(margin_per_unit, 'FM999999990.00') as margem_unit,
  TO_CHAR(margin_percentage, 'FM990.0') || '%' as margem_pct,

  -- Indicador
  CASE
    WHEN avg_cost_per_unit > 0 THEN 'Real'
    WHEN product_unit_cost > 0 THEN 'Teórico'
    ELSE 'Sem Custo'
  END as tipo_custo
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
)
ORDER BY production_date DESC, product_name
LIMIT 20;


-- ========================================
-- 4. PRODUTOS COM MAIOR MARGEM
-- ========================================

SELECT
  product_name as produto,
  TO_CHAR(final_cost_per_unit, 'FM999999990.00') as custo,
  TO_CHAR(sales_price, 'FM999999990.00') as venda,
  TO_CHAR(margin_per_unit, 'FM999999990.00') as margem,
  TO_CHAR(margin_percentage, 'FM990.0') || '%' as margem_pct,
  total_quantity as qtd_produzida,
  TO_CHAR(margin_per_unit * total_quantity, 'FM999999990.00') as lucro_total
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
)
WHERE sales_price > 0
  AND margin_per_unit > 0
ORDER BY margin_percentage DESC
LIMIT 10;


-- ========================================
-- 5. PRODUTOS COM PREJUÍZO (Margem Negativa)
-- ========================================

SELECT
  product_name as produto,
  TO_CHAR(final_cost_per_unit, 'FM999999990.00') as custo,
  TO_CHAR(sales_price, 'FM999999990.00') as venda,
  TO_CHAR(margin_per_unit, 'FM999999990.00') as margem,
  TO_CHAR(margin_percentage, 'FM990.0') || '%' as margem_pct,
  total_quantity as qtd_produzida,
  TO_CHAR(margin_per_unit * total_quantity, 'FM999999990.00') as prejuizo_total,
  CASE
    WHEN avg_cost_per_unit > 0 THEN 'Custo Real Alto'
    ELSE 'Preço Venda Baixo'
  END as motivo
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
)
WHERE margin_per_unit < 0
ORDER BY margin_per_unit ASC
LIMIT 10;


-- ========================================
-- 6. PRODUTOS SEM CUSTO CONFIGURADO
-- ========================================

SELECT
  name as produto,
  code as codigo,
  product_type as tipo,
  TO_CHAR(sale_price, 'FM999999990.00') as preco_venda,
  CASE
    WHEN production_cost IS NULL
     AND material_cost IS NULL
     AND manual_unit_cost IS NULL THEN 'SEM CUSTO!'
    ELSE 'OK'
  END as status
FROM products
WHERE (production_cost IS NULL OR production_cost = 0)
  AND (material_cost IS NULL OR material_cost = 0)
  AND (manual_unit_cost IS NULL OR manual_unit_cost = 0)
ORDER BY name;


-- ========================================
-- 7. COMPARAR CUSTO REAL vs TEÓRICO
-- ========================================

SELECT
  product_name as produto,
  TO_CHAR(avg_cost_per_unit, 'FM999999990.00') as custo_real,
  TO_CHAR(product_unit_cost, 'FM999999990.00') as custo_teorico,
  TO_CHAR(final_cost_per_unit, 'FM999999990.00') as custo_final,
  CASE
    WHEN avg_cost_per_unit > 0 AND product_unit_cost > 0 THEN
      TO_CHAR(
        ((product_unit_cost - avg_cost_per_unit) / avg_cost_per_unit * 100),
        'FM990.0'
      ) || '%'
    ELSE '-'
  END as diferenca_pct,
  CASE
    WHEN avg_cost_per_unit = 0 THEN 'Usando Teórico'
    WHEN product_unit_cost = 0 THEN 'Usando Real'
    WHEN avg_cost_per_unit < product_unit_cost THEN 'Real Menor (Bom!)'
    WHEN avg_cost_per_unit > product_unit_cost THEN 'Real Maior (Atenção!)'
    ELSE 'Igual'
  END as analise
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
)
WHERE avg_cost_per_unit > 0 OR product_unit_cost > 0
ORDER BY product_name;


-- ========================================
-- 8. USAR VIEW AUXILIAR v_producao_com_custos
-- ========================================

SELECT
  TO_CHAR(production_date, 'DD/MM/YYYY') as data,
  product_name as produto,
  quantity as qtd,
  unit as unidade,
  TO_CHAR(total_material_cost, 'FM999999990.00') as custo_materiais,
  TO_CHAR(product_unit_cost, 'FM999999990.00') as custo_teorico,
  TO_CHAR(sales_price, 'FM999999990.00') as preco_venda,
  TO_CHAR(final_cost_per_unit, 'FM999999990.00') as custo_final,
  TO_CHAR(margin_per_unit, 'FM999999990.00') as margem,
  CASE
    WHEN margin_per_unit >= 0 THEN '✓ Lucro'
    ELSE '✗ Prejuízo'
  END as status
FROM v_producao_com_custos
WHERE production_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY production_date DESC, product_name
LIMIT 20;


-- ========================================
-- 9. PRODUTOS SEM PREÇO DE VENDA
-- ========================================

SELECT
  name as produto,
  code as codigo,
  product_type as tipo,
  TO_CHAR(production_cost, 'FM999999990.00') as custo,
  'SEM PREÇO!' as alerta
FROM products
WHERE (sale_price IS NULL OR sale_price = 0)
  AND (final_sale_price IS NULL OR final_sale_price = 0)
  AND (production_cost > 0 OR material_cost > 0)
ORDER BY name;


-- ========================================
-- 10. ESTATÍSTICAS DE MARGEM
-- ========================================

SELECT
  COUNT(*) as total_produtos,
  COUNT(CASE WHEN margin_per_unit > 0 THEN 1 END) as com_lucro,
  COUNT(CASE WHEN margin_per_unit < 0 THEN 1 END) as com_prejuizo,
  COUNT(CASE WHEN margin_per_unit = 0 THEN 1 END) as sem_margem,
  TO_CHAR(AVG(margin_per_unit), 'FM999999990.00') as margem_media,
  TO_CHAR(AVG(margin_percentage), 'FM990.0') || '%' as margem_pct_media,
  TO_CHAR(MAX(margin_per_unit), 'FM999999990.00') as margem_maxima,
  TO_CHAR(MIN(margin_per_unit), 'FM999999990.00') as margem_minima
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
)
WHERE sales_price > 0;


-- ========================================
-- 11. PRODUTOS USANDO CUSTO TEÓRICO
-- ========================================

SELECT
  product_name as produto,
  TO_CHAR(production_date, 'DD/MM/YYYY') as data,
  total_quantity as qtd,
  TO_CHAR(avg_cost_per_unit, 'FM999999990.00') as custo_real,
  TO_CHAR(product_unit_cost, 'FM999999990.00') as custo_teorico,
  TO_CHAR(final_cost_per_unit, 'FM999999990.00') as custo_usado,
  'USANDO TEÓRICO' as observacao
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
)
WHERE (avg_cost_per_unit = 0 OR avg_cost_per_unit IS NULL)
  AND product_unit_cost > 0
ORDER BY production_date DESC;


-- ========================================
-- 12. RESUMO FINANCEIRO POR PERÍODO
-- ========================================

SELECT
  TO_CHAR(production_date, 'MM/YYYY') as mes_ano,
  COUNT(DISTINCT product_id) as produtos_diferentes,
  SUM(total_quantity) as qtd_total_produzida,
  TO_CHAR(SUM(total_material_cost), 'FM999999990.00') as custo_total,
  TO_CHAR(SUM(sales_price * total_quantity), 'FM999999990.00') as faturamento_potencial,
  TO_CHAR(SUM(margin_per_unit * total_quantity), 'FM999999990.00') as margem_total,
  TO_CHAR(
    CASE
      WHEN SUM(sales_price * total_quantity) > 0 THEN
        (SUM(margin_per_unit * total_quantity) / SUM(sales_price * total_quantity) * 100)
      ELSE 0
    END,
    'FM990.0'
  ) || '%' as margem_media_pct
FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '6 months',
  CURRENT_DATE
)
WHERE sales_price > 0
GROUP BY TO_CHAR(production_date, 'MM/YYYY')
ORDER BY mes_ano DESC;


-- ========================================
-- 13. VERIFICAR ÍNDICES CRIADOS
-- ========================================

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('products', 'production_items', 'production')
  AND (indexdef ILIKE '%cost%' OR indexdef ILIKE '%price%')
ORDER BY tablename, indexname;


-- ========================================
-- 14. PERFORMANCE: EXPLAIN da Query Principal
-- ========================================

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM relatorio_total_produtos(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);


-- ========================================
-- 15. VALIDAR CÁLCULO DE MARGEM (Manual)
-- ========================================

WITH teste AS (
  SELECT
    product_name,
    final_cost_per_unit,
    sales_price,
    margin_per_unit,
    margin_percentage,
    -- Calcular manualmente
    (sales_price - final_cost_per_unit) as margem_calculada,
    CASE
      WHEN sales_price > 0 THEN
        ((sales_price - final_cost_per_unit) / sales_price * 100)
      ELSE 0
    END as pct_calculado
  FROM relatorio_total_produtos(
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE
  )
  WHERE sales_price > 0
  LIMIT 5
)
SELECT
  product_name,
  TO_CHAR(final_cost_per_unit, 'FM999990.00') as custo,
  TO_CHAR(sales_price, 'FM999990.00') as venda,
  TO_CHAR(margin_per_unit, 'FM999990.00') as margem_funcao,
  TO_CHAR(margem_calculada, 'FM999990.00') as margem_manual,
  TO_CHAR(margin_percentage, 'FM990.0') || '%' as pct_funcao,
  TO_CHAR(pct_calculado, 'FM990.0') || '%' as pct_manual,
  CASE
    WHEN ABS(margin_per_unit - margem_calculada) < 0.01 THEN '✓ OK'
    ELSE '✗ DIFERENÇA!'
  END as validacao
FROM teste;


-- ========================================
-- RESUMO DOS TESTES
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO DOS TESTES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Teste 1: Produtos com custos configurados';
  RAISE NOTICE '✓ Teste 2: Produções com custos reais';
  RAISE NOTICE '✓ Teste 3: Função relatorio_total_produtos';
  RAISE NOTICE '✓ Teste 4: Produtos com maior margem';
  RAISE NOTICE '✓ Teste 5: Produtos com prejuízo';
  RAISE NOTICE '✓ Teste 6: Produtos sem custo';
  RAISE NOTICE '✓ Teste 7: Comparar real vs teórico';
  RAISE NOTICE '✓ Teste 8: View auxiliar';
  RAISE NOTICE '✓ Teste 9: Produtos sem preço';
  RAISE NOTICE '✓ Teste 10: Estatísticas de margem';
  RAISE NOTICE '✓ Teste 11: Produtos usando teórico';
  RAISE NOTICE '✓ Teste 12: Resumo financeiro';
  RAISE NOTICE '✓ Teste 13: Índices criados';
  RAISE NOTICE '✓ Teste 14: Performance EXPLAIN';
  RAISE NOTICE '✓ Teste 15: Validar cálculo';
  RAISE NOTICE '';
  RAISE NOTICE 'Execute cada query acima para validar a implementação.';
END $$;
