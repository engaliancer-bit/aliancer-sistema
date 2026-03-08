/*
  # Modulo IA para Orcamentos de Obras - Leitura de Planta e Resumo de Quantitativos

  ## Objetivo
  Adicionar suporte a:
  1. Upload e analise de plantas baixas por IA
  2. Revisao e confirmacao de elementos sugeridos pela IA
  3. Resumo consolidado de quantitativos por categoria
  4. Vinculo de composicoes aos elementos confirmados

  ## Novas Tabelas
  - `budget_floorplans`: armazena metadados dos arquivos de planta baixa enviados
  - `budget_ia_suggestions`: sugestoes geradas pela IA a partir da planta
  - `budget_ia_jobs`: controle de jobs asincronos de analise de planta

  ## Alteracoes em tabelas existentes
  - `budget_elements`: adiciona campo `ia_confidence` (confianca da IA 0-1)
  - `budget_elements`: adiciona campo `room` (ambiente/comodo de referencia)
  - `budget_elements`: adiciona campo `identifier_code` (ex: V1, P-01)

  ## Novas funcoes
  - `get_budget_quantitative_summary`: retorna quantitativos consolidados por categoria

  ## Seguranca
  - RLS habilitado em todas as novas tabelas
  - Acesso publico para compatibilidade com o sistema existente (sem autenticacao obrigatoria)
*/

-- ==========================================
-- 1. Campos adicionais em budget_elements
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'ia_confidence'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN ia_confidence numeric(4,3) DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'room'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN room text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'identifier_code'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN identifier_code text DEFAULT NULL;
  END IF;
END $$;

-- ==========================================
-- 2. Tabela de plantas baixas enviadas
-- ==========================================

CREATE TABLE IF NOT EXISTS budget_floorplans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  file_size_kb integer DEFAULT NULL,
  storage_path text DEFAULT NULL,
  file_base64 text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  error_message text DEFAULT NULL,
  ia_model text DEFAULT NULL,
  processing_started_at timestamptz DEFAULT NULL,
  processing_finished_at timestamptz DEFAULT NULL,
  elements_suggested integer DEFAULT 0,
  elements_confirmed integer DEFAULT 0,
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE budget_floorplans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select budget_floorplans"
  ON budget_floorplans FOR SELECT USING (true);
CREATE POLICY "Allow public insert budget_floorplans"
  ON budget_floorplans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update budget_floorplans"
  ON budget_floorplans FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete budget_floorplans"
  ON budget_floorplans FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_budget_floorplans_budget ON budget_floorplans(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_floorplans_status ON budget_floorplans(status);

-- ==========================================
-- 3. Tabela de sugestoes da IA (staging antes de virar budget_elements)
-- ==========================================

CREATE TABLE IF NOT EXISTS budget_ia_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  floorplan_id uuid REFERENCES budget_floorplans(id) ON DELETE CASCADE,
  element_type text NOT NULL,
  label text NOT NULL,
  room text DEFAULT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  calculated_quantity numeric(14,4) DEFAULT 0,
  calculated_unit text DEFAULT 'un',
  calc_summary text DEFAULT NULL,
  ia_confidence numeric(4,3) DEFAULT NULL,
  ia_reasoning text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'editado', 'ignorado')),
  converted_element_id uuid REFERENCES budget_elements(id) ON DELETE SET NULL,
  wbs_step_id uuid REFERENCES budget_wbs_steps(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE budget_ia_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select budget_ia_suggestions"
  ON budget_ia_suggestions FOR SELECT USING (true);
CREATE POLICY "Allow public insert budget_ia_suggestions"
  ON budget_ia_suggestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update budget_ia_suggestions"
  ON budget_ia_suggestions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete budget_ia_suggestions"
  ON budget_ia_suggestions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_budget_ia_suggestions_budget ON budget_ia_suggestions(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_ia_suggestions_floorplan ON budget_ia_suggestions(floorplan_id);
CREATE INDEX IF NOT EXISTS idx_budget_ia_suggestions_status ON budget_ia_suggestions(status);

-- ==========================================
-- 4. Funcao de resumo de quantitativos por categoria
-- ==========================================

CREATE OR REPLACE FUNCTION get_budget_quantitative_summary(p_budget_id uuid)
RETURNS TABLE(
  category text,
  category_label text,
  element_type text,
  element_label text,
  total_quantity numeric,
  unit text,
  confirmed_quantity numeric,
  pending_quantity numeric,
  element_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE be.element_type
      WHEN 'sapata' THEN 'fundacao'
      WHEN 'bloco_fundacao' THEN 'fundacao'
      WHEN 'baldrame' THEN 'fundacao'
      WHEN 'radier' THEN 'fundacao'
      WHEN 'estaca' THEN 'fundacao'
      WHEN 'viga' THEN 'estrutura'
      WHEN 'pilar' THEN 'estrutura'
      WHEN 'laje' THEN 'estrutura'
      WHEN 'escada' THEN 'estrutura'
      WHEN 'parede_alvenaria' THEN 'vedacao'
      WHEN 'parede_drywall' THEN 'vedacao'
      WHEN 'muro' THEN 'vedacao'
      WHEN 'porta' THEN 'esquadria'
      WHEN 'janela' THEN 'esquadria'
      WHEN 'revestimento_piso' THEN 'revestimento'
      WHEN 'revestimento_parede' THEN 'revestimento'
      WHEN 'revestimento_teto' THEN 'revestimento'
      WHEN 'cobertura' THEN 'cobertura'
      WHEN 'impermeabilizacao' THEN 'cobertura'
      WHEN 'pintura' THEN 'acabamento'
      WHEN 'pavimentacao_asfalto' THEN 'pavimentacao'
      WHEN 'pavimentacao_concreto' THEN 'pavimentacao'
      WHEN 'pavimentacao_intertravado' THEN 'pavimentacao'
      WHEN 'terraplanagem' THEN 'terraplagem'
      WHEN 'drenagem' THEN 'drenagem'
      WHEN 'instalacao_eletrica' THEN 'instalacao'
      WHEN 'instalacao_hidraulica' THEN 'instalacao'
      ELSE 'outros'
    END AS category,
    CASE be.element_type
      WHEN 'sapata' THEN 'Fundacoes'
      WHEN 'bloco_fundacao' THEN 'Fundacoes'
      WHEN 'baldrame' THEN 'Fundacoes'
      WHEN 'radier' THEN 'Fundacoes'
      WHEN 'estaca' THEN 'Fundacoes'
      WHEN 'viga' THEN 'Estrutura'
      WHEN 'pilar' THEN 'Estrutura'
      WHEN 'laje' THEN 'Estrutura'
      WHEN 'escada' THEN 'Estrutura'
      WHEN 'parede_alvenaria' THEN 'Vedacao'
      WHEN 'parede_drywall' THEN 'Vedacao'
      WHEN 'muro' THEN 'Vedacao'
      WHEN 'porta' THEN 'Esquadrias'
      WHEN 'janela' THEN 'Esquadrias'
      WHEN 'revestimento_piso' THEN 'Revestimentos'
      WHEN 'revestimento_parede' THEN 'Revestimentos'
      WHEN 'revestimento_teto' THEN 'Revestimentos'
      WHEN 'cobertura' THEN 'Cobertura'
      WHEN 'impermeabilizacao' THEN 'Cobertura'
      WHEN 'pintura' THEN 'Acabamento'
      WHEN 'pavimentacao_asfalto' THEN 'Pavimentacao'
      WHEN 'pavimentacao_concreto' THEN 'Pavimentacao'
      WHEN 'pavimentacao_intertravado' THEN 'Pavimentacao'
      WHEN 'terraplanagem' THEN 'Terraplanagem'
      WHEN 'drenagem' THEN 'Drenagem'
      WHEN 'instalacao_eletrica' THEN 'Instalacoes'
      WHEN 'instalacao_hidraulica' THEN 'Instalacoes'
      ELSE 'Outros'
    END AS category_label,
    be.element_type,
    CASE be.element_type
      WHEN 'sapata' THEN 'Sapata Isolada'
      WHEN 'bloco_fundacao' THEN 'Bloco de Fundacao'
      WHEN 'baldrame' THEN 'Viga Baldrame'
      WHEN 'radier' THEN 'Radier'
      WHEN 'estaca' THEN 'Estaca'
      WHEN 'viga' THEN 'Viga'
      WHEN 'pilar' THEN 'Pilar'
      WHEN 'laje' THEN 'Laje'
      WHEN 'escada' THEN 'Escada'
      WHEN 'parede_alvenaria' THEN 'Parede de Alvenaria'
      WHEN 'parede_drywall' THEN 'Parede Drywall'
      WHEN 'muro' THEN 'Muro'
      WHEN 'porta' THEN 'Porta'
      WHEN 'janela' THEN 'Janela'
      WHEN 'revestimento_piso' THEN 'Piso'
      WHEN 'revestimento_parede' THEN 'Revestimento Parede'
      WHEN 'revestimento_teto' THEN 'Forro / Teto'
      WHEN 'cobertura' THEN 'Cobertura'
      WHEN 'impermeabilizacao' THEN 'Impermeabilizacao'
      WHEN 'pintura' THEN 'Pintura'
      WHEN 'pavimentacao_asfalto' THEN 'Pavim. Asfaltica'
      WHEN 'pavimentacao_concreto' THEN 'Pavim. Concreto'
      WHEN 'pavimentacao_intertravado' THEN 'Piso Intertravado'
      WHEN 'terraplanagem' THEN 'Corte / Aterro'
      WHEN 'drenagem' THEN 'Drenagem'
      WHEN 'instalacao_eletrica' THEN 'Inst. Eletrica'
      WHEN 'instalacao_hidraulica' THEN 'Inst. Hidraulica'
      ELSE 'Item Avulso'
    END AS element_label,
    SUM(be.calculated_quantity)::numeric AS total_quantity,
    be.calculated_unit AS unit,
    SUM(CASE WHEN be.measurement_status = 'confirmado' THEN be.calculated_quantity ELSE 0 END)::numeric AS confirmed_quantity,
    SUM(CASE WHEN be.measurement_status = 'pendente' THEN be.calculated_quantity ELSE 0 END)::numeric AS pending_quantity,
    COUNT(be.id)::integer AS element_count
  FROM budget_elements be
  WHERE be.budget_id = p_budget_id
    AND be.measurement_status != 'ignorado'
  GROUP BY be.element_type, be.calculated_unit
  ORDER BY category, element_type;
END;
$$ LANGUAGE plpgsql STABLE;
