/*
  # Sistema de Categorias de Custos e Compras Pendentes

  ## Visão Geral
  Cria um sistema completo para categorização e gestão de custos diretos e indiretos
  da empresa, incluindo registro de compras pendentes de classificação provenientes
  de importações de XML de notas fiscais.

  ## Novas Tabelas

  ### 1. `cost_categories` - Categorias de Custos
  Armazena as categorias de custos da empresa:
  - `id` (uuid, PK) - Identificador único
  - `name` (text) - Nome da categoria
  - `type` (text) - Tipo: 'direct_production', 'direct_resale', 'administrative', 
                    'personnel', 'taxes', 'equipment', 'maintenance', 'ppe'
  - `description` (text) - Descrição da categoria
  - `is_active` (boolean) - Se está ativa
  - `created_at` (timestamptz) - Data de criação

  ### 2. `pending_purchases` - Compras Pendentes de Classificação
  Registra compras importadas do XML que aguardam classificação manual:
  - `id` (uuid, PK) - Identificador único
  - `material_id` (uuid, FK) - Referência ao material/produto
  - `supplier_id` (uuid, FK) - Referência ao fornecedor
  - `nfe_key` (text) - Chave da nota fiscal
  - `product_name` (text) - Nome do produto
  - `quantity` (numeric) - Quantidade comprada
  - `unit` (text) - Unidade de medida
  - `unit_cost` (numeric) - Custo unitário
  - `total_cost` (numeric) - Custo total
  - `cost_category_id` (uuid, FK nullable) - Categoria de custo (null = pendente)
  - `classification_status` (text) - Status: 'pending', 'classified'
  - `is_for_resale` (boolean) - Se é para revenda
  - `is_asset` (boolean) - Se é patrimônio/ativo
  - `notes` (text) - Observações
  - `imported_at` (timestamptz) - Data de importação
  - `classified_at` (timestamptz) - Data de classificação
  - `created_at` (timestamptz) - Data de criação

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas restritivas para usuários autenticados
  - Validação de integridade referencial

  ## Dados Iniciais
  Categorias padrão de custos pré-cadastradas
*/

-- Criar tabela de categorias de custos
CREATE TABLE IF NOT EXISTS cost_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'direct_production',
    'direct_resale', 
    'administrative',
    'personnel',
    'taxes',
    'equipment',
    'maintenance',
    'ppe'
  )),
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de compras pendentes
CREATE TABLE IF NOT EXISTS pending_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  nfe_key text,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unid',
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  cost_category_id uuid REFERENCES cost_categories(id) ON DELETE SET NULL,
  classification_status text NOT NULL DEFAULT 'pending' CHECK (classification_status IN ('pending', 'classified')),
  is_for_resale boolean DEFAULT false,
  is_asset boolean DEFAULT false,
  notes text DEFAULT '',
  imported_at timestamptz DEFAULT now(),
  classified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_purchases ENABLE ROW LEVEL SECURITY;

-- Políticas para cost_categories
CREATE POLICY "Usuários autenticados podem visualizar categorias de custos"
  ON cost_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir categorias de custos"
  ON cost_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar categorias de custos"
  ON cost_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir categorias de custos"
  ON cost_categories FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para pending_purchases
CREATE POLICY "Usuários autenticados podem visualizar compras pendentes"
  ON pending_purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir compras pendentes"
  ON pending_purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar compras pendentes"
  ON pending_purchases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem excluir compras pendentes"
  ON pending_purchases FOR DELETE
  TO authenticated
  USING (true);

-- Inserir categorias padrão
INSERT INTO cost_categories (name, type, description) VALUES
  ('Compra de Insumos de Produção', 'direct_production', 'Materiais e insumos utilizados diretamente na produção'),
  ('Compra de Produtos para Revenda', 'direct_resale', 'Produtos acabados adquiridos para revenda direta'),
  ('Despesas Administrativas', 'administrative', 'Despesas com escritório, materiais de consumo, etc'),
  ('Despesas com Pessoal', 'personnel', 'Salários, benefícios, encargos trabalhistas'),
  ('Impostos e Taxas', 'taxes', 'Impostos federais, estaduais, municipais e taxas'),
  ('FGTS', 'taxes', 'Fundo de Garantia do Tempo de Serviço'),
  ('Equipamentos e Patrimônio', 'equipment', 'Compra de máquinas, equipamentos e ativos'),
  ('Manutenção de Máquinas', 'maintenance', 'Manutenção preventiva e corretiva de equipamentos'),
  ('EPIs e Segurança', 'ppe', 'Equipamentos de Proteção Individual e materiais de segurança')
ON CONFLICT DO NOTHING;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pending_purchases_status ON pending_purchases(classification_status);
CREATE INDEX IF NOT EXISTS idx_pending_purchases_material ON pending_purchases(material_id);
CREATE INDEX IF NOT EXISTS idx_pending_purchases_supplier ON pending_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pending_purchases_category ON pending_purchases(cost_category_id);
CREATE INDEX IF NOT EXISTS idx_cost_categories_type ON cost_categories(type);
CREATE INDEX IF NOT EXISTS idx_cost_categories_active ON cost_categories(is_active);
