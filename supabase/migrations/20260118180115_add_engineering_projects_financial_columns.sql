/*
  # Adicionar Colunas Financeiras e de Gestão aos Projetos de Engenharia

  ## Mudanças
  1. Adicionar colunas de valores financeiros
     - `total_actual_value` - Valor total dos serviços
     - `total_additional_costs` - Custos adicionais
     - `total_concrete_markers` - Valor dos marcos de concreto
     - `total_received` - Total de pagamentos recebidos
  
  2. Adicionar colunas de gestão
     - `balance` - Saldo pendente (calculado automaticamente)
  
  ## Notas
  - Todas as colunas numéricas têm valor padrão 0
  - Triggers automáticos sincronizam os totais
*/

-- Adicionar colunas financeiras
ALTER TABLE engineering_projects 
ADD COLUMN IF NOT EXISTS total_actual_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_additional_costs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_concrete_markers numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_received numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0;

-- Criar função para calcular o saldo automaticamente
CREATE OR REPLACE FUNCTION calculate_project_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular saldo: grand_total - total_received
  NEW.balance = COALESCE(NEW.grand_total, 0) - COALESCE(NEW.total_received, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para calcular saldo automaticamente
DROP TRIGGER IF EXISTS calculate_balance_trigger ON engineering_projects;
CREATE TRIGGER calculate_balance_trigger
  BEFORE INSERT OR UPDATE ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION calculate_project_balance();

-- Atualizar projetos existentes
UPDATE engineering_projects
SET 
  total_actual_value = COALESCE(total_actual_value, 0),
  total_additional_costs = COALESCE(total_additional_costs, 0),
  total_concrete_markers = COALESCE(total_concrete_markers, 0),
  total_received = COALESCE(total_received, 0),
  balance = COALESCE(grand_total, 0) - COALESCE(total_received, 0);

-- Criar tabela para pagamentos de projetos de engenharia
CREATE TABLE IF NOT EXISTS engineering_project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  value numeric NOT NULL CHECK (value > 0),
  payment_method text NOT NULL,
  conta_caixa_id uuid REFERENCES contas_caixa(id) ON DELETE SET NULL,
  account_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE engineering_project_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para engineering_project_payments
CREATE POLICY "Permitir acesso total a engineering_project_payments"
  ON engineering_project_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_engineering_project_payments_project_id 
  ON engineering_project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_engineering_project_payments_date 
  ON engineering_project_payments(payment_date);

-- Função para atualizar total_received quando um pagamento é inserido/atualizado/deletado
CREATE OR REPLACE FUNCTION update_project_total_received()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular o total recebido
  UPDATE engineering_projects
  SET total_received = (
    SELECT COALESCE(SUM(value), 0)
    FROM engineering_project_payments
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar total_received
DROP TRIGGER IF EXISTS update_total_received_on_insert ON engineering_project_payments;
CREATE TRIGGER update_total_received_on_insert
  AFTER INSERT ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_project_total_received();

DROP TRIGGER IF EXISTS update_total_received_on_update ON engineering_project_payments;
CREATE TRIGGER update_total_received_on_update
  AFTER UPDATE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_project_total_received();

DROP TRIGGER IF EXISTS update_total_received_on_delete ON engineering_project_payments;
CREATE TRIGGER update_total_received_on_delete
  AFTER DELETE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_project_total_received();

-- Criar função para registrar pagamento no fluxo de caixa
CREATE OR REPLACE FUNCTION create_cash_flow_for_engineering_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
BEGIN
  -- Buscar nome do projeto
  SELECT project_name INTO v_project_name
  FROM engineering_projects
  WHERE id = NEW.project_id;

  -- Inserir no fluxo de caixa
  INSERT INTO cash_flow (
    date,
    type,
    category,
    description,
    value,
    payment_method,
    conta_caixa_id,
    reference_type,
    reference_id
  ) VALUES (
    NEW.payment_date,
    'entrada',
    'Recebimento de Projeto',
    'Pagamento do projeto: ' || COALESCE(v_project_name, 'Sem nome'),
    NEW.value,
    NEW.payment_method,
    NEW.conta_caixa_id,
    'engineering_project_payment',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar entrada no fluxo de caixa
DROP TRIGGER IF EXISTS create_cash_flow_on_payment ON engineering_project_payments;
CREATE TRIGGER create_cash_flow_on_payment
  AFTER INSERT ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_cash_flow_for_engineering_payment();

-- Função para deletar entrada do fluxo de caixa quando pagamento é excluído
CREATE OR REPLACE FUNCTION delete_cash_flow_for_engineering_payment()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cash_flow
  WHERE reference_type = 'engineering_project_payment'
  AND reference_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para deletar entrada do fluxo de caixa
DROP TRIGGER IF EXISTS delete_cash_flow_on_payment_delete ON engineering_project_payments;
CREATE TRIGGER delete_cash_flow_on_payment_delete
  AFTER DELETE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION delete_cash_flow_for_engineering_payment();