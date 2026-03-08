/*
  # Sistema de Categorias Customizáveis e Recorrência de Salários CLT

  1. Novas Tabelas
    - `engineering_expense_categories`: Categorias de despesas customizáveis pelo usuário
    - `engineering_payroll_schedule`: Controle de recorrência de pagamento de salários CLT

  2. Alterações em Tabelas Existentes
    - `employees`: Adicionar dia de pagamento de salário (recorrência)
    - `engineering_finance_entries`: Adicionar vínculo com categoria customizada e payroll_schedule

  3. Funcionalidades
    - Usuário pode criar suas próprias categorias de despesas
    - Sistema de recorrência mensal para salários CLT
    - Notificação automática para incluir salários do mês
    - Confirmação individual de cada salário
    - Possibilidade de editar benefício antes de confirmar

  4. Regras de Negócio
    - Apenas colaboradores CLT têm recorrência de salário
    - Pagamentos são sugeridos conforme dia de recorrência
    - Usuário confirma individualmente cada colaborador
    - Valor base: base_salary
    - Valor adicional: benefits (editável na confirmação)

  5. Segurança
    - RLS habilitado
    - Acesso público para operações do escritório
*/

-- ============================================
-- TABELA: Categorias de Despesas Customizáveis
-- ============================================
CREATE TABLE IF NOT EXISTS engineering_expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_custom boolean NOT NULL DEFAULT true,
  color text,
  active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- TABELA: Controle de Pagamentos de Salário
-- ============================================
CREATE TABLE IF NOT EXISTS engineering_payroll_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary decimal(15,2) NOT NULL,
  benefits decimal(15,2) DEFAULT 0,
  total_amount decimal(15,2) GENERATED ALWAYS AS (base_salary + COALESCE(benefits, 0)) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid', 'skipped')),
  expected_payment_date date NOT NULL,
  finance_entry_id uuid REFERENCES engineering_finance_entries(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(employee_id, year, month)
);

-- ============================================
-- ALTERAR: employees (Adicionar Recorrência)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'salary_payment_day'
  ) THEN
    ALTER TABLE employees ADD COLUMN salary_payment_day integer CHECK (salary_payment_day BETWEEN 1 AND 31);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'auto_payroll_enabled'
  ) THEN
    ALTER TABLE employees ADD COLUMN auto_payroll_enabled boolean DEFAULT true;
  END IF;
END $$;

-- ============================================
-- ALTERAR: engineering_finance_entries
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_finance_entries' AND column_name = 'custom_category_id'
  ) THEN
    ALTER TABLE engineering_finance_entries
    ADD COLUMN custom_category_id uuid REFERENCES engineering_expense_categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_finance_entries' AND column_name = 'payroll_schedule_id'
  ) THEN
    ALTER TABLE engineering_finance_entries
    ADD COLUMN payroll_schedule_id uuid REFERENCES engineering_payroll_schedule(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_finance_entries' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE engineering_finance_entries
    ADD COLUMN employee_id uuid REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- POPULAR: Categorias Padrão do Sistema
-- ============================================
INSERT INTO engineering_expense_categories (name, description, is_custom, color, display_order, active)
VALUES
  ('Salários e Encargos', 'Pagamento de salários e encargos trabalhistas', false, '#3B82F6', 1, true),
  ('Antecipações a Clientes', 'Valores antecipados para execução de projetos', false, '#8B5CF6', 2, true),
  ('Despesas Operacionais', 'Despesas gerais de operação do escritório', false, '#10B981', 3, true),
  ('Outras Despesas', 'Demais despesas não categorizadas', false, '#6B7280', 4, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- FUNÇÃO: Gerar Agendamento de Salários do Mês
-- ============================================
CREATE OR REPLACE FUNCTION generate_monthly_payroll_schedule(
  p_year integer,
  p_month integer
) RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  base_salary decimal,
  benefits decimal,
  expected_date date,
  schedule_id uuid
) AS $$
BEGIN
  INSERT INTO engineering_payroll_schedule (
    year, month, employee_id, base_salary, benefits, expected_payment_date, status
  )
  SELECT
    e.id,
    p_year,
    p_month,
    COALESCE(e.base_salary, 0),
    COALESCE(e.benefits, 0),
    make_date(
      p_year, p_month,
      LEAST(e.salary_payment_day,
        EXTRACT(DAY FROM date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month - 1 day')::integer
      )
    ),
    'pending'
  FROM employees e
  WHERE e.employment_type = 'clt'
    AND e.active = true
    AND COALESCE(e.auto_payroll_enabled, true) = true
    AND e.salary_payment_day IS NOT NULL
    AND e.business_unit = 'engineering'
    AND NOT EXISTS (
      SELECT 1 FROM engineering_payroll_schedule ps
      WHERE ps.employee_id = e.id AND ps.year = p_year AND ps.month = p_month
    );

  RETURN QUERY
  SELECT ps.employee_id, e.name, ps.base_salary, ps.benefits, ps.expected_payment_date, ps.id
  FROM engineering_payroll_schedule ps
  JOIN employees e ON e.id = ps.employee_id
  WHERE ps.year = p_year AND ps.month = p_month AND ps.status = 'pending'
  ORDER BY ps.expected_payment_date, e.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Confirmar Pagamento de Salário
-- ============================================
CREATE OR REPLACE FUNCTION confirm_payroll_payment(
  p_schedule_id uuid,
  p_benefits decimal DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_payment_method text DEFAULT 'transferencia',
  p_bank_account text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_schedule engineering_payroll_schedule;
  v_employee employees;
  v_finance_entry_id uuid;
  v_category_id uuid;
  v_final_benefits decimal;
BEGIN
  SELECT * INTO v_schedule FROM engineering_payroll_schedule WHERE id = p_schedule_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF v_schedule.status != 'pending' THEN RAISE EXCEPTION 'Agendamento já foi processado'; END IF;

  SELECT * INTO v_employee FROM employees WHERE id = v_schedule.employee_id;
  v_final_benefits := COALESCE(p_benefits, v_schedule.benefits);

  SELECT id INTO v_category_id FROM engineering_expense_categories
  WHERE name = 'Salários e Encargos' AND is_custom = false LIMIT 1;

  INSERT INTO engineering_finance_entries (
    entry_type, category, custom_category_id, amount, description,
    employee_id, payroll_schedule_id, entry_date, paid_date,
    payment_method, bank_account, status, notes, created_by
  ) VALUES (
    'despesa', 'salario_clt', v_category_id,
    v_schedule.base_salary + COALESCE(v_final_benefits, 0),
    'Pagamento de salário - ' || v_employee.name || ' - ' ||
      to_char(make_date(v_schedule.year, v_schedule.month, 1), 'MM/YYYY'),
    v_employee.id, p_schedule_id, p_payment_date, p_payment_date,
    p_payment_method, p_bank_account, 'efetivado',
    COALESCE(p_notes, 'Salário base: R$ ' || v_schedule.base_salary ||
      CASE WHEN v_final_benefits > 0 THEN ' + Benefícios: R$ ' || v_final_benefits ELSE '' END),
    p_user_id
  ) RETURNING id INTO v_finance_entry_id;

  UPDATE engineering_payroll_schedule
  SET status = 'confirmed', benefits = v_final_benefits, finance_entry_id = v_finance_entry_id,
      confirmed_at = now(), confirmed_by = p_user_id, updated_at = now()
  WHERE id = p_schedule_id;

  RETURN v_finance_entry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO: Pular Pagamento
-- ============================================
CREATE OR REPLACE FUNCTION skip_payroll_payment(
  p_schedule_id uuid,
  p_reason text DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
  UPDATE engineering_payroll_schedule
  SET status = 'skipped', notes = COALESCE(p_reason, 'Pagamento pulado'), updated_at = now()
  WHERE id = p_schedule_id AND status = 'pending';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Salários Pendentes do Mês Atual
-- ============================================
CREATE OR REPLACE VIEW v_pending_payroll_current_month AS
SELECT
  ps.id as schedule_id, ps.year, ps.month, ps.employee_id,
  e.name as employee_name, e.role as employee_role,
  ps.base_salary, ps.benefits, ps.total_amount, ps.expected_payment_date,
  ps.status, ps.notes,
  CASE WHEN ps.expected_payment_date < CURRENT_DATE THEN true ELSE false END as is_overdue
FROM engineering_payroll_schedule ps
JOIN employees e ON e.id = ps.employee_id
WHERE ps.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.month = EXTRACT(MONTH FROM CURRENT_DATE)
  AND ps.status = 'pending'
ORDER BY ps.expected_payment_date, e.name;

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_engineering_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON engineering_expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON engineering_expense_categories
  FOR EACH ROW EXECUTE FUNCTION update_engineering_tables_updated_at();

DROP TRIGGER IF EXISTS update_payroll_schedule_updated_at ON engineering_payroll_schedule;
CREATE TRIGGER update_payroll_schedule_updated_at
  BEFORE UPDATE ON engineering_payroll_schedule
  FOR EACH ROW EXECUTE FUNCTION update_engineering_tables_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE engineering_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_payroll_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso público a categorias de despesas" ON engineering_expense_categories;
CREATE POLICY "Acesso público a categorias de despesas"
  ON engineering_expense_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público a agendamento de folha" ON engineering_payroll_schedule;
CREATE POLICY "Acesso público a agendamento de folha"
  ON engineering_payroll_schedule FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expense_categories_active
  ON engineering_expense_categories(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_year_month
  ON engineering_payroll_schedule(year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_status
  ON engineering_payroll_schedule(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payroll_schedule_employee
  ON engineering_payroll_schedule(employee_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_payroll
  ON engineering_finance_entries(payroll_schedule_id) WHERE payroll_schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_entries_employee
  ON engineering_finance_entries(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_entries_custom_category
  ON engineering_finance_entries(custom_category_id) WHERE custom_category_id IS NOT NULL;