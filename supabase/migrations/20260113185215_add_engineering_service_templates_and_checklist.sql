/*
  # Sistema de Templates de Serviços de Engenharia

  ## Descrição
  Adiciona sistema completo para cadastro de serviços de engenharia com:
  - Cadastro de serviços padrão
  - Checklist padrão para cada serviço
  - Honorários (valores) para cada serviço
  - Tempo médio estimado para execução

  ## Novas Tabelas

  ### `engineering_service_templates`
  Armazena os serviços de engenharia cadastrados com suas informações básicas:
  - `id` (uuid, PK) - Identificador único
  - `name` (text) - Nome do serviço
  - `description` (text) - Descrição detalhada do serviço
  - `fees` (decimal) - Honorários/valor para realizar o serviço
  - `estimated_time_hours` (decimal) - Tempo médio estimado em horas
  - `category` (text) - Categoria do serviço (topografia, projetos, laudos, etc)
  - `is_active` (boolean) - Se o serviço está ativo
  - `created_at` (timestamptz) - Data de criação
  - `updated_at` (timestamptz) - Data da última atualização

  ### `engineering_service_checklist_items`
  Armazena os itens do checklist padrão para cada serviço:
  - `id` (uuid, PK) - Identificador único
  - `service_template_id` (uuid, FK) - Referência ao serviço
  - `item_text` (text) - Texto do item do checklist
  - `order_index` (integer) - Ordem do item na lista
  - `is_required` (boolean) - Se o item é obrigatório
  - `created_at` (timestamptz) - Data de criação

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas permitem acesso público (mesmo padrão do sistema)
*/

-- Criar tabela de templates de serviços de engenharia
CREATE TABLE IF NOT EXISTS engineering_service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  fees decimal(10, 2) DEFAULT 0,
  estimated_time_hours decimal(10, 2) DEFAULT 0,
  category text DEFAULT 'geral',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de itens do checklist padrão
CREATE TABLE IF NOT EXISTS engineering_service_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_template_id uuid NOT NULL REFERENCES engineering_service_templates(id) ON DELETE CASCADE,
  item_text text NOT NULL,
  order_index integer DEFAULT 0,
  is_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_service_templates_active ON engineering_service_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_service_templates_category ON engineering_service_templates(category);
CREATE INDEX IF NOT EXISTS idx_checklist_items_service ON engineering_service_checklist_items(service_template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_order ON engineering_service_checklist_items(service_template_id, order_index);

-- Habilitar RLS
ALTER TABLE engineering_service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_service_checklist_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (seguindo padrão do sistema)
CREATE POLICY "Permitir leitura pública de templates de serviços"
  ON engineering_service_templates
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção pública de templates de serviços"
  ON engineering_service_templates
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de templates de serviços"
  ON engineering_service_templates
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão pública de templates de serviços"
  ON engineering_service_templates
  FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Permitir leitura pública de itens do checklist"
  ON engineering_service_checklist_items
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção pública de itens do checklist"
  ON engineering_service_checklist_items
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de itens do checklist"
  ON engineering_service_checklist_items
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão pública de itens do checklist"
  ON engineering_service_checklist_items
  FOR DELETE
  TO public
  USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_engineering_service_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_engineering_service_templates_updated_at
  BEFORE UPDATE ON engineering_service_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_engineering_service_templates_updated_at();
