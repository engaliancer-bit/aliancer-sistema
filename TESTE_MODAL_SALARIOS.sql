-- ============================================
-- TESTE: Modal de Confirmação de Salários
-- Data: 17 de Fevereiro de 2026
-- ============================================

-- ============================================
-- 1. VER TODOS OS COLABORADORES CLT
-- ============================================
SELECT
  id,
  name as nome,
  role as cargo,
  employment_type as tipo_contrato,
  base_salary as salario_base,
  active as ativo
FROM employees
WHERE employment_type = 'CLT'
ORDER BY name;

-- ============================================
-- 2. VER SALÁRIOS PENDENTES DO MÊS ATUAL
-- ============================================
SELECT
  schedule_id,
  employee_name as colaborador,
  employee_role as cargo,
  base_salary as salario_base,
  benefits as beneficios,
  total_amount as total,
  expected_payment_date as data_prevista,
  CASE WHEN is_overdue THEN '⚠️ ATRASADO' ELSE '✅ No Prazo' END as status
FROM v_pending_payroll_current_month
ORDER BY is_overdue DESC, expected_payment_date;

-- Esperado: Lista de colaboradores com salários pendentes
-- Se retornar vazio, modal não abrirá

-- ============================================
-- 3. CRIAR COLABORADOR CLT DE TESTE
-- ============================================
INSERT INTO employees (
  name,
  role,
  employment_type,
  base_salary,
  benefits,
  hire_date,
  business_unit,
  active
) VALUES (
  'João Silva - TESTE',
  'Engenheiro Civil',
  'CLT',
  8000.00,
  500.00,
  '2025-01-01',
  'Engenharia',
  true
) ON CONFLICT DO NOTHING
RETURNING id, name, role, base_salary;

-- ============================================
-- 4. CRIAR AGENDAMENTO DE SALÁRIO PENDENTE
-- ============================================
DO $$
DECLARE
  v_employee_id uuid;
  v_current_year int;
  v_current_month int;
BEGIN
  -- Buscar colaborador de teste
  SELECT id INTO v_employee_id
  FROM employees
  WHERE name LIKE '%TESTE%' AND employment_type = 'CLT'
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador de teste não encontrado. Execute query #3 primeiro.';
  END IF;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Verificar se já existe agendamento
  IF NOT EXISTS (
    SELECT 1 FROM engineering_payroll_schedules
    WHERE employee_id = v_employee_id
      AND year = v_current_year
      AND month = v_current_month
  ) THEN
    -- Criar agendamento de salário pendente
    INSERT INTO engineering_payroll_schedules (
      employee_id,
      year,
      month,
      base_salary,
      benefits,
      expected_payment_date,
      status
    ) VALUES (
      v_employee_id,
      v_current_year,
      v_current_month,
      8000.00,
      500.00,
      DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '14 days', -- Dia 15
      'pending'
    );

    RAISE NOTICE 'Agendamento de salário criado para % - %/%',
      v_employee_id, v_current_month, v_current_year;
  ELSE
    RAISE NOTICE 'Agendamento já existe para este colaborador neste mês';
  END IF;
END $$;

-- ============================================
-- 5. CRIAR VÁRIOS COLABORADORES E SALÁRIOS
-- ============================================
DO $$
DECLARE
  v_employee_id uuid;
  v_current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month int := EXTRACT(MONTH FROM CURRENT_DATE);
  v_employees text[] := ARRAY[
    'Maria Santos - Topógrafa - 6000',
    'Pedro Oliveira - Desenhista - 4500',
    'Ana Costa - Engenheira Ambiental - 7500'
  ];
  v_employee_data text[];
BEGIN
  FOREACH v_employee_data[1] IN ARRAY v_employees LOOP
    -- Parse dados
    v_employee_data := string_to_array(v_employee_data[1], ' - ');

    -- Criar colaborador se não existir
    INSERT INTO employees (
      name,
      role,
      employment_type,
      base_salary,
      hire_date,
      business_unit,
      active
    ) VALUES (
      v_employee_data[1] || ' - TESTE',
      v_employee_data[2],
      'CLT',
      v_employee_data[3]::numeric,
      '2025-01-01',
      'Engenharia',
      true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_employee_id;

    -- Se não retornou ID, buscar existente
    IF v_employee_id IS NULL THEN
      SELECT id INTO v_employee_id
      FROM employees
      WHERE name = v_employee_data[1] || ' - TESTE';
    END IF;

    -- Criar agendamento se não existir
    IF NOT EXISTS (
      SELECT 1 FROM engineering_payroll_schedules
      WHERE employee_id = v_employee_id
        AND year = v_current_year
        AND month = v_current_month
    ) THEN
      INSERT INTO engineering_payroll_schedules (
        employee_id,
        year,
        month,
        base_salary,
        benefits,
        expected_payment_date,
        status
      ) VALUES (
        v_employee_id,
        v_current_year,
        v_current_month,
        v_employee_data[3]::numeric,
        (v_employee_data[3]::numeric * 0.1), -- 10% de benefícios
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '14 days',
        'pending'
      );

      RAISE NOTICE 'Criado: %', v_employee_data[1];
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 6. CRIAR SALÁRIO ATRASADO (TESTE ALERTA)
-- ============================================
DO $$
DECLARE
  v_employee_id uuid;
  v_current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month int := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
  -- Criar colaborador
  INSERT INTO employees (
    name,
    role,
    employment_type,
    base_salary,
    hire_date,
    business_unit,
    active
  ) VALUES (
    'Carlos Mendes - TESTE ATRASADO',
    'Técnico em Edificações',
    'CLT',
    3500.00,
    '2025-01-01',
    'Engenharia',
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_employee_id;

  IF v_employee_id IS NULL THEN
    SELECT id INTO v_employee_id
    FROM employees
    WHERE name = 'Carlos Mendes - TESTE ATRASADO';
  END IF;

  -- Criar agendamento ATRASADO (5 dias atrás)
  IF NOT EXISTS (
    SELECT 1 FROM engineering_payroll_schedules
    WHERE employee_id = v_employee_id
      AND year = v_current_year
      AND month = v_current_month
  ) THEN
    INSERT INTO engineering_payroll_schedules (
      employee_id,
      year,
      month,
      base_salary,
      benefits,
      expected_payment_date,
      status
    ) VALUES (
      v_employee_id,
      v_current_year,
      v_current_month,
      3500.00,
      200.00,
      CURRENT_DATE - INTERVAL '5 days', -- ATRASADO!
      'pending'
    );

    RAISE NOTICE 'Salário ATRASADO criado para teste de alerta';
  END IF;
END $$;

-- ============================================
-- 7. VERIFICAR TODOS OS AGENDAMENTOS
-- ============================================
SELECT
  ps.id,
  e.name as colaborador,
  e.role as cargo,
  ps.year as ano,
  ps.month as mes,
  ps.base_salary as salario,
  ps.benefits as beneficios,
  ps.expected_payment_date as data_prevista,
  ps.status,
  CASE
    WHEN ps.expected_payment_date < CURRENT_DATE AND ps.status = 'pending'
    THEN '⚠️ ATRASADO'
    WHEN ps.status = 'pending' THEN '⏳ Pendente'
    WHEN ps.status = 'paid' THEN '✅ Pago'
    WHEN ps.status = 'skipped' THEN '⏭️ Pulado'
  END as situacao
FROM engineering_payroll_schedules ps
JOIN employees e ON e.id = ps.employee_id
WHERE ps.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.month = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY ps.status, ps.expected_payment_date;

-- ============================================
-- 8. TESTAR FUNÇÃO confirm_payroll_payment
-- ============================================
/*
-- Pegar um schedule_id da query #7 acima:
SELECT confirm_payroll_payment(
  'UUID_DO_SCHEDULE',
  600.00,                    -- benefícios
  CURRENT_DATE::text,        -- data pagamento
  'transferencia'            -- método
);
*/

-- ============================================
-- 9. VERIFICAR LANÇAMENTOS CRIADOS
-- ============================================
SELECT
  e.id,
  e.entry_date as data,
  e.description as descricao,
  e.category as categoria,
  e.amount as valor,
  e.status,
  e.payroll_schedule_id,
  emp.name as colaborador
FROM engineering_finance_entries e
LEFT JOIN engineering_payroll_schedules ps ON ps.id = e.payroll_schedule_id
LEFT JOIN employees emp ON emp.id = ps.employee_id
WHERE e.category = 'salario_clt'
ORDER BY e.entry_date DESC;

-- ============================================
-- 10. ESTATÍSTICAS DE SALÁRIOS
-- ============================================
SELECT
  COUNT(*) FILTER (WHERE ps.status = 'pending') as pendentes,
  COUNT(*) FILTER (WHERE ps.status = 'paid') as pagos,
  COUNT(*) FILTER (WHERE ps.status = 'skipped') as pulados,
  COUNT(*) FILTER (WHERE ps.status = 'pending' AND ps.expected_payment_date < CURRENT_DATE) as atrasados,
  SUM(ps.base_salary + COALESCE(ps.benefits, 0)) FILTER (WHERE ps.status = 'pending') as total_pendente
FROM engineering_payroll_schedules ps
WHERE ps.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.month = EXTRACT(MONTH FROM CURRENT_DATE);

-- ============================================
-- 11. SIMULAR CONFIRMAÇÃO EM LOTE
-- ============================================
DO $$
DECLARE
  v_schedule record;
  v_confirmed int := 0;
BEGIN
  FOR v_schedule IN
    SELECT schedule_id, base_salary, benefits
    FROM v_pending_payroll_current_month
    LIMIT 3 -- Confirmar apenas 3
  LOOP
    PERFORM confirm_payroll_payment(
      v_schedule.schedule_id,
      COALESCE(v_schedule.benefits, 0),
      CURRENT_DATE::text,
      'transferencia'
    );
    v_confirmed := v_confirmed + 1;
  END LOOP;

  RAISE NOTICE 'Confirmados % pagamentos', v_confirmed;
END $$;

-- ============================================
-- 12. TESTAR FUNÇÃO skip_payroll_payment
-- ============================================
/*
-- Pegar um schedule_id pendente:
SELECT skip_payroll_payment(
  'UUID_DO_SCHEDULE',
  'Colaborador em férias'
);
*/

-- ============================================
-- 13. RESETAR DADOS DE TESTE
-- ============================================
-- ⚠️ CUIDADO: Isso vai excluir todos os dados de teste
/*
-- Excluir agendamentos de teste
DELETE FROM engineering_payroll_schedules
WHERE employee_id IN (
  SELECT id FROM employees WHERE name LIKE '%TESTE%'
);

-- Excluir lançamentos de salários de teste
DELETE FROM engineering_finance_entries
WHERE payroll_schedule_id IN (
  SELECT id FROM engineering_payroll_schedules
  WHERE employee_id IN (
    SELECT id FROM employees WHERE name LIKE '%TESTE%'
  )
);

-- Excluir colaboradores de teste
DELETE FROM employees
WHERE name LIKE '%TESTE%';
*/

-- ============================================
-- 14. FORÇAR REABERTURA DO MODAL
-- ============================================
-- Para forçar o modal a aparecer novamente:
-- 1. Certifique-se de que há salários pendentes (query #2)
-- 2. Recarregue a página (F5)
-- 3. Ou navegue para outra aba e volte

-- ============================================
-- 15. VERIFICAR INTEGRIDADE
-- ============================================
-- Verificar se há agendamentos sem lançamentos financeiros
SELECT
  ps.id,
  e.name as colaborador,
  ps.status,
  COUNT(fe.id) as lancamentos_criados
FROM engineering_payroll_schedules ps
JOIN employees e ON e.id = ps.employee_id
LEFT JOIN engineering_finance_entries fe ON fe.payroll_schedule_id = ps.id
WHERE ps.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.month = EXTRACT(MONTH FROM CURRENT_DATE)
GROUP BY ps.id, e.name, ps.status
HAVING (ps.status = 'paid' AND COUNT(fe.id) = 0)
    OR (ps.status = 'pending' AND COUNT(fe.id) > 0);

-- Esperado: 0 linhas (nenhuma inconsistência)

-- ============================================
-- 16. RELATÓRIO MENSAL DE SALÁRIOS
-- ============================================
SELECT
  e.name as colaborador,
  e.role as cargo,
  ps.base_salary as salario_base,
  ps.benefits as beneficios,
  (ps.base_salary + COALESCE(ps.benefits, 0)) as total,
  ps.expected_payment_date as data_prevista,
  ps.actual_payment_date as data_pagamento,
  ps.status,
  ps.payment_method as forma_pagamento,
  fe.id as lancamento_financeiro_id
FROM engineering_payroll_schedules ps
JOIN employees e ON e.id = ps.employee_id
LEFT JOIN engineering_finance_entries fe ON fe.payroll_schedule_id = ps.id
WHERE ps.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.month = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY ps.status, e.name;

-- ============================================
-- 17. GERAR DADOS REALISTAS PARA TESTE COMPLETO
-- ============================================
DO $$
DECLARE
  v_employee_id uuid;
  v_current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
  v_current_month int := EXTRACT(MONTH FROM CURRENT_DATE);
  v_employees record;
  v_base_date date := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '14 days';
BEGIN
  -- Cenário realista com 10 colaboradores
  FOR v_employees IN
    SELECT * FROM (VALUES
      ('Ana Paula Silva', 'Engenheira Civil Sênior', 12000.00, 800.00, 0),
      ('Bruno Costa Santos', 'Engenheiro Civil Pleno', 8000.00, 600.00, 0),
      ('Carla Mendes Oliveira', 'Topógrafa', 6000.00, 450.00, 0),
      ('Daniel Ferreira Lima', 'Desenhista CAD', 4500.00, 300.00, 0),
      ('Eduarda Sousa Alves', 'Engenheira Ambiental', 9000.00, 650.00, 0),
      ('Fernando Ribeiro Costa', 'Técnico em Edificações', 3500.00, 250.00, -5), -- Atrasado
      ('Gabriela Santos Rocha', 'Engenheira de Segurança', 8500.00, 600.00, 0),
      ('Henrique Lima Pereira', 'Geólogo', 7000.00, 500.00, 0),
      ('Isabela Costa Martins', 'Arquiteta', 7500.00, 550.00, -2), -- Atrasado
      ('João Pedro Alves Silva', 'Projetista Estrutural', 6500.00, 450.00, 0)
    ) AS t(nome, cargo, salario, beneficios, dias_atraso)
  LOOP
    -- Criar colaborador
    INSERT INTO employees (
      name,
      role,
      employment_type,
      base_salary,
      benefits,
      hire_date,
      business_unit,
      active
    ) VALUES (
      v_employees.nome,
      v_employees.cargo,
      'CLT',
      v_employees.salario,
      v_employees.beneficios,
      '2024-01-01',
      'Engenharia',
      true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_employee_id;

    IF v_employee_id IS NULL THEN
      SELECT id INTO v_employee_id
      FROM employees
      WHERE name = v_employees.nome;
    END IF;

    -- Criar agendamento
    IF NOT EXISTS (
      SELECT 1 FROM engineering_payroll_schedules
      WHERE employee_id = v_employee_id
        AND year = v_current_year
        AND month = v_current_month
    ) THEN
      INSERT INTO engineering_payroll_schedules (
        employee_id,
        year,
        month,
        base_salary,
        benefits,
        expected_payment_date,
        status
      ) VALUES (
        v_employee_id,
        v_current_year,
        v_current_month,
        v_employees.salario,
        v_employees.beneficios,
        v_base_date + (v_employees.dias_atraso || ' days')::interval,
        'pending'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Cenário realista criado com 10 colaboradores (2 atrasados)';
END $$;

-- ============================================
-- ✅ RESUMO FINAL
-- ============================================
SELECT
  '✅ Total de Colaboradores CLT' as metrica,
  COUNT(*)::text as valor
FROM employees
WHERE employment_type = 'CLT' AND active = true

UNION ALL

SELECT
  '✅ Salários Pendentes Mês Atual',
  COUNT(*)::text
FROM v_pending_payroll_current_month

UNION ALL

SELECT
  '⚠️ Salários Atrasados',
  COUNT(*)::text
FROM v_pending_payroll_current_month
WHERE is_overdue = true

UNION ALL

SELECT
  '✅ Salários Pagos Mês Atual',
  COUNT(*)::text
FROM engineering_payroll_schedules
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND month = EXTRACT(MONTH FROM CURRENT_DATE)
  AND status = 'paid'

UNION ALL

SELECT
  '💰 Total Pendente',
  'R$ ' || SUM(total_amount)::text
FROM v_pending_payroll_current_month;

-- ============================================
-- FIM DOS TESTES
-- ============================================

-- ⚠️ IMPORTANTE PARA TESTAR:
-- 1. Execute as queries #3, #4, #5 e #6 para criar dados de teste
-- 2. Acesse "Receitas/Despesas" no sistema
-- 3. Modal deve abrir automaticamente mostrando os salários pendentes
-- 4. Teste confirmar alguns salários
-- 5. Feche o modal e veja o alerta aparecer
-- 6. Recarregue a página (F5) - modal deve reabrir
-- 7. Execute query #9 para ver lançamentos criados
