/*
  # Sistema Detalhado de Armaduras e Acessórios para Pré-Moldados

  ## Descrição
  Esta migração expande o sistema de armaduras e adiciona suporte para acessórios e materiais auxiliares
  utilizados na fabricação de produtos pré-moldados.

  ## Alterações

  ### 1. Tabela product_reinforcements - Novos Campos
    - `longitudinal_position` (text) - Posição da armadura longitudinal:
      - 'superior' - Armadura superior
      - 'middle' - Armadura intermediária (pele)
      - 'inferior' - Armadura inferior
      - NULL - Para armaduras transversais
    - `bar_diameter_mm` (numeric) - Diâmetro da barra em milímetros (ex: 6.3, 8.0, 10.0, 12.5, etc.)

  ### 2. Nova Tabela: product_accessories
    Gerencia acessórios e materiais auxiliares do produto pré-moldado:
    - `id` (uuid, primary key)
    - `product_id` (uuid, FK para products)
    - `accessory_type` (text) - Tipo do acessório:
      - 'lifting_bar' - Barra de içamento
      - 'threaded_bar' - Barra roscada
      - 'threaded_hook' - Gancho de barra roscada
      - 'release_agent' - Desmoldante
      - 'cloth' - Estopa
      - 'other' - Outros
    - `material_id` (uuid, FK para materials, opcional) - Material do estoque (se aplicável)
    - `description` (text) - Descrição do acessório
    - `quantity` (numeric) - Quantidade utilizada
    - `unit` (text) - Unidade de medida (unid, kg, litro, etc.)
    - `bar_diameter_mm` (numeric, opcional) - Diâmetro em mm (para barras)
    - `bar_length_meters` (numeric, opcional) - Comprimento em metros (para barras)
    - `notes` (text) - Observações adicionais
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Segurança
    - RLS habilitado em product_accessories
    - Políticas para acesso anônimo e autenticado

  ## Notas Importantes
    - A posição longitudinal só se aplica a armaduras longitudinais
    - Os acessórios podem ou não estar vinculados a materiais do estoque
    - O diâmetro das barras é armazenado em milímetros para precisão
*/

-- Adicionar novos campos à tabela product_reinforcements
DO $$
BEGIN
  -- Posição da armadura longitudinal (superior, middle/pele, inferior)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_reinforcements' AND column_name = 'longitudinal_position'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN longitudinal_position text CHECK (longitudinal_position IN ('superior', 'middle', 'inferior'));
    COMMENT ON COLUMN product_reinforcements.longitudinal_position IS 'Posição da armadura longitudinal: superior, middle (pele), inferior. NULL para armaduras transversais';
  END IF;

  -- Diâmetro da barra em milímetros
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_reinforcements' AND column_name = 'bar_diameter_mm'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN bar_diameter_mm numeric CHECK (bar_diameter_mm > 0);
    COMMENT ON COLUMN product_reinforcements.bar_diameter_mm IS 'Diâmetro da barra em milímetros (ex: 6.3, 8.0, 10.0, 12.5)';
  END IF;
END $$;

-- Criar tabela de acessórios e materiais auxiliares para produtos pré-moldados
CREATE TABLE IF NOT EXISTS product_accessories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  accessory_type text NOT NULL CHECK (accessory_type IN ('lifting_bar', 'threaded_bar', 'threaded_hook', 'release_agent', 'cloth', 'other')),
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'unid',
  bar_diameter_mm numeric CHECK (bar_diameter_mm > 0),
  bar_length_meters numeric CHECK (bar_length_meters > 0),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Comentários para product_accessories
COMMENT ON TABLE product_accessories IS 'Acessórios e materiais auxiliares utilizados na fabricação de produtos pré-moldados';
COMMENT ON COLUMN product_accessories.accessory_type IS 'Tipo: lifting_bar (içamento), threaded_bar (roscada), threaded_hook (gancho), release_agent (desmoldante), cloth (estopa), other (outros)';
COMMENT ON COLUMN product_accessories.material_id IS 'Material do estoque (opcional). Use quando o acessório está cadastrado como material';
COMMENT ON COLUMN product_accessories.description IS 'Descrição do acessório ou material auxiliar';
COMMENT ON COLUMN product_accessories.quantity IS 'Quantidade utilizada por produto';
COMMENT ON COLUMN product_accessories.unit IS 'Unidade de medida (unid, kg, litro, etc.)';
COMMENT ON COLUMN product_accessories.bar_diameter_mm IS 'Diâmetro em milímetros (apenas para barras)';
COMMENT ON COLUMN product_accessories.bar_length_meters IS 'Comprimento em metros (apenas para barras)';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_product_accessories_product_id ON product_accessories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_accessories_material_id ON product_accessories(material_id);
CREATE INDEX IF NOT EXISTS idx_product_accessories_accessory_type ON product_accessories(accessory_type);

-- Habilitar RLS
ALTER TABLE product_accessories ENABLE ROW LEVEL SECURITY;

-- Políticas para product_accessories
CREATE POLICY "Allow anonymous access to product_accessories"
  ON product_accessories
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated access to product_accessories"
  ON product_accessories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_product_accessories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_product_accessories_updated_at ON product_accessories;
CREATE TRIGGER trigger_update_product_accessories_updated_at
  BEFORE UPDATE ON product_accessories
  FOR EACH ROW
  EXECUTE FUNCTION update_product_accessories_updated_at();
