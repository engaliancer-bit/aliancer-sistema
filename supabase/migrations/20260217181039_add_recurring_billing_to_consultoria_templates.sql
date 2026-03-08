/*
  # Sistema de Cobrança Recorrente Mensal para Consultoria

  ## Descrição
  Adiciona campos para permitir cobrança mensal recorrente em templates de consultoria:
  - Campo para marcar se o serviço tem periodicidade mensal
  - Campo para definir o dia do vencimento mensal
  - Sistema automático de geração de cobranças mensais

  ## Alterações na Tabela `engineering_service_templates`
  
  ### Novos Campos:
  - `is_recurring_monthly` (boolean) - Indica se o serviço tem cobrança mensal recorrente
  - `recurring_due_day` (integer) - Dia do mês para vencimento (1-31)
  - `recurring_description` (text) - Descrição adicional para cobranças recorrentes

  ## Nova Tabela `engineering_recurring_charges`
  
  Armazena as cobranças geradas automaticamente para contratos de consultoria:
  - `id` (uuid, PK) - Identificador único
  - `project_id` (uuid, FK) - Referência ao projeto
  - `charge_date` (date) - Data da cobrança
  - `due_date` (date) - Data de vencimento
  - `amount` (decimal) - Valor da cobrança
  - `description` (text) - Descrição da cobrança
  - `status` (text) - Status: 'pending', 'paid', 'overdue', 'cancelled'
  - `payment_id` (uuid, FK nullable) - Referência ao pagamento se pago
  - `created_at` (timestamptz) - Data de criação
  - `generated_automatically` (boolean) - Se foi gerado automaticamente

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas de acesso público (padrão do sistema)
*/

-- Adicionar campos de cobrança recorrente à tabela de templates
ALTER TABLE engineering_service_templates
ADD COLUMN IF NOT EXISTS is_recurring_monthly boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_due_day integer DEFAULT 1 CHECK (recurring_due_day >= 1 AND recurring_due_day <= 31),
ADD COLUMN IF NOT EXISTS recurring_description text DEFAULT '';

-- Criar comentários explicativos
COMMENT ON COLUMN engineering_service_templates.is_recurring_monthly IS 'Indica se o serviço tem cobrança mensal recorrente (contratos de consultoria)';
COMMENT ON COLUMN engineering_service_templates.recurring_due_day IS 'Dia do mês para vencimento das cobranças recorrentes (1-31)';
COMMENT ON COLUMN engineering_service_templates.recurring_description IS 'Descrição adicional para cobranças recorrentes';

-- Criar tabela de cobranças recorrentes
CREATE TABLE IF NOT EXISTS engineering_recurring_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  charge_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  amount decimal(10, 2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_id uuid REFERENCES engineering_finance_entries(id) ON DELETE SET NULL,
  generated_automatically boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_recurring_charges_project ON engineering_recurring_charges(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_due_date ON engineering_recurring_charges(due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_status ON engineering_recurring_charges(status);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_charge_date ON engineering_recurring_charges(charge_date);

-- Criar índice composto para buscar cobranças de um projeto por mês
CREATE INDEX IF NOT EXISTS idx_recurring_charges_project_month ON engineering_recurring_charges(project_id, charge_date);

-- Habilitar RLS
ALTER TABLE engineering_recurring_charges ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
CREATE POLICY "Permitir leitura pública de cobranças recorrentes"
  ON engineering_recurring_charges
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção pública de cobranças recorrentes"
  ON engineering_recurring_charges
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de cobranças recorrentes"
  ON engineering_recurring_charges
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão pública de cobranças recorrentes"
  ON engineering_recurring_charges
  FOR DELETE
  TO public
  USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_recurring_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_recurring_charges_updated_at
  BEFORE UPDATE ON engineering_recurring_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_charges_updated_at();

-- Trigger para atualizar status para 'overdue' automaticamente
CREATE OR REPLACE FUNCTION update_recurring_charge_overdue_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.due_date < CURRENT_DATE THEN
    NEW.status = 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_recurring_charge_overdue
  BEFORE UPDATE ON engineering_recurring_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_charge_overdue_status();

-- Função para gerar cobrança mensal automaticamente
CREATE OR REPLACE FUNCTION generate_monthly_recurring_charge(
  p_project_id uuid,
  p_charge_month date
)
RETURNS uuid AS $$
DECLARE
  v_project RECORD;
  v_template RECORD;
  v_due_date date;
  v_charge_id uuid;
  v_charge_exists boolean;
BEGIN
  -- Buscar informações do projeto
  SELECT 
    ep.*,
    est.fees,
    est.recurring_due_day,
    est.recurring_description,
    est.is_recurring_monthly
  INTO v_project
  FROM engineering_projects ep
  INNER JOIN engineering_service_templates est ON ep.template_id = est.id
  WHERE ep.id = p_project_id
    AND est.is_recurring_monthly = true
    AND ep.status != 'concluido'
    AND ep.status != 'cancelado';

  -- Se não encontrou projeto ou não é recorrente, retornar null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Verificar se já existe cobrança para este mês
  SELECT EXISTS(
    SELECT 1 
    FROM engineering_recurring_charges
    WHERE project_id = p_project_id
      AND date_trunc('month', charge_date) = date_trunc('month', p_charge_month)
  ) INTO v_charge_exists;

  -- Se já existe, não criar duplicata
  IF v_charge_exists THEN
    RETURN NULL;
  END IF;

  -- Calcular data de vencimento
  v_due_date := make_date(
    extract(year from p_charge_month)::int,
    extract(month from p_charge_month)::int,
    LEAST(v_project.recurring_due_day, 
          extract(day from (date_trunc('month', p_charge_month) + interval '1 month' - interval '1 day'))::int)
  );

  -- Criar cobrança
  INSERT INTO engineering_recurring_charges (
    project_id,
    charge_date,
    due_date,
    amount,
    description,
    status,
    generated_automatically
  ) VALUES (
    p_project_id,
    p_charge_month,
    v_due_date,
    v_project.fees,
    COALESCE(
      NULLIF(v_project.recurring_description, ''),
      'Mensalidade de consultoria - ' || to_char(p_charge_month, 'MM/YYYY')
    ),
    'pending',
    true
  )
  RETURNING id INTO v_charge_id;

  RETURN v_charge_id;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar cobranças do mês atual para todos os projetos recorrentes
CREATE OR REPLACE FUNCTION generate_all_monthly_charges()
RETURNS TABLE(
  project_id uuid,
  project_name text,
  charge_id uuid,
  amount decimal,
  due_date date
) AS $$
DECLARE
  v_project RECORD;
  v_charge_id uuid;
  v_current_month date;
BEGIN
  v_current_month := date_trunc('month', CURRENT_DATE)::date;
  
  -- Buscar todos os projetos com cobrança recorrente ativa
  FOR v_project IN
    SELECT 
      ep.id,
      ep.name,
      est.fees,
      est.recurring_due_day
    FROM engineering_projects ep
    INNER JOIN engineering_service_templates est ON ep.template_id = est.id
    WHERE est.is_recurring_monthly = true
      AND ep.status NOT IN ('concluido', 'cancelado')
  LOOP
    -- Tentar gerar cobrança para este projeto
    v_charge_id := generate_monthly_recurring_charge(v_project.id, v_current_month);
    
    -- Se gerou uma nova cobrança, retornar informações
    IF v_charge_id IS NOT NULL THEN
      RETURN QUERY
      SELECT 
        rc.project_id,
        v_project.name,
        rc.id,
        rc.amount,
        rc.due_date
      FROM engineering_recurring_charges rc
      WHERE rc.id = v_charge_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- View para listar cobranças pendentes e vencidas
CREATE OR REPLACE VIEW v_recurring_charges_pending AS
SELECT 
  rc.id,
  rc.project_id,
  ep.name as project_name,
  c.name as customer_name,
  rc.charge_date,
  rc.due_date,
  rc.amount,
  rc.description,
  rc.status,
  CASE 
    WHEN rc.due_date < CURRENT_DATE THEN CURRENT_DATE - rc.due_date
    ELSE 0
  END as days_overdue,
  rc.created_at
FROM engineering_recurring_charges rc
INNER JOIN engineering_projects ep ON rc.project_id = ep.id
INNER JOIN customers c ON ep.customer_id = c.id
WHERE rc.status IN ('pending', 'overdue')
ORDER BY rc.due_date;

-- Comentários na view
COMMENT ON VIEW v_recurring_charges_pending IS 'View para visualizar cobranças recorrentes pendentes e vencidas com informações do projeto e cliente';
