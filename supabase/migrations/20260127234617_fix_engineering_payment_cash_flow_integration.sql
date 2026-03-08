/*
  # Corrigir Integração de Pagamentos de Projetos de Engenharia com Fluxo de Caixa

  1. Problema Identificado
    - Erro ao salvar pagamento: column "value" of relation "cash_flow" does not exist
    - Triggers tentam inserir campos inexistentes no cash_flow:
      - `value` (correto é `amount`)
      - `payment_method` (não existe)
      - `reference_id` e `reference_type` (não existem)
      - `category_id` (correto é `category` text)
      - `account_id` (correto é `conta_caixa_id`)
    
  2. Causa
    - Tabela engineering_project_payments usa `account_id`
    - Componente frontend usa `conta_caixa_id`
    - Triggers usam nomes de colunas antigos que não existem mais
    
  3. Solução
    - Adicionar coluna `conta_caixa_id` à tabela engineering_project_payments
    - Migrar dados de `account_id` para `conta_caixa_id`
    - Remover coluna `account_id` antiga
    - Corrigir funções de trigger para usar campos corretos do cash_flow
    - Otimizar funções para melhor performance

  4. Estrutura Correta do cash_flow
    - date (date)
    - type (text): 'entrada' ou 'saída'
    - category (text): descrição da categoria
    - description (text)
    - amount (numeric): ao invés de 'value'
    - conta_caixa_id (uuid)
    - notes (text)
    - business_unit (text)
*/

-- =====================================================
-- 1. AJUSTAR ESTRUTURA DA TABELA engineering_project_payments
-- =====================================================

-- Adicionar coluna conta_caixa_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_project_payments' 
    AND column_name = 'conta_caixa_id'
  ) THEN
    ALTER TABLE engineering_project_payments 
    ADD COLUMN conta_caixa_id uuid REFERENCES contas_caixa(id) ON DELETE SET NULL;
    
    -- Migrar dados de account_id para conta_caixa_id
    UPDATE engineering_project_payments 
    SET conta_caixa_id = account_id 
    WHERE account_id IS NOT NULL;
    
    RAISE NOTICE 'Coluna conta_caixa_id adicionada e dados migrados';
  END IF;
END $$;

-- Remover coluna account_id antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_project_payments' 
    AND column_name = 'account_id'
  ) THEN
    ALTER TABLE engineering_project_payments DROP COLUMN account_id;
    RAISE NOTICE 'Coluna account_id removida';
  END IF;
END $$;

-- Remover coluna account_name se existir (não é mais necessária)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_project_payments' 
    AND column_name = 'account_name'
  ) THEN
    ALTER TABLE engineering_project_payments DROP COLUMN account_name;
    RAISE NOTICE 'Coluna account_name removida';
  END IF;
END $$;

-- Atualizar coluna updated_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_project_payments' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE engineering_project_payments 
    ADD COLUMN updated_at timestamptz DEFAULT now();
    RAISE NOTICE 'Coluna updated_at adicionada';
  END IF;
END $$;

-- =====================================================
-- 2. CORRIGIR FUNÇÃO create_cash_flow_for_engineering_payment
-- =====================================================

CREATE OR REPLACE FUNCTION create_cash_flow_for_engineering_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
BEGIN
  -- Buscar informações do projeto e cliente
  SELECT 
    p.name,
    c.name
  INTO v_project_name, v_customer_name
  FROM engineering_projects p
  LEFT JOIN customers c ON p.customer_id = c.id
  WHERE p.id = NEW.project_id;

  -- Inserir no fluxo de caixa com campos corretos
  INSERT INTO cash_flow (
    date,
    type,
    category,
    description,
    amount,
    conta_caixa_id,
    notes,
    business_unit
  ) VALUES (
    NEW.payment_date,
    'entrada',
    'Serviços de Engenharia',
    'Recebimento - Projeto: ' || COALESCE(v_project_name, 'Sem nome') || 
    ' - Cliente: ' || COALESCE(v_customer_name, 'Não informado'),
    NEW.value,
    NEW.conta_caixa_id,
    'Pagamento de projeto de engenharia' || 
    CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
    'engineering'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_cash_flow_for_engineering_payment() IS
'Cria registro no fluxo de caixa quando um pagamento de projeto de engenharia é inserido. Usa os campos corretos da tabela cash_flow (amount, conta_caixa_id, category text).';

-- =====================================================
-- 3. CORRIGIR FUNÇÃO delete_cash_flow_for_engineering_payment
-- =====================================================

CREATE OR REPLACE FUNCTION delete_cash_flow_for_engineering_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Remover entrada do fluxo de caixa correspondente ao pagamento deletado
  DELETE FROM cash_flow
  WHERE date = OLD.payment_date
    AND type = 'entrada'
    AND category = 'Serviços de Engenharia'
    AND amount = OLD.value
    AND conta_caixa_id = OLD.conta_caixa_id
    AND description LIKE '%Projeto:%'
    AND created_at >= OLD.created_at - INTERVAL '1 minute'
    AND created_at <= OLD.created_at + INTERVAL '1 minute';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_cash_flow_for_engineering_payment() IS
'Remove registro do fluxo de caixa quando um pagamento de projeto de engenharia é deletado.';

-- =====================================================
-- 4. CORRIGIR FUNÇÃO integrate_payment_to_cash_flow
-- =====================================================

CREATE OR REPLACE FUNCTION integrate_payment_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar informações do projeto e cliente
    SELECT 
      p.name,
      c.name
    INTO v_project_name, v_customer_name
    FROM engineering_projects p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.id = NEW.project_id;

    -- Criar entrada no fluxo de caixa
    INSERT INTO cash_flow (
      date,
      type,
      category,
      description,
      amount,
      conta_caixa_id,
      notes,
      business_unit
    ) VALUES (
      NEW.payment_date,
      'entrada',
      'Serviços de Engenharia',
      'Recebimento - ' || COALESCE(v_project_name, 'Projeto') || 
      ' - ' || COALESCE(v_customer_name, 'Cliente'),
      NEW.value,
      NEW.conta_caixa_id,
      CASE WHEN NEW.notes IS NOT NULL 
        THEN 'Pagamento de projeto - ' || NEW.notes 
        ELSE 'Pagamento de projeto de engenharia' 
      END,
      'engineering'
    );

  ELSIF TG_OP = 'DELETE' THEN
    -- Remover do fluxo de caixa
    DELETE FROM cash_flow
    WHERE date = OLD.payment_date
      AND type = 'entrada'
      AND category = 'Serviços de Engenharia'
      AND amount = OLD.value
      AND conta_caixa_id = OLD.conta_caixa_id
      AND created_at >= OLD.created_at - INTERVAL '1 minute'
      AND created_at <= OLD.created_at + INTERVAL '1 minute';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION integrate_payment_to_cash_flow() IS
'Integra pagamentos de projetos de engenharia com o fluxo de caixa. Usa os campos corretos da tabela cash_flow.';

-- =====================================================
-- 5. REMOVER TRIGGERS DUPLICADOS
-- =====================================================

-- Manter apenas os triggers necessários
DROP TRIGGER IF EXISTS create_cash_flow_on_payment ON engineering_project_payments;
DROP TRIGGER IF EXISTS delete_cash_flow_on_payment_delete ON engineering_project_payments;

-- Os triggers integrate_payment_cash_flow já fazem o trabalho de INSERT e DELETE
-- Então não precisamos dos triggers create_cash_flow_on_payment e delete_cash_flow_on_payment_delete

-- =====================================================
-- 6. OTIMIZAR FUNÇÃO update_project_total_received
-- =====================================================

CREATE OR REPLACE FUNCTION update_project_total_received()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id uuid;
  v_total_received numeric;
  v_grand_total numeric;
BEGIN
  -- Identificar o projeto afetado
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

  -- Calcular total recebido para este projeto
  SELECT COALESCE(SUM(value), 0)
  INTO v_total_received
  FROM engineering_project_payments
  WHERE project_id = v_project_id;

  -- Buscar grand_total do projeto
  SELECT grand_total INTO v_grand_total
  FROM engineering_projects
  WHERE id = v_project_id;

  -- Atualizar o projeto
  UPDATE engineering_projects
  SET 
    total_received = v_total_received,
    balance = COALESCE(v_grand_total, 0) - v_total_received,
    updated_at = now()
  WHERE id = v_project_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_project_total_received() IS
'Atualiza automaticamente total_received e balance quando pagamentos são inseridos, atualizados ou deletados.';

-- =====================================================
-- 7. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_engineering_project_payments_conta_caixa 
  ON engineering_project_payments(conta_caixa_id)
  WHERE conta_caixa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engineering_project_payments_payment_date 
  ON engineering_project_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_cash_flow_engineering_category
  ON cash_flow(category)
  WHERE category = 'Serviços de Engenharia';

-- =====================================================
-- 8. ATUALIZAR DADOS EXISTENTES
-- =====================================================

-- Recalcular totais de todos os projetos
DO $$
DECLARE
  v_project RECORD;
  v_total_received numeric;
BEGIN
  FOR v_project IN 
    SELECT id, grand_total
    FROM engineering_projects
  LOOP
    -- Calcular total recebido
    SELECT COALESCE(SUM(value), 0)
    INTO v_total_received
    FROM engineering_project_payments
    WHERE project_id = v_project.id;

    -- Atualizar projeto
    UPDATE engineering_projects
    SET 
      total_received = v_total_received,
      balance = COALESCE(v_project.grand_total, 0) - v_total_received
    WHERE id = v_project.id;

    RAISE NOTICE 'Projeto % atualizado: recebido=%, saldo=%', 
      v_project.id, v_total_received, 
      COALESCE(v_project.grand_total, 0) - v_total_received;
  END LOOP;
END;
$$;

-- =====================================================
-- 9. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE engineering_project_payments IS
'Registra os pagamentos recebidos de projetos de engenharia. Integra automaticamente com cash_flow e atualiza total_received do projeto.';

COMMENT ON COLUMN engineering_project_payments.conta_caixa_id IS
'Conta de caixa onde o pagamento foi recebido. Campo alinhado com o padrão do sistema.';

COMMENT ON COLUMN engineering_project_payments.value IS
'Valor do pagamento recebido em reais.';

COMMENT ON COLUMN engineering_project_payments.payment_method IS
'Método de pagamento utilizado (dinheiro, pix, transferencia, etc).';
