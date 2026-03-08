-- ============================================
-- SCRIPT DE TESTE: Sistema de Salários Recorrentes CLT
-- Data: 17 de Fevereiro de 2026
-- ============================================

-- ============================================
-- 1. VERIFICAR CATEGORIAS CRIADAS
-- ============================================
SELECT
  name,
  is_custom,
  color,
  active,
  display_order
FROM engineering_expense_categories
ORDER BY is_custom, display_order;

-- Esperado: 4 categorias padrão do sistema

-- ============================================
-- 2. VERIFICAR COLABORADORES CLT COM RECORRÊNCIA
-- ============================================
SELECT
  id,
  name,
  role,
  employment_type,
  base_salary,
  benefits,
  salary_payment_day,
  auto_payroll_enabled,
  active,
  business_unit
FROM employees
WHERE business_unit = 'engineering'
  AND employment_type = 'clt'
ORDER BY name;

-- Esperado: Colaboradores CLT com salary_payment_day preenchido

-- ============================================
-- 3. GERAR AGENDAMENTOS DE SALÁRIO PARA FEVEREIRO/2026
-- ============================================
SELECT * FROM generate_monthly_payroll_schedule(2026, 2);

-- Esperado: Retorna colaboradores CLT ativos do escritório

-- ============================================
-- 4. VISUALIZAR AGENDAMENTOS PENDENTES DO MÊS ATUAL
-- ============================================
SELECT * FROM v_pending_payroll_current_month;

-- Esperado: Lista de salários pendentes de confirmação

-- ============================================
-- 5. VISUALIZAR TODOS OS AGENDAMENTOS DE FEVEREIRO
-- ============================================
SELECT
  ps.id,
  e.name as colaborador,
  e.role as cargo,
  ps.base_salary as salario_base,
  ps.benefits as beneficios,
  ps.total_amount as total,
  ps.expected_payment_date as data_prevista,
  ps.status,
  ps.confirmed_at as confirmado_em,
  ps.finance_entry_id as lancamento_id
FROM engineering_payroll_schedule ps
JOIN employees e ON e.id = ps.employee_id
WHERE ps.year = 2026 AND ps.month = 2
ORDER BY ps.expected_payment_date, e.name;

-- ============================================
-- 6. TESTE: CONFIRMAR UM PAGAMENTO MANUALMENTE
-- ============================================
-- Primeiro, pegue um schedule_id da query acima, depois execute:
/*
SELECT confirm_payroll_payment(
  'UUID_DO_SCHEDULE_ID', -- Substituir pelo ID real
  500.00,                 -- Benefícios editados
  CURRENT_DATE,           -- Data de pagamento
  'transferencia',        -- Forma de pagamento
  'Banco do Brasil',      -- Conta bancária
  'Teste de confirmação', -- Observações
  NULL                    -- ID do usuário
);
*/

-- ============================================
-- 7. TESTE: PULAR UM PAGAMENTO MANUALMENTE
-- ============================================
/*
SELECT skip_payroll_payment(
  'UUID_DO_SCHEDULE_ID',
  'Colaborador de férias'
);
*/

-- ============================================
-- 8. VERIFICAR LANÇAMENTOS FINANCEIROS CRIADOS
-- ============================================
SELECT
  id,
  entry_type,
  category,
  amount,
  description,
  entry_date,
  status,
  notes,
  employee_id,
  payroll_schedule_id
FROM engineering_finance_entries
WHERE payroll_schedule_id IS NOT NULL
ORDER BY entry_date DESC;

-- Esperado: Lançamentos de salários confirmados

-- ============================================
-- 9. RELATÓRIO: DESPESAS COM SALÁRIOS NO MÊS
-- ============================================
SELECT
  e.name as colaborador,
  e.role as cargo,
  fe.amount as valor_pago,
  fe.entry_date as data_pagamento,
  fe.payment_method as forma_pagamento,
  fe.notes as observacoes
FROM engineering_finance_entries fe
JOIN employees e ON e.id = fe.employee_id
WHERE fe.entry_type = 'despesa'
  AND fe.category = 'salario_clt'
  AND EXTRACT(YEAR FROM fe.entry_date) = 2026
  AND EXTRACT(MONTH FROM fe.entry_date) = 2
ORDER BY fe.entry_date DESC, e.name;

-- ============================================
-- 10. TOTAL DE SALÁRIOS PAGOS NO MÊS
-- ============================================
SELECT
  COUNT(*) as quantidade_pagamentos,
  SUM(amount) as total_pago
FROM engineering_finance_entries
WHERE entry_type = 'despesa'
  AND category = 'salario_clt'
  AND EXTRACT(YEAR FROM entry_date) = 2026
  AND EXTRACT(MONTH FROM entry_date) = 2;

-- ============================================
-- 11. STATUS DOS AGENDAMENTOS
-- ============================================
SELECT
  status,
  COUNT(*) as quantidade,
  SUM(total_amount) as valor_total
FROM engineering_payroll_schedule
WHERE year = 2026 AND month = 2
GROUP BY status
ORDER BY status;

-- Esperado:
-- pending: X colaboradores aguardando
-- confirmed: Y colaboradores confirmados
-- skipped: Z colaboradores pulados

-- ============================================
-- 12. CRIAR CATEGORIA CUSTOMIZADA (TESTE)
-- ============================================
INSERT INTO engineering_expense_categories (
  name,
  description,
  is_custom,
  color,
  active,
  display_order
) VALUES (
  'Aluguel',
  'Aluguel do escritório',
  true,
  '#3B82F6',
  true,
  10
) RETURNING *;

-- ============================================
-- 13. LISTAR TODAS AS CATEGORIAS
-- ============================================
SELECT
  CASE WHEN is_custom THEN '🔧 Customizada' ELSE '⚙️ Sistema' END as tipo,
  name as nome,
  description as descricao,
  color as cor,
  CASE WHEN active THEN '✅ Ativa' ELSE '❌ Inativa' END as status
FROM engineering_expense_categories
ORDER BY is_custom, display_order, name;

-- ============================================
-- 14. VERIFICAR INTEGRIDADE DOS DADOS
-- ============================================
-- Verificar se há agendamentos sem colaborador
SELECT 'Agendamentos órfãos' as problema, COUNT(*) as quantidade
FROM engineering_payroll_schedule ps
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.id = ps.employee_id
);

-- Verificar se há lançamentos sem agendamento vinculado
SELECT 'Lançamentos sem agendamento' as problema, COUNT(*) as quantidade
FROM engineering_finance_entries
WHERE category = 'salario_clt'
  AND payroll_schedule_id IS NULL;

-- Esperado: 0 para ambos

-- ============================================
-- 15. LIMPAR DADOS DE TESTE (SE NECESSÁRIO)
-- ============================================
/*
-- CUIDADO: Isso remove TODOS os agendamentos de fevereiro
DELETE FROM engineering_payroll_schedule
WHERE year = 2026 AND month = 2;

-- CUIDADO: Isso remove categorias customizadas de teste
DELETE FROM engineering_expense_categories
WHERE is_custom = true AND name = 'Aluguel';
*/

-- ============================================
-- ✅ FIM DOS TESTES
-- ============================================
