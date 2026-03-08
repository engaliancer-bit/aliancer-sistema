/*
  # Add Sub-Etapa and Parametric Mode to WBS Steps and Elements

  ## Changes

  ### budget_wbs_steps table
  - Add `is_parametric` (boolean, default false): marks a WBS step as parametric
    (its items are calculated from pre-registered models and global params)
    vs non-parametric (free-form spreadsheet entry).

  ### budget_elements table
  - Add `sub_etapa` (text, nullable): groups elements into named sub-sections within
    a WBS step. Examples: "Almoxarifado", "Locacao e demarcacao", "Sapata Isolada".
    Elements with the same sub_etapa + wbs_step_id are shown together in one sub-section.

  ## Purpose
  This enables the new two-level spreadsheet layout:
    1. WBS Step (Etapa) — e.g. "1. Servicos Preliminares"
    1.1 Sub-Etapa — e.g. "Almoxarifado"
         Quant. | Unid. | Descricao | Valor Unit. | Valor Total
    1.2 Sub-Etapa — e.g. "Locacao e demarcacao"
         ...
    Total Servicos Preliminares

  For parametric steps (Fundacao), each sub-etapa selects a pre-registered model,
  informing quantity and showing auto-calculated material consumption in spreadsheet format.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_wbs_steps' AND column_name = 'is_parametric'
  ) THEN
    ALTER TABLE budget_wbs_steps ADD COLUMN is_parametric boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'sub_etapa'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN sub_etapa text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budget_elements_sub_etapa
  ON budget_elements (wbs_step_id, sub_etapa)
  WHERE wbs_step_id IS NOT NULL;
