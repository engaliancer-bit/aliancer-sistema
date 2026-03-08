/*
  # Corrigir Triggers - Usar income/expense ao invés de entrada/saída

  1. Problema
    - Triggers usam 'entrada' mas cash_flow valida apenas 'income' ou 'expense'
    - Constraint: cash_flow_type_check valida (type = ANY (ARRAY['income', 'expense']))
    
  2. Solução
    - Atualizar funções de trigger para usar 'income' ao invés de 'entrada'
    - Atualizar todos os triggers relacionados
*/

-- =====================================================
-- 1. CORRIGIR FUNÇÃO integrate_payment_to_cash_flow
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

    -- Criar entrada no fluxo de caixa usando 'income'
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
      'income',  -- ✅ Mudado de 'entrada' para 'income'
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
      AND type = 'income'  -- ✅ Mudado de 'entrada' para 'income'
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
'Integra pagamentos de projetos de engenharia com o fluxo de caixa. Usa type=income para receitas.';

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

  -- Inserir no fluxo de caixa com campos corretos usando 'income'
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
    'income',  -- ✅ Mudado de 'entrada' para 'income'
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
'Cria registro no fluxo de caixa quando um pagamento de projeto de engenharia é inserido. Usa type=income para receitas.';

-- =====================================================
-- 3. CORRIGIR FUNÇÃO delete_cash_flow_for_engineering_payment
-- =====================================================

CREATE OR REPLACE FUNCTION delete_cash_flow_for_engineering_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Remover entrada do fluxo de caixa correspondente ao pagamento deletado
  DELETE FROM cash_flow
  WHERE date = OLD.payment_date
    AND type = 'income'  -- ✅ Mudado de 'entrada' para 'income'
    AND category = 'Serviços de Engenharia'
    AND amount = OLD.value
    AND conta_caixa_id = OLD.conta_caixa_id
    AND created_at >= OLD.created_at - INTERVAL '1 minute'
    AND created_at <= OLD.created_at + INTERVAL '1 minute';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_cash_flow_for_engineering_payment() IS
'Remove registro do fluxo de caixa quando um pagamento de projeto de engenharia é deletado.';

-- =====================================================
-- 4. ATUALIZAR REGISTROS ANTIGOS NO CASH_FLOW
-- =====================================================

-- Atualizar registros que possam estar com 'entrada' para 'income'
UPDATE cash_flow
SET type = 'income'
WHERE category = 'Serviços de Engenharia'
  AND business_unit = 'engineering'
  AND type = 'entrada';

-- =====================================================
-- 5. VERIFICAÇÃO FINAL
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Triggers atualizados para usar income/expense!';
  RAISE NOTICE 'Registros antigos atualizados!';
  RAISE NOTICE '==================================================';
END $$;
