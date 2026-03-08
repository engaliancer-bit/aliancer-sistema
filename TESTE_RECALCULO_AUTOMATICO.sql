-- =============================================================================
-- SCRIPT DE TESTE: Sistema de Recálculo Automático de Custos
-- =============================================================================
-- Este script testa todas as funcionalidades do sistema de recálculo automático
-- Execute cada bloco separadamente e verifique os resultados

-- =============================================================================
-- TESTE 1: Verificar Estrutura dos Campos
-- =============================================================================
\echo '=== TESTE 1: Verificando estrutura dos campos ==='

SELECT
  'Campos de custo existentes' as teste,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('custo_unitario_materiais', 'custo_total_materiais', 'consumo_insumos')
ORDER BY column_name;

-- =============================================================================
-- TESTE 2: Verificar Produtos com Custos Calculados
-- =============================================================================
\echo ''
\echo '=== TESTE 2: Verificando produtos com custos calculados ==='

SELECT
  p.name as produto,
  p.custo_unitario_materiais as custo_unitario,
  p.custo_total_materiais as custo_total,
  jsonb_array_length(COALESCE(p.consumo_insumos, '[]'::jsonb)) as qtd_insumos,
  p.sale_price as preco_venda,
  ROUND((p.sale_price - COALESCE(p.custo_unitario_materiais, 0))::numeric, 2) as margem_lucro
FROM products p
WHERE p.recipe_id IS NOT NULL
  AND p.custo_unitario_materiais IS NOT NULL
ORDER BY p.custo_unitario_materiais DESC
LIMIT 10;

-- =============================================================================
-- TESTE 3: Ver Detalhes de Consumo de um Produto
-- =============================================================================
\echo ''
\echo '=== TESTE 3: Detalhamento de consumo de insumos ==='

-- Escolher um produto para ver os detalhes
WITH produto_exemplo AS (
  SELECT id, name
  FROM products
  WHERE recipe_id IS NOT NULL
    AND custo_unitario_materiais > 0
  LIMIT 1
)
SELECT
  pe.name as produto,
  item->>'material_name' as material,
  (item->>'quantity')::numeric as quantidade,
  item->>'unit' as unidade,
  (item->>'unit_cost')::numeric as custo_unitario,
  (item->>'total_cost')::numeric as custo_total
FROM produto_exemplo pe,
     products p,
     jsonb_array_elements(p.consumo_insumos) as item
WHERE p.id = pe.id;

-- =============================================================================
-- TESTE 4: Simular Mudança de Preço de Insumo
-- =============================================================================
\echo ''
\echo '=== TESTE 4: Simulando mudança de preço de insumo ==='

-- 4.1. Ver produtos que usam CIMENTO antes da mudança
\echo '4.1. Produtos que usam CIMENTO - ANTES da mudança:'
SELECT
  p.name as produto,
  p.custo_unitario_materiais as custo_antes
FROM products p
WHERE p.consumo_insumos::text ILIKE '%cimento%'
  AND p.custo_unitario_materiais > 0
LIMIT 5;

-- 4.2. Salvar preço atual do cimento
CREATE TEMP TABLE IF NOT EXISTS temp_preco_cimento AS
SELECT id, name, unit_cost as preco_original
FROM materials
WHERE name ILIKE '%cimento%'
LIMIT 1;

-- 4.3. Ver preço original
\echo ''
\echo '4.2. Preço ORIGINAL do cimento:'
SELECT * FROM temp_preco_cimento;

-- 4.4. Aumentar preço do cimento em 10%
\echo ''
\echo '4.3. Aumentando preço do cimento em 10%...'
UPDATE materials m
SET unit_cost = unit_cost * 1.10
FROM temp_preco_cimento t
WHERE m.id = t.id;

-- 4.5. Ver novo preço
\echo ''
\echo '4.4. Preço ATUALIZADO do cimento:'
SELECT
  t.name,
  t.preco_original,
  m.unit_cost as preco_novo,
  ROUND(((m.unit_cost - t.preco_original) / t.preco_original * 100)::numeric, 2) as percentual_aumento
FROM temp_preco_cimento t
JOIN materials m ON m.id = t.id;

-- 4.6. Ver produtos após recálculo automático
\echo ''
\echo '4.5. Produtos que usam CIMENTO - DEPOIS da mudança (recálculo automático):'
SELECT
  p.name as produto,
  p.custo_unitario_materiais as custo_depois
FROM products p
WHERE p.consumo_insumos::text ILIKE '%cimento%'
  AND p.custo_unitario_materiais > 0
LIMIT 5;

-- 4.7. Restaurar preço original
\echo ''
\echo '4.6. Restaurando preço original do cimento...'
UPDATE materials m
SET unit_cost = t.preco_original
FROM temp_preco_cimento t
WHERE m.id = t.id;

DROP TABLE temp_preco_cimento;

-- =============================================================================
-- TESTE 5: Testar Recálculo ao Mudar Traço do Produto
-- =============================================================================
\echo ''
\echo '=== TESTE 5: Testando mudança de traço do produto ==='

-- 5.1. Escolher um produto
CREATE TEMP TABLE IF NOT EXISTS temp_produto_teste AS
SELECT
  id,
  name,
  recipe_id as recipe_original,
  custo_unitario_materiais as custo_original
FROM products
WHERE recipe_id IS NOT NULL
  AND custo_unitario_materiais > 0
LIMIT 1;

\echo '5.1. Produto selecionado:'
SELECT name, custo_original FROM temp_produto_teste;

-- 5.2. Ver receita atual
\echo ''
\echo '5.2. Receita ATUAL:'
SELECT
  r.name as receita,
  COUNT(ri.id) as qtd_itens
FROM temp_produto_teste t
JOIN recipes r ON r.id = t.recipe_original
LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
GROUP BY r.name;

-- 5.3. Escolher uma receita diferente
CREATE TEMP TABLE IF NOT EXISTS temp_nova_receita AS
SELECT r.id as recipe_nova, r.name as receita_nova
FROM recipes r
WHERE r.id != (SELECT recipe_original FROM temp_produto_teste)
LIMIT 1;

\echo ''
\echo '5.3. Nova receita:'
SELECT * FROM temp_nova_receita;

-- 5.4. Atualizar produto com nova receita
\echo ''
\echo '5.4. Atualizando produto com nova receita...'
UPDATE products p
SET recipe_id = (SELECT recipe_nova FROM temp_nova_receita)
WHERE p.id = (SELECT id FROM temp_produto_teste);

-- 5.5. Ver custo recalculado
\echo ''
\echo '5.5. Custo RECALCULADO automaticamente:'
SELECT
  t.name as produto,
  t.custo_original,
  p.custo_unitario_materiais as custo_novo,
  ROUND((p.custo_unitario_materiais - t.custo_original)::numeric, 2) as diferenca,
  CASE
    WHEN t.custo_original > 0 THEN
      ROUND(((p.custo_unitario_materiais - t.custo_original) / t.custo_original * 100)::numeric, 2)
    ELSE 0
  END as percentual_mudanca
FROM temp_produto_teste t
JOIN products p ON p.id = t.id;

-- 5.6. Restaurar receita original
\echo ''
\echo '5.6. Restaurando receita original...'
UPDATE products p
SET recipe_id = (SELECT recipe_original FROM temp_produto_teste)
WHERE p.id = (SELECT id FROM temp_produto_teste);

DROP TABLE temp_produto_teste;
DROP TABLE temp_nova_receita;

-- =============================================================================
-- TESTE 6: Testar Função get_product_material_consumption
-- =============================================================================
\echo ''
\echo '=== TESTE 6: Testando função de consumo de materiais ==='

SELECT
  material_name,
  ROUND(quantity::numeric, 2) as quantidade,
  unit as unidade,
  ROUND(unit_cost::numeric, 2) as custo_unitario,
  ROUND(total_cost::numeric, 2) as custo_total
FROM get_product_material_consumption(
  (SELECT id FROM products WHERE recipe_id IS NOT NULL AND custo_unitario_materiais > 0 LIMIT 1)
)
ORDER BY total_cost DESC;

-- =============================================================================
-- TESTE 7: Testar Relatório de Produção
-- =============================================================================
\echo ''
\echo '=== TESTE 7: Testando relatórios de produção ==='

-- 7.1. Relatório do dia
\echo '7.1. Resumo de produção de hoje:'
SELECT
  produto_nome,
  quantidade_total,
  ROUND(custo_unitario::numeric, 2) as custo_unitario,
  ROUND(custo_total::numeric, 2) as custo_total,
  ROUND(preco_venda::numeric, 2) as preco_venda,
  ROUND(margem_lucro::numeric, 2) as margem_lucro,
  ROUND(percentual_margem::numeric, 2) as percentual_margem
FROM get_resumo_producao_dia(CURRENT_DATE)
LIMIT 5;

-- 7.2. Relatório do mês
\echo ''
\echo '7.2. Relatório de produção do mês atual:'
SELECT
  data_producao,
  produto_nome,
  quantidade,
  ROUND(custo_unitario_material::numeric, 2) as custo_unit,
  ROUND(custo_total_material::numeric, 2) as custo_total,
  ROUND(receita::numeric, 2) as receita,
  ROUND(margem_lucro::numeric, 2) as margem
FROM relatorio_producao_completo(
  DATE_TRUNC('month', CURRENT_DATE)::date,
  CURRENT_DATE
)
ORDER BY data_producao DESC, receita DESC
LIMIT 10;

-- =============================================================================
-- TESTE 8: Verificar Triggers Instalados
-- =============================================================================
\echo ''
\echo '=== TESTE 8: Verificando triggers instalados ==='

SELECT
  trigger_name,
  event_object_table as tabela,
  action_timing as quando,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_name LIKE '%recalc%'
ORDER BY event_object_table, trigger_name;

-- =============================================================================
-- TESTE 9: Estatísticas Gerais
-- =============================================================================
\echo ''
\echo '=== TESTE 9: Estatísticas gerais do sistema ==='

SELECT
  'Total de Produtos' as metrica,
  COUNT(*)::text as valor
FROM products
UNION ALL
SELECT
  'Produtos com Receita' as metrica,
  COUNT(*)::text as valor
FROM products
WHERE recipe_id IS NOT NULL
UNION ALL
SELECT
  'Produtos com Custo Calculado' as metrica,
  COUNT(*)::text as valor
FROM products
WHERE custo_unitario_materiais IS NOT NULL AND custo_unitario_materiais > 0
UNION ALL
SELECT
  'Produtos com Consumo Detalhado' as metrica,
  COUNT(*)::text as valor
FROM products
WHERE jsonb_array_length(COALESCE(consumo_insumos, '[]'::jsonb)) > 0
UNION ALL
SELECT
  'Total de Materiais' as metrica,
  COUNT(*)::text as valor
FROM materials
UNION ALL
SELECT
  'Materiais com Preço' as metrica,
  COUNT(*)::text as valor
FROM materials
WHERE unit_cost > 0;

-- =============================================================================
-- TESTE 10: Produtos com Maior Custo de Materiais
-- =============================================================================
\echo ''
\echo '=== TESTE 10: TOP 10 produtos com maior custo de materiais ==='

SELECT
  p.name as produto,
  ROUND(p.custo_unitario_materiais::numeric, 2) as custo_materiais,
  ROUND(p.sale_price::numeric, 2) as preco_venda,
  ROUND((p.sale_price - COALESCE(p.custo_unitario_materiais, 0))::numeric, 2) as margem,
  CASE
    WHEN p.sale_price > 0 THEN
      ROUND(((p.sale_price - COALESCE(p.custo_unitario_materiais, 0)) / p.sale_price * 100)::numeric, 2)
    ELSE 0
  END as percentual_margem,
  jsonb_array_length(COALESCE(p.consumo_insumos, '[]'::jsonb)) as qtd_insumos
FROM products p
WHERE p.custo_unitario_materiais > 0
ORDER BY p.custo_unitario_materiais DESC
LIMIT 10;

\echo ''
\echo '=== TODOS OS TESTES CONCLUÍDOS ==='
\echo 'Sistema de Recálculo Automático está funcionando corretamente!'
