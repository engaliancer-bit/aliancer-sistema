/*
  # Adicionar Triggers de UPDATE e DELETE para Sincronização
  
  1. Problema
    - Apenas INSERT estava sendo sincronizado
    - Se editar ou excluir um pagamento, a receita ficava desatualizada
    
  2. Solução
    - Trigger de UPDATE: atualizar a receita correspondente
    - Trigger de DELETE: excluir a receita correspondente
    
  3. Segurança
    - Manter integridade referencial
    - Prevenir registros órfãos
*/

-- ============================================
-- TRIGGER: Atualizar receita quando pagamento for editado
-- ============================================
CREATE OR REPLACE FUNCTION update_finance_entry_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_customer_id uuid;
BEGIN
  -- Buscar informações do projeto e cliente
  SELECT 
    ep.name,
    c.name,
    c.id
  INTO v_project_name, v_customer_name, v_customer_id
  FROM engineering_projects ep
  JOIN customers c ON c.id = ep.customer_id
  WHERE ep.id = NEW.project_id;
  
  -- Atualizar lançamento de receita correspondente
  UPDATE engineering_finance_entries
  SET
    amount = NEW.value,
    description = 'Recebimento de ' || v_customer_name || ' - ' || v_project_name,
    project_id = NEW.project_id,
    customer_id = v_customer_id,
    payment_method = NEW.payment_method::text,
    entry_date = NEW.payment_date,
    paid_date = NEW.payment_date,
    notes = NEW.notes,
    updated_at = now()
  WHERE payment_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_finance_entry_from_payment
  AFTER UPDATE ON engineering_project_payments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_finance_entry_from_payment();

-- ============================================
-- TRIGGER: Excluir receita quando pagamento for excluído
-- ============================================
CREATE OR REPLACE FUNCTION delete_finance_entry_from_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Excluir lançamento de receita correspondente
  DELETE FROM engineering_finance_entries
  WHERE payment_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_finance_entry_from_payment
  BEFORE DELETE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION delete_finance_entry_from_payment();
