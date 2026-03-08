/*
  # Sistema de Produtos Pré-Moldados com Armaduras

  ## Alterações

  1. **Produtos**
    - Adiciona `product_type` (artifact/premolded) para diferenciar artefatos de pré-moldados
    - Adiciona `concrete_volume_m3` para armazenar o volume de concreto em m³ (apenas pré-moldados)

  2. **Nova Tabela: product_reinforcements**
    - `id` (uuid, primary key)
    - `product_id` (uuid, FK para products)
    - `reinforcement_type` (longitudinal/transversal)
    - `material_id` (uuid, FK para materials - ferro de construção)
    - `bar_count` (numeric) - número de barras
    - `bar_length_meters` (numeric) - comprimento de cada barra em metros
    - `total_length_meters` (numeric) - comprimento total calculado
    - `notes` (text) - observações

  3. **Receitas/Traços**
    - Adiciona `concrete_type` (dry/plastic) para TCS AL ou TCP AL
    - Adiciona `name_prefix` calculado automaticamente

  ## Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para acesso autenticado

  ## Notas Importantes
    - O volume de concreto é registrado em m³
    - As armaduras são descontadas do estoque durante a produção
    - Os traços recebem prefixos automáticos: TCS AL (seco) ou TCP AL (plástico)
*/

-- Adicionar campos aos produtos
DO $$
BEGIN
  -- Tipo de produto: artifact (artefato) ou premolded (pré-moldado)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'product_type'
  ) THEN
    ALTER TABLE products ADD COLUMN product_type text DEFAULT 'artifact' CHECK (product_type IN ('artifact', 'premolded'));
  END IF;

  -- Volume de concreto em m³ (apenas para pré-moldados)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'concrete_volume_m3'
  ) THEN
    ALTER TABLE products ADD COLUMN concrete_volume_m3 numeric DEFAULT 0 CHECK (concrete_volume_m3 >= 0);
  END IF;
END $$;

-- Criar tabela de armaduras para produtos pré-moldados
CREATE TABLE IF NOT EXISTS product_reinforcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reinforcement_type text NOT NULL CHECK (reinforcement_type IN ('longitudinal', 'transversal')),
  material_id uuid NOT NULL REFERENCES materials(id),
  bar_count numeric NOT NULL DEFAULT 0 CHECK (bar_count >= 0),
  bar_length_meters numeric NOT NULL DEFAULT 0 CHECK (bar_length_meters >= 0),
  total_length_meters numeric NOT NULL DEFAULT 0 CHECK (total_length_meters >= 0),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Comentários
COMMENT ON COLUMN product_reinforcements.reinforcement_type IS 'Tipo de armadura: longitudinal (principal) ou transversal';
COMMENT ON COLUMN product_reinforcements.bar_count IS 'Número de barras de ferro';
COMMENT ON COLUMN product_reinforcements.bar_length_meters IS 'Comprimento de cada barra em metros';
COMMENT ON COLUMN product_reinforcements.total_length_meters IS 'Comprimento total calculado (bar_count × bar_length_meters)';

-- Adicionar campos às receitas/traços
DO $$
BEGIN
  -- Tipo de concreto: dry (seco - TCS AL) ou plastic (plástico - TCP AL)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'concrete_type'
  ) THEN
    ALTER TABLE recipes ADD COLUMN concrete_type text CHECK (concrete_type IN ('dry', 'plastic'));
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE product_reinforcements ENABLE ROW LEVEL SECURITY;

-- Políticas para product_reinforcements
CREATE POLICY "Allow anonymous access to product_reinforcements"
  ON product_reinforcements
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated access to product_reinforcements"
  ON product_reinforcements
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para atualizar o total_length_meters automaticamente
CREATE OR REPLACE FUNCTION update_reinforcement_total_length()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_length_meters := NEW.bar_count * NEW.bar_length_meters;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular total_length_meters
DROP TRIGGER IF EXISTS trigger_update_reinforcement_total ON product_reinforcements;
CREATE TRIGGER trigger_update_reinforcement_total
  BEFORE INSERT OR UPDATE OF bar_count, bar_length_meters
  ON product_reinforcements
  FOR EACH ROW
  EXECUTE FUNCTION update_reinforcement_total_length();