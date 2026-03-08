-- ============================================================
-- QUERIES DE VERIFICAÇÃO: ORDENS AUTOMÁTICAS
-- ============================================================

-- ============================================================
-- 1. VERIFICAR SE TRIGGER ESTÁ ATIVO
-- ============================================================

-- Ver se o trigger existe e está ativo
SELECT
  trigger_name,
  event_object_table as tabela,
  action_timing as momento,
  event_manipulation as evento,
  action_statement as funcao,
  'ATIVO' as status
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_create_production_orders';

-- Resultado esperado: 1 linha mostrando o trigger ativo
-- Se retornar 0 linhas: PROBLEMA! Trigger não existe

-- ============================================================
-- 2. VERIFICAR SE FUNÇÃO EXISTE
-- ============================================================

-- Ver se a função de criação automática existe
SELECT
  routine_name as nome_funcao,
  routine_type as tipo,
  'EXISTE' as status
FROM information_schema.routines
WHERE routine_name = 'auto_create_production_orders_on_quote_approval';

-- Resultado esperado: 1 linha
-- Se retornar 0 linhas: PROBLEMA! Função não existe

-- ============================================================
-- 3. TESTE RÁPIDO: VER ORÇAMENTOS APROVADOS HOJE
-- ============================================================

-- Ver orçamentos aprovados hoje
SELECT
  q.id,
  c.name as cliente,
  q.status,
  q.created_at,
  q.updated_at,
  COUNT(DISTINCT qi.id) as total_items,
  COUNT(DISTINCT po.id) as ordens_criadas
FROM quotes q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN quote_items qi ON qi.quote_id = q.id AND qi.item_type = 'product'
LEFT JOIN production_orders po ON po.quote_id = q.id
WHERE q.status = 'approved'
  AND DATE(q.updated_at) = CURRENT_DATE
GROUP BY q.id, c.name, q.status, q.created_at, q.updated_at
ORDER BY q.updated_at DESC;

-- Resultado esperado:
-- - Se você aprovou orçamento hoje: deve aparecer aqui
-- - Coluna "ordens_criadas" deve ser > 0

-- ============================================================
-- 4. VER ORDENS CRIADAS AUTOMATICAMENTE (HOJE)
-- ============================================================

-- Ver todas as ordens criadas automaticamente hoje
SELECT
  po.order_number as numero_ordem,
  p.name as produto,
  p.code as codigo,
  po.quantity as quantidade,
  po.priority as prioridade,
  po.status as status_ordem,
  c.name as cliente,
  q.id as orcamento_id,
  po.notes as observacoes,
  po.created_at
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN quotes q ON q.id = po.quote_id
LEFT JOIN customers c ON c.id = q.customer_id
WHERE DATE(po.created_at) = CURRENT_DATE
  AND po.quote_id IS NOT NULL
ORDER BY po.created_at DESC;

-- Resultado esperado:
-- - Ordens criadas hoje via trigger
-- - Coluna "observacoes" contém: "Ordem automática - Orçamento aprovado"
-- - Coluna "orcamento_id" não é NULL

-- ============================================================
-- 5. TESTE DE INTEGRIDADE: ORÇAMENTOS SEM ORDENS
-- ============================================================

-- Ver orçamentos aprovados que NÃO têm ordens
-- (Pode indicar problema no trigger ou produtos com estoque)
SELECT
  q.id as orcamento_id,
  c.name as cliente,
  q.created_at as criado_em,
  q.updated_at as atualizado_em,
  COUNT(DISTINCT qi.id) as produtos_no_orcamento,
  COUNT(DISTINCT po.id) as ordens_criadas,
  CASE
    WHEN COUNT(DISTINCT po.id) = 0 THEN '⚠️ SEM ORDENS'
    ELSE '✅ OK'
  END as verificacao
FROM quotes q
JOIN customers c ON c.id = q.customer_id
JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN production_orders po ON po.quote_id = q.id
WHERE q.status = 'approved'
  AND qi.item_type = 'product'
  AND DATE(q.updated_at) >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY q.id, c.name, q.created_at, q.updated_at
ORDER BY q.updated_at DESC;

-- Resultado esperado:
-- - Orçamentos com coluna "verificacao" = "✅ OK"
-- - Se aparecer "⚠️ SEM ORDENS":
--   → Pode ser normal (produtos com estoque completo)
--   → Ou problema no trigger (verificar logs)

-- ============================================================
-- 6. VERIFICAR ESTOQUE vs ORDENS
-- ============================================================

-- Ver produtos de orçamentos aprovados com estoque e ordens
SELECT
  p.name as produto,
  p.code as codigo,
  qi.quantity as qtd_orcamento,
  COALESCE(i.quantity, 0) as estoque_atual,
  qi.quantity - COALESCE(i.quantity, 0) as qtd_faltante,
  po.order_number as ordem_criada,
  po.quantity as qtd_ordem,
  CASE
    WHEN COALESCE(i.quantity, 0) >= qi.quantity THEN '✅ Estoque OK'
    WHEN po.id IS NOT NULL THEN '✅ Ordem Criada'
    ELSE '❌ PROBLEMA!'
  END as status
FROM quote_items qi
JOIN quotes q ON q.id = qi.quote_id
JOIN products p ON p.id = qi.product_id
LEFT JOIN inventory i ON i.product_id = qi.product_id
LEFT JOIN production_orders po ON po.quote_id = q.id AND po.product_id = qi.product_id
WHERE q.status = 'approved'
  AND qi.item_type = 'product'
  AND DATE(q.updated_at) >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY q.updated_at DESC, p.name;

-- Resultado esperado:
-- - Status "✅ Estoque OK": Produto tem estoque suficiente
-- - Status "✅ Ordem Criada": Ordem foi criada para faltante
-- - Status "❌ PROBLEMA!": Falta estoque e ordem não foi criada!

-- ============================================================
-- 7. DETALHES DE UMA ORDEM ESPECÍFICA
-- ============================================================

-- Ver detalhes completos de uma ordem
-- (Substitua 'OP-XXX' pelo número da ordem)
SELECT
  po.order_number,
  po.status as status_ordem,
  p.name as produto,
  p.code as codigo_produto,
  po.quantity as quantidade_ordem,
  po.priority as prioridade,
  po.deadline as prazo,
  po.notes as observacoes,
  po.created_at as criada_em,
  q.id as orcamento_id,
  c.name as cliente,
  q.status as status_orcamento
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN quotes q ON q.id = po.quote_id
LEFT JOIN customers c ON c.id = q.customer_id
WHERE po.order_number = 'OP-XXX'; -- <-- SUBSTITUA AQUI

-- Resultado: Detalhes completos da ordem

-- ============================================================
-- 8. HISTÓRICO: ORDENS DOS ÚLTIMOS 7 DIAS
-- ============================================================

-- Ver todas as ordens criadas nos últimos 7 dias
SELECT
  DATE(po.created_at) as data,
  COUNT(*) as total_ordens,
  COUNT(CASE WHEN po.quote_id IS NOT NULL THEN 1 END) as ordens_automaticas,
  COUNT(CASE WHEN po.quote_id IS NULL THEN 1 END) as ordens_manuais,
  SUM(po.quantity) as quantidade_total
FROM production_orders po
WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(po.created_at)
ORDER BY data DESC;

-- Resultado: Resumo diário de ordens criadas

-- ============================================================
-- 9. TESTE FINAL: CRIAR ORÇAMENTO E VERIFICAR
-- ============================================================

/*
PASSO A PASSO PARA TESTE COMPLETO:

1. Copie este ID (vamos usar para teste):
   -- Seu ID de teste será gerado ao criar orçamento

2. Crie um orçamento de teste:
   - Vá em: Vendas → Orçamentos → Novo
   - Adicione cliente
   - Adicione 1 produto SEM estoque
   - Status: APROVADO
   - Salve

3. Copie o ID do orçamento criado

4. Execute esta query (substitua o UUID):
*/

SELECT
  'ORÇAMENTO' as tipo,
  q.id,
  q.status,
  c.name as nome,
  NULL::text as quantidade
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE q.id = 'UUID_DO_ORCAMENTO' -- <-- COLE O ID AQUI

UNION ALL

SELECT
  'PRODUTO' as tipo,
  qi.id,
  qi.item_type as status,
  p.name as nome,
  qi.quantity::text as quantidade
FROM quote_items qi
JOIN products p ON p.id = qi.product_id
WHERE qi.quote_id = 'UUID_DO_ORCAMENTO' -- <-- COLE O ID AQUI

UNION ALL

SELECT
  'ORDEM' as tipo,
  po.id,
  po.status,
  po.order_number as nome,
  po.quantity::text as quantidade
FROM production_orders po
WHERE po.quote_id = 'UUID_DO_ORCAMENTO'; -- <-- COLE O ID AQUI

-- Resultado esperado:
-- Linha 1: ORÇAMENTO (status: approved)
-- Linha 2: PRODUTO (item do orçamento)
-- Linha 3: ORDEM (criada automaticamente)

-- Se linha 3 NÃO aparecer: PROBLEMA!

-- ============================================================
-- 10. DIAGNÓSTICO COMPLETO
-- ============================================================

-- Execute tudo junto para diagnóstico completo
WITH trigger_check AS (
  SELECT COUNT(*) as trigger_exists
  FROM information_schema.triggers
  WHERE trigger_name = 'trigger_auto_create_production_orders'
),
function_check AS (
  SELECT COUNT(*) as function_exists
  FROM information_schema.routines
  WHERE routine_name = 'auto_create_production_orders_on_quote_approval'
),
recent_quotes AS (
  SELECT COUNT(*) as approved_today
  FROM quotes
  WHERE status = 'approved'
    AND DATE(updated_at) = CURRENT_DATE
),
recent_orders AS (
  SELECT COUNT(*) as orders_created_today
  FROM production_orders
  WHERE DATE(created_at) = CURRENT_DATE
    AND quote_id IS NOT NULL
)
SELECT
  'DIAGNÓSTICO DO SISTEMA' as titulo,
  tc.trigger_exists as trigger_ativo,
  fc.function_exists as funcao_existe,
  rq.approved_today as orcamentos_aprovados_hoje,
  ro.orders_created_today as ordens_automaticas_hoje,
  CASE
    WHEN tc.trigger_exists = 0 THEN '❌ ERRO: Trigger não existe'
    WHEN fc.function_exists = 0 THEN '❌ ERRO: Função não existe'
    WHEN rq.approved_today > 0 AND ro.orders_created_today = 0 THEN '⚠️ AVISO: Orçamentos aprovados mas sem ordens'
    WHEN rq.approved_today = 0 THEN 'ℹ️ OK: Nenhum orçamento aprovado hoje'
    ELSE '✅ OK: Sistema funcionando'
  END as status_sistema
FROM trigger_check tc, function_check fc, recent_quotes rq, recent_orders ro;

-- Resultado esperado: status_sistema = "✅ OK: Sistema funcionando"

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- ============================================================

/*
✅ TUDO OK:
   - Trigger existe (1)
   - Função existe (1)
   - Ordens criadas para orçamentos aprovados

⚠️ ATENÇÃO:
   - Trigger ou função não existe: Execute migração novamente
   - Orçamentos sem ordens: Pode ser estoque suficiente ou problema

❌ PROBLEMA:
   - Trigger = 0: Sistema não está ativo
   - Função = 0: Código não foi instalado
   - Ordens = 0 com orçamentos > 0: Trigger não está executando

SOLUÇÃO PARA PROBLEMAS:
1. Verifique logs: Supabase → Logs → Functions
2. Execute migração novamente
3. Teste com orçamento novo
4. Veja erros nos logs
*/

-- ============================================================
-- FIM DAS QUERIES
-- ============================================================
