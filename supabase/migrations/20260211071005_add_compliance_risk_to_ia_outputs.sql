/*
  # Adicionar Indicadores de Risco/Compliance aos Documentos IA

  ## Visão Geral
  Adiciona campos para análise de risco e qualidade dos insumos nos outputs de IA,
  com foco em projetos rurais (CAR/RL/PRAD/Georeferenciamento).

  ## Mudanças

  1. Enum para nível de risco
  2. Campos de compliance_risk em project_ia_outputs:
     - compliance_risk_level (low/medium/high)
     - compliance_risk_reasons (array de motivos)
     - inputs_quality (qualidade dos insumos)

  3. Função para calcular risco automaticamente

  4. View atualizada para incluir informações de risco

  ## Regras de Cálculo de Risco (MVP)

  ### HIGH
  - Polígono ausente ou inválido
  - CAR ausente quando template exigir
  - Conflito crítico de dados
  - Tentativa de cálculo quantitativo com imagem não georref

  ### MEDIUM
  - Checklist incompleto
  - Anexos insuficientes
  - Dados relevantes faltando

  ### LOW
  - Sem pendências críticas
  - Checklist essencial OK
*/

-- Enum para nível de risco de compliance
DO $$ BEGIN
  CREATE TYPE compliance_risk_level AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar campos de risco/compliance aos outputs
ALTER TABLE project_ia_outputs
  ADD COLUMN IF NOT EXISTS compliance_risk_level compliance_risk_level DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS compliance_risk_reasons text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS inputs_quality jsonb DEFAULT '{}'::jsonb;

-- Padronizar pending_items como array de objetos com severidade
COMMENT ON COLUMN project_ia_outputs.pending_items IS
  'Array de objetos: [{section, item, severity: "CRÍTICA"|"IMPORTANTE"|"INFO"}]';

COMMENT ON COLUMN project_ia_outputs.compliance_risk_level IS
  'Nível de risco de compliance: low, medium, high';

COMMENT ON COLUMN project_ia_outputs.compliance_risk_reasons IS
  'Motivos do nível de risco (array de strings)';

COMMENT ON COLUMN project_ia_outputs.inputs_quality IS
  'Qualidade dos insumos: {polygon_status, source_type, source_year, attachments_count, geographic_quality}';

-- Função: calcular risco de compliance automaticamente
CREATE OR REPLACE FUNCTION calculate_compliance_risk(
  p_pending_items jsonb,
  p_inputs_quality jsonb,
  p_template_type text DEFAULT NULL
)
RETURNS TABLE(
  risk_level compliance_risk_level,
  risk_reasons text[]
) AS $$
DECLARE
  v_risk_level compliance_risk_level := 'low';
  v_reasons text[] := '{}';
  v_polygon_status text;
  v_source_type text;
  v_attachments_count integer;
  v_critical_count integer := 0;
  v_important_count integer := 0;
BEGIN
  -- Extrair dados de qualidade dos insumos
  v_polygon_status := p_inputs_quality->>'polygon_status';
  v_source_type := p_inputs_quality->>'source_type';
  v_attachments_count := COALESCE((p_inputs_quality->>'attachments_count')::integer, 0);

  -- Contar pendências críticas e importantes
  SELECT
    COUNT(*) FILTER (WHERE item->>'severity' = 'CRÍTICA'),
    COUNT(*) FILTER (WHERE item->>'severity' = 'IMPORTANTE')
  INTO v_critical_count, v_important_count
  FROM jsonb_array_elements(p_pending_items) AS item;

  -- RISCO ALTO: Critérios críticos

  -- Polígono ausente ou inválido
  IF v_polygon_status IN ('ausente', 'invalido', 'absent', 'invalid') THEN
    v_risk_level := 'high';
    v_reasons := array_append(v_reasons, 'Polígono do imóvel ausente ou inválido');
  END IF;

  -- CAR ausente para templates rurais
  IF p_template_type IN ('car', 'laudo_rural', 'prad', 'reserva_legal')
     AND (p_inputs_quality->>'car_number' IS NULL OR p_inputs_quality->>'car_number' = '') THEN
    v_risk_level := 'high';
    v_reasons := array_append(v_reasons, 'CAR ausente para documento rural');
  END IF;

  -- Tentativa de cálculo quantitativo sem georref
  IF v_source_type = 'imagem_qualitativa'
     AND p_inputs_quality->>'requires_quantitative' = 'true' THEN
    v_risk_level := 'high';
    v_reasons := array_append(v_reasons, 'Cálculo quantitativo requer imagem georeferenciada');
  END IF;

  -- Pendências críticas existem
  IF v_critical_count > 0 THEN
    v_risk_level := 'high';
    v_reasons := array_append(v_reasons,
      format('Existem %s pendência(s) crítica(s) no documento', v_critical_count)
    );
  END IF;

  -- RISCO MÉDIO: Se não for alto, verificar critérios médios
  IF v_risk_level = 'low' THEN

    -- Anexos insuficientes
    IF v_attachments_count < 2 THEN
      v_risk_level := 'medium';
      v_reasons := array_append(v_reasons,
        format('Apenas %s anexo(s) - recomendado mínimo 2', v_attachments_count)
      );
    END IF;

    -- Pendências importantes
    IF v_important_count >= 3 THEN
      v_risk_level := 'medium';
      v_reasons := array_append(v_reasons,
        format('%s pendência(s) importante(s) aguardando resolução', v_important_count)
      );
    END IF;

    -- Base de dados desatualizada
    IF (p_inputs_quality->>'source_year')::integer < EXTRACT(YEAR FROM now()) - 2 THEN
      v_risk_level := 'medium';
      v_reasons := array_append(v_reasons, 'Base de dados com mais de 2 anos');
    END IF;

    -- Polígono com qualidade questionável
    IF v_polygon_status IN ('baixa_qualidade', 'low_quality') THEN
      v_risk_level := 'medium';
      v_reasons := array_append(v_reasons, 'Qualidade do polígono precisa ser verificada');
    END IF;
  END IF;

  -- RISCO BAIXO: Mensagem padrão se não houver problemas
  IF v_risk_level = 'low' AND array_length(v_reasons, 1) IS NULL THEN
    v_reasons := array_append(v_reasons, 'Documentação e insumos em conformidade');
  END IF;

  RETURN QUERY SELECT v_risk_level, v_reasons;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger: calcular risco automaticamente ao criar/atualizar output
CREATE OR REPLACE FUNCTION auto_calculate_compliance_risk()
RETURNS TRIGGER AS $$
DECLARE
  v_calc_result RECORD;
  v_template_type text;
BEGIN
  -- Buscar tipo do template
  SELECT t.ia_doc_type
  INTO v_template_type
  FROM project_ia_jobs j
  INNER JOIN ai_document_templates t ON t.id = j.template_id
  WHERE j.id = NEW.job_id;

  -- Calcular risco se ainda não foi definido manualmente
  IF NEW.compliance_risk_level IS NULL OR NEW.compliance_risk_level = 'low' THEN
    SELECT risk_level, risk_reasons
    INTO v_calc_result
    FROM calculate_compliance_risk(
      COALESCE(NEW.pending_items, '[]'::jsonb),
      COALESCE(NEW.inputs_quality, '{}'::jsonb),
      v_template_type
    );

    NEW.compliance_risk_level := v_calc_result.risk_level;
    NEW.compliance_risk_reasons := v_calc_result.risk_reasons;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_calculate_compliance_risk ON project_ia_outputs;
CREATE TRIGGER trigger_auto_calculate_compliance_risk
  BEFORE INSERT OR UPDATE ON project_ia_outputs
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_compliance_risk();

-- Atualizar view de outputs com informações de risco
DROP VIEW IF EXISTS project_ia_outputs_detail;
CREATE OR REPLACE VIEW project_ia_outputs_detail AS
SELECT
  o.id,
  o.job_id,
  o.created_at,
  o.version,
  o.output_markdown,
  o.executive_summary,
  o.pending_items,
  o.docx_storage_path,
  o.docx_generated_at,
  o.word_count,
  o.section_count,
  o.placeholders_count,
  o.generated_by,
  o.reviewed_by,
  o.reviewed_at,

  -- Campos de risco/compliance
  o.compliance_risk_level,
  o.compliance_risk_reasons,
  o.inputs_quality,

  -- Job info
  j.status as job_status,
  j.project_id,
  j.customer_id,
  j.property_id,

  -- Projeto
  p.name as project_name,
  p.property_type,

  -- Template
  t.name as template_name,
  t.ia_doc_type,

  -- Cliente
  c.name as customer_name,

  -- Contagens úteis
  (SELECT COUNT(*) FROM project_ia_job_files f WHERE f.job_id = o.job_id) as attachments_count,

  -- Pendências por severidade
  (SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)
   WHERE value->>'severity' = 'CRÍTICA') as critical_pending_count,
  (SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)
   WHERE value->>'severity' = 'IMPORTANTE') as important_pending_count,
  (SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)) as total_pending_count
FROM project_ia_outputs o
INNER JOIN project_ia_jobs j ON j.id = o.job_id
LEFT JOIN engineering_projects p ON p.id = j.project_id
LEFT JOIN ai_document_templates t ON t.id = j.template_id
LEFT JOIN customers c ON c.id = j.customer_id;

-- View: último output por projeto (para card gerencial)
CREATE OR REPLACE VIEW project_latest_ia_output AS
SELECT DISTINCT ON (j.project_id)
  j.project_id,
  o.id as output_id,
  o.job_id,
  o.version,
  o.created_at,
  o.executive_summary,
  o.compliance_risk_level,
  o.compliance_risk_reasons,
  o.inputs_quality,
  o.pending_items,
  o.word_count,
  o.section_count,
  o.placeholders_count,

  -- Status do job
  j.status as job_status,
  j.progress as job_progress,

  -- Template
  t.name as template_name,
  t.ia_doc_type,

  -- Contagens
  (SELECT COUNT(*) FROM project_ia_job_files f WHERE f.job_id = j.id) as attachments_count,
  (SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)
   WHERE value->>'severity' = 'CRÍTICA') as critical_pending_count,
  (SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)
   WHERE value->>'severity' = 'IMPORTANTE') as important_pending_count,
  (SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)) as total_pending_count,

  -- Total de jobs e outputs do projeto
  (SELECT COUNT(*) FROM project_ia_jobs WHERE project_id = j.project_id) as total_jobs,
  (SELECT COUNT(*) FROM project_ia_outputs o2
   INNER JOIN project_ia_jobs j2 ON j2.id = o2.job_id
   WHERE j2.project_id = j.project_id) as total_outputs
FROM project_ia_jobs j
LEFT JOIN project_ia_outputs o ON o.job_id = j.id
LEFT JOIN ai_document_templates t ON t.id = j.template_id
WHERE o.id IS NOT NULL
ORDER BY j.project_id, o.created_at DESC, o.version DESC;

COMMENT ON VIEW project_latest_ia_output IS
  'Último output de IA por projeto com indicadores de risco/compliance';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_project_ia_outputs_risk_level
  ON project_ia_outputs(compliance_risk_level);

CREATE INDEX IF NOT EXISTS idx_project_ia_outputs_job_created
  ON project_ia_outputs(job_id, created_at DESC);

-- Função: obter estatísticas de compliance por projeto
CREATE OR REPLACE FUNCTION get_project_ia_compliance_stats(p_project_id uuid)
RETURNS TABLE(
  total_outputs integer,
  high_risk_count integer,
  medium_risk_count integer,
  low_risk_count integer,
  total_critical_pending integer,
  total_important_pending integer,
  latest_risk_level compliance_risk_level,
  latest_risk_reasons text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::integer as total_outputs,
    COUNT(*) FILTER (WHERE o.compliance_risk_level = 'high')::integer as high_risk_count,
    COUNT(*) FILTER (WHERE o.compliance_risk_level = 'medium')::integer as medium_risk_count,
    COUNT(*) FILTER (WHERE o.compliance_risk_level = 'low')::integer as low_risk_count,
    COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)
                  WHERE value->>'severity' = 'CRÍTICA')), 0)::integer as total_critical_pending,
    COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(o.pending_items)
                  WHERE value->>'severity' = 'IMPORTANTE')), 0)::integer as total_important_pending,
    (SELECT compliance_risk_level FROM project_latest_ia_output WHERE project_id = p_project_id) as latest_risk_level,
    (SELECT compliance_risk_reasons FROM project_latest_ia_output WHERE project_id = p_project_id) as latest_risk_reasons
  FROM project_ia_outputs o
  INNER JOIN project_ia_jobs j ON j.id = o.job_id
  WHERE j.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Exemplo de uso da função de cálculo de risco
COMMENT ON FUNCTION calculate_compliance_risk IS
  'Calcula nível de risco e motivos baseado em pendências e qualidade dos insumos';

-- Exemplo de inputs_quality JSON
COMMENT ON COLUMN project_ia_outputs.inputs_quality IS
  'Exemplo: {
    "polygon_status": "ok|ausente|invalido|baixa_qualidade",
    "source_type": "mapbiomas|imagem_georref|imagem_qualitativa",
    "source_year": 2024,
    "attachments_count": 5,
    "geographic_quality": "alta|media|baixa",
    "car_number": "BR-XXXXX",
    "requires_quantitative": false
  }';
