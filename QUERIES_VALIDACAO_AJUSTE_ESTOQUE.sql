/*
  QUERIES DE VALIDAÇÃO - CORREÇÃO DE AJUSTE DE ESTOQUE

  Execute estas queries para validar que a correção está funcionando corretamente.
*/

-- ============================================================================
-- 1. VERIFICAR AJUSTES DE ESTOQUE MARCADOS CORRETAMENTE
-- ============================================================================
-- Esta query mostra todos os ajustes de estoque que foram identificados
-- Todos devem ter production_type = 'adjustment'

SELECT
  id,
  product_id,
  quantity,
  production_date,
  production_type,
  notes,
  created_at
FROM production
WHERE production_type = 'adjustment'
ORDER BY production_date DESC;

-- Resultado esperado:
-- Todos os registros de ajustes devem aparecer com production_type = 'adjustment'


-- ============================================================================
-- 2. CONFIRMAR QUE AJUSTES NÃO TÊM MOVIMENTAÇÕES DE INSUMOS
-- ============================================================================
-- Esta query busca ajustes que ainda tenham movimentações de insumos
-- O resultado DEVE SER VAZIO (nenhum registro)

SELECT
  p.id as production_id,
  p.production_type,
  p.quantity,
  p.production_date,
  p.notes as production_notes,
  COUNT(mm.id) as total_movimentacoes_insumos,
  STRING_AGG(m.name, ', ') as insumos_afetados
FROM production p
LEFT JOIN material_movements mm ON mm.production_id = p.id
LEFT JOIN materials m ON m.id = mm.material_id
WHERE p.production_type = 'adjustment'
GROUP BY p.id, p.production_type, p.quantity, p.production_date, p.notes
HAVING COUNT(mm.id) > 0;

-- Resultado esperado:
-- NENHUM REGISTRO (tabela vazia)
-- Se aparecer algum registro, significa que ainda há movimentações indevidas


-- ============================================================================
-- 3. VERIFICAR MOVIMENTAÇÕES DE UM INSUMO ESPECÍFICO
-- ============================================================================
-- Substitua 'NOME_DO_INSUMO' pelo insumo que você quer verificar
-- Exemplo: 'Areia Industrial', 'Cimento', etc.

SELECT
  mm.id,
  mm.movement_date,
  mm.movement_type,
  mm.quantity,
  mm.notes,
  p.production_type,
  p.notes as production_notes,
  pr.name as produto_relacionado
FROM material_movements mm
LEFT JOIN production p ON p.id = mm.production_id
LEFT JOIN products pr ON pr.id = p.product_id
WHERE mm.material_id IN (
  SELECT id FROM materials WHERE name ILIKE '%Areia Industrial%'
)
ORDER BY mm.movement_date DESC
LIMIT 20;

-- Resultado esperado:
-- Movimentações com production_type = 'adjustment' NÃO devem aparecer
-- Apenas movimentações de produções reais (type = 'stock' ou 'order')


-- ============================================================================
-- 4. RESUMO POR TIPO DE PRODUÇÃO
-- ============================================================================
-- Esta query mostra quantas produções de cada tipo existem
-- e quantas movimentações de insumos cada tipo gerou

SELECT
  p.production_type,
  COUNT(DISTINCT p.id) as total_producoes,
  COUNT(mm.id) as total_movimentacoes_insumos,
  CASE
    WHEN COUNT(DISTINCT p.id) > 0
    THEN ROUND(COUNT(mm.id)::numeric / COUNT(DISTINCT p.id), 2)
    ELSE 0
  END as media_movimentacoes_por_producao
FROM production p
LEFT JOIN material_movements mm ON mm.production_id = p.id AND mm.movement_type = 'saida'
GROUP BY p.production_type
ORDER BY p.production_type;

-- Resultado esperado:
-- adjustment: total_producoes > 0, total_movimentacoes = 0, media = 0.00
-- stock:      total_producoes > 0, total_movimentacoes > 0, media > 0
-- order:      total_producoes >= 0, total_movimentacoes >= 0, media >= 0


-- ============================================================================
-- 5. ÚLTIMAS PRODUÇÕES (TODOS OS TIPOS)
-- ============================================================================
-- Mostra as últimas produções e se geraram movimentações de insumos

SELECT
  p.id,
  p.production_date,
  p.production_type,
  pr.name as produto,
  p.quantity,
  COUNT(mm.id) as movimentacoes_insumos,
  p.notes
FROM production p
LEFT JOIN products pr ON pr.id = p.product_id
LEFT JOIN material_movements mm ON mm.production_id = p.id
GROUP BY p.id, p.production_date, p.production_type, pr.name, p.quantity, p.notes
ORDER BY p.created_at DESC
LIMIT 20;

-- Resultado esperado:
-- Produções com type 'adjustment' devem ter movimentacoes_insumos = 0
-- Produções com type 'stock' ou 'order' podem ter movimentacoes_insumos > 0


-- ============================================================================
-- 6. VERIFICAR MOVIMENTAÇÕES AUTOMÁTICAS SEM PRODUÇÃO ASSOCIADA
-- ============================================================================
-- Busca movimentações que foram criadas automaticamente mas não têm produção válida

SELECT
  mm.id,
  mm.movement_date,
  mm.material_id,
  m.name as material_name,
  mm.quantity,
  mm.notes,
  mm.production_id,
  p.production_type
FROM material_movements mm
LEFT JOIN materials m ON m.id = mm.material_id
LEFT JOIN production p ON p.id = mm.production_id
WHERE mm.notes LIKE 'Consumo automático%'
AND (
  mm.production_id IS NULL
  OR p.production_type = 'adjustment'
)
ORDER BY mm.movement_date DESC;

-- Resultado esperado:
-- NENHUM REGISTRO (tabela vazia)
-- Todas as movimentações automáticas devem estar vinculadas a produções reais


-- ============================================================================
-- 7. ESTATÍSTICAS DE AJUSTES POR PRODUTO
-- ============================================================================
-- Mostra quais produtos tiveram mais ajustes de estoque

SELECT
  pr.name as produto,
  COUNT(p.id) as total_ajustes,
  SUM(CASE WHEN p.quantity > 0 THEN p.quantity ELSE 0 END) as total_adicionado,
  SUM(CASE WHEN p.quantity < 0 THEN ABS(p.quantity) ELSE 0 END) as total_removido,
  MIN(p.production_date) as primeiro_ajuste,
  MAX(p.production_date) as ultimo_ajuste
FROM production p
JOIN products pr ON pr.id = p.product_id
WHERE p.production_type = 'adjustment'
GROUP BY pr.name
ORDER BY total_ajustes DESC
LIMIT 10;

-- Resultado esperado:
-- Lista dos produtos que tiveram ajustes de estoque
-- Útil para identificar produtos com divergências frequentes


-- ============================================================================
-- 8. VERIFICAR CONSISTÊNCIA DO ESTOQUE ATUAL
-- ============================================================================
-- Compara o estoque calculado com o esperado (após correção)
-- Nota: Esta query é complexa e pode demorar em bases grandes

WITH estoque_produtos AS (
  SELECT
    p.id as product_id,
    pr.name as produto,
    COALESCE(SUM(
      CASE
        WHEN p.production_type IN ('stock', 'order', 'adjustment') THEN p.quantity
        ELSE 0
      END
    ), 0) as total_producao,
    COALESCE((
      SELECT SUM(di.loaded_quantity)
      FROM delivery_items di
      WHERE di.product_id = pr.id
    ), 0) as total_entregue,
    COALESCE(SUM(
      CASE
        WHEN p.production_type IN ('stock', 'order', 'adjustment') THEN p.quantity
        ELSE 0
      END
    ), 0) - COALESCE((
      SELECT SUM(di.loaded_quantity)
      FROM delivery_items di
      WHERE di.product_id = pr.id
    ), 0) as estoque_calculado
  FROM products pr
  LEFT JOIN production p ON p.product_id = pr.id
  GROUP BY pr.id, pr.name
)
SELECT * FROM estoque_produtos
WHERE total_producao > 0
ORDER BY produto
LIMIT 20;

-- Resultado esperado:
-- Estoque calculado deve ser consistente
-- Ajustes (type=adjustment) são incluídos no cálculo do estoque


-- ============================================================================
-- 9. BUSCAR POSSÍVEIS AJUSTES NÃO MARCADOS
-- ============================================================================
-- Busca produções que parecem ser ajustes mas não estão marcadas

SELECT
  p.id,
  p.production_date,
  p.production_type,
  pr.name as produto,
  p.quantity,
  p.notes,
  COUNT(mm.id) as movimentacoes_insumos
FROM production p
JOIN products pr ON pr.id = p.product_id
LEFT JOIN material_movements mm ON mm.production_id = p.id
WHERE p.production_type != 'adjustment'
AND (
  p.notes ILIKE '%ajuste%'
  OR p.notes ILIKE '%correção%'
  OR p.notes ILIKE '%inventário%'
  OR p.notes ILIKE '%acerto%'
)
GROUP BY p.id, p.production_date, p.production_type, pr.name, p.quantity, p.notes
ORDER BY p.production_date DESC;

-- Resultado esperado:
-- Idealmente NENHUM REGISTRO
-- Se aparecer algo, são ajustes que não foram identificados automaticamente


-- ============================================================================
-- 10. QUERY DE CORREÇÃO MANUAL (SE NECESSÁRIO)
-- ============================================================================
-- Use esta query APENAS se encontrar ajustes não marcados na query anterior
-- IMPORTANTE: Substitua 'UUID-AQUI' pelo ID real da produção

/*
-- Descomente e edite se precisar corrigir manualmente:

-- Marcar como ajuste
UPDATE production
SET production_type = 'adjustment'
WHERE id = 'UUID-AQUI';

-- Remover movimentações indevidas
DELETE FROM material_movements
WHERE production_id = 'UUID-AQUI'
AND notes LIKE 'Consumo automático%';

-- Verificar a correção
SELECT * FROM production WHERE id = 'UUID-AQUI';
*/


-- ============================================================================
-- 11. ANÁLISE DE IMPACTO - INSUMOS AFETADOS PELA CORREÇÃO
-- ============================================================================
-- Mostra quais insumos tiveram movimentações removidas e o impacto no estoque

WITH movimentacoes_removidas AS (
  -- Esta query simula as movimentações que FORAM removidas
  -- (não é possível recuperar dados deletados, mas ajuda a entender o impacto)
  SELECT
    m.name as insumo,
    COUNT(*) as ajustes_que_afetaram
  FROM materials m
  WHERE m.id IN (
    SELECT DISTINCT ri.material_id
    FROM recipe_items ri
    JOIN products p ON p.recipe_id = ri.recipe_id
    JOIN production prod ON prod.product_id = p.id
    WHERE prod.production_type = 'adjustment'
  )
  GROUP BY m.name
)
SELECT * FROM movimentacoes_removidas
ORDER BY ajustes_que_afetaram DESC;

-- Resultado esperado:
-- Lista de insumos que foram afetados por ajustes de estoque
-- Útil para entender o impacto da correção


-- ============================================================================
-- RESUMO DE VALIDAÇÃO
-- ============================================================================
-- Execute todas as queries acima na ordem
-- Resultados esperados:
--
-- Query 1: Lista de ajustes identificados
-- Query 2: VAZIO (nenhum ajuste com movimentações)
-- Query 3: Sem ajustes nas movimentações do insumo
-- Query 4: Ajustes com média 0, produções reais com média > 0
-- Query 5: Ajustes sem movimentações, produções com movimentações
-- Query 6: VAZIO (sem movimentações órfãs)
-- Query 7: Estatísticas de ajustes por produto
-- Query 8: Estoque consistente
-- Query 9: VAZIO (nenhum ajuste não marcado)
-- Query 10: Usar apenas se necessário
-- Query 11: Insumos que foram afetados pela correção
