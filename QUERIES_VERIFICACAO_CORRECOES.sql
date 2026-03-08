-- ============================================
-- QUERIES PARA VERIFICAR CORREÇÕES
-- ============================================

-- ============================================
-- 1. VERIFICAR ORDENS DE PRODUÇÃO CRIADAS
-- ============================================

-- Ver TODAS as ordens criadas para obras
SELECT
  po.order_number,
  po.status,
  p.name as produto,
  p.code as codigo,
  po.quantity as quantidade,
  po.priority as prioridade,
  po.notes as observacoes,
  po.created_at,
  -- Items da obra vinculados
  COUNT(cqi.id) as total_items_vinculados
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN construction_quote_items cqi ON cqi.production_order_id = po.id
WHERE po.notes LIKE '%Ordem para obra%'
   OR cqi.construction_project_id IS NOT NULL
GROUP BY po.id, po.order_number, po.status, p.name, p.code, po.quantity, po.priority, po.notes, po.created_at
ORDER BY po.created_at DESC;

-- Ver ordens criadas HOJE
SELECT
  po.order_number,
  p.name as produto,
  po.quantity,
  po.status,
  po.notes
FROM production_orders po
JOIN products p ON p.id = po.product_id
WHERE DATE(po.created_at) = CURRENT_DATE
ORDER BY po.created_at DESC;

-- Verificar se algum produto sem estoque NÃO gerou ordem
-- (Esta query deve retornar ZERO linhas após a correção)
SELECT
  cqi.id,
  cp.name as obra,
  p.name as produto,
  cqi.quantity_required,
  cqi.quantity_in_stock,
  cqi.quantity_to_produce,
  cqi.status,
  cqi.production_order_id,
  CASE
    WHEN cqi.production_order_id IS NULL THEN '❌ SEM ORDEM!'
    ELSE '✅ OK'
  END as verificacao
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
LEFT JOIN products p ON p.id = cqi.product_id
WHERE cqi.item_type = 'product'
  AND cqi.quantity_to_produce > 0
  AND cqi.production_order_id IS NULL
ORDER BY cqi.created_at DESC;

-- Resumo de ordens por obra
SELECT
  cp.name as obra,
  COUNT(DISTINCT po.id) as total_ordens_criadas,
  COUNT(DISTINCT CASE WHEN po.status = 'open' THEN po.id END) as ordens_abertas,
  COUNT(DISTINCT CASE WHEN po.status = 'completed' THEN po.id END) as ordens_concluidas,
  SUM(po.quantity) as quantidade_total
FROM construction_projects cp
JOIN construction_quote_items cqi ON cqi.construction_project_id = cp.id
JOIN production_orders po ON po.id = cqi.production_order_id
GROUP BY cp.id, cp.name
ORDER BY cp.created_at DESC;

-- ============================================
-- 2. VERIFICAR ENTREGAS E SEUS ITEMS
-- ============================================

-- Ver TODAS as entregas com contagem de items
SELECT
  d.delivery_number,
  d.status,
  d.delivery_date,
  c.name as cliente,
  cp.name as obra,
  COUNT(di.id) as total_items,
  CASE
    WHEN d.auto_created THEN '🤖 Automática'
    ELSE '👤 Manual'
  END as tipo_criacao,
  d.notes
FROM deliveries d
LEFT JOIN customers c ON c.id = d.customer_id
LEFT JOIN construction_projects cp ON cp.id = d.construction_project_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
GROUP BY d.id, d.delivery_number, d.status, d.delivery_date, c.name, cp.name, d.auto_created, d.notes
ORDER BY d.created_at DESC
LIMIT 20;

-- Ver items de uma entrega específica
-- (Substitua 'ENT-XXX' pelo número da entrega)
SELECT
  CASE
    WHEN di.product_id IS NOT NULL THEN '🔨 Produto'
    WHEN di.material_id IS NOT NULL THEN '📦 Material'
    WHEN di.composition_id IS NOT NULL THEN '📋 Composição'
  END as tipo,
  COALESCE(
    p.name,
    m.name,
    c.name,
    'Item sem nome'
  ) as nome,
  COALESCE(
    p.code,
    ''
  ) as codigo,
  di.quantity as quantidade,
  di.unit_price as preco_unitario,
  di.notes as observacoes
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
LEFT JOIN products p ON p.id = di.product_id
LEFT JOIN materials m ON m.id = di.material_id
LEFT JOIN compositions c ON c.id = di.composition_id
WHERE d.delivery_number = 'ENT-XXX'  -- <-- SUBSTITUA AQUI
ORDER BY tipo, nome;

-- Verificar entregas que NÃO tem items
-- (Pode indicar problema no carregamento)
SELECT
  d.delivery_number,
  d.status,
  d.delivery_date,
  c.name as cliente,
  d.notes,
  COUNT(di.id) as total_items
FROM deliveries d
LEFT JOIN customers c ON c.id = d.customer_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
GROUP BY d.id, d.delivery_number, d.status, d.delivery_date, c.name, d.notes
HAVING COUNT(di.id) = 0
ORDER BY d.created_at DESC;

-- Items por tipo em uma entrega
SELECT
  d.delivery_number,
  CASE
    WHEN di.product_id IS NOT NULL THEN 'Produto'
    WHEN di.material_id IS NOT NULL THEN 'Material'
    WHEN di.composition_id IS NOT NULL THEN 'Composição'
  END as tipo_item,
  COUNT(*) as quantidade_items,
  SUM(di.quantity) as quantidade_total
FROM deliveries d
JOIN delivery_items di ON di.delivery_id = d.id
WHERE d.delivery_number = 'ENT-XXX'  -- <-- SUBSTITUA AQUI
GROUP BY d.delivery_number, tipo_item
ORDER BY tipo_item;

-- ============================================
-- 3. VERIFICAR ITEMS DA OBRA
-- ============================================

-- Ver todos os items de uma obra com status
SELECT
  cqi.item_type,
  CASE cqi.item_type
    WHEN 'product' THEN '🔨'
    WHEN 'material' THEN '📦'
  END as emoji,
  COALESCE(p.name, m.name) as item_nome,
  cqi.quantity_required as necessario,
  cqi.quantity_in_stock as em_estoque,
  cqi.quantity_to_produce as a_produzir,
  cqi.unit as unidade,
  cqi.status,
  CASE cqi.status
    WHEN 'in_production' THEN '🔴'
    WHEN 'partially_available' THEN '🟡'
    WHEN 'available_for_delivery' THEN '🟢'
    WHEN 'delivered' THEN '⚪'
  END as status_emoji,
  po.order_number as ordem,
  po.status as status_ordem,
  d.delivery_number as entrega
FROM construction_quote_items cqi
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
LEFT JOIN deliveries d ON d.id = cqi.delivery_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI
ORDER BY
  cqi.item_type,
  CASE cqi.status
    WHEN 'in_production' THEN 1
    WHEN 'partially_available' THEN 2
    WHEN 'available_for_delivery' THEN 3
    WHEN 'delivered' THEN 4
  END,
  cqi.created_at;

-- Resumo de items por status e tipo
SELECT
  cqi.item_type as tipo,
  cqi.status,
  COUNT(*) as total_items,
  SUM(cqi.quantity_required) as qtd_total_necessaria,
  SUM(cqi.quantity_in_stock) as qtd_total_estoque,
  SUM(cqi.quantity_to_produce) as qtd_total_produzir,
  COUNT(cqi.production_order_id) as com_ordem_producao,
  COUNT(cqi.delivery_id) as com_entrega
FROM construction_quote_items cqi
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI
GROUP BY cqi.item_type, cqi.status
ORDER BY cqi.item_type, cqi.status;

-- ============================================
-- 4. VERIFICAR FLUXO COMPLETO
-- ============================================

-- Ver o fluxo completo de um orçamento vinculado
SELECT
  'Obra' as etapa,
  cp.name as nome,
  cp.status as status,
  NULL::text as quantidade,
  NULL::text as observacao
FROM construction_projects cp
WHERE cp.id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI

UNION ALL

SELECT
  'Item da Obra' as etapa,
  COALESCE(p.name, m.name) as nome,
  cqi.status as status,
  cqi.quantity_required::text as quantidade,
  cqi.item_type as observacao
FROM construction_quote_items cqi
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI

UNION ALL

SELECT
  'Ordem de Produção' as etapa,
  po.order_number as nome,
  po.status as status,
  po.quantity::text as quantidade,
  p.name as observacao
FROM construction_quote_items cqi
JOIN production_orders po ON po.id = cqi.production_order_id
JOIN products p ON p.id = po.product_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI

UNION ALL

SELECT
  'Entrega' as etapa,
  d.delivery_number as nome,
  d.status as status,
  COUNT(di.id)::text as quantidade,
  'items' as observacao
FROM construction_quote_items cqi
JOIN deliveries d ON d.id = cqi.delivery_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI
GROUP BY d.id, d.delivery_number, d.status

ORDER BY etapa, nome;

-- ============================================
-- 5. ESTATÍSTICAS GERAIS
-- ============================================

-- Estatísticas de ordens criadas hoje
SELECT
  COUNT(*) as total_ordens_hoje,
  COUNT(CASE WHEN notes LIKE '%Ordem para obra%' THEN 1 END) as ordens_para_obras,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as ordens_abertas,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as ordens_em_progresso,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as ordens_concluidas,
  SUM(quantity) as quantidade_total
FROM production_orders
WHERE DATE(created_at) = CURRENT_DATE;

-- Estatísticas de entregas criadas hoje
SELECT
  COUNT(*) as total_entregas_hoje,
  COUNT(CASE WHEN auto_created THEN 1 END) as entregas_automaticas,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as entregas_abertas,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as entregas_em_progresso,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as entregas_finalizadas
FROM deliveries
WHERE DATE(created_at) = CURRENT_DATE;

-- Estatísticas de items por status
SELECT
  status,
  COUNT(*) as total,
  COUNT(CASE WHEN item_type = 'product' THEN 1 END) as produtos,
  COUNT(CASE WHEN item_type = 'material' THEN 1 END) as materiais
FROM construction_quote_items
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status
ORDER BY
  CASE status
    WHEN 'in_production' THEN 1
    WHEN 'partially_available' THEN 2
    WHEN 'available_for_delivery' THEN 3
    WHEN 'delivered' THEN 4
  END;

-- ============================================
-- 6. DIAGNÓSTICO DE PROBLEMAS
-- ============================================

-- Produtos sem estoque que NÃO tem ordem
-- (Deve retornar 0 após correção)
SELECT
  'ERRO' as nivel,
  'Produto sem ordem' as problema,
  cp.name as obra,
  p.name as produto,
  cqi.quantity_to_produce as quantidade,
  cqi.created_at
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
LEFT JOIN products p ON p.id = cqi.product_id
WHERE cqi.item_type = 'product'
  AND cqi.quantity_to_produce > 0
  AND cqi.production_order_id IS NULL;

-- Entregas sem items
-- (Pode ser normal, mas vale verificar)
SELECT
  'AVISO' as nivel,
  'Entrega sem items' as problema,
  d.delivery_number,
  d.status,
  d.notes,
  d.created_at
FROM deliveries d
LEFT JOIN delivery_items di ON di.delivery_id = d.id
GROUP BY d.id, d.delivery_number, d.status, d.notes, d.created_at
HAVING COUNT(di.id) = 0
ORDER BY d.created_at DESC;

-- Items com status inconsistente
-- (Item diz "available_for_delivery" mas ordem ainda não foi concluída)
SELECT
  'AVISO' as nivel,
  'Status inconsistente' as problema,
  cp.name as obra,
  COALESCE(p.name, m.name) as item,
  cqi.status as status_item,
  po.status as status_ordem
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
WHERE cqi.status = 'available_for_delivery'
  AND cqi.production_order_id IS NOT NULL
  AND po.status != 'completed';

-- ============================================
-- 7. QUERIES DE LIMPEZA (CUIDADO!)
-- ============================================

-- Ver items que podem ser deletados para teste
-- (NÃO execute o DELETE sem confirmar!)
SELECT
  'DELETE' as acao,
  cqi.id,
  cp.name as obra,
  COALESCE(p.name, m.name) as item,
  cqi.created_at,
  'DELETE FROM construction_quote_items WHERE id = ''' || cqi.id || ''';' as comando_sql
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'  -- <-- SUBSTITUA AQUI
ORDER BY cqi.created_at DESC;

-- ============================================
-- FIM DAS QUERIES
-- ============================================

/*
COMO USAR ESTE ARQUIVO:

1. VERIFICAÇÃO RÁPIDA:
   - Execute as queries da seção 1 e 2
   - Confirme que ordens foram criadas
   - Confirme que entregas têm items

2. VERIFICAÇÃO DETALHADA:
   - Execute as queries da seção 3 e 4
   - Substitua 'UUID_DA_OBRA' pelo ID real
   - Verifique o fluxo completo

3. DIAGNÓSTICO:
   - Execute as queries da seção 6
   - Se retornar alguma linha em "ERRO", há problema
   - Se retornar em "AVISO", investigue

4. ESTATÍSTICAS:
   - Execute as queries da seção 5
   - Use para relatórios e acompanhamento

DICAS:
- Sempre substitua os UUIDs de exemplo
- Use CTRL+F para encontrar "SUBSTITUA AQUI"
- Execute uma query por vez
- Verifique os resultados antes de executar DELETE

Boa sorte! 🚀
*/
