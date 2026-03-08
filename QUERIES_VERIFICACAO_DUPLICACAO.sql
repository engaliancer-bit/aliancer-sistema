-- =====================================================
-- QUERIES DE VERIFICAÇÃO DE DUPLICAÇÃO
-- Orçamentos vinculados a Obras
-- =====================================================

-- 1. VERIFICAR DUPLICAÇÕES EM construction_work_items
-- Esta query mostra orçamentos que foram vinculados mais de uma vez à mesma obra

SELECT
  cw.work_name as obra,
  c.name as cliente,
  q.id as orcamento_id,
  COUNT(cwi.id) as quantidade_itens_duplicados,
  STRING_AGG(DISTINCT cwi.item_name, ', ') as itens
FROM construction_work_items cwi
JOIN construction_works cw ON cw.id = cwi.work_id
JOIN quotes q ON q.id = cwi.quote_id
JOIN customers c ON c.id = q.customer_id
GROUP BY cw.work_name, c.name, q.id, cwi.work_id, cwi.quote_id
HAVING COUNT(cwi.id) > (
  SELECT COUNT(DISTINCT qi.id)
  FROM quote_items qi
  WHERE qi.quote_id = q.id
)
ORDER BY quantidade_itens_duplicados DESC;

-- 2. VERIFICAR DUPLICAÇÕES EM construction_quote_items
-- Esta query mostra orçamentos que foram processados mais de uma vez para a mesma obra

SELECT
  cp.name as obra,
  q.id as orcamento_id,
  cqi.quote_type,
  COUNT(cqi.id) as total_itens,
  COUNT(DISTINCT cqi.quote_item_id) as itens_unicos,
  COUNT(cqi.id) - COUNT(DISTINCT cqi.quote_item_id) as duplicados
FROM construction_quote_items cqi
JOIN construction_projects cp ON cp.id = cqi.construction_project_id
JOIN quotes q ON q.id = cqi.quote_id
GROUP BY cp.name, q.id, cqi.quote_type, cqi.construction_project_id
HAVING COUNT(cqi.id) > COUNT(DISTINCT cqi.quote_item_id)
ORDER BY duplicados DESC;

-- 3. LISTAR TODOS OS ORÇAMENTOS VINCULADOS COM SUAS QUANTIDADES
-- Para auditoria geral

SELECT
  q.id as orcamento_id,
  c.name as cliente,
  q.status,
  q.created_at,
  (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as itens_orcamento,
  (SELECT COUNT(*) FROM construction_work_items WHERE quote_id = q.id) as itens_vinculados_obra,
  (SELECT COUNT(*) FROM construction_quote_items WHERE quote_id = q.id) as itens_processados,
  CASE
    WHEN (SELECT COUNT(*) FROM construction_work_items WHERE quote_id = q.id) >
         (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id)
    THEN '⚠️ DUPLICAÇÃO DETECTADA'
    ELSE '✓ OK'
  END as status_duplicacao
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE q.status = 'approved'
ORDER BY q.created_at DESC;

-- 4. VERIFICAR SE HÁ ITENS DO MESMO ORÇAMENTO EM MÚLTIPLAS OBRAS
-- Útil para detectar se um orçamento foi vinculado a várias obras diferentes

SELECT
  q.id as orcamento_id,
  c.name as cliente,
  COUNT(DISTINCT cwi.work_id) as quantidade_obras_vinculadas,
  STRING_AGG(DISTINCT cw.work_name, ', ') as obras
FROM quotes q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN construction_work_items cwi ON cwi.quote_id = q.id
LEFT JOIN construction_works cw ON cw.id = cwi.work_id
WHERE q.status = 'approved'
GROUP BY q.id, c.name
HAVING COUNT(DISTINCT cwi.work_id) > 1
ORDER BY quantidade_obras_vinculadas DESC;

-- 5. VERIFICAR INTEGRIDADE: Itens sem referência válida
-- Esta query encontra itens órfãos ou com referências quebradas

SELECT
  'construction_work_items' as tabela,
  cwi.id,
  cwi.item_name,
  cwi.quote_id,
  CASE
    WHEN q.id IS NULL THEN '⚠️ Orçamento não existe'
    WHEN cw.id IS NULL THEN '⚠️ Obra não existe'
    ELSE '✓ OK'
  END as problema
FROM construction_work_items cwi
LEFT JOIN quotes q ON q.id = cwi.quote_id
LEFT JOIN construction_works cw ON cw.id = cwi.work_id
WHERE q.id IS NULL OR cw.id IS NULL

UNION ALL

SELECT
  'construction_quote_items' as tabela,
  cqi.id,
  'Item processado' as item_name,
  cqi.quote_id,
  CASE
    WHEN q.id IS NULL THEN '⚠️ Orçamento não existe'
    WHEN cp.id IS NULL THEN '⚠️ Obra não existe'
    ELSE '✓ OK'
  END as problema
FROM construction_quote_items cqi
LEFT JOIN quotes q ON q.id = cqi.quote_id
LEFT JOIN construction_projects cp ON cp.id = cqi.construction_project_id
WHERE q.id IS NULL OR cp.id IS NULL;

-- 6. HISTÓRICO DE VINCULAÇÕES POR ORÇAMENTO
-- Para ver quando e quantas vezes um orçamento foi vinculado

SELECT
  q.id as orcamento_id,
  c.name as cliente,
  q.status,
  q.created_at as data_criacao,
  q.updated_at as data_ultima_atualizacao,
  (SELECT COUNT(*) FROM construction_work_items WHERE quote_id = q.id) as total_itens_vinculados,
  (SELECT COUNT(DISTINCT work_id) FROM construction_work_items WHERE quote_id = q.id) as obras_distintas,
  (SELECT STRING_AGG(DISTINCT cw.work_name, ', ')
   FROM construction_work_items cwi
   JOIN construction_works cw ON cw.id = cwi.work_id
   WHERE cwi.quote_id = q.id) as nomes_obras
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE EXISTS (SELECT 1 FROM construction_work_items WHERE quote_id = q.id)
ORDER BY q.updated_at DESC;

-- 7. TESTAR PROTEÇÃO CONTRA DUPLICAÇÃO
-- Esta query simula a verificação que a função RPC faz

WITH verificacao AS (
  SELECT
    q.id as quote_id,
    cw.id as work_id,
    COUNT(cwi.id) as itens_existentes
  FROM quotes q
  CROSS JOIN construction_works cw
  LEFT JOIN construction_work_items cwi ON cwi.quote_id = q.id AND cwi.work_id = cw.id
  WHERE q.status = 'approved'
  GROUP BY q.id, cw.id
)
SELECT
  c.name as cliente,
  q.id as orcamento_id,
  cw.work_name as obra,
  v.itens_existentes,
  CASE
    WHEN v.itens_existentes > 0 THEN '🛡️ BLOQUEADO (já vinculado)'
    ELSE '✅ LIBERADO para vinculação'
  END as status_protecao
FROM verificacao v
JOIN quotes q ON q.id = v.quote_id
JOIN customers c ON c.id = q.customer_id
JOIN construction_works cw ON cw.id = v.work_id
ORDER BY v.itens_existentes DESC, c.name;

-- =====================================================
-- QUERIES DE LIMPEZA (USE COM CUIDADO!)
-- =====================================================

-- 8. IDENTIFICAR DUPLICATAS PARA REMOÇÃO MANUAL
-- Esta query identifica quais registros são duplicados
-- NÃO REMOVE automaticamente - apenas mostra o que poderia ser removido

WITH itens_numerados AS (
  SELECT
    id,
    quote_id,
    work_id,
    item_name,
    ROW_NUMBER() OVER (
      PARTITION BY quote_id, work_id, quote_item_id
      ORDER BY created_at
    ) as numero_sequencial
  FROM construction_work_items
)
SELECT
  id,
  quote_id,
  work_id,
  item_name,
  'Duplicado - pode ser removido' as acao_sugerida
FROM itens_numerados
WHERE numero_sequencial > 1
ORDER BY quote_id, work_id;

-- Para ver a quantidade total de duplicatas:
WITH itens_numerados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY quote_id, work_id, quote_item_id
      ORDER BY created_at
    ) as numero_sequencial
  FROM construction_work_items
)
SELECT
  COUNT(*) as total_duplicatas_encontradas
FROM itens_numerados
WHERE numero_sequencial > 1;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

-- 1. As queries 1-7 são SOMENTE LEITURA e seguras para executar
-- 2. A query 8 identifica duplicatas mas NÃO remove
-- 3. Se encontrar duplicatas, avalie cuidadosamente antes de remover
-- 4. Faça backup antes de qualquer operação de limpeza
-- 5. As proteções implementadas previnem NOVAS duplicações
-- 6. Duplicatas antigas precisam ser avaliadas caso a caso
