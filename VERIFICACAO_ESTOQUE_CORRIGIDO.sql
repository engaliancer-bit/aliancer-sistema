-- =====================================================
-- VERIFICAÇÃO: Estoque Corrigido
-- =====================================================
-- Execute estas queries para confirmar que o estoque está correto
-- =====================================================

-- 1. Verificar estoque do produto "Paver retangular 10x20x06"
SELECT
  psv.product_id,
  psv.product_name,
  psv.product_code,
  psv.total_produced as "Total Produzido Para Estoque",
  psv.total_delivered as "Total Reservado (Entregas Ativas)",
  psv.available_stock as "Estoque Disponível",
  CASE
    WHEN psv.available_stock < 0 THEN '⚠️ NEGATIVO - Necessita Produção'
    WHEN psv.available_stock = 0 THEN '⚡ ZERADO'
    ELSE '✅ DISPONÍVEL'
  END as status_estoque
FROM product_stock_view psv
WHERE psv.product_name ILIKE '%paver%retangular%10%20%06%'
   OR psv.product_name ILIKE '%paver%10x20x06%';

-- Resultado Esperado:
-- Total Produzido: 14200
-- Total Reservado: 1500
-- Estoque Disponível: 12700
-- Status: ✅ DISPONÍVEL

-- =====================================================

-- 2. Verificar TODAS as entregas do produto
SELECT
  d.id as delivery_id,
  d.quote_id,
  c.name as cliente,
  d.status as status_entrega,
  d.delivery_date,
  di.quantity as quantidade_reservada,
  di.loaded_quantity as quantidade_carregada,
  d.created_at,
  CASE
    WHEN d.status = 'open' THEN '📦 Aguardando Carregamento'
    WHEN d.status = 'in_progress' THEN '🚛 Em Carregamento'
    WHEN d.status = 'closed' THEN '✅ Finalizada'
    WHEN d.status = 'cancelled' THEN '❌ Cancelada'
  END as status_legivel
FROM deliveries d
JOIN delivery_items di ON di.delivery_id = d.id
JOIN products p ON p.id = di.product_id
JOIN customers c ON c.id = d.customer_id
WHERE p.name ILIKE '%paver%retangular%10%20%06%'
ORDER BY d.created_at DESC;

-- Deve aparecer pelo menos a entrega da Simone Dill com:
-- - Status: open
-- - Quantidade: 1500
-- - Cliente: Simone Dill

-- =====================================================

-- 3. Verificar estoque DETALHADO (breakdown completo)
SELECT
  psdv.product_id,
  psdv.product_name,
  psdv.total_produced_all as "Produção Total (Todos os Tipos)",
  psdv.total_produced_for_stock as "Produção Para Estoque",
  psdv.total_produced_for_orders as "Produção Para Ordens",
  psdv.total_in_open_deliveries as "Entregas Abertas",
  psdv.total_in_progress_deliveries as "Entregas Em Progresso",
  psdv.total_in_closed_deliveries as "Entregas Fechadas",
  psdv.total_in_cancelled_deliveries as "Entregas Canceladas",
  psdv.total_reserved as "TOTAL RESERVADO",
  psdv.available_stock as "ESTOQUE DISPONÍVEL"
FROM product_stock_detailed_view psdv
WHERE psdv.product_name ILIKE '%paver%retangular%10%20%06%';

-- Este mostra o breakdown completo de onde está cada unidade

-- =====================================================

-- 4. Verificar se o cálculo está correto (matemática)
WITH stock_calc AS (
  SELECT
    p.id,
    p.name,

    -- Produção "Para Estoque"
    COALESCE((
      SELECT SUM(quantity)
      FROM production
      WHERE product_id = p.id
        AND production_type = 'stock'
    ), 0) as producao_estoque,

    -- Entregas Ativas (open, in_progress, closed)
    COALESCE((
      SELECT SUM(di.quantity)
      FROM delivery_items di
      JOIN deliveries d ON d.id = di.delivery_id
      WHERE di.product_id = p.id
        AND d.status IN ('open', 'in_progress', 'closed')
    ), 0) as entregas_ativas,

    -- Cálculo Manual
    COALESCE((
      SELECT SUM(quantity)
      FROM production
      WHERE product_id = p.id
        AND production_type = 'stock'
    ), 0) - COALESCE((
      SELECT SUM(di.quantity)
      FROM delivery_items di
      JOIN deliveries d ON d.id = di.delivery_id
      WHERE di.product_id = p.id
        AND d.status IN ('open', 'in_progress', 'closed')
    ), 0) as estoque_calculado_manual

  FROM products p
  WHERE p.name ILIKE '%paver%retangular%10%20%06%'
)
SELECT
  sc.*,
  psv.available_stock as estoque_pela_view,
  CASE
    WHEN sc.estoque_calculado_manual = psv.available_stock THEN '✅ CORRETO'
    ELSE '❌ DIVERGÊNCIA'
  END as validacao
FROM stock_calc sc
JOIN product_stock_view psv ON psv.product_id = sc.id;

-- Deve mostrar:
-- producao_estoque: 14200
-- entregas_ativas: 1500
-- estoque_calculado_manual: 12700
-- estoque_pela_view: 12700
-- validacao: ✅ CORRETO

-- =====================================================

-- 5. Verificar função get_product_available_stock()
-- SUBSTITUIR <product_id> pelo ID real do produto
SELECT
  p.id,
  p.name,
  get_product_available_stock(p.id) as estoque_via_funcao,
  psv.available_stock as estoque_via_view,
  CASE
    WHEN get_product_available_stock(p.id) = psv.available_stock THEN '✅ CONSISTENTE'
    ELSE '❌ INCONSISTENTE'
  END as consistencia
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.name ILIKE '%paver%retangular%10%20%06%';

-- Deve mostrar:
-- estoque_via_funcao: 12700
-- estoque_via_view: 12700
-- consistencia: ✅ CONSISTENTE

-- =====================================================

-- 6. Verificar produção registrada como "Para Estoque"
SELECT
  pr.id,
  p.name as produto,
  pr.quantity as quantidade,
  pr.production_type as tipo_producao,
  pr.production_date as data_producao,
  pr.created_at,
  CASE
    WHEN pr.production_type = 'stock' THEN '✅ Conta no Estoque'
    WHEN pr.production_type = 'order' THEN '📋 Vinculada a Ordem (Não conta)'
    ELSE '❓ Tipo Desconhecido'
  END as status_tipo
FROM production pr
JOIN products p ON p.id = pr.product_id
WHERE p.name ILIKE '%paver%retangular%10%20%06%'
ORDER BY pr.production_date DESC, pr.created_at DESC
LIMIT 20;

-- Verificar se tem production_type = 'stock'
-- Se tiver 'order', essas não contam no estoque geral

-- =====================================================

-- 7. TESTE: Simular novo orçamento
-- Esta query mostra o que DEVERIA acontecer se criar um novo orçamento
WITH simulacao AS (
  SELECT
    psv.product_id,
    psv.product_name,
    psv.available_stock as estoque_atual,
    500 as nova_venda_simulada,
    psv.available_stock - 500 as estoque_apos_venda
  FROM product_stock_view psv
  WHERE psv.product_name ILIKE '%paver%retangular%10%20%06%'
)
SELECT
  *,
  CASE
    WHEN estoque_apos_venda >= 0 THEN '✅ Tem Estoque Suficiente'
    WHEN estoque_apos_venda < 0 THEN '⚠️ Estoque Insuficiente - Precisa Produzir ' || ABS(estoque_apos_venda) || ' unidades'
  END as resultado
FROM simulacao;

-- Se aprovar um novo orçamento de 500 unidades:
-- Estoque atual: 12700
-- Nova venda: 500
-- Estoque após: 12200
-- Resultado: ✅ Tem Estoque Suficiente

-- =====================================================

-- RESUMO DO QUE DEVE APARECER:
-- =====================================================
--
-- Query 1: Estoque Disponível = 12700 (14200 - 1500)
-- Query 2: Entrega da Simone Dill com 1500 unidades, status='open'
-- Query 3: Breakdown mostrando de onde vem cada número
-- Query 4: Validação = ✅ CORRETO
-- Query 5: Consistência = ✅ CONSISTENTE
-- Query 6: Produção registrada como production_type='stock'
-- Query 7: Simulação de nova venda
--
-- Se TODOS os resultados estiverem corretos, o sistema está funcionando!
-- =====================================================
