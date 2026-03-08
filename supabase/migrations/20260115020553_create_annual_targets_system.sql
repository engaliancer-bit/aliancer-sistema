/*
  # Sistema de Metas Anuais

  1. Nova Tabela
    - `annual_targets`
      - `id` (uuid, primary key)
      - `year` (integer) - Ano da meta
      - `annual_target_amount` (numeric) - Valor da meta anual
      - `start_date` (date) - Data de início das atividades
      - `end_date` (date) - Data de fim das atividades
      - `working_days` (integer) - Número de dias úteis calculados no período
      - `daily_target` (numeric) - Meta diária calculada (meta anual / dias úteis)
      - `description` (text) - Descrição da meta
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Segurança
    - Habilitar RLS na tabela
    - Adicionar políticas para acesso público (anonymous e authenticated)
  
  3. Observações
    - A tabela permite apenas uma meta por ano (UNIQUE constraint)
    - Os dias úteis devem ser calculados no frontend baseado no período
    - A meta diária é armazenada para facilitar consultas
*/

-- Criar tabela de metas anuais
CREATE TABLE IF NOT EXISTS annual_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  annual_target_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  working_days integer NOT NULL DEFAULT 0,
  daily_target numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_working_days CHECK (working_days > 0),
  CONSTRAINT valid_amounts CHECK (annual_target_amount >= 0 AND daily_target >= 0)
);

-- Habilitar RLS
ALTER TABLE annual_targets ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
CREATE POLICY "Public access for all operations on annual_targets" 
  ON annual_targets FOR ALL 
  TO anon 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Authenticated access for all operations on annual_targets" 
  ON annual_targets FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_annual_targets_year ON annual_targets(year);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_annual_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_annual_targets_updated_at
  BEFORE UPDATE ON annual_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_annual_targets_updated_at();
