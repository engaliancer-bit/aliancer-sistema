-- ===================================================================
-- TESTE DA CORREÇÃO - VÍNCULO DE OP NA PRODUÇÃO
-- ===================================================================

-- 1. VERIFICAR OP #21
SELECT
  po.id,
  po.order_number,
  po.product_id,
  p.name as product_name,
  p.code as product_code,
  po.total_quantity,
  po.produced_quantity,
  po.remaining_quantity,
  po.status,
  po.notes
FROM production_orders po
LEFT JOIN products p ON p.id = po.product_id
WHERE po.order_number = 21;

-- Resultado esperado:
-- ✓ order_number = 21
-- ✓ status = 'open' (ou 'in_progress')
-- ✓ product_id existe (não é null)
-- ✓ remaining_quantity > 0

-- ===================================================================

-- 2. VERIFICAR SE OP #21 É LEGADA (sem itens)
SELECT
  'OP #21 é legada?' as pergunta,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM production_order_items poi
      WHERE poi.production_order_id = po.id
    ) THEN 'NÃO - Tem itens (modelo novo)'
    WHEN po.product_id IS NOT NULL THEN 'SIM - Sem itens (modelo legado)'
    ELSE 'INDEFINIDO'
  END as resposta
FROM production_orders po
WHERE po.order_number = 21;

-- Resultado esperado: 'SIM - Sem itens (modelo legado)'

-- ===================================================================

-- 3. VER TODAS AS OPs LEGADAS ABERTAS
SELECT
  po.order_number,
  po.product_id,
  p.name as product_name,
  po.total_quantity,
  po.produced_quantity,
  po.remaining_quantity,
  po.status
FROM production_orders po
LEFT JOIN products p ON p.id = po.product_id
WHERE po.product_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM production_order_items poi
  WHERE poi.production_order_id = po.id
)
AND po.status IN ('open', 'in_progress')
ORDER BY po.order_number DESC;

-- Resultado esperado: Lista incluindo OP #21

-- ===================================================================

-- 4. VER TODAS AS OPs NOVAS (com itens)
SELECT
  po.order_number,
  po.status,
  COUNT(poi.id) as total_itens,
  SUM(poi.quantity) as quantidade_total,
  SUM(poi.produced_quantity) as produzido_total,
  SUM(poi.quantity - poi.produced_quantity) as restante_total
FROM production_orders po
INNER JOIN production_order_items poi ON poi.production_order_id = po.id
WHERE po.status IN ('open', 'in_progress')
GROUP BY po.id, po.order_number, po.status
ORDER BY po.order_number DESC;

-- ===================================================================

-- 5. COMPARAR AMBOS OS MODELOS
SELECT
  po.order_number,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM production_order_items poi
      WHERE poi.production_order_id = po.id
    ) THEN 'NOVO (com itens)'
    WHEN po.product_id IS NOT NULL THEN 'LEGADO (sem itens)'
    ELSE 'INDEFINIDO'
  END as tipo_modelo,
  COALESCE(p.name, 'N/A') as product_name,
  po.remaining_quantity,
  po.status
FROM production_orders po
LEFT JOIN products p ON p.id = po.product_id
WHERE po.status IN ('open', 'in_progress')
ORDER BY po.order_number DESC
LIMIT 20;

-- ===================================================================

-- 6. VERIFICAR PRODUTO DA OP #21
SELECT
  p.id,
  p.code,
  p.name,
  p.unit
FROM products p
WHERE p.id = (
  SELECT product_id FROM production_orders WHERE order_number = 21
);

-- Resultado esperado:
-- name = 'Tesoura pré moldada T vão de 10,00 m sem aba'

-- ===================================================================

-- 7. SIMULAR BUSCA DE OPs PARA O PRODUTO DA OP #21
WITH target_product AS (
  SELECT product_id FROM production_orders WHERE order_number = 21
)
SELECT
  'OPs abertas para este produto' as descricao,
  COUNT(*) as total
FROM production_orders po
WHERE po.status IN ('open', 'in_progress')
AND (
  -- Modelo legado: product_id direto
  (
    po.product_id = (SELECT product_id FROM target_product)
    AND NOT EXISTS (
      SELECT 1 FROM production_order_items poi
      WHERE poi.production_order_id = po.id
    )
  )
  -- OU Modelo novo: itens com product_id
  OR EXISTS (
    SELECT 1 FROM production_order_items poi
    WHERE poi.production_order_id = po.id
    AND poi.product_id = (SELECT product_id FROM target_product)
    AND (poi.quantity - poi.produced_quantity) > 0
  )
);

-- Resultado esperado: total >= 1 (incluindo OP #21)

-- ===================================================================

-- 8. TESTE DE PRODUÇÃO (simulação)
-- Simular registro de 1 unidade na OP #21

/*
-- ANTES de produzir
SELECT produced_quantity, remaining_quantity, status
FROM production_orders
WHERE order_number = 21;
-- Exemplo: produced_quantity = 0, remaining_quantity = 3, status = 'open'

-- Simular atualização (NÃO EXECUTAR, apenas exemplo)
UPDATE production_orders
SET
  produced_quantity = produced_quantity + 1,
  remaining_quantity = remaining_quantity - 1,
  status = CASE
    WHEN remaining_quantity - 1 = 0 THEN 'completed'
    ELSE 'in_progress'
  END,
  updated_at = NOW()
WHERE order_number = 21;

-- DEPOIS de produzir
SELECT produced_quantity, remaining_quantity, status
FROM production_orders
WHERE order_number = 21;
-- Esperado: produced_quantity = 1, remaining_quantity = 2, status = 'in_progress'
*/

-- ===================================================================

-- 9. VERIFICAR HISTÓRICO DE PRODUÇÕES DA OP #21
SELECT
  p.id,
  p.product_id,
  prod.name as product_name,
  p.quantity,
  p.production_date,
  p.production_order_id,
  p.production_order_item_id,
  p.created_at
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
WHERE p.production_order_id = (
  SELECT id FROM production_orders WHERE order_number = 21
)
ORDER BY p.created_at DESC;

-- Mostra todas as produções registradas para OP #21

-- ===================================================================

-- 10. DIAGNÓSTICO COMPLETO DA OP #21
SELECT
  'Diagnóstico OP #21' as titulo,
  po.order_number,
  po.status,
  po.total_quantity as quantidade_total,
  po.produced_quantity as quantidade_produzida,
  po.remaining_quantity as quantidade_restante,
  ROUND((po.produced_quantity::numeric / po.total_quantity::numeric * 100), 2) as percentual_concluido,
  p.name as produto,
  c.name as cliente,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM production_order_items poi
      WHERE poi.production_order_id = po.id
    ) THEN 'NOVO (com itens)'
    WHEN po.product_id IS NOT NULL THEN 'LEGADO (sem itens)'
    ELSE 'INDEFINIDO'
  END as tipo_modelo,
  (
    SELECT COUNT(*) FROM production prod
    WHERE prod.production_order_id = po.id
  ) as total_producoes_registradas,
  po.created_at as criada_em,
  po.deadline as prazo
FROM production_orders po
LEFT JOIN products p ON p.id = po.product_id
LEFT JOIN customers c ON c.id = po.customer_id
WHERE po.order_number = 21;

-- ===================================================================

-- 11. VERIFICAR INTEGRIDADE (teste de consistência)
SELECT
  po.order_number,
  po.total_quantity,
  po.produced_quantity,
  po.remaining_quantity,
  -- Verificar se soma bate
  CASE
    WHEN po.produced_quantity + po.remaining_quantity = po.total_quantity
    THEN '✓ OK'
    ELSE '✗ INCONSISTENTE'
  END as status_integridade,
  -- Verificar se status está correto
  CASE
    WHEN po.remaining_quantity = 0 AND po.status = 'completed' THEN '✓ OK'
    WHEN po.remaining_quantity > 0 AND po.produced_quantity = 0 AND po.status = 'open' THEN '✓ OK'
    WHEN po.remaining_quantity > 0 AND po.produced_quantity > 0 AND po.status = 'in_progress' THEN '✓ OK'
    ELSE '✗ STATUS INCORRETO'
  END as status_correto
FROM production_orders po
WHERE po.order_number = 21;

-- Resultado esperado: Ambos '✓ OK'

-- ===================================================================
-- FIM DOS TESTES
-- ===================================================================

/*
RESUMO DO QUE FOI CORRIGIDO:

ANTES:
- loadOpenOrders buscava APENAS de production_order_items
- OP #21 (modelo legado) não aparecia porque não tem itens

DEPOIS:
- loadOpenOrders busca de AMBOS:
  1. production_order_items (modelo novo)
  2. production_orders com product_id direto (modelo legado)
- OP #21 agora aparece na lista
- Sistema atualiza progresso corretamente para ambos os modelos

PARA TESTAR NO FRONTEND:
1. Abrir DevTools (F12) → Console
2. Selecionar produto "Tesoura pré moldada T vão de 10,00 m sem aba"
3. Selecionar tipo "Para Ordem de Produção"
4. Verificar logs:
   === DEBUG ORDENS ABERTAS ===
   Ordens modelo legado (sem itens): 1
5. Deve aparecer "OP #21 (Ordem legada)" no select
6. Registrar produção de 1 unidade
7. Verificar se OP #21 foi atualizada

QUERIES DE VERIFICAÇÃO RÁPIDA:
- Query 1: Ver dados da OP #21
- Query 2: Confirmar que é ordem legada
- Query 3: Ver todas as OPs legadas abertas
- Query 10: Diagnóstico completo da OP #21
*/
