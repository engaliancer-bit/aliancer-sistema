/*
  # Sistema de Composições de Orçamento

  1. Novas Tabelas
    - `compositions`: Armazena composições de itens (ex: Pórtico Pré-Moldado)
      - `id` (uuid, primary key)
      - `name` (text): Nome da composição
      - `description` (text): Descrição detalhada
      - `total_cost` (numeric): Custo total calculado
      - `created_at`, `updated_at` (timestamptz)
    
    - `composition_items`: Itens que compõem cada composição
      - `id` (uuid, primary key)
      - `composition_id` (uuid, FK): Referência para compositions
      - `item_type` (text): Tipo do item (product, material, service, labor, equipment)
      - `item_name` (text): Nome do item
      - `item_description` (text): Descrição do item
      - `quantity` (numeric): Quantidade
      - `unit` (text): Unidade de medida
      - `unit_cost` (numeric): Custo unitário
      - `total_cost` (numeric): Custo total (quantity * unit_cost)
      - `material_id` (uuid, nullable FK): Referência opcional para materials
      - `product_id` (uuid, nullable FK): Referência opcional para products
      - `created_at`, `updated_at` (timestamptz)

  2. Alterações
    - Adicionar `composition_id` em `quotes` para vincular orçamentos a composições

  3. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas permitem acesso autenticado para leitura e escrita
    - Trigger para atualizar total_cost automaticamente
*/

-- Criar tabela compositions
CREATE TABLE IF NOT EXISTS compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  total_cost numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela composition_items
CREATE TABLE IF NOT EXISTS composition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id uuid NOT NULL REFERENCES compositions(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('product', 'material', 'service', 'labor', 'equipment')),
  item_name text NOT NULL,
  item_description text DEFAULT '',
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'un',
  unit_cost numeric(12,4) NOT NULL DEFAULT 0,
  total_cost numeric(12,4) NOT NULL DEFAULT 0,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar composition_id à tabela quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'composition_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN composition_id uuid REFERENCES compositions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE composition_items ENABLE ROW LEVEL SECURITY;

-- Políticas para compositions
CREATE POLICY "Usuários autenticados podem ler composições"
  ON compositions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir composições"
  ON compositions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar composições"
  ON compositions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar composições"
  ON compositions FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para composition_items
CREATE POLICY "Usuários autenticados podem ler itens de composição"
  ON composition_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir itens de composição"
  ON composition_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar itens de composição"
  ON composition_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar itens de composição"
  ON composition_items FOR DELETE
  TO authenticated
  USING (true);

-- Função para calcular o custo total de um item de composição
CREATE OR REPLACE FUNCTION calculate_composition_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_cost = NEW.quantity * NEW.unit_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular o custo total do item antes de inserir ou atualizar
DROP TRIGGER IF EXISTS trigger_calculate_composition_item_total ON composition_items;
CREATE TRIGGER trigger_calculate_composition_item_total
  BEFORE INSERT OR UPDATE ON composition_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_composition_item_total();

-- Função para atualizar o custo total da composição
CREATE OR REPLACE FUNCTION update_composition_total_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE compositions
  SET 
    total_cost = (
      SELECT COALESCE(SUM(total_cost), 0)
      FROM composition_items
      WHERE composition_id = COALESCE(NEW.composition_id, OLD.composition_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.composition_id, OLD.composition_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar o custo total da composição quando itens são modificados
DROP TRIGGER IF EXISTS trigger_update_composition_total ON composition_items;
CREATE TRIGGER trigger_update_composition_total
  AFTER INSERT OR UPDATE OR DELETE ON composition_items
  FOR EACH ROW
  EXECUTE FUNCTION update_composition_total_cost();