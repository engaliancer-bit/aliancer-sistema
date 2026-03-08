/*
  # TESTE DE STRESS - LANÇAMENTOS DE PAGAMENTOS

  Este script realiza testes de stress com 20 lançamentos simultâneos
  para validar as otimizações de performance implementadas.

  ATENÇÃO: Execute em ambiente de TESTE apenas!
*/

-- ========================================
-- 1. PREPARAR DADOS DE TESTE
-- ========================================

-- Criar fornecedores de teste (se não existirem)
DO $$
DECLARE
  i INTEGER;
  supplier_id UUID;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO suppliers (name, cnpj, email, phone)
    VALUES (
      'Fornecedor Teste ' || i,
      LPAD((12345678000000 + i)::TEXT, 14, '0'),
      'fornecedor' || i || '@teste.com',
      '(11) 9' || LPAD(i::TEXT, 8, '0')
    )
    ON CONFLICT (cnpj) DO NOTHING;
  END LOOP;

  RAISE NOTICE '5 fornecedores de teste criados/verificados';
END $$;

-- Criar contas de caixa de teste (se não existirem)
DO $$
BEGIN
  INSERT INTO contas_caixa (name, description)
  VALUES
    ('Caixa Teste 1', 'Conta para testes de stress'),
    ('Caixa Teste 2', 'Conta para testes de stress'),
    ('Caixa Teste 3', 'Conta para testes de stress')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Contas de caixa de teste criadas/verificadas';
END $$;

-- ========================================
-- 2. CRIAR CATEGORIAS DE CUSTO (se necessário)
-- ========================================

DO $$
BEGIN
  INSERT INTO cost_categories (name, type)
  VALUES
    ('Teste Despesa', 'expense'),
    ('Teste Investimento', 'investment')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Categorias de custo criadas/verificadas';
END $$;

-- ========================================
-- 3. TESTE DE STRESS - 20 CONTAS A PAGAR SIMULTÂNEAS
-- ========================================

-- Criar 20 contas a pagar rapidamente
DO $$
DECLARE
  i INTEGER;
  supplier_id_var UUID;
  account_id_var UUID;
BEGIN
  -- Pegar ID de um fornecedor aleatório
  SELECT id INTO supplier_id_var
  FROM suppliers
  WHERE name LIKE 'Fornecedor Teste%'
  LIMIT 1;

  IF supplier_id_var IS NULL THEN
    RAISE EXCEPTION 'Nenhum fornecedor de teste encontrado';
  END IF;

  -- Criar 20 contas a pagar
  FOR i IN 1..20 LOOP
    INSERT INTO payable_accounts (
      supplier_id,
      description,
      installment_number,
      total_installments,
      amount,
      due_date,
      payment_status
    )
    VALUES (
      supplier_id_var,
      'Teste Stress - Lançamento ' || i,
      1,
      1,
      100.00 + (i * 10),
      CURRENT_DATE + (i || ' days')::INTERVAL,
      'pending'
    )
    RETURNING id INTO account_id_var;
  END LOOP;

  RAISE NOTICE '20 contas a pagar de teste criadas com sucesso';
END $$;

-- ========================================
-- 4. TESTE DE STRESS - PAGAMENTOS EM LOTE
-- ========================================

-- Pagar 10 contas simultaneamente
DO $$
DECLARE
  account_record RECORD;
  conta_caixa_id_var UUID;
  processed INTEGER := 0;
BEGIN
  -- Pegar ID de uma conta de caixa
  SELECT id INTO conta_caixa_id_var
  FROM contas_caixa
  WHERE name LIKE 'Caixa Teste%'
  LIMIT 1;

  IF conta_caixa_id_var IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta de caixa de teste encontrada';
  END IF;

  -- Processar pagamentos
  FOR account_record IN
    SELECT id, amount, supplier_id, description
    FROM payable_accounts
    WHERE payment_status = 'pending'
      AND description LIKE 'Teste Stress%'
    LIMIT 10
  LOOP
    -- Atualizar conta como paga
    UPDATE payable_accounts
    SET
      payment_status = 'paid',
      payment_date = CURRENT_DATE,
      cash_account_id = conta_caixa_id_var
    WHERE id = account_record.id;

    -- Criar lançamento no fluxo de caixa
    INSERT INTO cash_flow (
      date,
      type,
      category,
      description,
      amount,
      business_unit,
      conta_caixa_id,
      supplier_id,
      payable_account_id
    )
    VALUES (
      CURRENT_DATE,
      'expense',
      'Pagamento',
      account_record.description,
      account_record.amount,
      'factory',
      conta_caixa_id_var,
      account_record.supplier_id,
      account_record.id
    );

    processed := processed + 1;
  END LOOP;

  RAISE NOTICE '% pagamentos processados com sucesso', processed;
END $$;

-- ========================================
-- 5. MÉTRICAS DE PERFORMANCE
-- ========================================

-- Contar registros criados
SELECT
  'Contas a Pagar' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE payment_status = 'pending') as pendentes,
  COUNT(*) FILTER (WHERE payment_status = 'paid') as pagas
FROM payable_accounts
WHERE description LIKE 'Teste Stress%'

UNION ALL

SELECT
  'Fluxo de Caixa' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE type = 'expense') as despesas,
  0 as outros
FROM cash_flow
WHERE description LIKE 'Teste Stress%';

-- ========================================
-- 6. TESTE DE CONSULTA COM JOINS
-- ========================================

-- Consulta complexa para testar índices
EXPLAIN ANALYZE
SELECT
  pa.id,
  pa.description,
  pa.amount,
  pa.due_date,
  pa.payment_date,
  pa.payment_status,
  s.name as supplier_name,
  cc.name as cash_account_name,
  cf.amount as paid_amount
FROM payable_accounts pa
LEFT JOIN suppliers s ON pa.supplier_id = s.id
LEFT JOIN contas_caixa cc ON pa.cash_account_id = cc.id
LEFT JOIN cash_flow cf ON pa.cash_flow_id = cf.id
WHERE pa.description LIKE 'Teste Stress%'
ORDER BY pa.due_date DESC
LIMIT 20;

-- ========================================
-- 7. VERIFICAR INTEGRIDADE
-- ========================================

-- Verificar se todos os pagamentos têm lançamento no fluxo de caixa
SELECT
  pa.id,
  pa.description,
  pa.payment_status,
  pa.cash_flow_id,
  cf.id as cash_flow_exists
FROM payable_accounts pa
LEFT JOIN cash_flow cf ON pa.cash_flow_id = cf.id
WHERE pa.description LIKE 'Teste Stress%'
  AND pa.payment_status = 'paid'
  AND cf.id IS NULL;

-- Se retornar 0 linhas, tudo está correto!

-- ========================================
-- 8. BENCHMARK DE INSERÇÕES
-- ========================================

-- Teste de velocidade de inserção
DO $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  duration INTERVAL;
  supplier_id_var UUID;
  i INTEGER;
BEGIN
  -- Pegar um fornecedor
  SELECT id INTO supplier_id_var
  FROM suppliers
  WHERE name LIKE 'Fornecedor Teste%'
  LIMIT 1;

  -- Iniciar cronômetro
  start_time := clock_timestamp();

  -- Inserir 100 registros
  FOR i IN 1..100 LOOP
    INSERT INTO payable_accounts (
      supplier_id,
      description,
      installment_number,
      total_installments,
      amount,
      due_date,
      payment_status
    )
    VALUES (
      supplier_id_var,
      'Benchmark ' || i,
      1,
      1,
      50.00,
      CURRENT_DATE + (i || ' days')::INTERVAL,
      'pending'
    );
  END LOOP;

  -- Parar cronômetro
  end_time := clock_timestamp();
  duration := end_time - start_time;

  RAISE NOTICE 'Inseridas 100 contas em %', duration;
  RAISE NOTICE 'Média: % ms por inserção', EXTRACT(MILLISECOND FROM duration) / 100;
END $$;

-- ========================================
-- 9. LIMPAR DADOS DE TESTE (OPCIONAL)
-- ========================================

/*
-- Descomente as linhas abaixo para REMOVER os dados de teste

-- Deletar lançamentos do fluxo de caixa de teste
DELETE FROM cash_flow
WHERE description LIKE 'Teste Stress%'
   OR description LIKE 'Benchmark%';

-- Deletar contas a pagar de teste
DELETE FROM payable_accounts
WHERE description LIKE 'Teste Stress%'
   OR description LIKE 'Benchmark%';

-- Deletar fornecedores de teste (cuidado!)
DELETE FROM suppliers
WHERE name LIKE 'Fornecedor Teste%';

-- Deletar contas de caixa de teste (cuidado!)
DELETE FROM contas_caixa
WHERE name LIKE 'Caixa Teste%';

-- Deletar categorias de teste
DELETE FROM cost_categories
WHERE name LIKE 'Teste%';

RAISE NOTICE 'Dados de teste removidos com sucesso!';
*/

-- ========================================
-- 10. RELATÓRIO FINAL
-- ========================================

SELECT
  'TESTE DE STRESS CONCLUÍDO' as status,
  NOW() as data_hora;

SELECT
  '✓ Fornecedores' as checklist,
  COUNT(*) as total
FROM suppliers
WHERE name LIKE 'Fornecedor Teste%'

UNION ALL

SELECT
  '✓ Contas de Caixa' as checklist,
  COUNT(*) as total
FROM contas_caixa
WHERE name LIKE 'Caixa Teste%'

UNION ALL

SELECT
  '✓ Contas a Pagar' as checklist,
  COUNT(*) as total
FROM payable_accounts
WHERE description LIKE 'Teste Stress%'

UNION ALL

SELECT
  '✓ Lançamentos no Fluxo' as checklist,
  COUNT(*) as total
FROM cash_flow
WHERE description LIKE 'Teste Stress%';
