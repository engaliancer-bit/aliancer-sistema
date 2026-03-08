-- ===================================================================
-- TESTE - BOTÃO "GERAR RESUMO DO DIA"
-- ===================================================================

-- 1. VERIFICAR SE RPCs FORAM CRIADAS
SELECT
  proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN ('get_resumo_producao_dia', 'get_resumo_produtos_dia')
ORDER BY proname;

-- Resultado esperado: 2 linhas (ambas as funções)

-- ===================================================================

-- 2. TESTAR RPC get_resumo_producao_dia PARA HOJE
SELECT * FROM get_resumo_producao_dia(CURRENT_DATE);

-- Se retornar dados: ✓ Funcionando
-- Se retornar vazio: Não há produções hoje ou custos não calculados

-- ===================================================================

-- 3. TESTAR RPC get_resumo_produtos_dia PARA HOJE
SELECT * FROM get_resumo_produtos_dia(CURRENT_DATE);

-- Deve retornar produtos produzidos hoje agregados

-- ===================================================================

-- 4. VERIFICAR PRODUCTION_ITEMS (FONTE PRINCIPAL)
SELECT
  'Total de production_items' as descricao,
  COUNT(*) as total
FROM production_items;

-- Se > 0: Produções novas têm items
-- Se = 0: Nenhuma produção nova com items ainda

-- ===================================================================

-- 5. VER ÚLTIMOS PRODUCTION_ITEMS
SELECT
  pi.material_name,
  pi.quantity,
  pi.unit,
  pi.total_cost,
  p.production_date,
  prod.name as product_name
FROM production_items pi
JOIN production p ON p.id = pi.production_id
LEFT JOIN products prod ON prod.id = p.product_id
ORDER BY p.production_date DESC, pi.created_at DESC
LIMIT 20;

-- Mostra últimos consumos de materiais registrados

-- ===================================================================

-- 6. VERIFICAR CUSTOS_NO_MOMENTO (FONTE FALLBACK)
SELECT
  p.production_date,
  p.product_id,
  prod.name as product_name,
  CASE
    WHEN p.custos_no_momento IS NULL THEN 'SEM custos_no_momento'
    WHEN jsonb_typeof(p.custos_no_momento) = 'null' THEN 'custos_no_momento = null'
    WHEN p.custos_no_momento->'materials' = '{}'::jsonb THEN 'VAZIO (materials = {})'
    WHEN jsonb_typeof(p.custos_no_momento->'materials') = 'object' THEN 'COM DADOS'
    ELSE 'OUTRO: ' || jsonb_typeof(p.custos_no_momento)
  END as status_custos,
  p.custos_no_momento->>'total_cost' as total_cost
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.production_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY p.production_date DESC
LIMIT 20;

-- Mostra status dos custos das produções recentes

-- ===================================================================

-- 7. COMPARAR PRODUCTION_ITEMS VS CUSTOS_NO_MOMENTO
SELECT
  p.production_date,
  COUNT(DISTINCT p.id) as total_producoes,
  COUNT(DISTINCT pi.id) as total_items,
  COUNT(DISTINCT CASE
    WHEN p.custos_no_momento->'materials' != '{}'::jsonb THEN p.id
  END) as producoes_com_custos_materials
FROM production p
LEFT JOIN production_items pi ON pi.production_id = p.id
WHERE p.production_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.production_date
ORDER BY p.production_date DESC;

-- Mostra estatísticas por data

-- ===================================================================

-- 8. VER EXEMPLO DE custos_no_momento BEM PREENCHIDO
SELECT
  p.id,
  p.production_date,
  prod.name as product_name,
  p.quantity,
  p.custos_no_momento
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE jsonb_typeof(p.custos_no_momento->'materials') = 'object'
AND p.custos_no_momento->'materials' != '{}'::jsonb
ORDER BY p.production_date DESC
LIMIT 1;

-- Mostra exemplo de produção com custos bem calculados

-- ===================================================================

-- 9. TESTAR get_resumo_producao_dia PARA DATA ESPECÍFICA
-- (Trocar '2026-02-04' pela data desejada)
SELECT
  material_name,
  total_quantity,
  unit,
  total_cost,
  usage_count,
  source
FROM get_resumo_producao_dia('2026-02-04')
ORDER BY total_cost DESC;

-- source = 'production_items': Buscou da fonte principal ✓
-- source = 'custos_no_momento': Usou fallback
-- vazio: Sem dados para esta data

-- ===================================================================

-- 10. TESTAR get_resumo_produtos_dia PARA DATA ESPECÍFICA
SELECT
  product_name,
  product_code,
  total_quantity,
  unit,
  production_count
FROM get_resumo_produtos_dia('2026-02-04')
ORDER BY product_name;

-- Mostra produtos produzidos na data

-- ===================================================================

-- 11. VERIFICAR TRIGGER sync_production_items
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_sync_production_items';

-- Deve retornar 1 linha
-- action_timing: AFTER
-- event_manipulation: INSERT ou UPDATE

-- ===================================================================

-- 12. VERIFICAR FUNÇÃO extract_production_items_from_custos
SELECT
  proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname = 'extract_production_items_from_custos';

-- Deve retornar 1 linha (função existe)

-- ===================================================================

-- 13. DIAGNÓSTICO COMPLETO PARA UMA DATA
WITH data_target AS (
  SELECT '2026-02-04'::date as data_teste
),
stats AS (
  SELECT
    (SELECT COUNT(*) FROM production WHERE production_date = (SELECT data_teste FROM data_target)) as total_producoes,
    (SELECT COUNT(*) FROM production_items pi
     JOIN production p ON p.id = pi.production_id
     WHERE p.production_date = (SELECT data_teste FROM data_target)) as total_items,
    (SELECT COUNT(*) FROM production
     WHERE production_date = (SELECT data_teste FROM data_target)
     AND custos_no_momento->'materials' != '{}'::jsonb) as producoes_com_custos
)
SELECT
  (SELECT data_teste FROM data_target) as data_analisada,
  total_producoes,
  total_items,
  producoes_com_custos,
  CASE
    WHEN total_items > 0 THEN 'RPC usará production_items ✓'
    WHEN producoes_com_custos > 0 THEN 'RPC usará custos_no_momento (fallback)'
    WHEN total_producoes > 0 THEN 'Produções existem mas sem custos calculados ⚠'
    ELSE 'Nenhuma produção nesta data'
  END as fonte_dados,
  CASE
    WHEN total_items > 0 OR producoes_com_custos > 0 THEN 'Resumo disponível ✓'
    ELSE 'Resumo vazio (sem dados)'
  END as resultado_esperado
FROM stats;

-- Diagnóstico completo em uma query

-- ===================================================================

-- 14. TESTAR CENÁRIO: PRODUÇÃO SEM RECEITA
SELECT
  p.id,
  p.production_date,
  prod.name as product_name,
  prod.recipe_id,
  CASE WHEN prod.recipe_id IS NULL THEN 'SEM RECEITA ⚠' ELSE 'COM RECEITA ✓' END as status_receita,
  p.custos_no_momento->>'total_cost' as custo_total,
  (SELECT COUNT(*) FROM production_items WHERE production_id = p.id) as qtd_items
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.production_date >= CURRENT_DATE - INTERVAL '7 days'
AND prod.recipe_id IS NULL
ORDER BY p.production_date DESC
LIMIT 10;

-- Produções de produtos sem receita não terão custos de materiais

-- ===================================================================

-- 15. SIMULAÇÃO: EXTRAIR ITEMS DE CUSTOS_NO_MOMENTO
-- (NÃO EXECUTAR automaticamente - apenas exemplo)

/*
-- Encontrar produções com custos mas sem items
SELECT
  id,
  production_date,
  custos_no_momento->'materials' as materials
FROM production
WHERE custos_no_momento IS NOT NULL
AND custos_no_momento->'materials' != '{}'::jsonb
AND NOT EXISTS (
  SELECT 1 FROM production_items WHERE production_id = production.id
)
LIMIT 5;

-- Extrair items para essas produções (executar um por vez)
SELECT extract_production_items_from_custos(
  '[production_id aqui]',
  (SELECT custos_no_momento FROM production WHERE id = '[production_id aqui]')
);

-- Verificar se items foram criados
SELECT * FROM production_items WHERE production_id = '[production_id aqui]';
*/

-- ===================================================================
-- FIM DOS TESTES
-- ===================================================================

/*
RESUMO DOS TESTES:

✅ Query 1: Verifica se RPCs existem
✅ Query 2-3: Testa RPCs com data atual
✅ Query 4-5: Verifica production_items
✅ Query 6-8: Verifica custos_no_momento
✅ Query 9-10: Testa RPCs com data específica
✅ Query 11-12: Verifica trigger e funções auxiliares
✅ Query 13: Diagnóstico completo
✅ Query 14: Identifica produtos sem receita
✅ Query 15: Migração manual (opcional)

PARA TESTAR NO FRONTEND:
1. Abrir DevTools (F12) → Console
2. Ir em "Produção Diária"
3. Selecionar uma data
4. Clicar "Gerar Resumo do Dia"
5. Observar logs no console
6. Verificar se tabela aparece ou mensagem de erro

MENSAGENS ESPERADAS NO CONSOLE:
- "Gerando resumo de produção do dia: [data]"
- "Consumo encontrado: X materiais (fonte: production_items)"
- "Buscando resumo de produtos..."
- "✓ Relatório gerado com sucesso!"

OU:
- "Nenhum consumo de insumo encontrado para a data: [data]"
- Alert: "Sem produções registradas para [data]"

ERROS COMUNS:
- "Failed to run sql query": RPC não existe ou sintaxe errada
- "permission denied": RLS bloqueando acesso
- Array vazio []: Sem dados para a data selecionada
*/
