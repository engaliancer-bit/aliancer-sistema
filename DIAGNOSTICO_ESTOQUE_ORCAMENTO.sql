-- =====================================================
-- DIAGNÓSTICO: Estoque não atualizando após aprovação de orçamento
-- =====================================================
-- Cliente: Simone Dill
-- Produto: paver retangular 10x20x06
-- Quantidade orçada: 1500 unidades
-- Estoque antes: 14200
-- Estoque depois: 14200 (PROBLEMA: deveria ser 12700)
-- =====================================================

-- 1. Verificar cliente Simone Dill
SELECT
  id,
  name,
  cpf,
  created_at
FROM customers
WHERE name ILIKE '%simone%dill%';

-- 2. Verificar orçamento da Simone
SELECT
  q.id,
  q.customer_id,
  c.name as customer_name,
  q.status,
  q.created_at,
  q.approved_at,
  q.awaiting_production
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE c.name ILIKE '%simone%dill%'
ORDER BY q.created_at DESC
LIMIT 5;

-- 3. Verificar produto "paver retangular 10x20x06"
SELECT
  id,
  name,
  code,
  description,
  created_at
FROM products
WHERE name ILIKE '%paver%retangular%10%20%06%'
   OR name ILIKE '%paver%10x20x06%'
   OR name ILIKE '%paver%10x20%'
ORDER BY created_at DESC;

-- 4. Verificar itens do orçamento (usar ID do orçamento encontrado acima)
-- SUBSTITUIR <quote_id> pelo ID real do orçamento
SELECT
  qi.id,
  qi.quote_id,
  qi.item_type,
  qi.product_id,
  p.name as product_name,
  p.code as product_code,
  qi.quantity,
  qi.proposed_price
FROM quote_items qi
LEFT JOIN products p ON p.id = qi.product_id
WHERE qi.quote_id = '<quote_id>' -- SUBSTITUIR pelo ID real
ORDER BY qi.created_at;

-- 5. Verificar se a entrega foi criada para este orçamento
-- SUBSTITUIR <quote_id> pelo ID real do orçamento
SELECT
  d.id as delivery_id,
  d.quote_id,
  d.customer_id,
  c.name as customer_name,
  d.status,
  d.auto_created,
  d.created_at,
  d.notes
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
WHERE d.quote_id = '<quote_id>' -- SUBSTITUIR pelo ID real
ORDER BY d.created_at DESC;

-- 6. Verificar itens da entrega (usar ID da entrega encontrado acima)
-- SUBSTITUIR <delivery_id> pelo ID real da entrega
SELECT
  di.id,
  di.delivery_id,
  di.product_id,
  p.name as product_name,
  p.code as product_code,
  di.item_type,
  di.quantity,
  di.loaded_quantity,
  di.is_from_composition,
  di.created_at
FROM delivery_items di
LEFT JOIN products p ON p.id = di.product_id
WHERE di.delivery_id = '<delivery_id>' -- SUBSTITUIR pelo ID real
ORDER BY di.created_at;

-- 7. Verificar produção do produto (production_type deve ser 'stock')
-- SUBSTITUIR <product_id> pelo ID real do produto
SELECT
  pr.id,
  pr.product_id,
  p.name as product_name,
  p.code as product_code,
  pr.quantity,
  pr.production_type, -- IMPORTANTE: deve ser 'stock' para contar no estoque
  pr.production_date,
  pr.created_at
FROM production pr
JOIN products p ON p.id = pr.product_id
WHERE pr.product_id = '<product_id>' -- SUBSTITUIR pelo ID real
ORDER BY pr.production_date DESC, pr.created_at DESC
LIMIT 20;

-- 8. Verificar cálculo de estoque pela VIEW
-- SUBSTITUIR <product_id> pelo ID real do produto
SELECT
  product_id,
  product_name,
  product_code,
  total_produced,
  total_delivered,
  available_stock
FROM product_stock_view
WHERE product_id = '<product_id>'; -- SUBSTITUIR pelo ID real

-- 9. Verificar cálculo detalhado de estoque
-- SUBSTITUIR <product_id> pelo ID real do produto
SELECT
  product_id,
  product_name,
  product_code,
  total_produced_all,
  total_produced_for_stock,
  total_produced_for_orders,
  total_in_open_deliveries,
  total_in_progress_deliveries,
  total_in_closed_deliveries,
  total_in_cancelled_deliveries,
  total_reserved,
  available_stock
FROM product_stock_detailed_view
WHERE product_id = '<product_id>'; -- SUBSTITUIR pelo ID real

-- 10. Verificar função get_product_available_stock
-- SUBSTITUIR <product_id> pelo ID real do produto
SELECT get_product_available_stock('<product_id>') as stock_via_function;

-- =====================================================
-- POSSÍVEIS CAUSAS DO PROBLEMA:
-- =====================================================
--
-- 1. Entrega não foi criada quando orçamento foi aprovado
-- 2. Entrega foi criada com status diferente de 'open'
-- 3. Delivery_items não foram inseridos
-- 4. Produção foi registrada como 'order' ao invés de 'stock'
-- 5. View product_stock_view não está sendo atualizada
-- 6. Há um problema na query da view
--
-- =====================================================
-- PRÓXIMOS PASSOS APÓS DIAGNÓSTICO:
-- =====================================================
--
-- Executar as queries acima substituindo os IDs reais e verificar:
-- - Se a entrega existe e está com status='open'
-- - Se os delivery_items foram criados corretamente
-- - Se a produção está marcada como production_type='stock'
-- - Se a view está calculando corretamente
--
-- Com base nos resultados, identificar a causa raiz e corrigir.
