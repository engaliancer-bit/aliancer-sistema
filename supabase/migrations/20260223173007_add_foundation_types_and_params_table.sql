/*
  # Foundation Types, Parameters Table, and Caixaria Settings

  ## Changes

  ### 1. Fix element_type constraint
  - Add 'alicerce' (masonry foundation wall) and 'pilar_fundacao' (foundation column)
    to the allowed element_type values in budget_elements

  ### 2. New Table: budget_foundation_params
  - Stores reusable foundation element models per budget (sapata, baldrame, pilar, alicerce)
  - Each model has a code (SP-01), type, label, and JSONB dimensions
  - Referenced by budget_elements via optional foundation_param_id FK

  ### 3. New Table: budget_caixaria_settings
  - Stores formwork (caixaria) rules per budget
  - Rules for board height selection based on beam/column height
  - Board dimensions, waste percentage, nail and wire consumption coefficients

  ### 4. Add foundation_param_id column to budget_elements
  - Optional FK linking an element to a foundation model in budget_foundation_params
*/

-- 1. Fix element_type check constraint to include new types
ALTER TABLE budget_elements DROP CONSTRAINT IF EXISTS budget_elements_element_type_check;

ALTER TABLE budget_elements ADD CONSTRAINT budget_elements_element_type_check
  CHECK (element_type = ANY (ARRAY[
    'sapata', 'bloco_fundacao', 'radier', 'estaca', 'baldrame',
    'alicerce', 'pilar_fundacao',
    'viga', 'pilar', 'laje', 'escada',
    'parede_alvenaria', 'parede_drywall', 'muro',
    'revestimento_piso', 'revestimento_parede', 'revestimento_teto',
    'porta', 'janela', 'esquadria',
    'instalacao_eletrica', 'instalacao_hidraulica', 'instalacao_gas',
    'pintura', 'impermeabilizacao', 'cobertura',
    'pavimentacao_asfalto', 'pavimentacao_concreto', 'pavimentacao_intertravado',
    'drenagem', 'contencao', 'terraplanagem', 'outros',
    'canteiro_obras', 'instalacoes_provisorias', 'tapume', 'locacao_terreno', 'limpeza_terreno',
    'bacia_sanitaria', 'pia_cozinha', 'lavatorio_cuba', 'torneira_registro',
    'chuveiro_ducha', 'tanque_lavanderia', 'item_louca_metal'
  ]));

-- 2. Create budget_foundation_params table
CREATE TABLE IF NOT EXISTS budget_foundation_params (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  param_type text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT budget_foundation_params_param_type_check
    CHECK (param_type IN ('sapata', 'baldrame', 'pilar', 'pilar_fundacao', 'alicerce'))
);

CREATE INDEX IF NOT EXISTS idx_budget_foundation_params_budget_id ON budget_foundation_params(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_foundation_params_type ON budget_foundation_params(budget_id, param_type);

ALTER TABLE budget_foundation_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read budget_foundation_params"
  ON budget_foundation_params FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert budget_foundation_params"
  ON budget_foundation_params FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update budget_foundation_params"
  ON budget_foundation_params FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete budget_foundation_params"
  ON budget_foundation_params FOR DELETE
  TO anon, authenticated
  USING (true);

-- 3. Create budget_caixaria_settings table
CREATE TABLE IF NOT EXISTS budget_caixaria_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  board_length_m numeric NOT NULL DEFAULT 2.20,
  board_width_rule jsonb NOT NULL DEFAULT '[
    {"min_height": 0.25, "board_width_cm": 30},
    {"min_height": 0.20, "board_width_cm": 25},
    {"min_height": 0.00, "board_width_cm": 20}
  ]',
  waste_percent numeric NOT NULL DEFAULT 15,
  nail_kg_per_m2 numeric NOT NULL DEFAULT 0.3,
  wire_gravateamento_m_per_ml numeric NOT NULL DEFAULT 0.5,
  nail_price_per_kg numeric NOT NULL DEFAULT 0,
  board_price_per_unit numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_caixaria_settings_budget_id ON budget_caixaria_settings(budget_id);

ALTER TABLE budget_caixaria_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read budget_caixaria_settings"
  ON budget_caixaria_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert budget_caixaria_settings"
  ON budget_caixaria_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update budget_caixaria_settings"
  ON budget_caixaria_settings FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete budget_caixaria_settings"
  ON budget_caixaria_settings FOR DELETE
  TO anon, authenticated
  USING (true);

-- 4. Add foundation_param_id to budget_elements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'foundation_param_id'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN foundation_param_id uuid REFERENCES budget_foundation_params(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_budget_elements_foundation_param ON budget_elements(foundation_param_id);
  END IF;
END $$;
