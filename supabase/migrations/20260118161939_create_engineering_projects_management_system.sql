/*
  # Sistema Completo de Gestão de Projetos de Engenharia

  ## Visão Geral
  Sistema completo para gestão de projetos de engenharia e topografia, incluindo:
  - Gestão de projetos vinculados a clientes e imóveis
  - Controle financeiro detalhado com valores sugeridos vs praticados
  - Custos adicionais (taxas, deslocamento, etc)
  - Integração com estoque (marcos de concreto)
  - Sistema de recebimentos integrado ao fluxo de caixa

  ## Novas Tabelas

  ### 1. `engineering_projects`
  Tabela principal de projetos
    - `id` (uuid, PK)
    - `project_name` - Nome do projeto
    - `customer_id` - Cliente (FK)
    - `property_id` - Imóvel do cliente (FK)
    - `start_date` - Data de início
    - `estimated_completion_date` - Previsão de conclusão
    - `actual_completion_date` - Data real de conclusão
    - `status` - Status do projeto
    - `total_suggested_value` - Total dos valores sugeridos
    - `total_actual_value` - Total dos valores praticados
    - `total_additional_costs` - Total de custos adicionais
    - `total_concrete_markers` - Total de marcos de concreto
    - `grand_total` - Valor total geral
    - `notes` - Observações

  ### 2. `engineering_project_services`
  Serviços vinculados ao projeto
    - Relaciona projeto com serviços da tabela engineering_services
    - Armazena valor sugerido e valor praticado

  ### 3. `engineering_project_costs`
  Custos adicionais do projeto
    - Taxas, deslocamento, hospedagem, alimentação, etc

  ### 4. `engineering_project_markers`
  Marcos de concreto utilizados
    - Integração com estoque de produtos
    - Registra quantidade e preços

  ### 5. `engineering_project_payments`
  Recebimentos do projeto
    - Integração com fluxo de caixa
    - Múltiplas formas de pagamento

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Acesso público (anônimo) permitido para todas as operações
  - Políticas específicas para cada operação
*/

-- Enum para status do projeto
DO $$ BEGIN
  CREATE TYPE engineering_project_status AS ENUM (
    'em_planejamento',
    'em_andamento',
    'concluido',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de custo adicional
DO $$ BEGIN
  CREATE TYPE project_cost_type AS ENUM (
    'taxa',
    'deslocamento',
    'hospedagem',
    'alimentacao',
    'outros'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para forma de pagamento
DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM (
    'dinheiro',
    'pix',
    'transferencia',
    'cheque',
    'cartao'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabela principal de projetos
CREATE TABLE IF NOT EXISTS engineering_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  estimated_completion_date date,
  actual_completion_date date,
  status engineering_project_status NOT NULL DEFAULT 'em_planejamento',
  total_suggested_value decimal(15,2) NOT NULL DEFAULT 0,
  total_actual_value decimal(15,2) NOT NULL DEFAULT 0,
  total_additional_costs decimal(15,2) NOT NULL DEFAULT 0,
  total_concrete_markers decimal(15,2) NOT NULL DEFAULT 0,
  grand_total decimal(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_completion_date CHECK (
    estimated_completion_date IS NULL OR 
    estimated_completion_date >= start_date
  ),
  CONSTRAINT valid_actual_completion CHECK (
    actual_completion_date IS NULL OR 
    actual_completion_date >= start_date
  ),
  CONSTRAINT valid_totals CHECK (
    total_suggested_value >= 0 AND
    total_actual_value >= 0 AND
    total_additional_costs >= 0 AND
    total_concrete_markers >= 0 AND
    grand_total >= 0
  )
);

-- Serviços do projeto
CREATE TABLE IF NOT EXISTS engineering_project_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES engineering_services(id) ON DELETE RESTRICT,
  suggested_value decimal(15,2) NOT NULL,
  actual_value decimal(15,2) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_service_values CHECK (
    suggested_value >= 0 AND actual_value >= 0
  )
);

-- Custos adicionais
CREATE TABLE IF NOT EXISTS engineering_project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  cost_type project_cost_type NOT NULL,
  description text NOT NULL,
  value decimal(15,2) NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_cost_value CHECK (value >= 0)
);

-- Marcos de concreto utilizados
CREATE TABLE IF NOT EXISTS engineering_project_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_price decimal(15,2) NOT NULL,
  total_price decimal(15,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_marker_quantity CHECK (quantity > 0),
  CONSTRAINT valid_marker_prices CHECK (
    unit_price >= 0 AND 
    total_price >= 0 AND
    total_price = quantity * unit_price
  )
);

-- Pagamentos recebidos
CREATE TABLE IF NOT EXISTS engineering_project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  value decimal(15,2) NOT NULL,
  payment_method payment_method_type NOT NULL,
  account_id uuid REFERENCES contas_caixa(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_value CHECK (value > 0)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_engineering_projects_customer ON engineering_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_engineering_projects_property ON engineering_projects(property_id);
CREATE INDEX IF NOT EXISTS idx_engineering_projects_status ON engineering_projects(status);
CREATE INDEX IF NOT EXISTS idx_engineering_projects_dates ON engineering_projects(start_date, estimated_completion_date);
CREATE INDEX IF NOT EXISTS idx_project_services_project ON engineering_project_services(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_project ON engineering_project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_markers_project ON engineering_project_markers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_project ON engineering_project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_date ON engineering_project_payments(payment_date);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_engineering_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_engineering_projects_updated_at ON engineering_projects;
CREATE TRIGGER update_engineering_projects_updated_at
  BEFORE UPDATE ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_engineering_project_updated_at();

-- Função para recalcular totais do projeto
CREATE OR REPLACE FUNCTION recalculate_project_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id uuid;
  v_total_services decimal(15,2);
  v_total_costs decimal(15,2);
  v_total_markers decimal(15,2);
BEGIN
  -- Determinar o project_id baseado na operação
  IF TG_OP = 'DELETE' THEN
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;

  -- Calcular total de serviços
  SELECT COALESCE(SUM(actual_value), 0)
  INTO v_total_services
  FROM engineering_project_services
  WHERE project_id = v_project_id;

  -- Calcular total de custos
  SELECT COALESCE(SUM(value), 0)
  INTO v_total_costs
  FROM engineering_project_costs
  WHERE project_id = v_project_id;

  -- Calcular total de marcos
  SELECT COALESCE(SUM(total_price), 0)
  INTO v_total_markers
  FROM engineering_project_markers
  WHERE project_id = v_project_id;

  -- Atualizar projeto
  UPDATE engineering_projects
  SET
    total_actual_value = v_total_services,
    total_additional_costs = v_total_costs,
    total_concrete_markers = v_total_markers,
    grand_total = v_total_services + v_total_costs + v_total_markers
  WHERE id = v_project_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para recalcular totais
DROP TRIGGER IF EXISTS recalc_totals_on_service ON engineering_project_services;
CREATE TRIGGER recalc_totals_on_service
  AFTER INSERT OR UPDATE OR DELETE ON engineering_project_services
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_project_totals();

DROP TRIGGER IF EXISTS recalc_totals_on_cost ON engineering_project_costs;
CREATE TRIGGER recalc_totals_on_cost
  AFTER INSERT OR UPDATE OR DELETE ON engineering_project_costs
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_project_totals();

DROP TRIGGER IF EXISTS recalc_totals_on_marker ON engineering_project_markers;
CREATE TRIGGER recalc_totals_on_marker
  AFTER INSERT OR UPDATE OR DELETE ON engineering_project_markers
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_project_totals();

-- Função para dar baixa no estoque ao adicionar marcos
CREATE OR REPLACE FUNCTION handle_marker_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name text;
  v_current_stock integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Verificar estoque disponível
    SELECT quantity INTO v_current_stock
    FROM inventory
    WHERE product_id = NEW.product_id;

    IF v_current_stock IS NULL OR v_current_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto';
    END IF;

    -- Obter nome do produto
    SELECT name INTO v_product_name
    FROM products
    WHERE id = NEW.product_id;

    -- Dar baixa no estoque
    UPDATE inventory
    SET quantity = quantity - NEW.quantity
    WHERE product_id = NEW.product_id;

    -- Registrar movimentação
    INSERT INTO material_movements (
      material_id,
      movement_type,
      quantity,
      unit_price,
      total_price,
      movement_date,
      notes
    ) VALUES (
      NEW.product_id,
      'saida',
      NEW.quantity,
      NEW.unit_price,
      NEW.total_price,
      CURRENT_DATE,
      'Saída para projeto de engenharia - ID: ' || NEW.project_id
    );

  ELSIF TG_OP = 'DELETE' THEN
    -- Estornar estoque
    UPDATE inventory
    SET quantity = quantity + OLD.quantity
    WHERE product_id = OLD.product_id;

    -- Registrar movimentação de estorno
    INSERT INTO material_movements (
      material_id,
      movement_type,
      quantity,
      unit_price,
      total_price,
      movement_date,
      notes
    ) VALUES (
      OLD.product_id,
      'entrada',
      OLD.quantity,
      OLD.unit_price,
      OLD.total_price,
      CURRENT_DATE,
      'Estorno de projeto de engenharia - ID: ' || OLD.project_id
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para movimentação de estoque
DROP TRIGGER IF EXISTS handle_marker_stock ON engineering_project_markers;
CREATE TRIGGER handle_marker_stock
  AFTER INSERT OR DELETE ON engineering_project_markers
  FOR EACH ROW
  EXECUTE FUNCTION handle_marker_stock_movement();

-- Função para integrar pagamentos com fluxo de caixa
CREATE OR REPLACE FUNCTION integrate_payment_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_project_name text;
  v_customer_name text;
  v_category_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Buscar informações do projeto e cliente
    SELECT 
      p.project_name,
      c.name
    INTO v_project_name, v_customer_name
    FROM engineering_projects p
    JOIN customers c ON p.customer_id = c.id
    WHERE p.id = NEW.project_id;

    -- Buscar ou criar categoria "Serviços de Engenharia"
    SELECT id INTO v_category_id
    FROM cost_categories
    WHERE name = 'Serviços de Engenharia'
    LIMIT 1;

    IF v_category_id IS NULL THEN
      INSERT INTO cost_categories (name, type)
      VALUES ('Serviços de Engenharia', 'receita')
      RETURNING id INTO v_category_id;
    END IF;

    -- Criar entrada no fluxo de caixa
    INSERT INTO cash_flow (
      type,
      category_id,
      description,
      value,
      date,
      payment_method,
      reference_id,
      reference_type,
      account_id
    ) VALUES (
      'entrada',
      v_category_id,
      'Recebimento - ' || v_project_name || ' - ' || v_customer_name,
      NEW.value,
      NEW.payment_date,
      NEW.payment_method::text,
      NEW.project_id::text,
      'engineering_project',
      NEW.account_id
    );

    -- Atualizar saldo da conta caixa se especificada
    IF NEW.account_id IS NOT NULL THEN
      UPDATE contas_caixa
      SET saldo_atual = saldo_atual + NEW.value
      WHERE id = NEW.account_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Remover do fluxo de caixa
    DELETE FROM cash_flow
    WHERE reference_id = OLD.project_id::text
      AND reference_type = 'engineering_project'
      AND date = OLD.payment_date
      AND value = OLD.value;

    -- Estornar saldo da conta caixa
    IF OLD.account_id IS NOT NULL THEN
      UPDATE contas_caixa
      SET saldo_atual = saldo_atual - OLD.value
      WHERE id = OLD.account_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para integração com fluxo de caixa
DROP TRIGGER IF EXISTS integrate_payment_cash_flow ON engineering_project_payments;
CREATE TRIGGER integrate_payment_cash_flow
  AFTER INSERT OR DELETE ON engineering_project_payments
  FOR EACH ROW
  EXECUTE FUNCTION integrate_payment_to_cash_flow();

-- Habilitar RLS
ALTER TABLE engineering_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para acesso público (todas as operações)
CREATE POLICY "Public access to engineering_projects"
  ON engineering_projects FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to engineering_project_services"
  ON engineering_project_services FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to engineering_project_costs"
  ON engineering_project_costs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to engineering_project_markers"
  ON engineering_project_markers FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to engineering_project_payments"
  ON engineering_project_payments FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);