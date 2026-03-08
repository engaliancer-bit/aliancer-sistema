/*
  # Popular Receitas de Pagamentos Existentes
  
  1. Problema Identificado
    - Existem 20 pagamentos em `engineering_project_payments`
    - Nenhum deles possui entrada correspondente em `engineering_finance_entries`
    - O trigger só funciona para NOVOS pagamentos (AFTER INSERT)
    
  2. Solução
    - Popular retroativamente todas as receitas dos pagamentos existentes
    - Manter integridade referencial (payment_id)
    - Respeitar status e datas originais
    
  3. Categorias
    - Honorários: receitas de pagamentos de projetos
    - Reembolsos: quando houver antecipações reembolsadas
    
  4. Segurança
    - Não duplicar registros existentes
    - Usar ONLY para pagamentos sem entrada financeira
*/

-- ============================================
-- POPULAR RECEITAS DE PAGAMENTOS EXISTENTES
-- ============================================

-- Inserir lançamentos de receita para todos os pagamentos que não têm entrada financeira
INSERT INTO engineering_finance_entries (
  entry_type,
  category,
  amount,
  description,
  project_id,
  customer_id,
  payment_id,
  payment_method,
  entry_date,
  paid_date,
  status,
  notes,
  created_at
)
SELECT 
  'receita' as entry_type,
  'honorarios' as category,
  p.value as amount,
  'Recebimento de ' || c.name || ' - ' || ep.name as description,
  p.project_id,
  ep.customer_id,
  p.id as payment_id,
  p.payment_method::text,
  p.payment_date as entry_date,
  p.payment_date as paid_date,
  'efetivado' as status,
  p.notes,
  p.created_at
FROM engineering_project_payments p
INNER JOIN engineering_projects ep ON ep.id = p.project_id
INNER JOIN customers c ON c.id = ep.customer_id
WHERE NOT EXISTS (
  SELECT 1 FROM engineering_finance_entries e 
  WHERE e.payment_id = p.id
);

-- ============================================
-- VERIFICAÇÃO: Mostrar quantos foram criados
-- ============================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM engineering_finance_entries
  WHERE payment_id IS NOT NULL;
  
  RAISE NOTICE 'Total de receitas criadas a partir de pagamentos: %', v_count;
END $$;
