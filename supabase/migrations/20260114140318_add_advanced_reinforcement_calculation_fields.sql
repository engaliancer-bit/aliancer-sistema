/*
  # Advanced Reinforcement Calculation System
  
  1. Changes to product_reinforcements table
    - Add reference_length_meters: comprimento de referência da armadura
    - Add length_adjustment_meters: ajuste calculado baseado na diferença
    - Add calculated_total_length_meters: comprimento total calculado automaticamente
    
  2. Changes for transversal reinforcements (stirrups)
    - Add stirrup_standard_length_meters: comprimento de cada estribo padrão
    - Add stirrup_standard_quantity: quantidade de estribos padrão
    - Add stirrup_spacing_meters: espaçamento entre estribos (ex: 0.15m)
    - Add stirrup_calculated_additional: estribos adicionais calculados automaticamente
    - Add stirrup_special_total_meters: total de metros de estribos especiais
    - Add stirrup_total_meters: total final de metros de armadura transversal
    
  3. New table: reinforcement_stirrup_specials
    - For storing special stirrup configurations
    - Links to product_reinforcement_id
    - Stores custom stirrup lengths and quantities
*/

-- Add new fields to product_reinforcements table for advanced calculations
DO $$
BEGIN
  -- Fields for longitudinal reinforcement calculations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'reference_length_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN reference_length_meters numeric(10,3);
    COMMENT ON COLUMN product_reinforcements.reference_length_meters IS 'Comprimento de referência da armadura principal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'length_adjustment_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN length_adjustment_meters numeric(10,3);
    COMMENT ON COLUMN product_reinforcements.length_adjustment_meters IS 'Ajuste de comprimento (diferença entre referência e total)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'calculated_total_length_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN calculated_total_length_meters numeric(10,3);
    COMMENT ON COLUMN product_reinforcements.calculated_total_length_meters IS 'Comprimento total calculado automaticamente';
  END IF;

  -- Fields for transversal reinforcement (stirrups) calculations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'stirrup_standard_length_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN stirrup_standard_length_meters numeric(10,3);
    COMMENT ON COLUMN product_reinforcements.stirrup_standard_length_meters IS 'Comprimento de cada estribo padrão';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'stirrup_standard_quantity'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN stirrup_standard_quantity integer DEFAULT 0;
    COMMENT ON COLUMN product_reinforcements.stirrup_standard_quantity IS 'Quantidade de estribos padrão';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'stirrup_spacing_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN stirrup_spacing_meters numeric(10,3);
    COMMENT ON COLUMN product_reinforcements.stirrup_spacing_meters IS 'Espaçamento entre estribos (ex: 0.15m)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'stirrup_calculated_additional'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN stirrup_calculated_additional integer DEFAULT 0;
    COMMENT ON COLUMN product_reinforcements.stirrup_calculated_additional IS 'Estribos adicionais calculados automaticamente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'stirrup_special_total_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN stirrup_special_total_meters numeric(10,3) DEFAULT 0;
    COMMENT ON COLUMN product_reinforcements.stirrup_special_total_meters IS 'Total de metros de estribos especiais';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_reinforcements' AND column_name = 'stirrup_total_meters'
  ) THEN
    ALTER TABLE product_reinforcements ADD COLUMN stirrup_total_meters numeric(10,3);
    COMMENT ON COLUMN product_reinforcements.stirrup_total_meters IS 'Total final de metros de armadura transversal';
  END IF;
END $$;

-- Create table for special stirrup configurations
CREATE TABLE IF NOT EXISTS reinforcement_stirrup_specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_reinforcement_id uuid REFERENCES product_reinforcements(id) ON DELETE CASCADE NOT NULL,
  description text,
  stirrup_length_meters numeric(10,3) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_meters numeric(10,3) GENERATED ALWAYS AS (stirrup_length_meters * quantity) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE reinforcement_stirrup_specials ENABLE ROW LEVEL SECURITY;

-- Create policies for reinforcement_stirrup_specials
CREATE POLICY "Allow public read access to stirrup specials"
  ON reinforcement_stirrup_specials FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to stirrup specials"
  ON reinforcement_stirrup_specials FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to stirrup specials"
  ON reinforcement_stirrup_specials FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to stirrup specials"
  ON reinforcement_stirrup_specials FOR DELETE
  TO public
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stirrup_specials_reinforcement 
  ON reinforcement_stirrup_specials(product_reinforcement_id);

-- Add comments
COMMENT ON TABLE reinforcement_stirrup_specials IS 'Configurações especiais de estribos para armaduras transversais';
