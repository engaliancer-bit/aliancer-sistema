/*
  # Sistema de Receitas/Despesas do Escritório de Engenharia
  
  1. Novas Tabelas
    - `engineering_finance_entries`: Lançamentos financeiros do escritório
    - `engineering_project_advances`: Antecipações feitas pelo escritório para clientes
    
  2. Funcionalidades
    - Registro de todas receitas e despesas do escritório
    - Integração automática com recebimentos de clientes
    - Sistema de antecipações que adiciona débito ao cliente
    - Classificação de receitas (Honorários, Antecipação/Reembolso, Outras)
    - Classificação de despesas (Antecipações, Operacionais, Outras)
    - Relatórios segregados por tipo de receita
    
  3. Regras de Negócio
    - Recebimentos de clientes geram receita automaticamente
    - Receitas de honorários vs receitas de reembolso separadas
    - Antecipações adicionam ao grand_total do projeto
    - Sistema de rastreamento completo
    
  4. Segurança
    - RLS habilitado em todas as tabelas
    - Acesso público para simplicidade operacional
*/

-- ============================================
-- TABELA: Lançamentos Financeiros do Escritório
-- ============================================
CREATE TABLE IF NOT EXISTS engineering_finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo e Categoria
  entry_type text NOT NULL CHECK (entry_type IN ('receita', 'despesa')),
  category text NOT NULL,
  -- Categorias de Receita: 'honorarios', 'antecipacao_reembolso', 'outras_receitas'
  -- Categorias de Despesa: 'antecipacao_cliente', 'operacional', 'outras_despesas'
  
  -- Valores
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  
  -- Vínculos
  project_id uuid REFERENCES engineering_projects(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES engineering_project_payments(id) ON DELETE SET NULL,
  advance_id uuid, -- Referência para engineering_project_advances
  
  -- Dados bancários
  bank_account text,
  payment_method text CHECK (payment_method IN ('dinheiro', 'pix', 'transferencia', 'cheque', 'cartao', 'boleto')),
  
  -- Datas
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  paid_date date,
  
  -- Status
  status text NOT NULL DEFAULT 'efetivado' CHECK (status IN ('pendente', 'efetivado', 'cancelado')),
  
  -- Observações
  notes text,
  
  -- Metadados
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- TABELA: Antecipações para Projetos
-- ============================================
CREATE TABLE IF NOT EXISTS engineering_project_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo com projeto e cliente
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Informações da antecipação
  description text NOT NULL,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  
  -- Tipo de antecipação
  advance_type text NOT NULL CHECK (advance_type IN ('taxa', 'material', 'servico_terceiro', 'deslocamento', 'outros')),
  
  -- Datas
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Status de reembolso
  reimbursed boolean DEFAULT false,
  reimbursed_date date,
  reimbursement_payment_id uuid REFERENCES engineering_project_payments(id) ON DELETE SET NULL,
  
  -- Observações
  notes text,
  
  -- Lançamento financeiro associado
  finance_entry_id uuid REFERENCES engineering_finance_entries(id) ON DELETE SET NULL,
  
  -- Metadados
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar foreign key de volta para engineering_finance_entries
ALTER TABLE engineering_finance_entries 
  ADD CONSTRAINT fk_advance_id 
  FOREIGN KEY (advance_id) 
  REFERENCES engineering_project_advances(id) 
  ON DELETE SET NULL;

-- ============================================
-- ÍNDICES para Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_finance_entries_type ON engineering_finance_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_finance_entries_category ON engineering_finance_entries(category);
CREATE INDEX IF NOT EXISTS idx_finance_entries_project ON engineering_finance_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_customer ON engineering_finance_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_date ON engineering_finance_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_entries_payment ON engineering_finance_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_status ON engineering_finance_entries(status);

CREATE INDEX IF NOT EXISTS idx_project_advances_project ON engineering_project_advances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_advances_customer ON engineering_project_advances(customer_id);
CREATE INDEX IF NOT EXISTS idx_project_advances_reimbursed ON engineering_project_advances(reimbursed);
CREATE INDEX IF NOT EXISTS idx_project_advances_date ON engineering_project_advances(advance_date);

-- ============================================
-- RLS: Engineering Finance Entries
-- ============================================
ALTER TABLE engineering_finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso público engineering_finance_entries"
  ON engineering_finance_entries FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RLS: Engineering Project Advances
-- ============================================
ALTER TABLE engineering_project_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso público engineering_project_advances"
  ON engineering_project_advances FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TRIGGER: Criar receita automaticamente ao receber pagamento
-- ============================================
CREATE OR REPLACE FUNCTION auto_create_finance_entry_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_category text;
BEGIN
  -- Buscar informações do projeto e cliente
  SELECT 
    ep.name,
    c.name
  INTO v_project_name, v_customer_name
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
    NEW.amount,
    'Recebimento de ' || v_customer_name || ' - ' || v_project_name,
    NEW.project_id,
    (SELECT customer_id FROM engineering_projects WHERE id = NEW.project_id),
    NEW.id,
    NEW.payment_method,
    NEW.payment_date,
    NEW.payment_date,
    'efetivado',
    NEW.description
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_finance_entry_from_payment
  AFTER INSERT ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_finance_entry_from_payment();

-- ============================================
-- TRIGGER: Adicionar antecipação ao grand_total do projeto
-- ============================================
CREATE OR REPLACE FUNCTION add_advance_to_project_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar grand_total do projeto
  UPDATE engineering_projects
  SET 
    grand_total = grand_total + NEW.amount,
    balance = balance + NEW.amount,
    updated_at = now()
  WHERE id = NEW.project_id;
  
  -- Criar lançamento de despesa
  INSERT INTO engineering_finance_entries (
    entry_type,
    category,
    amount,
    description,
    project_id,
    customer_id,
    advance_id,
    entry_date,
    paid_date,
    status,
    notes
  ) VALUES (
    'despesa',
    'antecipacao_cliente',
    NEW.amount,
    'Antecipação: ' || NEW.description,
    NEW.project_id,
    NEW.customer_id,
    NEW.id,
    NEW.advance_date,
    NEW.advance_date,
    'efetivado',
    NEW.notes
  );
  
  -- Atualizar finance_entry_id na tabela de antecipações
  UPDATE engineering_project_advances
  SET finance_entry_id = (
    SELECT id FROM engineering_finance_entries 
    WHERE advance_id = NEW.id 
    LIMIT 1
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_advance_to_project_total
  AFTER INSERT ON engineering_project_advances
  FOR EACH ROW
  EXECUTE FUNCTION add_advance_to_project_total();

-- ============================================
-- TRIGGER: Marcar antecipação como reembolsada ao receber pagamento
-- ============================================
CREATE OR REPLACE FUNCTION mark_advance_as_reimbursed()
RETURNS TRIGGER AS $$
DECLARE
  v_total_advances decimal(15,2);
  v_total_reimbursed decimal(15,2);
  v_advance_record RECORD;
BEGIN
  -- Buscar antecipações não reembolsadas do projeto
  FOR v_advance_record IN 
    SELECT id, amount 
    FROM engineering_project_advances
    WHERE project_id = NEW.project_id 
      AND reimbursed = false
    ORDER BY advance_date ASC
  LOOP
    -- Marcar como reembolsada
    UPDATE engineering_project_advances
    SET 
      reimbursed = true,
      reimbursed_date = NEW.payment_date,
      reimbursement_payment_id = NEW.id,
      updated_at = now()
    WHERE id = v_advance_record.id;
    
    -- Atualizar categoria do lançamento de receita para antecipacao_reembolso
    UPDATE engineering_finance_entries
    SET category = 'antecipacao_reembolso'
    WHERE payment_id = NEW.id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Nota: Este trigger só marca antecipações quando há pagamento
-- A lógica pode ser refinada para marcar proporcionalmente

-- ============================================
-- VIEW: Resumo Financeiro do Escritório
-- ============================================
CREATE OR REPLACE VIEW engineering_finance_summary AS
SELECT
  DATE_TRUNC('month', entry_date) as month,
  entry_type,
  category,
  COUNT(*) as total_entries,
  SUM(amount) as total_amount,
  SUM(CASE WHEN status = 'efetivado' THEN amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN status = 'pendente' THEN amount ELSE 0 END) as total_pending,
  SUM(CASE WHEN status = 'cancelado' THEN amount ELSE 0 END) as total_canceled
FROM engineering_finance_entries
GROUP BY DATE_TRUNC('month', entry_date), entry_type, category
ORDER BY month DESC, entry_type, category;

-- ============================================
-- VIEW: Resumo de Antecipações por Projeto
-- ============================================
CREATE OR REPLACE VIEW engineering_project_advances_summary AS
SELECT
  p.id as project_id,
  p.name as project_name,
  c.name as customer_name,
  COUNT(a.id) as total_advances,
  SUM(a.amount) as total_amount,
  SUM(CASE WHEN a.reimbursed THEN a.amount ELSE 0 END) as total_reimbursed,
  SUM(CASE WHEN NOT a.reimbursed THEN a.amount ELSE 0 END) as total_pending,
  MAX(a.advance_date) as last_advance_date
FROM engineering_projects p
LEFT JOIN engineering_project_advances a ON a.project_id = p.id
LEFT JOIN customers c ON c.id = p.customer_id
GROUP BY p.id, p.name, c.name
HAVING COUNT(a.id) > 0
ORDER BY total_pending DESC, last_advance_date DESC;

-- ============================================
-- FUNÇÃO: Obter saldo financeiro do escritório
-- ============================================
CREATE OR REPLACE FUNCTION get_engineering_finance_balance(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  total_receitas decimal,
  total_despesas decimal,
  saldo decimal,
  receitas_honorarios decimal,
  receitas_reembolsos decimal,
  receitas_outras decimal,
  despesas_antecipacoes decimal,
  despesas_operacionais decimal,
  despesas_outras decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'receita' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as total_receitas,
    COALESCE(SUM(CASE WHEN entry_type = 'despesa' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as total_despesas,
    COALESCE(SUM(CASE WHEN entry_type = 'receita' AND status = 'efetivado' THEN amount ELSE -amount END), 0) as saldo,
    COALESCE(SUM(CASE WHEN entry_type = 'receita' AND category = 'honorarios' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as receitas_honorarios,
    COALESCE(SUM(CASE WHEN entry_type = 'receita' AND category = 'antecipacao_reembolso' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as receitas_reembolsos,
    COALESCE(SUM(CASE WHEN entry_type = 'receita' AND category = 'outras_receitas' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as receitas_outras,
    COALESCE(SUM(CASE WHEN entry_type = 'despesa' AND category = 'antecipacao_cliente' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as despesas_antecipacoes,
    COALESCE(SUM(CASE WHEN entry_type = 'despesa' AND category = 'operacional' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as despesas_operacionais,
    COALESCE(SUM(CASE WHEN entry_type = 'despesa' AND category = 'outras_despesas' AND status = 'efetivado' THEN amount ELSE 0 END), 0) as despesas_outras
  FROM engineering_finance_entries
  WHERE 
    (p_start_date IS NULL OR entry_date >= p_start_date)
    AND (p_end_date IS NULL OR entry_date <= p_end_date);
END;
$$ LANGUAGE plpgsql;
