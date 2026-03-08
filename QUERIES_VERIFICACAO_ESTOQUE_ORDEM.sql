-- =====================================================
-- QUERIES DE VERIFICAÇÃO: ESTOQUE x PRODUÇÃO PARA ORDEM
-- =====================================================
-- Use estas queries para verificar que o sistema está
-- descontando corretamente produções vinculadas a ordens

-- =====================================================
-- 1. VERIFICAÇÃO COMPLETA DE UM PRODUTO ESPECÍFICO
-- =====================================================
-- Substitua o UUID pelo ID do produto que deseja verificar

WITH produto_teste AS (
  SELECT 'da85f3b1-8375-46bf-a172-13e06d26b553'::uuid as product_id
  -- ☝️ ALTERE ESTE ID PARA O PRODUTO QUE DESEJA VERIFICAR
)
SELECT
  p.name as "Produto",
  p.code as "Código",

  -- Produção por tipo
  COALESCE(prod_stock.qty_stock, 0) as "Prod. p/ Estoque",
  COALESCE(prod_order.qty_order, 0) as "Prod. p/ Ordem (não conta)",
  COALESCE(prod_total.qty_total, 0) as "Prod. Total",

  -- Entregas
  COALESCE(deliv.qty_delivered, 0) as "Total Entregue",

  -- Estoque
  COALESCE(psv.available_stock, 0) as "Estoque Disponível",

  -- Verificação de cálculo
  COALESCE(prod_stock.qty_stock, 0) - COALESCE(deliv.qty_delivered, 0) as "Cálculo Manual",

  -- Status
  CASE
    WHEN COALESCE(prod_stock.qty_stock, 0) - COALESCE(deliv.qty_delivered, 0) = COALESCE(psv.available_stock, 0)
    THEN '✅ CORRETO'
    ELSE '❌ DIVERGÊNCIA'
  END as "Status"

FROM produto_teste pt
JOIN products p ON p.id = pt.product_id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_stock
  FROM production
  WHERE production_type = 'stock' AND product_id = (SELECT product_id FROM produto_teste)
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = pt.product_id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_order
  FROM production
  WHERE production_type = 'order' AND product_id = (SELECT product_id FROM produto_teste)
  GROUP BY product_id
) prod_order ON prod_order.product_id = pt.product_id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_total
  FROM production
  WHERE product_id = (SELECT product_id FROM produto_teste)
  GROUP BY product_id
) prod_total ON prod_total.product_id = pt.product_id

LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as qty_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')
    AND di.product_id = (SELECT product_id FROM produto_teste)
  GROUP BY di.product_id
) deliv ON deliv.product_id = pt.product_id

LEFT JOIN product_stock_view psv ON psv.product_id = pt.product_id;


-- =====================================================
-- 2. VISÃO GERAL DE TODOS OS PRODUTOS
-- =====================================================
-- Mostra breakdown de estoque para todos os produtos com produção

SELECT
  p.name as "Produto",
  p.code as "Código",

  -- Produção
  COALESCE(prod_stock.qty_stock, 0) as "Prod. Estoque",
  COALESCE(prod_order.qty_order, 0) as "Prod. Ordem",
  COALESCE(prod_total.qty_total, 0) as "Prod. Total",

  -- Entregas
  COALESCE(deliv.qty_delivered, 0) as "Entregue",

  -- Estoque
  COALESCE(psv.available_stock, 0) as "Disponível",

  -- Indicador visual
  CASE
    WHEN COALESCE(psv.available_stock, 0) < 0 THEN '🔴 Negativo'
    WHEN COALESCE(psv.available_stock, 0) = 0 THEN '⚪ Zero'
    WHEN COALESCE(psv.available_stock, 0) > 0 THEN '🟢 Positivo'
  END as "Status"

FROM products p

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_stock
  FROM production WHERE production_type = 'stock'
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = p.id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_order
  FROM production WHERE production_type = 'order'
  GROUP BY product_id
) prod_order ON prod_order.product_id = p.id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_total
  FROM production
  GROUP BY product_id
) prod_total ON prod_total.product_id = p.id

LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as qty_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')
  GROUP BY di.product_id
) deliv ON deliv.product_id = p.id

LEFT JOIN product_stock_view psv ON psv.product_id = p.id

WHERE prod_total.qty_total > 0
ORDER BY p.name;


-- =====================================================
-- 3. PRODUÇÕES ALTERADAS (mudaram de tipo)
-- =====================================================
-- Identifica produções que foram modificadas após criação

SELECT
  pr.id as "ID Produção",
  p.name as "Produto",
  pr.quantity as "Qtd",
  pr.production_type as "Tipo",
  CASE pr.production_type
    WHEN 'stock' THEN '📦 Para Estoque'
    WHEN 'order' THEN '🔨 Para Ordem #' || COALESCE(po.order_number::text, '?')
  END as "Destinação",
  pr.production_date as "Data Produção",
  to_char(pr.created_at, 'DD/MM/YYYY HH24:MI') as "Criado em",
  to_char(pr.updated_at, 'DD/MM/YYYY HH24:MI') as "Atualizado em",
  CASE
    WHEN DATE(pr.created_at) != DATE(pr.updated_at) THEN '⚠️ ALTERADO'
    WHEN pr.created_at::time != pr.updated_at::time THEN '⚠️ ALTERADO'
    ELSE '✓ Original'
  END as "Status"
FROM production pr
JOIN products p ON p.id = pr.product_id
LEFT JOIN production_orders po ON po.id = pr.production_order_id
WHERE pr.production_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY pr.updated_at DESC
LIMIT 50;


-- =====================================================
-- 4. PRODUTOS COM ESTOQUE NEGATIVO
-- =====================================================
-- Produtos que precisam produção urgente

SELECT
  p.name as "Produto",
  p.code as "Código",
  psv.available_stock as "Estoque",
  psv.total_produced as "Produzido",
  psv.total_delivered as "Entregue",
  (psv.total_delivered - psv.total_produced) as "Faltando",
  p.minimum_stock as "Estoque Mínimo"
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE psv.available_stock < 0
ORDER BY psv.available_stock;


-- =====================================================
-- 5. PRODUÇÕES DE HOJE POR TIPO
-- =====================================================
-- Ver o que foi produzido hoje e para onde vai

SELECT
  p.name as "Produto",
  pr.quantity as "Qtd",
  CASE pr.production_type
    WHEN 'stock' THEN '📦 Para Estoque (conta)'
    WHEN 'order' THEN '🔨 Para Ordem (não conta)'
  END as "Tipo",
  po.order_number as "Nº Ordem",
  c.name as "Cliente",
  pr.production_date as "Data"
FROM production pr
JOIN products p ON p.id = pr.product_id
LEFT JOIN production_orders po ON po.id = pr.production_order_id
LEFT JOIN customers c ON c.id = po.customer_id
WHERE pr.production_date = CURRENT_DATE
ORDER BY pr.created_at DESC;


-- =====================================================
-- 6. TESTE DE ALTERAÇÃO DE TIPO
-- =====================================================
-- Use esta sequência para testar uma mudança de tipo

-- PASSO 1: Ver estoque ANTES
SELECT
  p.name,
  psv.available_stock as "Estoque ANTES"
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.id = 'SEU-PRODUCT-ID-AQUI';

-- PASSO 2: Alterar produção de 'stock' para 'order'
-- (DESCOMENTE E AJUSTE IDs PARA USAR)
/*
UPDATE production
SET
  production_type = 'order',
  production_order_id = 'ID-DA-ORDEM',
  updated_at = now()
WHERE id = 'ID-DA-PRODUCAO';
*/

-- PASSO 3: Ver estoque DEPOIS
SELECT
  p.name,
  psv.available_stock as "Estoque DEPOIS",
  pr.quantity as "Qtd Alterada"
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
JOIN production pr ON pr.product_id = p.id
WHERE p.id = 'SEU-PRODUCT-ID-AQUI'
  AND pr.id = 'ID-DA-PRODUCAO';

-- Resultado esperado: Estoque DEPOIS = Estoque ANTES - Qtd Alterada


-- =====================================================
-- 7. HISTÓRICO DE ALTERAÇÕES EM PRODUÇÃO ESPECÍFICA
-- =====================================================
-- Ver detalhes de uma produção que foi alterada

SELECT
  pr.id,
  p.name as "Produto",
  pr.quantity,
  pr.production_type as "Tipo Atual",
  pr.production_order_id as "Ordem ID",
  po.order_number as "Nº Ordem",
  pr.production_date as "Data Produção",
  pr.created_at as "Criado em",
  pr.updated_at as "Última Alteração",
  (pr.updated_at - pr.created_at) as "Tempo desde criação",
  CASE
    WHEN pr.created_at = pr.updated_at THEN 'Nunca alterado'
    ELSE 'Alterado ' || EXTRACT(DAY FROM (pr.updated_at - pr.created_at)) || ' dia(s) depois'
  END as "Status Alteração"
FROM production pr
JOIN products p ON p.id = pr.product_id
LEFT JOIN production_orders po ON po.id = pr.production_order_id
WHERE pr.id = 'ID-DA-PRODUCAO'  -- ☝️ ALTERE ESTE ID
;


-- =====================================================
-- 8. PRODUTOS COM PRODUÇÃO MISTA (stock + order)
-- =====================================================
-- Produtos que têm produções de ambos os tipos

SELECT
  p.name as "Produto",
  p.code as "Código",
  prod_stock.qty_stock as "Prod. Estoque",
  prod_order.qty_order as "Prod. Ordem",
  (prod_stock.qty_stock + prod_order.qty_order) as "Total Produzido",
  psv.available_stock as "Disponível",
  '⚠️ Misto' as "Observação"
FROM products p
INNER JOIN (
  SELECT product_id, SUM(quantity) as qty_stock
  FROM production WHERE production_type = 'stock'
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = p.id
INNER JOIN (
  SELECT product_id, SUM(quantity) as qty_order
  FROM production WHERE production_type = 'order'
  GROUP BY product_id
) prod_order ON prod_order.product_id = p.id
LEFT JOIN product_stock_view psv ON psv.product_id = p.id
ORDER BY p.name;


-- =====================================================
-- 9. VERIFICAR SE VIEW ESTÁ ATUALIZADA
-- =====================================================
-- Compara cálculo da view com cálculo manual

SELECT
  p.name as "Produto",

  -- Da view
  psv.available_stock as "Estoque (View)",

  -- Cálculo manual
  (
    COALESCE((
      SELECT SUM(quantity)
      FROM production pr
      WHERE pr.product_id = p.id
        AND pr.production_type = 'stock'
    ), 0)
    -
    COALESCE((
      SELECT SUM(di.quantity)
      FROM delivery_items di
      INNER JOIN deliveries d ON d.id = di.delivery_id
      WHERE di.product_id = p.id
        AND d.status IN ('open', 'in_progress', 'closed')
    ), 0)
  ) as "Estoque (Manual)",

  -- Comparação
  CASE
    WHEN psv.available_stock = (
      COALESCE((
        SELECT SUM(quantity)
        FROM production pr
        WHERE pr.product_id = p.id
          AND pr.production_type = 'stock'
      ), 0)
      -
      COALESCE((
        SELECT SUM(di.quantity)
        FROM delivery_items di
        INNER JOIN deliveries d ON d.id = di.delivery_id
        WHERE di.product_id = p.id
          AND d.status IN ('open', 'in_progress', 'closed')
      ), 0)
    )
    THEN '✅ OK'
    ELSE '❌ DIVERGÊNCIA'
  END as "Status"

FROM products p
LEFT JOIN product_stock_view psv ON psv.product_id = p.id
WHERE psv.available_stock IS NOT NULL
  OR EXISTS (SELECT 1 FROM production WHERE product_id = p.id)
ORDER BY p.name
LIMIT 20;


-- =====================================================
-- 10. RESUMO EXECUTIVO
-- =====================================================
-- Estatísticas gerais do sistema de estoque

SELECT
  'Produtos com Produção' as "Métrica",
  COUNT(DISTINCT product_id) as "Valor"
FROM production

UNION ALL

SELECT
  'Produções Para Estoque',
  COUNT(*)
FROM production
WHERE production_type = 'stock'

UNION ALL

SELECT
  'Produções Para Ordem',
  COUNT(*)
FROM production
WHERE production_type = 'order'

UNION ALL

SELECT
  'Produtos com Estoque Positivo',
  COUNT(*)
FROM product_stock_view
WHERE available_stock > 0

UNION ALL

SELECT
  'Produtos com Estoque Negativo',
  COUNT(*)
FROM product_stock_view
WHERE available_stock < 0

UNION ALL

SELECT
  'Entregas Ativas',
  COUNT(*)
FROM deliveries
WHERE status IN ('open', 'in_progress', 'closed')

UNION ALL

SELECT
  'Ordens de Produção Abertas',
  COUNT(*)
FROM production_orders
WHERE status = 'open';
