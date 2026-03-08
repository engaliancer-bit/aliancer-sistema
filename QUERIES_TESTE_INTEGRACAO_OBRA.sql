-- ================================================
-- QUERIES PARA TESTAR INTEGRAÇÃO ORÇAMENTO-OBRA
-- ================================================

-- ============================================
-- 1. VERIFICAR COMPOSIÇÕES E SEUS ITEMS
-- ============================================

-- Ver todas as composições com seus items (produtos + materiais)
SELECT
  c.id as composition_id,
  c.name as composition_name,
  ci.item_type,
  COALESCE(p.name, m.name) as item_name,
  ci.quantity,
  ci.unit,
  COALESCE(p.id::text, m.id::text) as item_id
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
LEFT JOIN products p ON p.id = ci.product_id
LEFT JOIN materials m ON m.id = ci.material_id
ORDER BY c.name, ci.item_type;

-- Ver composições que TÊM produtos E materiais (ideal para teste)
SELECT
  c.id,
  c.name,
  COUNT(CASE WHEN ci.item_type = 'product' THEN 1 END) as total_products,
  COUNT(CASE WHEN ci.item_type = 'material' THEN 1 END) as total_materials
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
GROUP BY c.id, c.name
HAVING
  COUNT(CASE WHEN ci.item_type = 'product' THEN 1 END) > 0 AND
  COUNT(CASE WHEN ci.item_type = 'material' THEN 1 END) > 0
ORDER BY c.name;

-- ============================================
-- 2. TESTAR FUNÇÃO DE VERIFICAÇÃO DE ESTOQUE
-- ============================================

-- Testar check_composition_full_stock
-- (Substitua UUID_DA_COMPOSICAO pelo ID real)
SELECT
  item_type,
  item_name,
  quantity_required,
  quantity_in_stock,
  quantity_to_produce,
  has_sufficient_stock,
  unit,
  CASE
    WHEN has_sufficient_stock THEN '✅ Estoque OK'
    WHEN quantity_in_stock > 0 THEN '⚠️ Estoque Parcial'
    ELSE '❌ Sem Estoque'
  END as status_visual
FROM check_composition_full_stock(
  'UUID_DA_COMPOSICAO'::uuid,
  1  -- quantidade multiplicadora
)
ORDER BY item_type, item_name;

-- ============================================
-- 3. VERIFICAR ORÇAMENTOS PRONTOS PARA TESTE
-- ============================================

-- Orçamentos padrão com composições
SELECT
  q.id as quote_id,
  q.customer_id,
  c.name as customer_name,
  COUNT(qi.id) as total_items,
  COUNT(qi.composition_id) as items_with_composition
FROM quotes q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN quote_items qi ON qi.quote_id = q.id
WHERE q.status = 'approved'
GROUP BY q.id, q.customer_id, c.name
HAVING COUNT(qi.composition_id) > 0
ORDER BY q.created_at DESC
LIMIT 10;

-- Orçamentos de laje treliçada com composições
SELECT
  rsq.id as quote_id,
  rsq.customer_id,
  c.name as customer_name,
  COUNT(DISTINCT rsf.id) as total_floors,
  COUNT(rsr.id) as total_rooms,
  COUNT(rsr.composition_id) as rooms_with_composition
FROM ribbed_slab_quotes rsq
JOIN customers c ON c.id = rsq.customer_id
LEFT JOIN ribbed_slab_floors rsf ON rsf.quote_id = rsq.id
LEFT JOIN ribbed_slab_rooms rsr ON rsr.floor_id = rsf.id
WHERE rsq.status = 'approved'
GROUP BY rsq.id, rsq.customer_id, c.name
HAVING COUNT(rsr.composition_id) > 0
ORDER BY rsq.created_at DESC
LIMIT 10;

-- ============================================
-- 4. VERIFICAR OBRAS DISPONÍVEIS
-- ============================================

-- Obras que podem receber orçamentos
SELECT
  cp.id,
  cp.name as project_name,
  cp.status,
  c.name as customer_name,
  cp.start_date,
  COUNT(cqi.id) as total_items_linked
FROM construction_projects cp
JOIN customers c ON c.id = cp.customer_id
LEFT JOIN construction_quote_items cqi ON cqi.construction_project_id = cp.id
GROUP BY cp.id, cp.name, cp.status, c.name, cp.start_date
ORDER BY cp.created_at DESC;

-- ============================================
-- 5. VER RESULTADO APÓS PROCESSAR
-- ============================================

-- Ver todos os items vinculados a uma obra
-- (Substitua UUID_DA_OBRA pelo ID real)
SELECT
  cqi.id,
  cqi.item_type,
  CASE
    WHEN cqi.item_type = 'product' THEN '🔨'
    WHEN cqi.item_type = 'material' THEN '📦'
  END as emoji,
  COALESCE(p.name, m.name) as item_name,
  cqi.quantity_required,
  cqi.quantity_in_stock,
  cqi.quantity_to_produce,
  cqi.unit,
  cqi.status,
  CASE cqi.status
    WHEN 'in_production' THEN '🔴 Em Produção'
    WHEN 'partially_available' THEN '🟡 Parcial'
    WHEN 'available_for_delivery' THEN '🟢 Disponível'
    WHEN 'delivered' THEN '⚪ Entregue'
  END as status_visual,
  po.order_number as production_order,
  po.status as order_status,
  d.delivery_number,
  d.status as delivery_status,
  cqi.notes
FROM construction_quote_items cqi
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
LEFT JOIN deliveries d ON d.id = cqi.delivery_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'::uuid
ORDER BY cqi.item_type, cqi.created_at DESC;

-- Resumo por status de uma obra
SELECT
  cp.name as obra_name,
  cqi.status,
  cqi.item_type,
  COUNT(*) as total_items,
  SUM(cqi.quantity_required) as total_quantity_required,
  SUM(cqi.quantity_in_stock) as total_quantity_in_stock,
  SUM(cqi.quantity_to_produce) as total_quantity_to_produce
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'::uuid
GROUP BY cp.name, cqi.status, cqi.item_type
ORDER BY cqi.status, cqi.item_type;

-- ============================================
-- 6. VERIFICAR ORDENS DE PRODUÇÃO CRIADAS
-- ============================================

-- Ordens criadas para obras
SELECT
  po.order_number,
  po.status,
  p.name as product_name,
  po.quantity,
  po.priority,
  po.notes,
  po.created_at,
  -- Obra vinculada
  cp.name as project_name
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN construction_quote_items cqi ON cqi.production_order_id = po.id
LEFT JOIN construction_projects cp ON cp.id = cqi.construction_project_id
WHERE po.notes LIKE '%Ordem para obra%'
   OR cqi.construction_project_id IS NOT NULL
ORDER BY po.created_at DESC;

-- Ordens por status para uma obra específica
SELECT
  po.status,
  COUNT(*) as total_orders,
  SUM(po.quantity) as total_quantity
FROM production_orders po
JOIN construction_quote_items cqi ON cqi.production_order_id = po.id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'::uuid
GROUP BY po.status
ORDER BY
  CASE po.status
    WHEN 'open' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'cancelled' THEN 4
  END;

-- ============================================
-- 7. VERIFICAR ENTREGAS AUTOMÁTICAS
-- ============================================

-- Entregas automáticas criadas
SELECT
  d.delivery_number,
  d.status,
  c.name as customer_name,
  cp.name as project_name,
  d.delivery_date,
  d.notes,
  COUNT(di.id) as total_items,
  d.created_at
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
LEFT JOIN construction_projects cp ON cp.id = d.construction_project_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
WHERE d.notes LIKE '%Entrega automática%'
   OR d.construction_project_id IS NOT NULL
GROUP BY d.id, d.delivery_number, d.status, c.name, cp.name, d.delivery_date, d.notes, d.created_at
ORDER BY d.created_at DESC;

-- Items de uma entrega automática
SELECT
  d.delivery_number,
  CASE
    WHEN di.product_id IS NOT NULL THEN '🔨 PRODUTO'
    WHEN di.material_id IS NOT NULL THEN '📦 MATERIAL'
  END as item_type,
  COALESCE(p.name, m.name) as item_name,
  di.quantity,
  COALESCE(p.unit, m.unit) as unit,
  di.notes
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
LEFT JOIN products p ON p.id = di.product_id
LEFT JOIN materials m ON m.id = di.material_id
WHERE d.delivery_number = 'ENT-XXX'  -- Substitua pelo número real
ORDER BY item_type, item_name;

-- ============================================
-- 8. TESTAR TRIGGERS
-- ============================================

-- Ver items que estão aguardando produção
SELECT
  cqi.id,
  cp.name as project_name,
  COALESCE(p.name, m.name) as item_name,
  cqi.quantity_to_produce,
  po.order_number,
  po.status as order_status,
  cqi.status as item_status
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
WHERE cqi.status = 'in_production'
AND po.id IS NOT NULL
ORDER BY cp.name, cqi.created_at;

-- Após marcar uma ordem como completed, execute para ver se atualizou:
SELECT
  cqi.id,
  cqi.status,
  cqi.notes,
  po.order_number,
  po.status as order_status,
  cqi.updated_at
FROM construction_quote_items cqi
JOIN production_orders po ON po.id = cqi.production_order_id
WHERE po.order_number = 'OP-XXX'  -- Substitua pelo número real
ORDER BY cqi.updated_at DESC;

-- ============================================
-- 9. ESTATÍSTICAS GERAIS
-- ============================================

-- Resumo geral de todas as obras
SELECT
  cp.name as project_name,
  COUNT(DISTINCT cqi.id) as total_items,
  COUNT(DISTINCT cqi.production_order_id) as total_orders,
  COUNT(DISTINCT cqi.delivery_id) as total_deliveries,
  COUNT(CASE WHEN cqi.status = 'in_production' THEN 1 END) as items_in_production,
  COUNT(CASE WHEN cqi.status = 'available_for_delivery' THEN 1 END) as items_available,
  COUNT(CASE WHEN cqi.status = 'delivered' THEN 1 END) as items_delivered,
  ROUND(
    COUNT(CASE WHEN cqi.status = 'delivered' THEN 1 END)::numeric /
    NULLIF(COUNT(cqi.id), 0) * 100,
    2
  ) as progress_percentage
FROM construction_projects cp
LEFT JOIN construction_quote_items cqi ON cqi.construction_project_id = cp.id
GROUP BY cp.id, cp.name
HAVING COUNT(cqi.id) > 0
ORDER BY cp.created_at DESC;

-- Items por tipo (produto vs material)
SELECT
  item_type,
  status,
  COUNT(*) as total_items,
  SUM(quantity_required) as total_required,
  SUM(quantity_in_stock) as total_in_stock,
  SUM(quantity_to_produce) as total_to_produce
FROM construction_quote_items
GROUP BY item_type, status
ORDER BY item_type,
  CASE status
    WHEN 'in_production' THEN 1
    WHEN 'partially_available' THEN 2
    WHEN 'available_for_delivery' THEN 3
    WHEN 'delivered' THEN 4
  END;

-- ============================================
-- 10. LIMPEZA E TESTES (CUIDADO!)
-- ============================================

-- Ver items que podem ser deletados para teste
-- (NÃO execute o DELETE sem confirmar!)
SELECT
  cqi.id,
  cp.name as project_name,
  COALESCE(p.name, m.name) as item_name,
  cqi.created_at,
  'DELETE FROM construction_quote_items WHERE id = ''' || cqi.id || ''';' as delete_command
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'::uuid
ORDER BY cqi.created_at DESC;

-- Deletar TODOS os items de uma obra (CUIDADO!)
-- DELETE FROM construction_quote_items
-- WHERE construction_project_id = 'UUID_DA_OBRA'::uuid;

-- ============================================
-- 11. QUERIES DE DEBUG
-- ============================================

-- Ver se função get_material_stock está funcionando
SELECT
  m.id,
  m.name,
  m.stock_quantity as stock_direct,
  get_material_stock(m.id) as stock_function,
  CASE
    WHEN m.stock_quantity = get_material_stock(m.id) THEN '✅ OK'
    ELSE '❌ ERRO'
  END as comparison
FROM materials
WHERE stock_quantity > 0
LIMIT 10;

-- Ver se função get_product_stock está funcionando
SELECT
  p.id,
  p.name,
  get_product_stock(p.id) as stock_quantity
FROM products
LIMIT 10;

-- Verificar se triggers existem
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_update_construction_items_on_production_completion',
  'trigger_update_construction_items_on_delivery'
)
ORDER BY trigger_name;

-- ============================================
-- 12. EXEMPLO COMPLETO DE TESTE
-- ============================================

-- PASSO 1: Encontrar composição para testar
SELECT
  c.id,
  c.name,
  COUNT(CASE WHEN ci.item_type = 'product' THEN 1 END) as products,
  COUNT(CASE WHEN ci.item_type = 'material' THEN 1 END) as materials
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(*) > 0
LIMIT 5;

-- PASSO 2: Ver estoque da composição
-- (Substitua pelo ID encontrado acima)
SELECT * FROM check_composition_full_stock(
  'UUID_DA_COMPOSICAO'::uuid,
  1
);

-- PASSO 3: Encontrar orçamento com essa composição
SELECT
  qi.quote_id,
  q.customer_id,
  c.name as customer_name
FROM quote_items qi
JOIN quotes q ON q.id = qi.quote_id
JOIN customers c ON c.id = q.customer_id
WHERE qi.composition_id = 'UUID_DA_COMPOSICAO'::uuid
LIMIT 1;

-- PASSO 4: Encontrar ou criar obra do cliente
SELECT
  id,
  name,
  status
FROM construction_projects
WHERE customer_id = 'UUID_DO_CLIENTE'::uuid
LIMIT 1;

-- PASSO 5: Processar (via interface web ou SQL)
-- Via SQL (não recomendado, use a interface):
-- SELECT process_quote_approval_for_construction(
--   'UUID_DO_ORCAMENTO'::uuid,
--   'quote',
--   'UUID_DA_OBRA'::uuid
-- );

-- PASSO 6: Ver resultado
SELECT
  cqi.item_type,
  COALESCE(p.name, m.name) as item_name,
  cqi.quantity_required,
  cqi.quantity_in_stock,
  cqi.quantity_to_produce,
  cqi.status,
  po.order_number,
  d.delivery_number
FROM construction_quote_items cqi
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
LEFT JOIN deliveries d ON d.id = cqi.delivery_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'::uuid
ORDER BY cqi.item_type, cqi.created_at;

-- ============================================
-- FIM DAS QUERIES
-- ============================================

/*
DICAS DE USO:

1. Sempre substitua os UUIDs de exemplo pelos reais
2. Use as queries na ordem sugerida para testar
3. Comece com SELECT antes de fazer qualquer DELETE
4. Use o Debug da interface antes de queries diretas
5. Verifique triggers estão ativos antes de testar

ORDEM RECOMENDADA DE TESTE:

1. Ver composições disponíveis (query 1)
2. Testar função de estoque (query 2)
3. Encontrar orçamento para teste (query 3)
4. Verificar obras disponíveis (query 4)
5. Processar via interface web
6. Verificar resultado (queries 5, 6, 7)
7. Testar triggers (query 8)
8. Ver estatísticas (query 9)

Boa sorte! 🚀
*/
