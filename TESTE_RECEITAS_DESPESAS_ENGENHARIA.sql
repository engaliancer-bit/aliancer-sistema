-- ============================================
-- TESTE: Sistema de Receitas/Despesas Engenharia
-- ============================================
-- Este arquivo testa o módulo completo de receitas/despesas

-- ============================================
-- 1. Verificar tabelas criadas
-- ============================================
SELECT
  'engineering_finance_entries' as tabela,
  COUNT(*) as total_registros
FROM engineering_finance_entries

UNION ALL

SELECT
  'engineering_project_advances' as tabela,
  COUNT(*) as total_registros
FROM engineering_project_advances;

-- ============================================
-- 2. Testar criação de antecipação
-- ============================================
-- Primeiro, vamos buscar um projeto para teste
SELECT
  p.id as project_id,
  p.name as project_name,
  p.customer_id,
  c.name as customer_name,
  p.grand_total,
  p.balance
FROM engineering_projects p
JOIN customers c ON c.id = p.customer_id
WHERE p.status != 'registrado'
LIMIT 1;

-- Usar os IDs acima para criar uma antecipação de teste (exemplo)
-- INSERT INTO engineering_project_advances (
--   project_id,
--   customer_id,
--   description,
--   amount,
--   advance_type,
--   advance_date
-- ) VALUES (
--   'UUID_DO_PROJETO',
--   'UUID_DO_CLIENTE',
--   'Teste: Taxa de registro',
--   500.00,
--   'taxa',
--   CURRENT_DATE
-- );

-- ============================================
-- 3. Verificar saldo financeiro geral
-- ============================================
SELECT * FROM get_engineering_finance_balance(NULL, NULL);

-- ============================================
-- 4. Verificar saldo financeiro do mês atual
-- ============================================
SELECT * FROM get_engineering_finance_balance(
  DATE_TRUNC('month', CURRENT_DATE)::date,
  (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
);

-- ============================================
-- 5. Listar todas as receitas
-- ============================================
SELECT
  entry_date,
  category,
  description,
  amount,
  CASE
    WHEN payment_id IS NOT NULL THEN 'Automática (Recebimento)'
    WHEN advance_id IS NOT NULL THEN 'Automática (Antecipação)'
    ELSE 'Manual'
  END as origem,
  status
FROM engineering_finance_entries
WHERE entry_type = 'receita'
ORDER BY entry_date DESC
LIMIT 20;

-- ============================================
-- 6. Listar todas as despesas
-- ============================================
SELECT
  entry_date,
  category,
  description,
  amount,
  CASE
    WHEN advance_id IS NOT NULL THEN 'Antecipação para Cliente'
    ELSE 'Despesa Normal'
  END as tipo_despesa,
  status
FROM engineering_finance_entries
WHERE entry_type = 'despesa'
ORDER BY entry_date DESC
LIMIT 20;

-- ============================================
-- 7. Resumo por categoria (mês atual)
-- ============================================
SELECT
  entry_type,
  category,
  COUNT(*) as qtd_lancamentos,
  SUM(amount) as total,
  SUM(CASE WHEN status = 'efetivado' THEN amount ELSE 0 END) as total_efetivado,
  SUM(CASE WHEN status = 'pendente' THEN amount ELSE 0 END) as total_pendente
FROM engineering_finance_entries
WHERE entry_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY entry_type, category
ORDER BY entry_type, total DESC;

-- ============================================
-- 8. Antecipações pendentes de reembolso
-- ============================================
SELECT
  pa.advance_date,
  pa.description,
  pa.amount,
  pa.advance_type,
  p.name as project_name,
  c.name as customer_name,
  p.balance as saldo_cliente,
  CASE
    WHEN pa.reimbursed THEN 'Reembolsada em ' || TO_CHAR(pa.reimbursed_date, 'DD/MM/YYYY')
    ELSE 'Pendente de reembolso'
  END as status_reembolso
FROM engineering_project_advances pa
JOIN engineering_projects p ON p.id = pa.project_id
JOIN customers c ON c.id = pa.customer_id
ORDER BY pa.reimbursed ASC, pa.advance_date DESC
LIMIT 20;

-- ============================================
-- 9. Verificar integração receitas x recebimentos
-- ============================================
-- Todos os recebimentos devem ter uma receita correspondente
SELECT
  pp.payment_date,
  pp.amount as valor_recebimento,
  pp.description,
  p.name as project_name,
  c.name as customer_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM engineering_finance_entries efe
      WHERE efe.payment_id = pp.id
    ) THEN '✓ Receita criada'
    ELSE '✗ Receita NÃO criada (PROBLEMA!)'
  END as status_integracao
FROM engineering_project_payments pp
JOIN engineering_projects p ON p.id = pp.project_id
JOIN customers c ON c.id = p.customer_id
ORDER BY pp.payment_date DESC
LIMIT 20;

-- ============================================
-- 10. Verificar integridade: antecipações x despesas
-- ============================================
-- Todas as antecipações devem ter uma despesa correspondente
SELECT
  pa.advance_date,
  pa.description,
  pa.amount as valor_antecipacao,
  p.name as project_name,
  CASE
    WHEN pa.finance_entry_id IS NOT NULL THEN '✓ Despesa vinculada'
    ELSE '✗ Despesa NÃO vinculada (PROBLEMA!)'
  END as status_despesa,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM engineering_finance_entries efe
      WHERE efe.advance_id = pa.id
    ) THEN '✓ Despesa existe'
    ELSE '✗ Despesa NÃO existe (PROBLEMA!)'
  END as status_existencia
FROM engineering_project_advances pa
JOIN engineering_projects p ON p.id = pa.project_id
ORDER BY pa.advance_date DESC
LIMIT 20;

-- ============================================
-- 11. Projetos com antecipações (resumo)
-- ============================================
SELECT * FROM engineering_project_advances_summary
ORDER BY total_pending DESC, last_advance_date DESC
LIMIT 10;

-- ============================================
-- 12. Resumo mensal (últimos 6 meses)
-- ============================================
SELECT * FROM engineering_finance_summary
WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
ORDER BY month DESC, entry_type, category;

-- ============================================
-- 13. Receitas de honorários vs reembolsos
-- ============================================
SELECT
  DATE_TRUNC('month', entry_date) as mes,
  SUM(CASE WHEN category = 'honorarios' THEN amount ELSE 0 END) as honorarios,
  SUM(CASE WHEN category = 'antecipacao_reembolso' THEN amount ELSE 0 END) as reembolsos,
  SUM(CASE WHEN category = 'outras_receitas' THEN amount ELSE 0 END) as outras,
  SUM(amount) as total_receitas
FROM engineering_finance_entries
WHERE entry_type = 'receita'
  AND status = 'efetivado'
GROUP BY DATE_TRUNC('month', entry_date)
ORDER BY mes DESC
LIMIT 12;

-- ============================================
-- 14. Top 10 projetos com mais antecipações
-- ============================================
SELECT
  p.name as project_name,
  c.name as customer_name,
  COUNT(pa.id) as qtd_antecipacoes,
  SUM(pa.amount) as total_antecipado,
  SUM(CASE WHEN pa.reimbursed THEN pa.amount ELSE 0 END) as total_reembolsado,
  SUM(CASE WHEN NOT pa.reimbursed THEN pa.amount ELSE 0 END) as pendente_reembolso,
  p.balance as saldo_atual_projeto
FROM engineering_projects p
JOIN customers c ON c.id = p.customer_id
LEFT JOIN engineering_project_advances pa ON pa.project_id = p.id
GROUP BY p.id, p.name, c.name, p.balance
HAVING COUNT(pa.id) > 0
ORDER BY total_antecipado DESC
LIMIT 10;

-- ============================================
-- 15. Verificar grand_total atualizado por antecipações
-- ============================================
-- Projetos que tiveram antecipações devem ter grand_total atualizado
SELECT
  p.name as project_name,
  c.name as customer_name,
  COALESCE(SUM(pa.amount), 0) as total_antecipacoes,
  p.grand_total,
  p.total_received,
  p.balance,
  CASE
    WHEN COALESCE(SUM(pa.amount), 0) > 0
         AND p.balance >= COALESCE(SUM(CASE WHEN NOT pa.reimbursed THEN pa.amount ELSE 0 END), 0)
    THEN '✓ Grand total atualizado corretamente'
    ELSE '⚠ Verificar grand total'
  END as status_grand_total
FROM engineering_projects p
JOIN customers c ON c.id = p.customer_id
LEFT JOIN engineering_project_advances pa ON pa.project_id = p.id
GROUP BY p.id, p.name, c.name, p.grand_total, p.total_received, p.balance
HAVING COUNT(pa.id) > 0
ORDER BY total_antecipacoes DESC;

-- ============================================
-- 16. Despesas operacionais (últimos 30 dias)
-- ============================================
SELECT
  entry_date,
  description,
  amount,
  payment_method,
  notes
FROM engineering_finance_entries
WHERE entry_type = 'despesa'
  AND category = 'operacional'
  AND status = 'efetivado'
  AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY entry_date DESC;

-- ============================================
-- 17. Lançamentos pendentes
-- ============================================
SELECT
  entry_type,
  category,
  description,
  amount,
  entry_date,
  due_date,
  CASE
    WHEN due_date < CURRENT_DATE THEN 'VENCIDO'
    WHEN due_date = CURRENT_DATE THEN 'VENCE HOJE'
    ELSE 'A VENCER'
  END as status_prazo
FROM engineering_finance_entries
WHERE status = 'pendente'
ORDER BY due_date ASC NULLS LAST, entry_date DESC;

-- ============================================
-- 18. Validação de triggers
-- ============================================
-- Verificar se triggers estão criados
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('engineering_project_payments', 'engineering_project_advances')
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 19. Performance: lançamentos por status
-- ============================================
SELECT
  status,
  entry_type,
  COUNT(*) as quantidade,
  SUM(amount) as total
FROM engineering_finance_entries
GROUP BY status, entry_type
ORDER BY status, entry_type;

-- ============================================
-- 20. Exemplo de caso real (Milton Klein)
-- ============================================
-- Buscar projeto do Milton Klein (se existir)
SELECT
  p.name as project_name,
  c.name as customer_name,
  p.grand_total as valor_total_projeto,
  p.total_received as total_recebido,
  p.balance as saldo_devedor,

  -- Receitas do projeto
  COALESCE((
    SELECT SUM(amount)
    FROM engineering_finance_entries
    WHERE project_id = p.id
      AND entry_type = 'receita'
      AND status = 'efetivado'
  ), 0) as total_receitas_projeto,

  -- Honorários recebidos
  COALESCE((
    SELECT SUM(amount)
    FROM engineering_finance_entries
    WHERE project_id = p.id
      AND entry_type = 'receita'
      AND category = 'honorarios'
      AND status = 'efetivado'
  ), 0) as receitas_honorarios,

  -- Reembolsos recebidos
  COALESCE((
    SELECT SUM(amount)
    FROM engineering_finance_entries
    WHERE project_id = p.id
      AND entry_type = 'receita'
      AND category = 'antecipacao_reembolso'
      AND status = 'efetivado'
  ), 0) as receitas_reembolsos,

  -- Antecipações feitas
  COALESCE((
    SELECT SUM(amount)
    FROM engineering_project_advances
    WHERE project_id = p.id
  ), 0) as total_antecipacoes,

  -- Antecipações pendentes
  COALESCE((
    SELECT SUM(amount)
    FROM engineering_project_advances
    WHERE project_id = p.id
      AND reimbursed = false
  ), 0) as antecipacoes_pendentes

FROM engineering_projects p
JOIN customers c ON c.id = p.customer_id
WHERE c.name ILIKE '%milton%'
   OR c.name ILIKE '%klein%'
   OR p.name ILIKE '%milton%'
   OR p.name ILIKE '%klein%'
LIMIT 1;

-- ============================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- ============================================
-- ✓ CORRETO:
--   - Query 9: Todos os recebimentos com "✓ Receita criada"
--   - Query 10: Todas as antecipações com "✓ Despesa vinculada"
--   - Query 15: Todos os projetos com "✓ Grand total atualizado"
--   - Query 18: Triggers aparecem na listagem
--
-- ✗ PROBLEMA:
--   - Query 9: Algum recebimento sem receita
--   - Query 10: Alguma antecipação sem despesa
--   - Query 15: Grand total não atualizado
--   - Query 18: Triggers faltando
