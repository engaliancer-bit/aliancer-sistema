/*
  # Corrigir Trigger de Criação Automática de Receitas
  
  1. Problema
    - Trigger estava usando campos errados (amount, description)
    - Campos corretos são (value, notes)
    
  2. Correção
    - Atualizar função para usar campos corretos da tabela engineering_project_payments
    - Manter todas as funcionalidades originais
    
  3. Campos Corretos
    - engineering_project_payments.value (não amount)
    - engineering_project_payments.notes (não description)
    - engineering_project_payments.payment_method (enum, precisa cast)
*/

-- ============================================
-- TRIGGER CORRIGIDO: Criar receita automaticamente ao receber pagamento
-- ============================================
CREATE OR REPLACE FUNCTION auto_create_finance_entry_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_customer_id uuid;
  v_category text;
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
  
  -- Determinar categoria baseado no tipo de pagamento
  -- Se não houver campo específico, assumir honorários
  v_category := 'honorarios';
  
  -- Inserir lançamento de receita
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
    notes
  ) VALUES (
    'receita',
    v_category,
    NEW.value, -- CORRIGIDO: era NEW.amount
    'Recebimento de ' || v_customer_name || ' - ' || v_project_name,
    NEW.project_id,
    v_customer_id,
    NEW.id,
    NEW.payment_method::text, -- CORRIGIDO: adicionado cast
    NEW.payment_date,
    NEW.payment_date,
    'efetivado',
    NEW.notes -- CORRIGIDO: era NEW.description
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger (DROP e CREATE para garantir)
DROP TRIGGER IF EXISTS trigger_auto_create_finance_entry_from_payment ON engineering_project_payments;

CREATE TRIGGER trigger_auto_create_finance_entry_from_payment
  AFTER INSERT ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_finance_entry_from_payment();
