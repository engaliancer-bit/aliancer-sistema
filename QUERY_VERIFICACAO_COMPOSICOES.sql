-- ============================================================
-- QUERIES DE VERIFICAÇÃO: COMPOSIÇÕES NAS ORDENS AUTOMÁTICAS
-- ============================================================

-- ============================================================
-- 1. VER COMPOSIÇÃO E SEUS PRODUTOS
-- ============================================================

-- Ver todos os produtos de uma composição específica
-- (Substitua 'Nome_da_Composicao' pelo nome real)
SELECT
  c.name as composicao,
  ci.item_type as tipo_item,
  COALESCE(p.name, m.name, ci.item_name) as nome_item,
  COALESCE(p.code, m.code) as codigo,
  ci.quantity as qtd_por_unidade,
  ci.unit as unidade,
  CASE
    WHEN ci.item_type = 'product' THEN '✅ Gera ordem'
    WHEN ci.item_type = 'material' THEN '❌ Não gera ordem'
    ELSE 'ℹ️  Outro'
  END as gera_ordem
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
LEFT JOIN products p ON p.id = ci.product_id
LEFT JOIN materials m ON m.id = ci.material_id
WHERE c.name ILIKE '%Laje%' -- <-- Troque pelo nome da sua composição
ORDER BY ci.item_type, ci.item_name;

-- ============================================================
-- 2. ORÇAMENTOS COM COMPOSIÇÕES (ÚLTIMOS 7 DIAS)
-- ============================================================

-- Ver orçamentos que têm composições
SELECT
  q.id as orcamento_id,
  c.name as cliente,
  q.status,
  q.created_at,
  STRING_AGG(DISTINCT qi.item_name, ', ') as composicoes,
  COUNT(DISTINCT qi.id) as total_composicoes
FROM quotes q
JOIN customers c ON c.id = q.customer_id
JOIN quote_items qi ON qi.quote_id = q.id
WHERE qi.item_type = 'composition'
  AND q.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY q.id, c.name, q.status, q.created_at
ORDER BY q.created_at DESC;

-- ============================================================
-- 3. ORDENS CRIADAS DE COMPOSIÇÕES (HOJE)
-- ============================================================

-- Ver ordens que vieram de composições
SELECT
  po.order_number as ordem,
  p.name as produto,
  p.code as codigo,
  po.quantity as quantidade,
  po.priority as prioridade,
  po.status as status_ordem,
  po.notes as observacoes,
  po.created_at
FROM production_orders po
JOIN products p ON p.id = po.product_id
WHERE po.notes LIKE '%Composição%'
  AND DATE(po.created_at) = CURRENT_DATE
ORDER BY po.created_at DESC;

-- ============================================================
-- 4. RASTREAMENTO COMPLETO: COMPOSIÇÃO → ORDENS
-- ============================================================

-- Rastrear de uma composição até as ordens criadas
-- (Substitua 'UUID_DO_ORCAMENTO' pelo ID real)
WITH orcamento_info AS (
  SELECT
    q.id as orcamento_id,
    c.name as cliente,
    q.status as status_orcamento,
    q.created_at
  FROM quotes q
  JOIN customers c ON c.id = q.customer_id
  WHERE q.id = 'UUID_DO_ORCAMENTO' -- <-- COLE O ID AQUI
),
composicoes_orcamento AS (
  SELECT
    qi.id as quote_item_id,
    qi.item_name as composicao_nome,
    qi.quantity as qtd_composicao,
    comp.id as composition_id
  FROM quote_items qi
  LEFT JOIN compositions comp ON comp.id = qi.composition_id
  WHERE qi.quote_id = (SELECT orcamento_id FROM orcamento_info)
    AND qi.item_type = 'composition'
),
produtos_composicao AS (
  SELECT
    co.composicao_nome,
    co.qtd_composicao,
    ci.item_type,
    p.name as produto_nome,
    p.code as produto_codigo,
    ci.quantity as qtd_por_composicao,
    co.qtd_composicao * ci.quantity as qtd_total_necessaria,
    COALESCE(i.quantity, 0) as estoque_atual,
    (co.qtd_composicao * ci.quantity) - COALESCE(i.quantity, 0) as qtd_faltante
  FROM composicoes_orcamento co
  JOIN composition_items ci ON ci.composition_id = co.composition_id
  LEFT JOIN products p ON p.id = ci.product_id
  LEFT JOIN inventory i ON i.product_id = ci.product_id
  WHERE ci.item_type = 'product'
),
ordens_criadas AS (
  SELECT
    po.order_number,
    p.name as produto,
    po.quantity as qtd_ordem,
    po.status as status_ordem,
    po.created_at as ordem_criada_em
  FROM production_orders po
  JOIN products p ON p.id = po.product_id
  WHERE po.quote_id = (SELECT orcamento_id FROM orcamento_info)
)
SELECT
  '📋 ORÇAMENTO' as secao,
  (SELECT cliente FROM orcamento_info) as detalhe,
  NULL::text as valor1,
  NULL::text as valor2,
  NULL::text as valor3
UNION ALL
SELECT
  '📦 COMPOSIÇÃO: ' || composicao_nome,
  '(' || qtd_composicao || ' un.)',
  NULL,
  NULL,
  NULL
FROM composicoes_orcamento
UNION ALL
SELECT
  '   ├─ Produto',
  produto_nome || ' (' || produto_codigo || ')',
  'Por comp: ' || qtd_por_composicao::text,
  'Total: ' || qtd_total_necessaria::text,
  'Falta: ' || GREATEST(qtd_faltante, 0)::text
FROM produtos_composicao
UNION ALL
SELECT
  '✅ ORDENS CRIADAS',
  order_number || ' - ' || produto,
  'Qtd: ' || qtd_ordem::text,
  'Status: ' || status_ordem,
  ordem_criada_em::text
FROM ordens_criadas
ORDER BY secao, detalhe;

-- ============================================================
-- 5. CALCULAR QUANTIDADES: COMPOSIÇÃO × ITEM
-- ============================================================

-- Ver cálculo detalhado de quantidades
-- (Substitua pelo ID do orçamento)
SELECT
  qi.item_name as composicao,
  qi.quantity as qtd_no_orcamento,
  ci.item_name as produto_na_composicao,
  ci.quantity as qtd_por_composicao,
  qi.quantity * ci.quantity as total_necessario,
  COALESCE(i.quantity, 0) as estoque_disponivel,
  GREATEST((qi.quantity * ci.quantity) - COALESCE(i.quantity, 0), 0) as qtd_a_produzir,
  CASE
    WHEN COALESCE(i.quantity, 0) >= (qi.quantity * ci.quantity) THEN '✅ Estoque OK'
    ELSE '⚠️  Precisa produzir'
  END as status
FROM quote_items qi
JOIN composition_items ci ON ci.composition_id = qi.composition_id
LEFT JOIN products p ON p.id = ci.product_id
LEFT JOIN inventory i ON i.product_id = ci.product_id
WHERE qi.quote_id = 'UUID_DO_ORCAMENTO' -- <-- COLE O ID AQUI
  AND qi.item_type = 'composition'
  AND ci.item_type = 'product'
ORDER BY qi.item_name, ci.item_name;

-- ============================================================
-- 6. COMPOSIÇÕES SEM PRODUTOS (PROBLEMAS)
-- ============================================================

-- Ver composições que NÃO têm produtos cadastrados
-- (Essas composições não geram ordens!)
SELECT
  c.id,
  c.name as composicao,
  c.description,
  COUNT(ci.id) FILTER (WHERE ci.item_type = 'product') as total_produtos,
  COUNT(ci.id) FILTER (WHERE ci.item_type = 'material') as total_materiais,
  CASE
    WHEN COUNT(ci.id) FILTER (WHERE ci.item_type = 'product') = 0 THEN '⚠️  SEM PRODUTOS!'
    ELSE '✅ OK'
  END as status
FROM compositions c
LEFT JOIN composition_items ci ON ci.composition_id = c.id
GROUP BY c.id, c.name, c.description
HAVING COUNT(ci.id) FILTER (WHERE ci.item_type = 'product') = 0
ORDER BY c.name;

-- ============================================================
-- 7. VERIFICAR PROCESSAMENTO DE COMPOSIÇÃO ESPECÍFICA
-- ============================================================

-- Ver se uma composição foi processada corretamente
-- (Substitua pelo nome da composição)
WITH composicao_info AS (
  SELECT
    c.id,
    c.name,
    COUNT(ci.id) FILTER (WHERE ci.item_type = 'product') as produtos_cadastrados
  FROM compositions c
  LEFT JOIN composition_items ci ON ci.composition_id = c.id
  WHERE c.name ILIKE '%Laje%' -- <-- Nome da composição
  GROUP BY c.id, c.name
),
orçamentos_com_composicao AS (
  SELECT
    q.id as orcamento_id,
    q.status,
    qi.quantity as qtd_orcamento,
    q.created_at
  FROM quote_items qi
  JOIN quotes q ON q.id = qi.quote_id
  JOIN composicao_info ci ON ci.id = qi.composition_id
  WHERE qi.item_type = 'composition'
    AND q.status = 'approved'
    AND q.created_at >= CURRENT_DATE - INTERVAL '7 days'
),
ordens_da_composicao AS (
  SELECT
    po.quote_id,
    COUNT(*) as total_ordens
  FROM production_orders po
  WHERE po.quote_id IN (SELECT orcamento_id FROM orçamentos_com_composicao)
    AND po.notes LIKE '%Composição%'
  GROUP BY po.quote_id
)
SELECT
  ci.name as composicao,
  ci.produtos_cadastrados,
  o.orcamento_id,
  o.qtd_orcamento,
  COALESCE(oc.total_ordens, 0) as ordens_criadas,
  o.created_at,
  CASE
    WHEN ci.produtos_cadastrados = 0 THEN '⚠️  Composição sem produtos'
    WHEN COALESCE(oc.total_ordens, 0) = 0 THEN '❌ PROBLEMA: Sem ordens!'
    ELSE '✅ OK'
  END as status
FROM composicao_info ci
CROSS JOIN orçamentos_com_composicao o
LEFT JOIN ordens_da_composicao oc ON oc.quote_id = o.orcamento_id
ORDER BY o.created_at DESC;

-- ============================================================
-- 8. COMPARAR: PRODUTOS vs COMPOSIÇÕES
-- ============================================================

-- Ver diferença entre ordens de produtos diretos e composições
SELECT
  'PRODUTOS DIRETOS' as tipo,
  COUNT(*) as total_ordens,
  SUM(po.quantity) as quantidade_total,
  AVG(po.quantity) as media_quantidade
FROM production_orders po
WHERE po.notes NOT LIKE '%Composição%'
  AND po.quote_id IS NOT NULL
  AND po.created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT
  'COMPOSIÇÕES' as tipo,
  COUNT(*) as total_ordens,
  SUM(po.quantity) as quantidade_total,
  AVG(po.quantity) as media_quantidade
FROM production_orders po
WHERE po.notes LIKE '%Composição%'
  AND po.quote_id IS NOT NULL
  AND po.created_at >= CURRENT_DATE - INTERVAL '7 days';

-- ============================================================
-- 9. TESTE COMPLETO: CRIAR E VERIFICAR
-- ============================================================

/*
PASSO A PASSO PARA TESTE:

1. Crie uma composição de teste:
   - Produção → Composições → Nova
   - Nome: "Teste Auto XXX"
   - Adicione 2 produtos

2. Crie orçamento com essa composição:
   - Vendas → Orçamentos → Novo
   - Item: Composição "Teste Auto XXX"
   - Quantidade: 10
   - Status: APROVADO

3. Copie o ID do orçamento criado

4. Execute esta query:
*/

-- Ver tudo sobre o orçamento de teste
-- (Substitua pelo UUID do orçamento)
SELECT * FROM (
  SELECT
    1 as ordem,
    'ORÇAMENTO' as tipo,
    q.id::text as id,
    c.name as nome,
    q.status as info1,
    NULL::text as info2
  FROM quotes q
  JOIN customers c ON c.id = q.customer_id
  WHERE q.id = 'UUID_DO_ORCAMENTO' -- <-- COLE ID AQUI

  UNION ALL

  SELECT
    2,
    'ITEM - ' || qi.item_type,
    qi.id::text,
    qi.item_name,
    'Qtd: ' || qi.quantity::text,
    NULL
  FROM quote_items qi
  WHERE qi.quote_id = 'UUID_DO_ORCAMENTO' -- <-- COLE ID AQUI

  UNION ALL

  SELECT
    3,
    'PRODUTO NA COMPOSIÇÃO',
    ci.id::text,
    p.name,
    'Por comp: ' || ci.quantity::text,
    'Total: ' || (qi.quantity * ci.quantity)::text
  FROM quote_items qi
  JOIN composition_items ci ON ci.composition_id = qi.composition_id
  JOIN products p ON p.id = ci.product_id
  WHERE qi.quote_id = 'UUID_DO_ORCAMENTO' -- <-- COLE ID AQUI
    AND ci.item_type = 'product'

  UNION ALL

  SELECT
    4,
    'ORDEM CRIADA',
    po.id::text,
    po.order_number || ' - ' || p.name,
    'Qtd: ' || po.quantity::text,
    'Status: ' || po.status
  FROM production_orders po
  JOIN products p ON p.id = po.product_id
  WHERE po.quote_id = 'UUID_DO_ORCAMENTO' -- <-- COLE ID AQUI
) AS resultado
ORDER BY ordem, tipo, nome;

-- ============================================================
-- 10. DIAGNÓSTICO: COMPOSIÇÕES NO SISTEMA
-- ============================================================

-- Resumo geral do sistema de composições
SELECT
  'Total de Composições' as metrica,
  COUNT(*)::text as valor
FROM compositions

UNION ALL

SELECT
  'Composições com Produtos',
  COUNT(DISTINCT c.id)::text
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
WHERE ci.item_type = 'product'

UNION ALL

SELECT
  'Composições SEM Produtos',
  COUNT(*)::text
FROM compositions c
WHERE NOT EXISTS (
  SELECT 1 FROM composition_items ci
  WHERE ci.composition_id = c.id AND ci.item_type = 'product'
)

UNION ALL

SELECT
  'Orçamentos com Composições (7 dias)',
  COUNT(DISTINCT q.id)::text
FROM quotes q
JOIN quote_items qi ON qi.quote_id = q.id
WHERE qi.item_type = 'composition'
  AND q.created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT
  'Ordens de Composições (7 dias)',
  COUNT(*)::text
FROM production_orders po
WHERE po.notes LIKE '%Composição%'
  AND po.created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT
  'Ordens Hoje',
  COUNT(*)::text
FROM production_orders po
WHERE po.notes LIKE '%Composição%'
  AND DATE(po.created_at) = CURRENT_DATE;

-- ============================================================
-- FIM DAS QUERIES
-- ============================================================
