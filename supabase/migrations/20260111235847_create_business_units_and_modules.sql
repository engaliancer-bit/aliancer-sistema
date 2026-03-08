/*
  # Sistema Multi-Unidades de Negócio

  1. Novas Tabelas

    ## Escritório de Engenharia e Topografia
    
    - `engineering_projects` - Projetos de engenharia e topografia
      - `id` (uuid, chave primária)
      - `project_number` (text, único) - Número do projeto
      - `customer_id` (uuid) - FK para customers
      - `name` (text) - Nome do projeto
      - `type` (text) - Tipo: topografia, projeto_estrutural, projeto_arquitetonico, etc.
      - `location` (text) - Localização do projeto
      - `area` (decimal) - Área do projeto
      - `start_date` (date) - Data de início
      - `expected_end_date` (date) - Previsão de término
      - `actual_end_date` (date) - Data real de conclusão
      - `status` (text) - planning, in_progress, paused, completed, cancelled
      - `total_value` (decimal) - Valor total do projeto
      - `description` (text) - Descrição detalhada
      - `notes` (text) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `engineering_services` - Serviços de engenharia (tabela de preços)
      - `id` (uuid, chave primária)
      - `name` (text) - Nome do serviço
      - `category` (text) - Categoria do serviço
      - `unit` (text) - Unidade de medida
      - `unit_price` (decimal) - Preço unitário
      - `description` (text) - Descrição
      - `active` (boolean) - Ativo/Inativo
      - `created_at` (timestamptz)

    - `project_payments` - Pagamentos de projetos
      - `id` (uuid, chave primária)
      - `project_id` (uuid) - FK para engineering_projects
      - `payment_date` (date) - Data do pagamento
      - `amount` (decimal) - Valor
      - `payment_method_id` (uuid) - FK para payment_methods
      - `description` (text) - Descrição
      - `created_at` (timestamptz)

    ## Construtora
    
    - `construction_projects` - Obras da construtora
      - `id` (uuid, chave primária)
      - `project_number` (text, único) - Número da obra
      - `customer_id` (uuid) - FK para customers
      - `quote_id` (uuid) - FK para quotes (orçamento base)
      - `name` (text) - Nome da obra
      - `location` (text) - Endereço da obra
      - `type` (text) - Tipo de obra
      - `total_area` (decimal) - Área total
      - `start_date` (date) - Data de início
      - `expected_end_date` (date) - Previsão de término
      - `actual_end_date` (date) - Data real de conclusão
      - `status` (text) - planning, in_progress, paused, completed, cancelled
      - `contract_value` (decimal) - Valor do contrato
      - `description` (text) - Descrição
      - `notes` (text) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `construction_progress` - Acompanhamento de obras
      - `id` (uuid, chave primária)
      - `project_id` (uuid) - FK para construction_projects
      - `report_date` (date) - Data do relatório
      - `progress_percentage` (decimal) - Percentual de conclusão
      - `activities_completed` (text) - Atividades concluídas
      - `activities_in_progress` (text) - Atividades em andamento
      - `next_activities` (text) - Próximas atividades
      - `issues` (text) - Problemas identificados
      - `photos` (text[]) - URLs de fotos
      - `notes` (text) - Observações
      - `created_by` (text) - Responsável pelo relatório
      - `created_at` (timestamptz)

    - `construction_expenses` - Despesas da obra
      - `id` (uuid, chave primária)
      - `project_id` (uuid) - FK para construction_projects
      - `expense_date` (date) - Data da despesa
      - `category` (text) - Categoria da despesa
      - `description` (text) - Descrição
      - `amount` (decimal) - Valor
      - `payment_method_id` (uuid) - FK para payment_methods
      - `supplier_id` (uuid) - FK para suppliers
      - `notes` (text) - Observações
      - `created_at` (timestamptz)

  2. Alterações em Tabelas Existentes
    - Adicionar campo `business_unit` em cash_flow para segregar por unidade

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas permissivas para usuários autenticados
*/

-- Adicionar campo business_unit ao cash_flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'business_unit'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN business_unit text DEFAULT 'factory';
  END IF;
END $$;

-- Criar tabela de projetos de engenharia
CREATE TABLE IF NOT EXISTS engineering_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL,
  location text,
  area decimal(15,2),
  start_date date,
  expected_end_date date,
  actual_end_date date,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'paused', 'completed', 'cancelled')),
  total_value decimal(15,2) DEFAULT 0,
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de serviços de engenharia
CREATE TABLE IF NOT EXISTS engineering_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit text DEFAULT 'un',
  unit_price decimal(15,2) NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de pagamentos de projetos
CREATE TABLE IF NOT EXISTS project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount decimal(15,2) NOT NULL,
  payment_method_id uuid REFERENCES payment_methods(id),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de obras da construtora
CREATE TABLE IF NOT EXISTS construction_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  name text NOT NULL,
  location text NOT NULL,
  type text NOT NULL,
  total_area decimal(15,2),
  start_date date,
  expected_end_date date,
  actual_end_date date,
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'paused', 'completed', 'cancelled')),
  contract_value decimal(15,2) DEFAULT 0,
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de acompanhamento de obras
CREATE TABLE IF NOT EXISTS construction_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  progress_percentage decimal(5,2) DEFAULT 0,
  activities_completed text,
  activities_in_progress text,
  next_activities text,
  issues text,
  photos text[],
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de despesas da obra
CREATE TABLE IF NOT EXISTS construction_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text NOT NULL,
  amount decimal(15,2) NOT NULL,
  payment_method_id uuid REFERENCES payment_methods(id),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_engineering_projects_customer ON engineering_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_engineering_projects_status ON engineering_projects(status);
CREATE INDEX IF NOT EXISTS idx_project_payments_project ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_customer ON construction_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_status ON construction_projects(status);
CREATE INDEX IF NOT EXISTS idx_construction_progress_project ON construction_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_expenses_project ON construction_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_business_unit ON cash_flow(business_unit);

-- Habilitar RLS
ALTER TABLE engineering_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para engineering_projects
CREATE POLICY "Projetos de engenharia visíveis para todos"
  ON engineering_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Projetos de engenharia editáveis por autenticados"
  ON engineering_projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para engineering_services
CREATE POLICY "Serviços de engenharia visíveis para todos"
  ON engineering_services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Serviços de engenharia editáveis por autenticados"
  ON engineering_services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para project_payments
CREATE POLICY "Pagamentos de projetos visíveis para todos"
  ON project_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Pagamentos de projetos editáveis por autenticados"
  ON project_payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para construction_projects
CREATE POLICY "Obras visíveis para todos"
  ON construction_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Obras editáveis por autenticados"
  ON construction_projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para construction_progress
CREATE POLICY "Acompanhamento de obras visível para todos"
  ON construction_progress FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Acompanhamento de obras editável por autenticados"
  ON construction_progress FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para construction_expenses
CREATE POLICY "Despesas de obras visíveis para todos"
  ON construction_expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Despesas de obras editáveis por autenticados"
  ON construction_expenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para gerar número de projeto de engenharia
CREATE OR REPLACE FUNCTION generate_engineering_project_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  year_suffix text;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_number FROM 'ENG-(\d+)-') AS integer)), 0) + 1
  INTO next_number
  FROM engineering_projects
  WHERE project_number LIKE 'ENG-%-' || year_suffix;
  
  RETURN 'ENG-' || LPAD(next_number::text, 5, '0') || '-' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar número de projeto automaticamente
CREATE OR REPLACE FUNCTION set_engineering_project_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_number IS NULL OR NEW.project_number = '' THEN
    NEW.project_number := generate_engineering_project_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_engineering_project_number ON engineering_projects;
CREATE TRIGGER trigger_set_engineering_project_number
  BEFORE INSERT ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION set_engineering_project_number();

-- Função para gerar número de obra
CREATE OR REPLACE FUNCTION generate_construction_project_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  year_suffix text;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_number FROM 'OB-(\d+)-') AS integer)), 0) + 1
  INTO next_number
  FROM construction_projects
  WHERE project_number LIKE 'OB-%-' || year_suffix;
  
  RETURN 'OB-' || LPAD(next_number::text, 5, '0') || '-' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar número de obra automaticamente
CREATE OR REPLACE FUNCTION set_construction_project_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_number IS NULL OR NEW.project_number = '' THEN
    NEW.project_number := generate_construction_project_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_construction_project_number ON construction_projects;
CREATE TRIGGER trigger_set_construction_project_number
  BEFORE INSERT ON construction_projects
  FOR EACH ROW
  EXECUTE FUNCTION set_construction_project_number();

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_engineering_projects_updated_at ON engineering_projects;
CREATE TRIGGER update_engineering_projects_updated_at
  BEFORE UPDATE ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_construction_projects_updated_at ON construction_projects;
CREATE TRIGGER update_construction_projects_updated_at
  BEFORE UPDATE ON construction_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();