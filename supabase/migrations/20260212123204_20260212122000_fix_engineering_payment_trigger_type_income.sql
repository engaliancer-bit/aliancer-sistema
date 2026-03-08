/*
  # Corrigir tipo de entrada no cash_flow para pagamentos de projetos
  
  1. Problema
    - Função integrate_payment_to_cash_flow() usa type='entrada'
    - Constraint cash_flow_type_check exige 'income' ou 'expense'
    - Causando erro: "violates check constraint cash_flow_type_check"
  
  2. Solução
    - Alterar 'entrada' para 'income' em todas as ocorrências
    - Manter toda a lógica existente
    - Atualizar registros antigos que possam ter 'entrada'
*/

-- =====================================================
-- 1. ATUALIZAR REGISTROS ANTIGOS
-- =====================================================

-- Corrigir registros existentes que possam ter 'entrada' ao invés de 'income'
UPDATE cash_flow
SET type = 'income'
WHERE type = 'entrada'
  AND business_unit = 'engineering'
  AND category = 'Serviços de Engenharia';

-- =====================================================
-- 2. RECRIAR FUNÇÃO COM TIPO CORRETO
-- =====================================================

CREATE OR REPLACE FUNCTION integrate_payment_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_cash_flow_id uuid;
BEGIN
  -- Buscar informações do projeto e cliente
  SELECT
    p.name,
    c.name
  INTO v_project_name, v_customer_name
  FROM engineering_projects p
  LEFT JOIN customers c ON p.customer_id = c.id
  WHERE p.id = COALESCE(NEW.project_id, OLD.project_id);

  IF TG_OP = 'INSERT' THEN
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
      'income',  -- ✅ CORRIGIDO: era 'entrada'
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

  ELSIF TG_OP = 'UPDATE' THEN
    -- Buscar ID do cash_flow correspondente
    SELECT id INTO v_cash_flow_id
    FROM cash_flow
    WHERE date = OLD.payment_date
      AND type = 'income'  -- ✅ CORRIGIDO: era 'entrada'
      AND category = 'Serviços de Engenharia'
      AND amount = OLD.value
      AND COALESCE(conta_caixa_id::text, '') = COALESCE(OLD.conta_caixa_id::text, '')
      AND business_unit = 'engineering'
      AND created_at >= OLD.created_at - INTERVAL '1 minute'
      AND created_at <= OLD.created_at + INTERVAL '1 minute'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se encontrou, atualizar
    IF v_cash_flow_id IS NOT NULL THEN
      UPDATE cash_flow
      SET
        date = NEW.payment_date,
        amount = NEW.value,
        conta_caixa_id = NEW.conta_caixa_id,
        description = 'Recebimento - Projeto: ' || COALESCE(v_project_name, 'Sem nome') ||
                      ' - Cliente: ' || COALESCE(v_customer_name, 'Não informado'),
        notes = 'Pagamento de projeto de engenharia' ||
                CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END
      WHERE id = v_cash_flow_id;
    ELSE
      -- Se não encontrou (caso de dados antigos), criar novo
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
        'income',  -- ✅ CORRIGIDO: era 'entrada'
        'Serviços de Engenharia',
        'Recebimento - Projeto: ' || COALESCE(v_project_name, 'Sem nome') ||
        ' - Cliente: ' || COALESCE(v_customer_name, 'Não informado'),
        NEW.value,
        NEW.conta_caixa_id,
        'Pagamento de projeto de engenharia' ||
        CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
        'engineering'
      );
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Remover do fluxo de caixa
    DELETE FROM cash_flow
    WHERE date = OLD.payment_date
      AND type = 'income'  -- ✅ CORRIGIDO: era 'entrada'
      AND category = 'Serviços de Engenharia'
      AND amount = OLD.value
      AND COALESCE(conta_caixa_id::text, '') = COALESCE(OLD.conta_caixa_id::text, '')
      AND business_unit = 'engineering'
      AND created_at >= OLD.created_at - INTERVAL '1 minute'
      AND created_at <= OLD.created_at + INTERVAL '1 minute';

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION integrate_payment_to_cash_flow() IS
'Integra pagamentos de projetos de engenharia com o fluxo de caixa usando type=income. Suporta INSERT, UPDATE e DELETE.';

-- =====================================================
-- 3. VERIFICAR SE TRIGGER EXISTE
-- =====================================================

-- O trigger já existe da migration anterior, não precisa recriar

-- =====================================================
-- 4. MENSAGENS FINAIS
-- =====================================================

DO $$
DECLARE
  v_count_updated integer;
BEGIN
  SELECT COUNT(*) INTO v_count_updated
  FROM cash_flow
  WHERE type = 'income'
    AND business_unit = 'engineering'
    AND category = 'Serviços de Engenharia';

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Função integrate_payment_to_cash_flow() corrigida!';
  RAISE NOTICE 'Tipo alterado de "entrada" para "income"';
  RAISE NOTICE 'Total de registros de engenharia no cash_flow: %', v_count_updated;
  RAISE NOTICE 'Agora os recebimentos serão registrados corretamente';
  RAISE NOTICE '==================================================';
END $$;