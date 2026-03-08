-- =====================================================
-- QUERIES DE TESTE: PAGAMENTOS DE PROJETOS DE ENGENHARIA
-- =====================================================

-- =====================================================
-- 1. VERIFICAR ESTRUTURA ATUALIZADA
-- =====================================================

-- Verificar colunas da tabela engineering_project_payments
SELECT
  column_name as "Coluna",
  data_type as "Tipo",
  is_nullable as "Nulável",
  column_default as "Padrão"
FROM information_schema.columns
WHERE table_name = 'engineering_project_payments'
ORDER BY ordinal_position;

-- Resultado esperado: deve ter conta_caixa_id (não account_id)


-- =====================================================
-- 2. VERIFICAR TRIGGERS ATIVOS
-- =====================================================

SELECT
  trigger_name as "Nome do Trigger",
  event_manipulation as "Evento",
  action_statement as "Função"
FROM information_schema.triggers
WHERE event_object_table = 'engineering_project_payments'
ORDER BY trigger_name, event_manipulation;

-- Resultado esperado:
-- - integrate_payment_cash_flow (INSERT, DELETE)
-- - update_total_received_on_insert (INSERT)
-- - update_total_received_on_update (UPDATE)
-- - update_total_received_on_delete (DELETE)


-- =====================================================
-- 3. LISTAR PROJETOS DISPONÍVEIS PARA TESTE
-- =====================================================

SELECT
  p.id,
  p.name as "Projeto",
  c.name as "Cliente",
  p.grand_total as "Total R$",
  p.total_received as "Recebido R$",
  p.balance as "Saldo R$",
  p.status as "Status",
  (SELECT COUNT(*) FROM engineering_project_payments WHERE project_id = p.id) as "Nº Pagamentos"
FROM engineering_projects p
LEFT JOIN customers c ON c.id = p.customer_id
ORDER BY p.created_at DESC
LIMIT 10;


-- =====================================================
-- 4. LISTAR CONTAS DE CAIXA DISPONÍVEIS
-- =====================================================

SELECT
  id,
  nome as "Nome da Conta",
  tipo as "Tipo",
  saldo_atual as "Saldo Atual"
FROM contas_caixa
ORDER BY nome;


-- =====================================================
-- 5. HISTÓRICO DE PAGAMENTOS
-- =====================================================

SELECT
  proj.name as "Projeto",
  cust.name as "Cliente",
  pay.payment_date as "Data",
  pay.value as "Valor",
  pay.payment_method as "Método",
  cc.nome as "Conta Caixa",
  pay.notes as "Observações",
  to_char(pay.created_at, 'DD/MM/YYYY HH24:MI') as "Registrado em"
FROM engineering_project_payments pay
JOIN engineering_projects proj ON proj.id = pay.project_id
LEFT JOIN customers cust ON cust.id = proj.customer_id
LEFT JOIN contas_caixa cc ON cc.id = pay.conta_caixa_id
ORDER BY pay.payment_date DESC, pay.created_at DESC;


-- =====================================================
-- 6. VERIFICAR INTEGRAÇÃO COM CASH FLOW
-- =====================================================

-- Ver pagamentos e suas entradas no cash_flow
SELECT
  p.name as "Projeto",
  pay.payment_date as "Data Pag",
  pay.value as "Valor Pag",
  pay.payment_method as "Método",
  -- Informações do cash_flow
  cf.date as "Data CF",
  cf.amount as "Valor CF",
  cf.category as "Categoria CF",
  cf.business_unit as "Unidade",
  -- Validação
  CASE
    WHEN cf.id IS NULL THEN '❌ Falta entrada no CF'
    WHEN pay.value != cf.amount THEN '⚠️ Valores diferentes'
    WHEN pay.payment_date != cf.date THEN '⚠️ Datas diferentes'
    ELSE '✅ OK'
  END as "Status"
FROM engineering_project_payments pay
JOIN engineering_projects p ON p.id = pay.project_id
LEFT JOIN cash_flow cf ON
  cf.date = pay.payment_date
  AND cf.amount = pay.value
  AND cf.category = 'Serviços de Engenharia'
  AND cf.business_unit = 'engineering'
ORDER BY pay.payment_date DESC;


-- =====================================================
-- 7. RESUMO FINANCEIRO POR PROJETO
-- =====================================================

SELECT
  p.name as "Projeto",
  c.name as "Cliente",
  p.grand_total as "Total",
  p.total_received as "Recebido",
  p.balance as "Saldo",
  ROUND((p.total_received / NULLIF(p.grand_total, 0) * 100), 1) as "% Recebido",
  p.status as "Status",
  -- Validação
  (SELECT COALESCE(SUM(value), 0)
   FROM engineering_project_payments
   WHERE project_id = p.id) as "Verificação Manual",
  CASE
    WHEN p.total_received = (
      SELECT COALESCE(SUM(value), 0)
      FROM engineering_project_payments
      WHERE project_id = p.id
    ) THEN '✅ Correto'
    ELSE '❌ Divergente'
  END as "Validação"
FROM engineering_projects p
LEFT JOIN customers c ON c.id = p.customer_id
ORDER BY p.created_at DESC;


-- =====================================================
-- 8. PAGAMENTOS RECENTES (ÚLTIMOS 30 DIAS)
-- =====================================================

SELECT
  p.name as "Projeto",
  c.name as "Cliente",
  pay.payment_date as "Data",
  pay.value as "Valor",
  pay.payment_method as "Método",
  cc.nome as "Conta",
  AGE(CURRENT_DATE, pay.payment_date) as "Há quanto tempo"
FROM engineering_project_payments pay
JOIN engineering_projects p ON p.id = pay.project_id
LEFT JOIN customers c ON c.id = p.customer_id
LEFT JOIN contas_caixa cc ON cc.id = pay.conta_caixa_id
WHERE pay.payment_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY pay.payment_date DESC;


-- =====================================================
-- 9. PROJETOS COM SALDO PENDENTE
-- =====================================================

SELECT
  p.name as "Projeto",
  c.name as "Cliente",
  p.grand_total as "Total",
  p.total_received as "Recebido",
  p.balance as "Saldo Pendente",
  ROUND((p.balance / NULLIF(p.grand_total, 0) * 100), 1) as "% Pendente",
  (SELECT COUNT(*)
   FROM engineering_project_payments
   WHERE project_id = p.id) as "Nº Pagamentos",
  CASE
    WHEN p.balance = 0 THEN '✅ Quitado'
    WHEN p.balance < p.grand_total * 0.5 THEN '🟡 Mais de 50% pago'
    ELSE '🔴 Menos de 50% pago'
  END as "Situação"
FROM engineering_projects p
LEFT JOIN customers c ON c.id = p.customer_id
WHERE p.balance > 0
ORDER BY p.balance DESC;


-- =====================================================
-- 10. AUDITORIA: INTEGRIDADE DOS DADOS
-- =====================================================

-- Verificar se todos os pagamentos têm entrada no cash_flow
WITH pagamentos_com_cf AS (
  SELECT
    pay.id,
    pay.value,
    pay.payment_date,
    cf.id as cash_flow_id
  FROM engineering_project_payments pay
  LEFT JOIN cash_flow cf ON
    cf.date = pay.payment_date
    AND cf.amount = pay.value
    AND cf.category = 'Serviços de Engenharia'
    AND cf.business_unit = 'engineering'
)
SELECT
  COUNT(*) as "Total Pagamentos",
  COUNT(cash_flow_id) as "Com Entrada no CF",
  COUNT(*) - COUNT(cash_flow_id) as "Sem Entrada no CF",
  CASE
    WHEN COUNT(*) = COUNT(cash_flow_id) THEN '✅ Todos integrados'
    ELSE '❌ Faltam ' || (COUNT(*) - COUNT(cash_flow_id)) || ' entradas'
  END as "Status"
FROM pagamentos_com_cf;


-- =====================================================
-- 11. AUDITORIA: TOTAIS DOS PROJETOS
-- =====================================================

-- Verificar se total_received está correto
SELECT
  p.name as "Projeto",
  p.total_received as "Total no Sistema",
  COALESCE((
    SELECT SUM(value)
    FROM engineering_project_payments
    WHERE project_id = p.id
  ), 0) as "Total Real",
  ABS(p.total_received - COALESCE((
    SELECT SUM(value)
    FROM engineering_project_payments
    WHERE project_id = p.id
  ), 0)) as "Diferença",
  CASE
    WHEN p.total_received = COALESCE((
      SELECT SUM(value)
      FROM engineering_project_payments
      WHERE project_id = p.id
    ), 0) THEN '✅ Correto'
    ELSE '❌ Divergente'
  END as "Status"
FROM engineering_projects p
ORDER BY p.created_at DESC;


-- =====================================================
-- 12. ESTATÍSTICAS GERAIS
-- =====================================================

SELECT
  'Total de Projetos' as "Métrica",
  COUNT(*)::text as "Valor"
FROM engineering_projects

UNION ALL

SELECT
  'Projetos com Pagamentos',
  COUNT(DISTINCT project_id)::text
FROM engineering_project_payments

UNION ALL

SELECT
  'Total de Pagamentos',
  COUNT(*)::text
FROM engineering_project_payments

UNION ALL

SELECT
  'Valor Total em Projetos',
  'R$ ' || TO_CHAR(SUM(grand_total), 'FM999,999,990.00')
FROM engineering_projects

UNION ALL

SELECT
  'Valor Total Recebido',
  'R$ ' || TO_CHAR(SUM(total_received), 'FM999,999,990.00')
FROM engineering_projects

UNION ALL

SELECT
  'Saldo Total Pendente',
  'R$ ' || TO_CHAR(SUM(balance), 'FM999,999,990.00')
FROM engineering_projects

UNION ALL

SELECT
  'Média de Valor por Projeto',
  'R$ ' || TO_CHAR(AVG(grand_total), 'FM999,999,990.00')
FROM engineering_projects

UNION ALL

SELECT
  '% Médio Recebido',
  ROUND(AVG(total_received / NULLIF(grand_total, 0) * 100), 1)::text || '%'
FROM engineering_projects
WHERE grand_total > 0;


-- =====================================================
-- 13. DETALHES DE UM PROJETO ESPECÍFICO
-- =====================================================

-- Substitua 'ID-DO-PROJETO' pelo ID real
DO $$
DECLARE
  v_project_id uuid := 'COPIE-ID-DO-PROJETO-AQUI';
BEGIN
  -- Informações do projeto
  RAISE NOTICE '=== INFORMAÇÕES DO PROJETO ===';
  PERFORM pg_notify('notice',
    format('Projeto: %s | Cliente: %s | Total: R$ %s',
      p.name, c.name, p.grand_total::text)
  )
  FROM engineering_projects p
  LEFT JOIN customers c ON c.id = p.customer_id
  WHERE p.id = v_project_id;

  -- Pagamentos
  RAISE NOTICE '=== PAGAMENTOS ===';
  FOR rec IN
    SELECT
      payment_date,
      value,
      payment_method,
      notes
    FROM engineering_project_payments
    WHERE project_id = v_project_id
    ORDER BY payment_date
  LOOP
    RAISE NOTICE 'Data: % | Valor: R$ % | Método: % | Obs: %',
      rec.payment_date, rec.value, rec.payment_method, COALESCE(rec.notes, '-');
  END LOOP;
END $$;


-- =====================================================
-- 14. BUSCAR PROJETO POR NOME
-- =====================================================

-- Substitua 'MILTON' pelo nome ou parte do nome
SELECT
  p.id,
  p.name as "Projeto",
  c.name as "Cliente",
  p.grand_total as "Total",
  p.total_received as "Recebido",
  p.balance as "Saldo",
  (SELECT COUNT(*)
   FROM engineering_project_payments
   WHERE project_id = p.id) as "Nº Pagamentos"
FROM engineering_projects p
LEFT JOIN customers c ON c.id = p.customer_id
WHERE p.name ILIKE '%MILTON%'
   OR c.name ILIKE '%MILTON%'
ORDER BY p.created_at DESC;


-- =====================================================
-- 15. TESTE DE PERFORMANCE DO TRIGGER
-- =====================================================

-- Este comando explica como o trigger funciona
EXPLAIN ANALYZE
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'integrate_payment_to_cash_flow';


-- =====================================================
-- 16. ÚLTIMA ATIVIDADE (PAGAMENTOS RECENTES)
-- =====================================================

SELECT
  p.name as "Projeto",
  pay.payment_date as "Data Pagamento",
  pay.value as "Valor",
  to_char(pay.created_at, 'DD/MM/YYYY HH24:MI:SS') as "Registrado em",
  AGE(now(), pay.created_at) as "Há quanto tempo"
FROM engineering_project_payments pay
JOIN engineering_projects p ON p.id = pay.project_id
ORDER BY pay.created_at DESC
LIMIT 10;
