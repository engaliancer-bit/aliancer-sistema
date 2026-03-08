-- ============================================
-- TESTE: Projetos À Cobrar (incluindo Registrado)
-- ============================================
-- Este arquivo testa a correção da view projects_to_collect
-- para incluir projetos com status "registrado"

-- 1. Verificar a view projects_to_collect atual
SELECT
  project_name,
  status,
  grand_total,
  total_received,
  balance_due,
  customer_name
FROM projects_to_collect
ORDER BY status, project_name;

-- Resultado esperado:
-- Deve incluir projetos com status 'finalizado', 'entregue' E 'registrado'
-- Todos devem ter balance_due > 0

-- ============================================
-- 2. Verificar todos os projetos por status (comparação)
-- ============================================
SELECT
  status,
  COUNT(*) as total_projetos,
  COUNT(CASE WHEN balance > 0 THEN 1 END) as com_saldo_devedor,
  SUM(balance) as total_saldo_devedor
FROM engineering_projects
GROUP BY status
ORDER BY status;

-- ============================================
-- 3. Teste específico: Projetos Registrados com saldo
-- ============================================
SELECT
  ep.id,
  ep.name,
  ep.status,
  ep.grand_total,
  ep.total_received,
  ep.balance,
  c.name as customer_name,
  CASE
    WHEN ep.id IN (SELECT id FROM projects_to_collect) THEN '✓ Aparece em À Cobrar'
    ELSE '✗ NÃO aparece em À Cobrar'
  END as status_aba_cobrar
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
WHERE ep.status = 'registrado'
ORDER BY ep.balance DESC;

-- Resultado esperado:
-- Projetos com balance > 0 devem aparecer em "À Cobrar"
-- Projetos com balance = 0 NÃO devem aparecer

-- ============================================
-- 4. Teste de validação completa
-- ============================================
-- Verificar se TODOS os projetos que deveriam aparecer estão na view
SELECT
  'Projetos que DEVEM aparecer' as tipo,
  COUNT(*) as quantidade
FROM engineering_projects
WHERE status IN ('finalizado', 'entregue', 'registrado')
  AND balance > 0

UNION ALL

SELECT
  'Projetos na view' as tipo,
  COUNT(*) as quantidade
FROM projects_to_collect;

-- Resultado esperado: As duas linhas devem ter o MESMO número

-- ============================================
-- 5. Identificar discrepâncias (se houver)
-- ============================================
-- Projetos que DEVERIAM estar na view mas não estão
SELECT
  ep.id,
  ep.name,
  ep.status,
  ep.balance,
  'DEVERIA aparecer mas NÃO está na view' as problema
FROM engineering_projects ep
WHERE ep.status IN ('finalizado', 'entregue', 'registrado')
  AND ep.balance > 0
  AND ep.id NOT IN (SELECT id FROM projects_to_collect);

-- Resultado esperado: Nenhum resultado (tabela vazia)

-- ============================================
-- 6. Teste de remoção automática (saldo zero)
-- ============================================
-- Verificar se projetos com saldo zero NÃO aparecem
SELECT
  ep.id,
  ep.name,
  ep.status,
  ep.balance,
  'NÃO deveria aparecer (saldo zero)' as problema
FROM engineering_projects ep
WHERE ep.status IN ('finalizado', 'entregue', 'registrado')
  AND ep.balance = 0
  AND ep.id IN (SELECT id FROM projects_to_collect);

-- Resultado esperado: Nenhum resultado (tabela vazia)

-- ============================================
-- 7. Resumo por status na aba À Cobrar
-- ============================================
SELECT
  status,
  COUNT(*) as quantidade,
  SUM(balance_due) as total_a_receber,
  AVG(balance_due) as media_por_projeto
FROM projects_to_collect
GROUP BY status
ORDER BY status;

-- Resultado esperado:
-- Deve mostrar contagens para 'finalizado', 'entregue' E 'registrado'

-- ============================================
-- COMO INTERPRETAR OS RESULTADOS
-- ============================================
-- ✓ CORRETO:
--   - Query 3 mostra projetos registrados com balance > 0 marcados como "✓ Aparece em À Cobrar"
--   - Query 4 mostra números iguais nas duas linhas
--   - Query 5 não retorna nenhum registro
--   - Query 6 não retorna nenhum registro
--   - Query 7 mostra todos os 3 status (finalizado, entregue, registrado)
--
-- ✗ PROBLEMA:
--   - Se Query 3 mostrar projetos registrados com "✗ NÃO aparece"
--   - Se Query 4 mostrar números diferentes
--   - Se Query 5 ou 6 retornarem registros
--   - Se Query 7 não mostrar o status 'registrado'
