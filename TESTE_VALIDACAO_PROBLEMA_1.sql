/*
  # Testes de Validação - Problema 1: Divergência de Custos

  Execute este script para validar que todos os relatórios retornam
  valores consistentes após a implementação da solução.

  ## Procedimento
  1. Execute cada bloco de teste
  2. Verifique se todos retornam o mesmo valor de total_cost
  3. Procure por anomalias ou valores zero
  4. Confirme que validações passam
*/

-- ============================================================
-- 1. TESTE: Função Centralizada get_production_costs_safe
-- ============================================================

COMMENT ON FUNCTION get_production_costs_safe IS
  'TESTE 1: Validar que retorna dados sem duplicação';

-- Para um dia específico (substitua a data conforme necessário)
SELECT
  COUNT(*) as total_productions,
  SUM(quantity) as total_quantity,
  SUM(total_cost) as total_cost,
  AVG(cost_per_unit) as avg_cost_per_unit,
  MIN(production_date) as first_date,
  MAX(production_date) as last_date
FROM get_production_costs_safe('2026-02-01', '2026-02-02', true);

-- Resultado esperado:
-- total_cost deve ser valor correto sem multiplicação
-- Comparem com outros testes abaixo

-- ============================================================
-- 2. TESTE: Função Agregada get_production_costs_aggregated
-- ============================================================

SELECT * FROM get_production_costs_aggregated('2026-02-01', '2026-02-02', true);

-- Resultado esperado:
-- Deve retornar mesma total_cost que TESTE 1
-- avg_cost_per_production = total_cost / total_productions

-- ============================================================
-- 3. TESTE: relatorio_producao_completo (ATUALIZADO)
-- ============================================================

SELECT
  total_productions,
  total_products_quantity,
  total_material_cost,
  total_products,
  unique_materials,
  avg_cost_per_production,
  date_range_days
FROM relatorio_producao_completo('2026-02-01', '2026-02-02');

-- Resultado esperado:
-- total_material_cost deve ser igual ao SUM de TESTE 1

-- ============================================================
-- 4. TESTE: get_resumo_producao_dia (ATUALIZADO)
-- ============================================================

SELECT * FROM get_resumo_producao_dia('2026-02-01');

-- Resultado esperado:
-- total_cost deve ser igual aos testes anteriores

-- ============================================================
-- 5. TESTE: relatorio_consumo_insumos (ATUALIZADO)
-- ============================================================

SELECT
  material_name,
  total_quantity,
  unit,
  avg_unit_cost,
  total_cost,
  usage_count
FROM relatorio_consumo_insumos('2026-02-01', '2026-02-02')
LIMIT 10;

-- Resultado esperado:
-- Sem zeros ou valores nulos inesperados
-- total_cost coerente com custos de materiais

-- ============================================================
-- 6. TESTE: Validação de Integridade
-- ============================================================

SELECT * FROM validate_production_costs('2026-02-01', '2026-02-02');

-- Resultado esperado:
-- validation_passed: true
-- duplicate_cost_entries: 0
-- total_cost_amount: positivo (se houver produções)

-- ============================================================
-- 7. TESTE: Validação de Consistência
-- ============================================================

SELECT * FROM validate_cost_consistency('2026-02-01', '2026-02-02');

-- Resultado esperado:
-- function_name: 'get_production_costs_aggregated'
-- consistency_check: 'OK'

-- ============================================================
-- 8. TESTE: View v_production_costs_detail
-- ============================================================

SELECT
  COUNT(*) as total_records,
  SUM(total_cost) as total_cost,
  COUNT(DISTINCT product_id) as unique_products
FROM v_production_costs_detail
WHERE production_date BETWEEN '2026-02-01' AND '2026-02-02';

-- Resultado esperado:
-- total_cost deve coincidir com TESTE 1 e 2

-- ============================================================
-- 9. TESTE: View v_production_summary_daily
-- ============================================================

SELECT * FROM v_production_summary_daily
WHERE production_date BETWEEN '2026-02-01' AND '2026-02-02';

-- Resultado esperado:
-- total_cost por dia deve ser consistente

-- ============================================================
-- 10. TESTE: Auditoria e Logs
-- ============================================================

SELECT * FROM cost_calculation_audit
WHERE DATE(calculation_date) >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY calculation_date DESC
LIMIT 10;

-- Resultado esperado:
-- Registros de migrações aplicadas
-- status: 'success' ou 'migration_applied'

-- ============================================================
-- 11. TESTE CRÍTICO: Comparação Cruzada
-- ============================================================

-- Este é o teste mais importante: todos devem retornar o mesmo total_cost

WITH test_1 AS (
  SELECT
    'get_production_costs_safe' as source,
    SUM(total_cost) as total_cost
  FROM get_production_costs_safe('2026-02-01', '2026-02-02', true)
),
test_2 AS (
  SELECT
    'get_production_costs_aggregated' as source,
    total_cost as total_cost
  FROM get_production_costs_aggregated('2026-02-01', '2026-02-02', true)
),
test_3 AS (
  SELECT
    'relatorio_producao_completo' as source,
    total_material_cost as total_cost
  FROM relatorio_producao_completo('2026-02-01', '2026-02-02')
),
test_4 AS (
  SELECT
    'v_production_costs_detail' as source,
    SUM(total_cost) as total_cost
  FROM v_production_costs_detail
  WHERE production_date BETWEEN '2026-02-01' AND '2026-02-02'
)
SELECT * FROM test_1
UNION ALL SELECT * FROM test_2
UNION ALL SELECT * FROM test_3
UNION ALL SELECT * FROM test_4
ORDER BY source;

-- Resultado esperado: TODOS retornam o mesmo valor!
-- Se valores diferem: FALHA na solução

-- ============================================================
-- 12. TESTE: Ausência de Multiplicação
-- ============================================================

-- Se houver 5 materiais em uma produção com custo R$ 758,26
-- E tivermos 3 produções
-- Esperamos: 3 × 758,26 = 2.274,78 (não 3 × 758,26 × 5 = 11.373,90)

SELECT
  production_id,
  COUNT(*) as item_count,
  SUM(total_cost) as sum_total_cost
FROM v_production_costs_detail
WHERE production_date BETWEEN '2026-02-01' AND '2026-02-02'
GROUP BY production_id
HAVING COUNT(*) > 1;

-- Resultado esperado:
-- Cada production_id deve ter apenas 1 linha (sem duplicação)
-- Se houver múltiplas linhas: há duplicação!

-- ============================================================
-- 13. TESTE: Performance
-- ============================================================

-- Medir tempo de execução (esperado: < 500ms)
EXPLAIN ANALYZE
SELECT * FROM get_production_costs_aggregated('2026-02-01', '2026-02-02', true);

-- Resultado esperado:
-- Planning time: < 5ms
-- Execution time: < 500ms

-- ============================================================
-- 14. TESTE: Relatório de Validação
-- ============================================================

SELECT * FROM generate_cost_validation_report('2026-02-01', '2026-02-02');

-- Resultado esperado:
-- validation_summary: 'All functions using centralized cost calculation'
-- total_cost: valor positivo (se houver produções)

-- ============================================================
-- 15. TESTE: Status do Sistema
-- ============================================================

SELECT * FROM v_cost_system_status;

-- Resultado esperado:
-- successful_validations > 0
-- last_validation_date: recente

-- ============================================================
-- RESUMO DE VALIDAÇÃO
-- ============================================================

/*
  Se todos os testes passarem:
  ✅ TESTE 1-2: Mesma total_cost
  ✅ TESTE 3-4: Mesmo total_cost
  ✅ TESTE 5: Sem anomalias
  ✅ TESTE 6: validation_passed = true
  ✅ TESTE 7: consistency_check = 'OK'
  ✅ TESTE 11: TODOS retornam mesmo valor
  ✅ TESTE 12: Sem duplicação (1 linha por produção)
  ✅ TESTE 13: Performance < 500ms
  ✅ TESTE 14: validation_summary = OK
  ✅ TESTE 15: Sistema em status correto

  → SOLUÇÃO VALIDADA ✅

  Se algum teste falhar:
  ❌ Verificar logs em cost_calculation_audit
  ❌ Executar validate_cost_consistency()
  ❌ Reexaminar a migration

  AÇÕES RECOMENDADAS:
  1. Se inconsistência: Verificar qual função retorna valor diferente
  2. Se duplicação: Procurar por LEFT JOINs desnecessários
  3. Se performance: Adicionar índices faltantes
  4. Se logs: Verificar cost_calculation_audit para mensagens de erro
*/
