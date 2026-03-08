/*
  # Corrigir Categorização de Receitas e Despesas do Escritório v3
  
  1. Problema Identificado
    - Pagamentos não estão sendo divididos em Honorários e Antecipação/Reembolso
    - Categoria "honorarios" (minúscula) sendo usada incorretamente
    - Falta lançamento de reembolso para projetos com custos adicionais
    - Projetos podem ter honorários = 0 (apenas custos)
    
  2. Categorias Corretas
    - Receitas:
      * "Honorários" - Valor dos honorários profissionais
      * "Antecipação/Reembolso" - Reembolso de custos adicionais pagos
    - Despesas:
      * "Custos do Escritório" - Custos adicionais do projeto
*/

-- ============================================
-- 1. ATUALIZAR CATEGORIAS INCORRETAS
-- ============================================

UPDATE engineering_finance_entries
SET 
  category = 'Honorários',
  updated_at = now()
WHERE category = 'honorarios';

-- ============================================
-- 2. CORRIGIR LANÇAMENTOS EXISTENTES
-- ============================================

DO $$
DECLARE
  v_payment RECORD;
  v_customer_name text;
  v_existing_entry RECORD;
BEGIN
  FOR v_payment IN 
    SELECT 
      p.id as payment_id,
      p.payment_date,
      p.value as valor_total,
      p.payment_method,
      ep.id as project_id,
      ep.customer_id,
      ep.total_actual_value as honorarios,
      ep.total_additional_costs as custos_adicionais,
      ep.name as projeto
    FROM engineering_project_payments p
    JOIN engineering_projects ep ON ep.id = p.project_id
    WHERE ep.total_additional_costs > 0
      AND p.payment_date >= '2026-01-01'
      AND (
        SELECT COUNT(*) 
        FROM engineering_finance_entries f 
        WHERE f.payment_id = p.id
      ) = 1
  LOOP
    SELECT name INTO v_customer_name
    FROM customers
    WHERE id = v_payment.customer_id;
    
    SELECT * INTO v_existing_entry
    FROM engineering_finance_entries
    WHERE payment_id = v_payment.payment_id
    LIMIT 1;
    
    IF v_payment.honorarios > 0 THEN
      UPDATE engineering_finance_entries
      SET 
        amount = v_payment.honorarios,
        category = 'Honorários',
        description = 'Honorários - ' || v_customer_name || ' - ' || v_payment.projeto,
        updated_at = now()
      WHERE id = v_existing_entry.id;
      
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
        status,
        created_at,
        updated_at
      ) VALUES (
        'receita',
        'Antecipação/Reembolso',
        v_payment.custos_adicionais,
        'Reembolso de custos adicionais - ' || v_customer_name || ' - ' || v_payment.projeto,
        v_payment.project_id,
        v_payment.customer_id,
        v_payment.payment_id,
        v_payment.payment_method,
        v_payment.payment_date,
        'efetivado',
        now(),
        now()
      );
      
      RAISE NOTICE 'Dividido: % = Honorários R$ % + Reembolso R$ %', 
        v_payment.projeto, v_payment.honorarios, v_payment.custos_adicionais;
    ELSE
      UPDATE engineering_finance_entries
      SET 
        category = 'Antecipação/Reembolso',
        description = 'Reembolso de custos adicionais - ' || v_customer_name || ' - ' || v_payment.projeto,
        updated_at = now()
      WHERE id = v_existing_entry.id;
      
      RAISE NOTICE 'Corrigido: % como Reembolso (apenas custos)', v_payment.projeto;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 3. RECRIAR TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS auto_create_finance_entry ON engineering_project_payments CASCADE;
DROP TRIGGER IF EXISTS trigger_auto_create_finance_entry_from_payment ON engineering_project_payments CASCADE;
DROP FUNCTION IF EXISTS auto_create_finance_entry_from_payment() CASCADE;

CREATE OR REPLACE FUNCTION auto_create_finance_entry_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name text;
  v_project_name text;
  v_honorarios numeric;
  v_custos_adicionais numeric;
  v_valor_honorarios numeric;
  v_valor_reembolso numeric;
BEGIN
  SELECT 
    ep.name,
    ep.total_actual_value,
    ep.total_additional_costs,
    c.name
  INTO 
    v_project_name,
    v_honorarios,
    v_custos_adicionais,
    v_customer_name
  FROM engineering_projects ep
  LEFT JOIN customers c ON c.id = ep.customer_id
  WHERE ep.id = NEW.project_id;
  
  v_valor_honorarios := LEAST(NEW.value, COALESCE(v_honorarios, 0));
  v_valor_reembolso := GREATEST(0, NEW.value - v_valor_honorarios);
  
  IF v_valor_honorarios > 0 THEN
    INSERT INTO engineering_finance_entries (
      entry_type, category, amount, description,
      project_id, customer_id, payment_id, payment_method,
      entry_date, status, created_at, updated_at
    ) VALUES (
      'receita', 'Honorários', v_valor_honorarios,
      'Honorários - ' || COALESCE(v_customer_name, 'Cliente') || ' - ' || v_project_name,
      NEW.project_id,
      (SELECT customer_id FROM engineering_projects WHERE id = NEW.project_id),
      NEW.id, NEW.payment_method, NEW.payment_date,
      'efetivado', now(), now()
    );
  END IF;
  
  IF v_valor_reembolso > 0 THEN
    INSERT INTO engineering_finance_entries (
      entry_type, category, amount, description,
      project_id, customer_id, payment_id, payment_method,
      entry_date, status, created_at, updated_at
    ) VALUES (
      'receita', 'Antecipação/Reembolso', v_valor_reembolso,
      'Reembolso de custos adicionais - ' || COALESCE(v_customer_name, 'Cliente') || ' - ' || v_project_name,
      NEW.project_id,
      (SELECT customer_id FROM engineering_projects WHERE id = NEW.project_id),
      NEW.id, NEW.payment_method, NEW.payment_date,
      'efetivado', now(), now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_finance_entry_from_payment
  AFTER INSERT ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_finance_entry_from_payment();

-- ============================================
-- 4. TRIGGER PARA DESPESAS DE CUSTOS
-- ============================================

DROP TRIGGER IF EXISTS auto_create_expense_on_project ON engineering_projects CASCADE;
DROP FUNCTION IF EXISTS auto_create_expense_for_additional_costs() CASCADE;

CREATE OR REPLACE FUNCTION auto_create_expense_for_additional_costs()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_expense_id uuid;
BEGIN
  SELECT id INTO v_existing_expense_id
  FROM engineering_finance_entries
  WHERE project_id = NEW.id
    AND entry_type = 'despesa'
    AND category = 'Custos do Escritório'
  LIMIT 1;
  
  IF COALESCE(NEW.total_additional_costs, 0) > 0 THEN
    IF v_existing_expense_id IS NULL THEN
      INSERT INTO engineering_finance_entries (
        entry_type, category, amount, description,
        project_id, customer_id, entry_date,
        status, created_at, updated_at
      ) VALUES (
        'despesa', 'Custos do Escritório', NEW.total_additional_costs,
        'Custos adicionais - ' || NEW.name,
        NEW.id, NEW.customer_id, NEW.start_date,
        'efetivado', now(), now()
      );
    ELSE
      UPDATE engineering_finance_entries
      SET amount = NEW.total_additional_costs, updated_at = now()
      WHERE id = v_existing_expense_id;
    END IF;
  ELSIF v_existing_expense_id IS NOT NULL THEN
    DELETE FROM engineering_finance_entries
    WHERE id = v_existing_expense_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_expense_on_project
  AFTER INSERT OR UPDATE OF total_additional_costs
  ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_expense_for_additional_costs();

-- ============================================
-- 5. VERIFICAÇÃO FINAL
-- ============================================
DO $$
DECLARE
  v_total_receitas numeric;
  v_total_despesas numeric;
  v_total_honorarios numeric;
  v_total_reembolsos numeric;
  v_total_custos numeric;
  v_saldo numeric;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN entry_type = 'receita' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'despesa' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Honorários' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Antecipação/Reembolso' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category = 'Custos do Escritório' THEN amount ELSE 0 END), 0)
  INTO 
    v_total_receitas,
    v_total_despesas,
    v_total_honorarios,
    v_total_reembolsos,
    v_total_custos
  FROM engineering_finance_entries;
  
  v_saldo := v_total_receitas - v_total_despesas;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'CATEGORIZAÇÃO DE RECEITAS E DESPESAS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Receitas Totais: R$ %', v_total_receitas;
  RAISE NOTICE '  Honorários: R$ %', v_total_honorarios;
  RAISE NOTICE '  Reembolsos: R$ %', v_total_reembolsos;
  RAISE NOTICE '';
  RAISE NOTICE 'Despesas Totais: R$ %', v_total_despesas;
  RAISE NOTICE '  Custos: R$ %', v_total_custos;
  RAISE NOTICE '';
  RAISE NOTICE 'Saldo Final: R$ %', v_saldo;
  RAISE NOTICE '============================================';
END $$;
