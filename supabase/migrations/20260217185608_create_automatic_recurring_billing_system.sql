/*
  # Sistema de Cobrança Recorrente Automática para Consultorias

  ## Descrição
  Cria sistema completo para gerar automaticamente cobranças mensais recorrentes
  desde a data de início do projeto até a data atual, com vencimento no dia
  especificado no template.

  ## Alterações

  ### 1. Tabela `engineering_recurring_charges`
  - Armazena todas as cobranças recorrentes geradas
  - Vincula projeto, valor, vencimento e status

  ### 2. Function `generate_recurring_charges_for_project`
  - Gera cobranças desde a data de início até hoje
  - Respeita o dia de vencimento configurado no template
  - Evita duplicatas
  - Status inicial: 'pending'

  ### 3. Trigger `auto_generate_recurring_charges`
  - Dispara automaticamente ao criar projeto com template recorrente
  - Gera todas as cobranças retroativas

  ### 4. Function `generate_all_recurring_charges`
  - Função manual para gerar cobranças de todos os projetos ativos
  - Útil para gerar cobranças do mês seguinte

  ## Segurança
  - RLS habilitado para todas as tabelas
  - Políticas de acesso completas
*/

-- Criar tabela de cobranças recorrentes
CREATE TABLE IF NOT EXISTS engineering_recurring_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_date date,
  payment_id uuid REFERENCES engineering_finance_entries(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recurring_charges_project ON engineering_recurring_charges(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_due_date ON engineering_recurring_charges(due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_status ON engineering_recurring_charges(status);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_project_due ON engineering_recurring_charges(project_id, due_date);

-- RLS
ALTER TABLE engineering_recurring_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to recurring charges"
  ON engineering_recurring_charges FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to recurring charges"
  ON engineering_recurring_charges FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to recurring charges"
  ON engineering_recurring_charges FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to recurring charges"
  ON engineering_recurring_charges FOR DELETE
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_recurring_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_charges_updated_at
  BEFORE UPDATE ON engineering_recurring_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_charges_updated_at();

-- Function para gerar cobranças recorrentes de um projeto
CREATE OR REPLACE FUNCTION generate_recurring_charges_for_project(p_project_id uuid)
RETURNS void AS $$
DECLARE
  v_project RECORD;
  v_template RECORD;
  v_current_date date;
  v_due_date date;
  v_start_date date;
  v_end_date date;
BEGIN
  -- Buscar projeto e template
  SELECT 
    ep.*,
    est.fees,
    est.recurring_due_day,
    est.is_recurring_monthly
  INTO v_project
  FROM engineering_projects ep
  LEFT JOIN engineering_service_templates est ON ep.template_id = est.id
  WHERE ep.id = p_project_id
    AND ep.status NOT IN ('finalizado', 'entregue', 'registrado');

  -- Verificar se encontrou o projeto e se tem cobrança recorrente
  IF NOT FOUND OR v_project.is_recurring_monthly IS NOT TRUE THEN
    RETURN;
  END IF;

  -- Data de início é a data de início do projeto
  v_start_date := v_project.start_date;
  
  -- Data final é hoje
  v_end_date := CURRENT_DATE;

  -- Gerar cobranças mensais desde a data de início até hoje
  v_current_date := v_start_date;
  
  WHILE v_current_date <= v_end_date LOOP
    -- Calcular o vencimento no dia especificado do mês
    v_due_date := make_date(
      EXTRACT(YEAR FROM v_current_date)::int,
      EXTRACT(MONTH FROM v_current_date)::int,
      LEAST(v_project.recurring_due_day, 
            EXTRACT(DAY FROM (date_trunc('month', v_current_date) + interval '1 month - 1 day')::date)::int
      )
    );

    -- Inserir cobrança se não existir
    INSERT INTO engineering_recurring_charges (
      project_id,
      due_date,
      amount,
      status,
      notes
    )
    SELECT
      p_project_id,
      v_due_date,
      v_project.fees,
      CASE
        WHEN v_due_date < CURRENT_DATE THEN 'overdue'
        ELSE 'pending'
      END,
      'Cobrança automática - Mês de ' || to_char(v_due_date, 'MM/YYYY')
    WHERE NOT EXISTS (
      SELECT 1
      FROM engineering_recurring_charges
      WHERE project_id = p_project_id
        AND due_date = v_due_date
    );

    -- Próximo mês
    v_current_date := (v_current_date + interval '1 month')::date;
  END LOOP;

  RAISE NOTICE 'Cobranças geradas para projeto %', p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar cobranças automaticamente ao criar projeto
CREATE OR REPLACE FUNCTION auto_generate_recurring_charges_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o projeto tem template com cobrança recorrente
  IF NEW.template_id IS NOT NULL THEN
    -- Executar geração de cobranças de forma assíncrona
    PERFORM generate_recurring_charges_for_project(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_recurring_charges
  AFTER INSERT ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_recurring_charges_trigger();

-- Function para gerar cobranças de todos os projetos ativos
CREATE OR REPLACE FUNCTION generate_all_recurring_charges()
RETURNS TABLE(project_id uuid, project_name text, charges_created int) AS $$
DECLARE
  v_project RECORD;
  v_count int;
BEGIN
  FOR v_project IN
    SELECT 
      ep.id,
      ep.name
    FROM engineering_projects ep
    INNER JOIN engineering_service_templates est ON ep.template_id = est.id
    WHERE est.is_recurring_monthly = true
      AND ep.status NOT IN ('finalizado', 'entregue', 'registrado')
  LOOP
    -- Contar cobranças antes
    SELECT COUNT(*) INTO v_count
    FROM engineering_recurring_charges
    WHERE engineering_recurring_charges.project_id = v_project.id;

    -- Gerar cobranças
    PERFORM generate_recurring_charges_for_project(v_project.id);

    -- Contar cobranças depois
    SELECT COUNT(*) - v_count INTO v_count
    FROM engineering_recurring_charges
    WHERE engineering_recurring_charges.project_id = v_project.id;

    project_id := v_project.id;
    project_name := v_project.name;
    charges_created := v_count;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE engineering_recurring_charges IS 'Cobranças recorrentes mensais para projetos de consultoria';
COMMENT ON COLUMN engineering_recurring_charges.due_date IS 'Data de vencimento da cobrança';
COMMENT ON COLUMN engineering_recurring_charges.status IS 'pending: aguardando pagamento, paid: pago, overdue: vencido, cancelled: cancelado';
COMMENT ON FUNCTION generate_recurring_charges_for_project IS 'Gera cobranças recorrentes desde a data de início do projeto até hoje';
COMMENT ON FUNCTION generate_all_recurring_charges IS 'Gera cobranças para todos os projetos ativos com cobrança recorrente';
