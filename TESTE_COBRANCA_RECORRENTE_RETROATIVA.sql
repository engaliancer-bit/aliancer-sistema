-- ============================================
-- TESTE: Cobrança Recorrente Retroativa
-- Data: 17 de Fevereiro de 2026
-- ============================================

-- ============================================
-- 1. VER TODOS OS PROJETOS RECORRENTES
-- ============================================
SELECT
  ep.id,
  ep.name as projeto,
  c.name as cliente,
  ep.recurring_start_date as inicio,
  ep.recurring_end_date as termino,
  est.fees as valor_mensal,
  est.recurring_due_day as dia_vencimento,
  ep.status
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.is_recurring_monthly = true
ORDER BY ep.name;

-- Esperado: 2 projetos de consultoria

-- ============================================
-- 2. VER COBRANÇAS GERADAS DE CADA PROJETO
-- ============================================
SELECT
  ep.name as projeto,
  to_char(rc.charge_date, 'MM/YYYY') as mes,
  rc.due_date as vencimento,
  rc.amount as valor,
  rc.status,
  CASE
    WHEN rc.status = 'overdue' THEN '⚠️ VENCIDO'
    WHEN rc.status = 'pending' THEN '⏳ Pendente'
    WHEN rc.status = 'paid' THEN '✅ Pago'
  END as situacao,
  rc.created_at as criado_em
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
ORDER BY ep.name, rc.charge_date;

-- Esperado: Múltiplas cobranças para cada projeto
-- Janeiro e Fevereiro devem estar como "overdue"
-- Março em diante como "pending"

-- ============================================
-- 3. ESTATÍSTICAS GERAIS
-- ============================================
SELECT
  'Total de Cobranças' as metrica,
  COUNT(*)::text as valor
FROM engineering_recurring_charges

UNION ALL

SELECT
  'Cobranças Pendentes',
  COUNT(*)::text
FROM engineering_recurring_charges
WHERE status = 'pending'

UNION ALL

SELECT
  'Cobranças Vencidas',
  COUNT(*)::text
FROM engineering_recurring_charges
WHERE status = 'overdue'

UNION ALL

SELECT
  'Cobranças Pagas',
  COUNT(*)::text
FROM engineering_recurring_charges
WHERE status = 'paid'

UNION ALL

SELECT
  'Total em Aberto',
  'R$ ' || SUM(amount)::text
FROM engineering_recurring_charges
WHERE status IN ('pending', 'overdue')

UNION ALL

SELECT
  'Total Pago',
  'R$ ' || COALESCE(SUM(amount), 0)::text
FROM engineering_recurring_charges
WHERE status = 'paid';

-- ============================================
-- 4. VER VIEW DE PROJETOS RECORRENTES
-- ============================================
SELECT
  project_name as projeto,
  customer_name as cliente,
  recurring_start_date as inicio,
  recurring_end_date as termino,
  monthly_fee as mensalidade,
  recurring_due_day as dia_venc,
  pending_charges as pendentes,
  overdue_charges as vencidas,
  paid_charges as pagas,
  total_pending as "total_em_aberto",
  total_paid as "total_pago"
FROM v_recurring_projects
ORDER BY project_name;

-- ============================================
-- 5. COBRANÇAS POR MÊS (RESUMO)
-- ============================================
SELECT
  to_char(charge_date, 'MM/YYYY') as mes,
  COUNT(*) as quantidade,
  SUM(amount) as valor_total,
  COUNT(*) FILTER (WHERE status = 'pending') as pendentes,
  COUNT(*) FILTER (WHERE status = 'overdue') as vencidas,
  COUNT(*) FILTER (WHERE status = 'paid') as pagas
FROM engineering_recurring_charges
GROUP BY to_char(charge_date, 'MM/YYYY'), charge_date
ORDER BY charge_date;

-- ============================================
-- 6. TESTAR GERAÇÃO RETROATIVA PARA UM PROJETO
-- ============================================
-- Pegar o ID de um projeto da query #1 e executar:
/*
SELECT
  charge_id,
  to_char(charge_month, 'MM/YYYY') as mes,
  due_date as vencimento,
  amount as valor,
  created as criado_agora
FROM generate_retroactive_recurring_charges('UUID_DO_PROJETO');
*/

-- Se created = false, significa que a cobrança já existia
-- Se created = true, significa que foi criada agora

-- ============================================
-- 7. PROCESSAR TODOS OS PROJETOS
-- ============================================
SELECT
  project_name as projeto,
  charges_created as "cobranças_criadas",
  total_amount as "valor_total"
FROM process_all_recurring_charges();

-- Esperado: Se já rodou na migration, deve retornar 0 linhas
-- (todas as cobranças já foram criadas)

-- ============================================
-- 8. VERIFICAR COBRANÇAS DO MÊS ATUAL
-- ============================================
SELECT
  ep.name as projeto,
  c.name as cliente,
  rc.due_date as vencimento,
  rc.amount as valor,
  rc.status,
  CASE
    WHEN rc.due_date < CURRENT_DATE THEN CURRENT_DATE - rc.due_date
    ELSE 0
  END as dias_atraso
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
JOIN customers c ON c.id = ep.customer_id
WHERE date_trunc('month', rc.charge_date) = date_trunc('month', CURRENT_DATE)
ORDER BY ep.name;

-- ============================================
-- 9. COBRANÇAS VENCIDAS (ALERTAS)
-- ============================================
SELECT
  ep.name as projeto,
  c.name as cliente,
  c.phone as telefone,
  c.email,
  rc.due_date as vencimento,
  CURRENT_DATE - rc.due_date as dias_atraso,
  rc.amount as valor,
  rc.description as descricao
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
JOIN customers c ON c.id = ep.customer_id
WHERE rc.status = 'overdue'
ORDER BY rc.due_date;

-- Use para enviar notificações de cobrança

-- ============================================
-- 10. TOTAL EM ABERTO POR CLIENTE
-- ============================================
SELECT
  c.name as cliente,
  c.phone as telefone,
  COUNT(rc.id) as "cobranças_pendentes",
  SUM(rc.amount) as "total_em_aberto",
  STRING_AGG(
    to_char(rc.due_date, 'DD/MM/YYYY') || ' - R$ ' || rc.amount::text,
    ', '
  ) as detalhes
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
JOIN customers c ON c.id = ep.customer_id
WHERE rc.status IN ('pending', 'overdue')
GROUP BY c.id, c.name, c.phone
ORDER BY "total_em_aberto" DESC;

-- ============================================
-- 11. PROJEÇÃO DE RECEITAS (12 MESES)
-- ============================================
SELECT
  to_char(generate_series, 'MM/YYYY') as mes,
  SUM(est.fees) as "receita_projetada"
FROM generate_series(
  date_trunc('month', CURRENT_DATE),
  date_trunc('month', CURRENT_DATE) + interval '11 months',
  interval '1 month'
) AS generate_series
CROSS JOIN engineering_projects ep
JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.is_recurring_monthly = true
  AND ep.status NOT IN ('finalizado', 'registrado')
  AND (
    ep.recurring_end_date IS NULL
    OR generate_series::date <= ep.recurring_end_date
  )
GROUP BY generate_series
ORDER BY generate_series;

-- ============================================
-- 12. VERIFICAR INTEGRIDADE
-- ============================================
-- Projetos recorrentes sem cobranças
SELECT
  ep.name as projeto,
  ep.recurring_start_date as inicio,
  COUNT(rc.id) as "cobranças_geradas"
FROM engineering_projects ep
JOIN engineering_service_templates est ON est.id = ep.template_id
LEFT JOIN engineering_recurring_charges rc ON rc.project_id = ep.id
WHERE est.is_recurring_monthly = true
GROUP BY ep.id, ep.name, ep.recurring_start_date
HAVING COUNT(rc.id) = 0;

-- Esperado: 0 linhas (todos os projetos devem ter cobranças)

-- ============================================
-- 13. COBRANÇAS DUPLICADAS (VALIDAÇÃO)
-- ============================================
SELECT
  ep.name as projeto,
  date_trunc('month', rc.charge_date) as mes,
  COUNT(*) as quantidade
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
GROUP BY ep.name, date_trunc('month', rc.charge_date)
HAVING COUNT(*) > 1;

-- Esperado: 0 linhas (não deve haver duplicatas)

-- ============================================
-- 14. SIMULAR PAGAMENTO DE UMA COBRANÇA
-- ============================================
/*
-- Pegar um ID de cobrança pendente da query #2
-- Criar um pagamento em engineering_finance_entries
INSERT INTO engineering_finance_entries (
  entry_type,
  category,
  amount,
  description,
  project_id,
  customer_id,
  payment_method,
  entry_date,
  paid_date,
  status
)
SELECT
  'receita',
  'honorarios',
  rc.amount,
  rc.description || ' - PAGAMENTO',
  rc.project_id,
  ep.customer_id,
  'pix',
  CURRENT_DATE,
  CURRENT_DATE,
  'efetivado'
FROM engineering_recurring_charges rc
JOIN engineering_projects ep ON ep.id = rc.project_id
WHERE rc.id = 'UUID_DA_COBRANÇA'
RETURNING id;

-- Depois, vincular a cobrança ao pagamento
UPDATE engineering_recurring_charges
SET
  payment_id = 'UUID_DO_PAGAMENTO_CRIADO',
  status = 'paid'
WHERE id = 'UUID_DA_COBRANÇA';
*/

-- ============================================
-- 15. HISTÓRICO DE COBRANÇAS DE UM PROJETO
-- ============================================
/*
SELECT
  to_char(rc.charge_date, 'MM/YYYY') as mes,
  rc.due_date as vencimento,
  rc.amount as valor,
  rc.status,
  rc.payment_id,
  CASE WHEN rc.payment_id IS NOT NULL
    THEN fe.paid_date
    ELSE NULL
  END as data_pagamento,
  rc.created_at as criado_em
FROM engineering_recurring_charges rc
LEFT JOIN engineering_finance_entries fe ON fe.id = rc.payment_id
WHERE rc.project_id = 'UUID_DO_PROJETO'
ORDER BY rc.charge_date;
*/

-- ============================================
-- 16. CRIAR PROJETO DE TESTE RECORRENTE
-- ============================================
DO $$
DECLARE
  v_customer_id uuid;
  v_template_id uuid;
  v_project_id uuid;
BEGIN
  -- Criar cliente de teste
  INSERT INTO customers (name, phone, email, person_type, active)
  VALUES ('Cliente Teste Recorrente', '11999999999', 'teste@email.com', 'PF', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM customers WHERE name = 'Cliente Teste Recorrente';
  END IF;

  -- Buscar template de consultoria
  SELECT id INTO v_template_id
  FROM engineering_service_templates
  WHERE is_recurring_monthly = true
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum template recorrente encontrado';
  END IF;

  -- Criar projeto
  INSERT INTO engineering_projects (
    customer_id,
    template_id,
    name,
    start_date,
    recurring_start_date,
    recurring_end_date,
    status,
    grand_total
  ) VALUES (
    v_customer_id,
    v_template_id,
    'Consultoria Teste Recorrente',
    '2026-01-01',
    '2026-01-01',
    '2026-12-31',
    'em_desenvolvimento',
    0
  )
  RETURNING id INTO v_project_id;

  -- Gerar cobranças retroativas
  PERFORM generate_retroactive_recurring_charges(v_project_id);

  RAISE NOTICE 'Projeto de teste criado: %', v_project_id;
  RAISE NOTICE 'Cliente: %', v_customer_id;
END $$;

-- ============================================
-- 17. LIMPAR DADOS DE TESTE
-- ============================================
/*
-- ⚠️ CUIDADO: Isso vai excluir TODOS os dados de teste

-- Excluir cobranças do projeto de teste
DELETE FROM engineering_recurring_charges
WHERE project_id IN (
  SELECT id FROM engineering_projects WHERE name LIKE '%Teste Recorrente%'
);

-- Excluir projeto de teste
DELETE FROM engineering_projects
WHERE name LIKE '%Teste Recorrente%';

-- Excluir cliente de teste
DELETE FROM customers
WHERE name LIKE '%Teste Recorrente%';
*/

-- ============================================
-- 18. RELATÓRIO EXECUTIVO
-- ============================================
SELECT
  'RESUMO EXECUTIVO - COBRANÇAS RECORRENTES' as titulo,
  '================================================' as separador

UNION ALL

SELECT
  'Total de Projetos Recorrentes Ativos',
  COUNT(DISTINCT ep.id)::text
FROM engineering_projects ep
JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.is_recurring_monthly = true
  AND ep.status NOT IN ('finalizado', 'registrado')

UNION ALL

SELECT
  'Receita Mensal Recorrente (MRR)',
  'R$ ' || SUM(est.fees)::text
FROM engineering_projects ep
JOIN engineering_service_templates est ON est.id = ep.template_id
WHERE est.is_recurring_monthly = true
  AND ep.status NOT IN ('finalizado', 'registrado')

UNION ALL

SELECT
  'Total de Cobranças Geradas',
  COUNT(*)::text
FROM engineering_recurring_charges

UNION ALL

SELECT
  'Cobranças Vencidas',
  COUNT(*) || ' (R$ ' || SUM(amount)::text || ')'
FROM engineering_recurring_charges
WHERE status = 'overdue'

UNION ALL

SELECT
  'Cobranças Pendentes (Futuras)',
  COUNT(*) || ' (R$ ' || SUM(amount)::text || ')'
FROM engineering_recurring_charges
WHERE status = 'pending'

UNION ALL

SELECT
  'Cobranças Pagas',
  COUNT(*) || ' (R$ ' || COALESCE(SUM(amount), 0)::text || ')'
FROM engineering_recurring_charges
WHERE status = 'paid'

UNION ALL

SELECT
  'Taxa de Inadimplência',
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(
        COUNT(*) FILTER (WHERE status = 'overdue')::numeric /
        COUNT(*)::numeric * 100,
        2
      )::text || '%'
    ELSE '0%'
  END
FROM engineering_recurring_charges;

-- ============================================
-- 19. TIMELINE DE COBRANÇAS
-- ============================================
SELECT
  to_char(rc.charge_date, 'YYYY-MM') as ano_mes,
  COUNT(*) as quantidade,
  COUNT(*) FILTER (WHERE rc.status = 'paid') as pagas,
  COUNT(*) FILTER (WHERE rc.status = 'pending') as pendentes,
  COUNT(*) FILTER (WHERE rc.status = 'overdue') as vencidas,
  SUM(rc.amount) as valor_total,
  SUM(rc.amount) FILTER (WHERE rc.status = 'paid') as valor_pago,
  SUM(rc.amount) FILTER (WHERE rc.status IN ('pending', 'overdue')) as valor_em_aberto,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN
        COUNT(*) FILTER (WHERE rc.status = 'paid')::numeric /
        COUNT(*)::numeric * 100
      ELSE 0
    END,
    2
  ) as "taxa_pagamento_%"
FROM engineering_recurring_charges rc
GROUP BY ano_mes
ORDER BY ano_mes;

-- ============================================
-- 20. VALIDAÇÃO FINAL
-- ============================================
DO $$
DECLARE
  v_total_projects integer;
  v_total_charges integer;
  v_expected_months integer;
BEGIN
  -- Contar projetos recorrentes ativos
  SELECT COUNT(*) INTO v_total_projects
  FROM engineering_projects ep
  JOIN engineering_service_templates est ON est.id = ep.template_id
  WHERE est.is_recurring_monthly = true
    AND ep.status NOT IN ('finalizado', 'registrado');

  -- Contar cobranças geradas
  SELECT COUNT(*) INTO v_total_charges
  FROM engineering_recurring_charges;

  RAISE NOTICE '=== VALIDAÇÃO FINAL ===';
  RAISE NOTICE 'Projetos recorrentes ativos: %', v_total_projects;
  RAISE NOTICE 'Total de cobranças geradas: %', v_total_charges;

  IF v_total_projects > 0 AND v_total_charges = 0 THEN
    RAISE WARNING 'PROBLEMA: Há projetos recorrentes mas nenhuma cobrança foi gerada!';
  ELSIF v_total_projects = 0 THEN
    RAISE NOTICE 'Nenhum projeto recorrente ativo encontrado';
  ELSE
    RAISE NOTICE 'Sistema funcionando corretamente!';
  END IF;

  RAISE NOTICE '======================';
END $$;

-- ============================================
-- FIM DOS TESTES
-- ============================================

-- ⚠️ IMPORTANTE:
-- Execute as queries na ordem para entender o fluxo completo
-- As queries #1 a #13 são para visualização e validação
-- A query #16 cria dados de teste
-- A query #17 limpa dados de teste
-- A query #18 gera relatório executivo
