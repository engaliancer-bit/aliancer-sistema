/*
  # Sistema de Gestão de Obras da Construtora

  ## Descrição
  Cria o sistema completo de gestão de obras da construtora, permitindo:
  - Cadastro de obras vinculadas a clientes
  - Controle de informações gerais (área, tipo, endereço)
  - Gestão de contratos (pacote fechado ou por administração)
  - Vinculação automática com orçamentos da fábrica
  - Controle detalhado de itens e valores da obra

  ## Novas Tabelas

  1. **construction_works** - Dados principais das obras
     - `id` (uuid, PK)
     - `customer_id` (uuid, FK -> customers) - Cliente da obra
     - `work_name` (text) - Nome da obra
     - `work_area` (decimal) - Área da obra em m²
     - `area_type` (text) - rural ou urbana
     - `construction_type` (text) - residencial, comercial ou industrial
     - `occupancy_type` (text) - unifamiliar ou multifamiliar
     - `address` (text) - Endereço completo
     - `city` (text) - Cidade
     - `state` (text) - Estado
     - `zip_code` (text) - CEP
     - `contract_type` (text) - pacote_fechado ou administracao
     - `total_contract_value` (decimal) - Valor total (pacote fechado)
     - `administration_percentage` (decimal) - % administração
     - `status` (text) - em_andamento, pausada, concluida, cancelada
     - `start_date` (date) - Data de início
     - `estimated_end_date` (date) - Previsão de término
     - `actual_end_date` (date) - Data real de conclusão
     - `notes` (text) - Observações
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **construction_work_items** - Itens vinculados às obras
     - `id` (uuid, PK)
     - `work_id` (uuid, FK -> construction_works)
     - `quote_id` (uuid, FK -> quotes) - Orçamento de origem
     - `quote_item_id` (uuid, FK -> quote_items) - Item do orçamento
     - `item_type` (text) - product, material, composition
     - `item_name` (text) - Nome do item
     - `quantity` (decimal) - Quantidade
     - `unit_price` (decimal) - Preço unitário
     - `total_price` (decimal) - Preço total
     - `added_date` (timestamptz) - Data de adição
     - `notes` (text)
     - `created_at` (timestamptz)

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas para acesso público (modo desenvolvimento)
*/

-- Criar tabela de obras
CREATE TABLE IF NOT EXISTS construction_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
  work_name text NOT NULL,
  work_area decimal(10,2),
  area_type text CHECK (area_type IN ('rural', 'urbana')),
  construction_type text CHECK (construction_type IN ('residencial', 'comercial', 'industrial')),
  occupancy_type text CHECK (occupancy_type IN ('unifamiliar', 'multifamiliar')),
  address text,
  city text,
  state text,
  zip_code text,
  contract_type text NOT NULL CHECK (contract_type IN ('pacote_fechado', 'administracao')),
  total_contract_value decimal(15,2),
  administration_percentage decimal(5,2),
  status text DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'pausada', 'concluida', 'cancelada')),
  start_date date,
  estimated_end_date date,
  actual_end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de itens das obras
CREATE TABLE IF NOT EXISTS construction_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES construction_works(id) ON DELETE CASCADE NOT NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  quote_item_id uuid REFERENCES quote_items(id) ON DELETE SET NULL,
  item_type text NOT NULL CHECK (item_type IN ('product', 'material', 'composition')),
  item_name text NOT NULL,
  quantity decimal(10,3) NOT NULL,
  unit_price decimal(15,2) NOT NULL DEFAULT 0,
  total_price decimal(15,2) NOT NULL DEFAULT 0,
  added_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_construction_works_customer ON construction_works(customer_id);
CREATE INDEX IF NOT EXISTS idx_construction_works_status ON construction_works(status);
CREATE INDEX IF NOT EXISTS idx_construction_work_items_work ON construction_work_items(work_id);
CREATE INDEX IF NOT EXISTS idx_construction_work_items_quote ON construction_work_items(quote_id);

-- Habilitar RLS
ALTER TABLE construction_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_work_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (desenvolvimento)
CREATE POLICY "Allow public read access to construction_works"
  ON construction_works FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to construction_works"
  ON construction_works FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to construction_works"
  ON construction_works FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to construction_works"
  ON construction_works FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to construction_work_items"
  ON construction_work_items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to construction_work_items"
  ON construction_work_items FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to construction_work_items"
  ON construction_work_items FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to construction_work_items"
  ON construction_work_items FOR DELETE
  TO public
  USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_construction_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_construction_works_updated_at_trigger ON construction_works;
CREATE TRIGGER update_construction_works_updated_at_trigger
  BEFORE UPDATE ON construction_works
  FOR EACH ROW
  EXECUTE FUNCTION update_construction_works_updated_at();

-- Função para calcular totais da obra
CREATE OR REPLACE FUNCTION calculate_work_total(work_id_param uuid)
RETURNS TABLE (
  total_items bigint,
  total_value decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_items,
    COALESCE(SUM(total_price), 0)::decimal as total_value
  FROM construction_work_items
  WHERE work_id = work_id_param;
END;
$$ LANGUAGE plpgsql;