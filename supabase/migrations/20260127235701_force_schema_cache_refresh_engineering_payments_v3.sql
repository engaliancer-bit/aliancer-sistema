/*
  # Forçar Atualização do Schema Cache do PostgREST

  1. Problema
    - Erro: "Could not find the 'account_id' column of 'engineering_project_payments' in the schema cache"
    - PostgREST (API do Supabase) está com cache desatualizado
    - Coluna account_id foi removida mas cache ainda a referencia
    
  2. Solução
    - Forçar refresh do schema cache do PostgREST
    - Notificar o PostgREST sobre mudanças de schema
    - Recriar comentários da tabela para forçar detecção de mudança
    - Garantir que nenhuma referência antiga existe
*/

-- =====================================================
-- 1. GARANTIR QUE account_id NÃO EXISTE
-- =====================================================

DO $$ 
BEGIN
  -- Se por acaso account_id ainda existir, remover
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_project_payments' 
    AND column_name = 'account_id'
  ) THEN
    -- Remover foreign key se existir
    ALTER TABLE engineering_project_payments 
    DROP CONSTRAINT IF EXISTS engineering_project_payments_account_id_fkey;
    
    -- Remover coluna
    ALTER TABLE engineering_project_payments 
    DROP COLUMN IF EXISTS account_id;
    
    RAISE NOTICE 'Coluna account_id removida';
  END IF;
END $$;

-- =====================================================
-- 2. GARANTIR QUE conta_caixa_id EXISTE CORRETAMENTE
-- =====================================================

DO $$ 
BEGIN
  -- Garantir que conta_caixa_id existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_project_payments' 
    AND column_name = 'conta_caixa_id'
  ) THEN
    ALTER TABLE engineering_project_payments 
    ADD COLUMN conta_caixa_id uuid REFERENCES contas_caixa(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Coluna conta_caixa_id adicionada';
  END IF;
  
  -- Garantir foreign key correta
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'engineering_project_payments_conta_caixa_id_fkey'
    AND table_name = 'engineering_project_payments'
  ) THEN
    ALTER TABLE engineering_project_payments 
    ADD CONSTRAINT engineering_project_payments_conta_caixa_id_fkey 
    FOREIGN KEY (conta_caixa_id) REFERENCES contas_caixa(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Foreign key conta_caixa_id criada';
  END IF;
END $$;

-- =====================================================
-- 3. ATUALIZAR COMENTÁRIOS (FORÇA DETECÇÃO DE MUDANÇA)
-- =====================================================

COMMENT ON TABLE engineering_project_payments IS
'Registra pagamentos recebidos de projetos de engenharia. Integra automaticamente com cash_flow atraves de triggers. Usa conta_caixa_id para integração.';

COMMENT ON COLUMN engineering_project_payments.id IS
'Identificador unico do pagamento UUID';

COMMENT ON COLUMN engineering_project_payments.project_id IS
'Referencia ao projeto de engenharia';

COMMENT ON COLUMN engineering_project_payments.payment_date IS
'Data em que o pagamento foi recebido';

COMMENT ON COLUMN engineering_project_payments.value IS
'Valor do pagamento em reais';

COMMENT ON COLUMN engineering_project_payments.payment_method IS
'Metodo de pagamento: dinheiro, pix, transferencia, cartao_credito, cartao_debito, cheque, boleto';

COMMENT ON COLUMN engineering_project_payments.conta_caixa_id IS
'Conta de caixa onde o pagamento foi recebido. Campo obrigatorio para integração com fluxo de caixa.';

COMMENT ON COLUMN engineering_project_payments.notes IS
'Observacoes adicionais sobre o pagamento';

COMMENT ON COLUMN engineering_project_payments.created_at IS
'Data e hora de criacao do registro';

COMMENT ON COLUMN engineering_project_payments.updated_at IS
'Data e hora da ultima atualizacao do registro';

-- =====================================================
-- 4. RECRIAR POLÍTICAS RLS (FORÇA REFRESH DO CACHE)
-- =====================================================

-- Remover política antiga
DROP POLICY IF EXISTS "Permitir acesso total a engineering_project_payments" 
  ON engineering_project_payments;

DROP POLICY IF EXISTS "Allow all operations on engineering_project_payments" 
  ON engineering_project_payments;

-- Recriar política com nome novo
CREATE POLICY "engineering_project_payments_all_access"
  ON engineering_project_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 5. RECRIAR ÍNDICES COM NOMES ATUALIZADOS
-- =====================================================

-- Remover índices antigos se existirem
DROP INDEX IF EXISTS idx_engineering_project_payments_account_id;
DROP INDEX IF EXISTS idx_engineering_project_payments_account;

-- Garantir índices corretos
DROP INDEX IF EXISTS idx_engineering_project_payments_conta_caixa;
CREATE INDEX idx_engineering_project_payments_conta_caixa 
  ON engineering_project_payments(conta_caixa_id)
  WHERE conta_caixa_id IS NOT NULL;

DROP INDEX IF EXISTS idx_engineering_project_payments_payment_date;
CREATE INDEX idx_engineering_project_payments_payment_date 
  ON engineering_project_payments(payment_date DESC);

DROP INDEX IF EXISTS idx_engineering_project_payments_project_id;
CREATE INDEX idx_engineering_project_payments_project_id 
  ON engineering_project_payments(project_id);

-- =====================================================
-- 6. FORÇAR REFRESH DO SCHEMA CACHE DO POSTGREST
-- =====================================================

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';

-- Atualizar estatísticas da tabela
ANALYZE engineering_project_payments;

-- =====================================================
-- 7. FORÇAR ATUALIZAÇÃO DO CACHE DO SUPABASE
-- =====================================================

-- Alterar e reverter uma configuração para forçar refresh
ALTER TABLE engineering_project_payments SET (fillfactor = 100);
ALTER TABLE engineering_project_payments RESET (fillfactor);

-- =====================================================
-- 8. VERIFICAR ESTRUTURA ATUAL
-- =====================================================

DO $$
DECLARE
  rec RECORD;
  v_has_account_id boolean := false;
  v_has_conta_caixa_id boolean := false;
BEGIN
  RAISE NOTICE '=== ESTRUTURA ATUAL DA TABELA ===';
  
  FOR rec IN
    SELECT 
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'engineering_project_payments'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE 'Coluna: % | Tipo: % | Nulavel: %',
      rec.column_name, rec.data_type, rec.is_nullable;
      
    IF rec.column_name = 'account_id' THEN
      v_has_account_id := true;
    END IF;
    
    IF rec.column_name = 'conta_caixa_id' THEN
      v_has_conta_caixa_id := true;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== VERIFICACAO ===';
  
  IF v_has_account_id THEN
    RAISE WARNING 'PROBLEMA: Coluna account_id ainda existe!';
  ELSE
    RAISE NOTICE 'OK: Coluna account_id nao existe';
  END IF;
  
  IF v_has_conta_caixa_id THEN
    RAISE NOTICE 'OK: Coluna conta_caixa_id existe';
  ELSE
    RAISE WARNING 'PROBLEMA: Coluna conta_caixa_id nao existe!';
  END IF;
  
  RAISE NOTICE '=== FIM ===';
END $$;

-- =====================================================
-- 9. MENSAGEM FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Schema cache do PostgREST foi notificado!';
  RAISE NOTICE 'Tabela engineering_project_payments atualizada!';
  RAISE NOTICE 'Aguarde 5-10 segundos para propagacao';
  RAISE NOTICE '==================================================';
END $$;
