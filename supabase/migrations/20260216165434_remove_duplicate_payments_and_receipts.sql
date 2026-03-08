/*
  # Remover Pagamentos e Receitas Duplicados
  
  1. Problema Identificado
    - Pagamentos cadastrados múltiplas vezes no mesmo projeto/data/valor
    - Cada pagamento duplicado gerou uma receita duplicada
    - Total de 10 duplicatas identificadas
    
  2. Duplicatas Encontradas
    - CAR NOVO ADRIANI SPIES: 4 pagamentos de R$ 350,00 (manter 1)
    - GEORREFERENCIAMENTO CLÁUDIO BAUMGRATZ: 2 de R$ 4.880,00 (manter 1)
    - RETIFICAÇÃO CAR EDUARDO H.: 2 de R$ 330,00 (manter 1)
    - Usucapião Èlio dill: 2 de R$ 5.160,00 (manter 1)
    
  3. Solução
    - Remover pagamentos duplicados (mantendo o mais antigo)
    - Trigger de DELETE removerá automaticamente as receitas correspondentes
    - Adicionar constraint para prevenir futuras duplicações
    
  4. Segurança
    - Manter sempre o registro mais antigo (created_at)
    - Log das exclusões
*/

-- ============================================
-- REMOVER PAGAMENTOS DUPLICADOS
-- ============================================

-- Criar tabela temporária para identificar duplicatas
CREATE TEMP TABLE payments_to_keep AS
SELECT DISTINCT ON (project_id, payment_date, value, payment_method)
  id
FROM engineering_project_payments
ORDER BY project_id, payment_date, value, payment_method, created_at ASC;

-- Log das exclusões
DO $$
DECLARE
  v_deleted_count integer;
  v_payments_before integer;
  v_payments_after integer;
BEGIN
  SELECT COUNT(*) INTO v_payments_before FROM engineering_project_payments;
  
  -- Remover pagamentos duplicados
  DELETE FROM engineering_project_payments
  WHERE id NOT IN (SELECT id FROM payments_to_keep);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  SELECT COUNT(*) INTO v_payments_after FROM engineering_project_payments;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'REMOÇÃO DE PAGAMENTOS DUPLICADOS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Pagamentos antes: %', v_payments_before;
  RAISE NOTICE 'Pagamentos duplicados removidos: %', v_deleted_count;
  RAISE NOTICE 'Pagamentos após: %', v_payments_after;
  RAISE NOTICE '============================================';
  
  -- As receitas correspondentes serão automaticamente removidas pelo trigger
END $$;

-- Limpar tabela temporária
DROP TABLE IF EXISTS payments_to_keep;

-- ============================================
-- ADICIONAR CONSTRAINT DE UNICIDADE
-- ============================================

-- Criar índice único para prevenir duplicatas no futuro
-- Permite múltiplos pagamentos no mesmo projeto, mas não com mesma data/valor/método
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_per_project_date_value 
ON engineering_project_payments (project_id, payment_date, value, payment_method)
WHERE payment_method IS NOT NULL;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
DO $$
DECLARE
  v_total_payments integer;
  v_total_receipts integer;
  v_receipts_with_payment integer;
BEGIN
  SELECT COUNT(*) INTO v_total_payments FROM engineering_project_payments;
  SELECT COUNT(*) INTO v_total_receipts FROM engineering_finance_entries WHERE entry_type = 'receita';
  SELECT COUNT(*) INTO v_receipts_with_payment FROM engineering_finance_entries WHERE payment_id IS NOT NULL;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total de Pagamentos: %', v_total_payments;
  RAISE NOTICE 'Total de Receitas: %', v_total_receipts;
  RAISE NOTICE 'Receitas vinculadas a pagamentos: %', v_receipts_with_payment;
  RAISE NOTICE '============================================';
END $$;
