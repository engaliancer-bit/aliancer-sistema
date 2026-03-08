-- ============================================
-- TESTE: Categorias Customizadas e Edição de Lançamentos
-- Data: 17 de Fevereiro de 2026
-- ============================================

-- ============================================
-- 1. VER TODAS AS CATEGORIAS (SISTEMA + CUSTOMIZADAS)
-- ============================================
SELECT
  CASE WHEN is_custom THEN '🔧' ELSE '⚙️' END as tipo_icone,
  CASE WHEN is_custom THEN 'Customizada' ELSE 'Sistema' END as tipo,
  name as nome,
  description as descricao,
  color as cor,
  CASE WHEN active THEN '✅ Ativa' ELSE '❌ Inativa' END as status,
  display_order as ordem
FROM engineering_expense_categories
ORDER BY is_custom, display_order, name;

-- Esperado:
-- ⚙️ Sistema | Salários e Encargos
-- ⚙️ Sistema | Antecipações a Clientes
-- ⚙️ Sistema | Despesas Operacionais
-- ⚙️ Sistema | Outras Despesas
-- 🔧 Customizada | Aluguel (se você criou)
-- 🔧 Customizada | Energia (se você criou)

-- ============================================
-- 2. CRIAR CATEGORIAS DE TESTE
-- ============================================
INSERT INTO engineering_expense_categories (
  name,
  description,
  is_custom,
  color,
  active,
  display_order
) VALUES
  ('Aluguel', 'Aluguel do escritório', true, '#3B82F6', true, 10),
  ('Energia Elétrica', 'Conta de luz', true, '#F59E0B', true, 11),
  ('Telefonia e Internet', 'Telefone e internet', true, '#10B981', true, 12),
  ('Material de Escritório', 'Materiais diversos', true, '#8B5CF6', true, 13)
ON CONFLICT DO NOTHING
RETURNING *;

-- ============================================
-- 3. CRIAR DESPESA COM CATEGORIA CUSTOMIZADA (MANUAL VIA SQL)
-- ============================================
-- Primeiro, pegue o ID de uma categoria customizada
DO $$
DECLARE
  v_category_id uuid;
BEGIN
  -- Buscar ID da categoria "Aluguel"
  SELECT id INTO v_category_id
  FROM engineering_expense_categories
  WHERE name = 'Aluguel' AND is_custom = true
  LIMIT 1;

  -- Criar despesa de teste
  IF v_category_id IS NOT NULL THEN
    INSERT INTO engineering_finance_entries (
      entry_type,
      category,
      custom_category_id,
      amount,
      description,
      entry_date,
      paid_date,
      payment_method,
      status,
      notes
    ) VALUES (
      'despesa',
      'outras_despesas',
      v_category_id,
      2500.00,
      'Aluguel do escritório - Fevereiro/2026',
      CURRENT_DATE,
      CURRENT_DATE,
      'transferencia',
      'efetivado',
      'Teste de categoria customizada'
    );

    RAISE NOTICE 'Despesa criada com categoria customizada: %', v_category_id;
  ELSE
    RAISE NOTICE 'Categoria Aluguel não encontrada. Crie primeiro na interface.';
  END IF;
END $$;

-- ============================================
-- 4. VER DESPESAS COM CATEGORIAS CUSTOMIZADAS
-- ============================================
SELECT
  e.id,
  e.entry_date as data,
  e.description as descricao,
  e.amount as valor,
  e.category as categoria_sistema,
  c.name as categoria_customizada,
  c.color as cor_categoria,
  CASE
    WHEN e.payment_id IS NOT NULL THEN '🔗 Recebimento'
    WHEN e.advance_id IS NOT NULL THEN '🔗 Antecipação'
    WHEN e.payroll_schedule_id IS NOT NULL THEN '🔗 Salário'
    ELSE '✏️ Editável'
  END as tipo_lancamento
FROM engineering_finance_entries e
LEFT JOIN engineering_expense_categories c ON c.id = e.custom_category_id
WHERE e.entry_type = 'despesa'
ORDER BY e.entry_date DESC
LIMIT 20;

-- ============================================
-- 5. CONTAR LANÇAMENTOS POR CATEGORIA
-- ============================================
SELECT
  COALESCE(c.name, e.category) as categoria,
  COUNT(*) as quantidade,
  SUM(e.amount) as total,
  CASE WHEN c.is_custom THEN 'Customizada' ELSE 'Sistema' END as tipo
FROM engineering_finance_entries e
LEFT JOIN engineering_expense_categories c ON c.id = e.custom_category_id
WHERE e.entry_type = 'despesa'
  AND e.status = 'efetivado'
GROUP BY c.name, c.is_custom, e.category
ORDER BY tipo, total DESC;

-- ============================================
-- 6. VERIFICAR QUAIS LANÇAMENTOS SÃO EDITÁVEIS
-- ============================================
SELECT
  e.id,
  e.description as descricao,
  e.amount as valor,
  CASE
    WHEN e.payment_id IS NOT NULL THEN '❌ Não (Recebimento automático)'
    WHEN e.advance_id IS NOT NULL THEN '❌ Não (Antecipação)'
    WHEN e.payroll_schedule_id IS NOT NULL THEN '❌ Não (Salário automático)'
    ELSE '✅ Sim (Lançamento manual)'
  END as pode_editar_excluir
FROM engineering_finance_entries e
ORDER BY e.entry_date DESC
LIMIT 20;

-- ============================================
-- 7. ESTATÍSTICAS DE CATEGORIAS
-- ============================================
SELECT
  COUNT(CASE WHEN is_custom = true THEN 1 END) as categorias_customizadas,
  COUNT(CASE WHEN is_custom = false THEN 1 END) as categorias_sistema,
  COUNT(CASE WHEN active = true THEN 1 END) as categorias_ativas,
  COUNT(CASE WHEN active = false THEN 1 END) as categorias_inativas
FROM engineering_expense_categories;

-- ============================================
-- 8. DESPESAS DO MÊS ATUAL COM CATEGORIAS
-- ============================================
SELECT
  e.entry_date as data,
  COALESCE(c.name,
    CASE e.category
      WHEN 'operacional' THEN 'Despesa Operacional'
      WHEN 'salario_clt' THEN 'Salário CLT'
      WHEN 'antecipacao_cliente' THEN 'Antecipação para Cliente'
      WHEN 'outras_despesas' THEN 'Outras Despesas'
      ELSE e.category
    END
  ) as categoria,
  e.description as descricao,
  e.amount as valor,
  e.status
FROM engineering_finance_entries e
LEFT JOIN engineering_expense_categories c ON c.id = e.custom_category_id
WHERE e.entry_type = 'despesa'
  AND EXTRACT(YEAR FROM e.entry_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM e.entry_date) = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY e.entry_date DESC, e.created_at DESC;

-- ============================================
-- 9. SIMULAR EDIÇÃO DE LANÇAMENTO
-- ============================================
/*
-- Pegar um ID editável da query #6 acima, depois:

UPDATE engineering_finance_entries
SET
  amount = 3000.00,
  description = 'Valor atualizado via SQL',
  updated_at = now()
WHERE id = 'UUID_DO_LANCAMENTO'
  AND payment_id IS NULL
  AND advance_id IS NULL
  AND payroll_schedule_id IS NULL
RETURNING *;
*/

-- ============================================
-- 10. VERIFICAR CATEGORIA DE UM LANÇAMENTO
-- ============================================
/*
-- Substitua o UUID por um ID real
SELECT
  e.id,
  e.description,
  e.category as cat_sistema,
  e.custom_category_id as cat_custom_id,
  c.name as cat_custom_nome
FROM engineering_finance_entries e
LEFT JOIN engineering_expense_categories c ON c.id = e.custom_category_id
WHERE e.id = 'UUID_DO_LANCAMENTO';
*/

-- ============================================
-- 11. RELATÓRIO: USO DE CATEGORIAS CUSTOMIZADAS
-- ============================================
SELECT
  c.name as categoria,
  c.description as descricao,
  c.color as cor,
  COUNT(e.id) as quantidade_usos,
  SUM(e.amount) as valor_total
FROM engineering_expense_categories c
LEFT JOIN engineering_finance_entries e ON e.custom_category_id = c.id
WHERE c.is_custom = true
  AND c.active = true
GROUP BY c.id, c.name, c.description, c.color
ORDER BY quantidade_usos DESC;

-- Mostra quais categorias customizadas estão sendo mais usadas

-- ============================================
-- 12. CATEGORIAS SEM USO (PODEM SER EXCLUÍDAS)
-- ============================================
SELECT
  c.id,
  c.name as categoria,
  c.description
FROM engineering_expense_categories c
WHERE c.is_custom = true
  AND c.active = true
  AND NOT EXISTS (
    SELECT 1
    FROM engineering_finance_entries e
    WHERE e.custom_category_id = c.id
  )
ORDER BY c.name;

-- Mostra categorias que podem ser excluídas sem problemas

-- ============================================
-- 13. VALIDAR INTEGRIDADE
-- ============================================
-- Verificar se há lançamentos com custom_category_id inválido
SELECT COUNT(*) as lancamentos_invalidos
FROM engineering_finance_entries e
WHERE e.custom_category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM engineering_expense_categories c
    WHERE c.id = e.custom_category_id
  );

-- Esperado: 0

-- ============================================
-- 14. DESATIVAR CATEGORIA (EM VEZ DE EXCLUIR)
-- ============================================
/*
-- Se tiver lançamentos vinculados, melhor desativar:
UPDATE engineering_expense_categories
SET active = false
WHERE id = 'UUID_DA_CATEGORIA'
  AND is_custom = true
RETURNING *;
*/

-- ============================================
-- 15. EXCLUIR CATEGORIA SEM USO
-- ============================================
/*
-- Apenas categorias sem lançamentos podem ser excluídas:
DELETE FROM engineering_expense_categories
WHERE id = 'UUID_DA_CATEGORIA'
  AND is_custom = true
  AND NOT EXISTS (
    SELECT 1
    FROM engineering_finance_entries e
    WHERE e.custom_category_id = 'UUID_DA_CATEGORIA'
  )
RETURNING *;
*/

-- ============================================
-- ✅ RESUMO FINAL
-- ============================================
SELECT
  '✅ Total de Categorias' as metrica,
  COUNT(*)::text as valor
FROM engineering_expense_categories

UNION ALL

SELECT
  '✅ Categorias Ativas',
  COUNT(*)::text
FROM engineering_expense_categories
WHERE active = true

UNION ALL

SELECT
  '✅ Categorias Customizadas',
  COUNT(*)::text
FROM engineering_expense_categories
WHERE is_custom = true

UNION ALL

SELECT
  '✅ Despesas com Categorias Customizadas',
  COUNT(*)::text
FROM engineering_finance_entries
WHERE custom_category_id IS NOT NULL

UNION ALL

SELECT
  '✅ Lançamentos Editáveis',
  COUNT(*)::text
FROM engineering_finance_entries
WHERE payment_id IS NULL
  AND advance_id IS NULL
  AND payroll_schedule_id IS NULL;

-- ============================================
-- FIM DOS TESTES
-- ============================================
