/*
  # Create budget_global_params table

  ## Summary
  Adds a new table to store global construction parameters per budget (Etapa 1).
  These pre-defined parameters (concrete mix designs, mortar mixes, recurring materials,
  steel reinforcement specs) are reused automatically when adding structural elements,
  avoiding repetitive data entry.

  ## New Tables
  - `budget_global_params`
    - `id` (uuid, PK)
    - `budget_id` (uuid, FK budgets) - which budget this param belongs to
    - `param_key` (text) - machine identifier e.g. 'traco_concreto_sapata'
    - `param_label` (text) - display name e.g. 'Traço Concreto - Sapata'
    - `param_category` (text) - group: 'concreto', 'argamassa', 'aco', 'insumos_gerais'
    - `material_id` (uuid, FK materials, nullable) - linked material from catalog
    - `unit_price` (numeric) - unit price fixed for this work
    - `value_text` (text, nullable) - mix ratio description e.g. '1:2:3'
    - `notes` (text, nullable)
    - `sort_order` (integer)
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Public access policies matching existing budget_* tables pattern

  ## Notes
  1. material_id references materials table; nullable for params without a direct material link
  2. unit_price defaults to 0 and can be auto-filled from linked material's latest price
  3. param_category groups params for display in the UI
*/

CREATE TABLE IF NOT EXISTS budget_global_params (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  param_key text NOT NULL,
  param_label text NOT NULL,
  param_category text NOT NULL DEFAULT 'insumos_gerais',
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  value_text text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE budget_global_params ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read budget_global_params"
  ON budget_global_params FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert budget_global_params"
  ON budget_global_params FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update budget_global_params"
  ON budget_global_params FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete budget_global_params"
  ON budget_global_params FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_budget_global_params_budget_id
  ON budget_global_params(budget_id);

CREATE INDEX IF NOT EXISTS idx_budget_global_params_material_id
  ON budget_global_params(material_id);
