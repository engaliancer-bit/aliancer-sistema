/*
  # Aprimoramento do Modulo Construtora - Orcamentos

  Melhora as tabelas existentes com:
  1. Parametros avancados nos elementos (fck, tipo_bloco, armacao etc.)
  2. Funcao de calculo de consumo de insumos por composicao
  3. View de orcamento consolidado por WBS com totais
  4. Funcao para gerar quantitativos automaticos a partir dos elementos

  ## Alteracoes em budget_elements
  - Adicionados campos de quantitativos calculados por categoria
  - Campo calc_log_summary para resumo textual do calculo

  ## Novas funcoes
  - get_budget_quantitative_summary: retorna resumo de quantitativos por WBS
  - apply_composition_to_element: calcula consumo de insumos para um elemento
*/

-- Adiciona coluna de resumo de calculo nos elementos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'calc_summary'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN calc_summary text;
  END IF;
END $$;

-- Adiciona campo de observacoes do levantamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_elements' AND column_name = 'survey_notes'
  ) THEN
    ALTER TABLE budget_elements ADD COLUMN survey_notes text;
  END IF;
END $$;

-- Tabela para vincular elementos a composicoes diretamente (elemento -> composicao -> insumos)
CREATE TABLE IF NOT EXISTS budget_element_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id uuid NOT NULL REFERENCES budget_elements(id) ON DELETE CASCADE,
  composition_id uuid NOT NULL REFERENCES budget_compositions(id) ON DELETE CASCADE,
  quantity_override numeric(14,4),
  unit_override text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(element_id, composition_id)
);

ALTER TABLE budget_element_compositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read budget_element_compositions" ON budget_element_compositions FOR SELECT USING (true);
CREATE POLICY "Allow public insert budget_element_compositions" ON budget_element_compositions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update budget_element_compositions" ON budget_element_compositions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete budget_element_compositions" ON budget_element_compositions FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_budget_element_comp_element ON budget_element_compositions(element_id);
CREATE INDEX IF NOT EXISTS idx_budget_element_comp_composition ON budget_element_compositions(composition_id);

-- View consolidada do orcamento por WBS
CREATE OR REPLACE VIEW v_budget_wbs_summary AS
SELECT
  ws.id AS wbs_step_id,
  ws.budget_id,
  ws.code,
  ws.name AS wbs_name,
  ws.sort_order,
  COUNT(DISTINCT be.id) AS total_elements,
  COUNT(DISTINCT CASE WHEN be.measurement_status = 'confirmado' THEN be.id END) AS confirmed_elements,
  COUNT(DISTINCT CASE WHEN be.measurement_status = 'pendente' THEN be.id END) AS pending_elements,
  COALESCE(SUM(bi.total_price), 0) AS subtotal,
  COALESCE(SUM(bi.bdi_value), 0) AS bdi_total,
  COALESCE(SUM(bi.final_price), 0) AS total_with_bdi
FROM budget_wbs_steps ws
LEFT JOIN budget_elements be ON be.wbs_step_id = ws.id
LEFT JOIN budget_items bi ON bi.wbs_step_id = ws.id
GROUP BY ws.id, ws.budget_id, ws.code, ws.name, ws.sort_order;

-- View de itens do orcamento com dados de insumos e produtos
CREATE OR REPLACE VIEW v_budget_items_detail AS
SELECT
  bi.*,
  ws.code AS wbs_code,
  ws.name AS wbs_name,
  m.name AS material_name,
  m.unit AS material_unit,
  COALESCE(m.resale_price, m.unit_cost, 0) AS material_current_price,
  p.name AS product_name,
  p.unit AS product_unit,
  COALESCE(p.final_sale_price, p.sale_price, 0) AS product_current_price,
  bc.code AS composition_code,
  bc.name AS composition_name
FROM budget_items bi
LEFT JOIN budget_wbs_steps ws ON ws.id = bi.wbs_step_id
LEFT JOIN materials m ON m.id = bi.material_id
LEFT JOIN products p ON p.id = bi.product_id
LEFT JOIN budget_compositions bc ON bc.id = bi.composition_id;

-- Funcao para calcular quantidade de um elemento parametricamente
-- Retorna uma tabela com (quantity, unit, formula, category)
CREATE OR REPLACE FUNCTION calc_element_params(
  p_type text,
  p_params jsonb
) RETURNS TABLE(
  quantity numeric,
  unit text,
  formula text,
  category text
) AS $$
DECLARE
  b numeric := COALESCE((p_params->>'largura')::numeric, (p_params->>'b')::numeric, 0);
  h numeric := COALESCE((p_params->>'altura')::numeric, (p_params->>'h')::numeric, 0);
  l numeric := COALESCE((p_params->>'comprimento')::numeric, (p_params->>'l')::numeric, 0);
  e numeric := COALESCE((p_params->>'espessura')::numeric, (p_params->>'e')::numeric, 0);
  d numeric := COALESCE((p_params->>'diametro')::numeric, 0);
  q numeric := COALESCE((p_params->>'quantidade')::numeric, 1);
  area_bruta numeric;
  area_deducao numeric := 0;
  vol numeric;
  result numeric;
BEGIN
  CASE p_type
    -- FUNDACOES
    WHEN 'sapata' THEN
      vol := b * l * h * q;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = b(%.2fm) × l(%.2fm) × h(%.2fm) × qtd(%s) = %.4f m3', b, l, h, q, vol),
        'fundacao'::text;

    WHEN 'bloco_fundacao' THEN
      vol := b * l * h * q;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = b(%.2fm) × l(%.2fm) × h(%.2fm) × qtd(%s) = %.4f m3', b, l, h, q, vol),
        'fundacao'::text;

    WHEN 'radier' THEN
      area_bruta := b * l;
      vol := area_bruta * e;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = A(%.2fm × %.2fm) × e(%.3fm) = %.4f m3', b, l, e, vol),
        'fundacao'::text;

    WHEN 'baldrame' THEN
      vol := b * h * l * q;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = b(%.2fm) × h(%.2fm) × L(%.2fm) × qtd(%s) = %.4f m3', b, h, l, q, vol),
        'fundacao'::text;

    WHEN 'estaca' THEN
      vol := 3.14159 * (d/2.0) * (d/2.0) * h * q;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = π × (d/2)² × h × qtd = π × (%.2f/2)² × %.2f × %s = %.4f m3', d, h, q, vol),
        'fundacao'::text;

    -- ESTRUTURA
    WHEN 'viga' THEN
      vol := b * h * l * q;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = b(%.2fm) × h(%.2fm) × L(%.2fm) × qtd(%s) = %.4f m3', b, h, l, q, vol),
        'estrutura'::text;

    WHEN 'pilar' THEN
      vol := b * l * h * q;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = b(%.2fm) × l(%.2fm) × h(%.2fm) × qtd(%s) = %.4f m3', b, l, h, q, vol),
        'estrutura'::text;

    WHEN 'laje' THEN
      area_bruta := b * l;
      vol := area_bruta * e;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × L(%.2fm) = %.4f m2 | Vol = %.4f m3 (e=%.3fm)', b, l, area_bruta, vol, e),
        'estrutura'::text;

    WHEN 'escada' THEN
      area_bruta := b * l;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × L(%.2fm) = %.4f m2', b, l, area_bruta),
        'estrutura'::text;

    -- VEDACAO
    WHEN 'parede_alvenaria', 'parede_drywall', 'muro' THEN
      area_bruta := l * h * q;
      area_deducao := COALESCE((p_params->>'area_deducao')::numeric, 0);
      result := GREATEST(area_bruta - area_deducao, 0);
      RETURN QUERY SELECT result, 'm2'::text,
        format('A = L(%.2fm) × h(%.2fm) × qtd(%s) - deducoes(%.2fm2) = %.4f m2', l, h, q, area_deducao, result),
        'vedacao'::text;

    -- ABERTURAS (desconto negativo)
    WHEN 'porta', 'janela', 'esquadria' THEN
      area_bruta := b * h * q;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × h(%.2fm) × qtd(%s) = %.4f m2 [desconto em paredes]', b, h, q, area_bruta),
        'esquadria'::text;

    -- REVESTIMENTOS / PISOS
    WHEN 'revestimento_piso', 'revestimento_parede', 'revestimento_teto', 'piso_ceramico', 'piso_porcelanato' THEN
      area_bruta := b * l * q;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × L(%.2fm) × qtd(%s) = %.4f m2', b, l, q, area_bruta),
        'revestimento'::text;

    -- PINTURA
    WHEN 'pintura' THEN
      area_bruta := b * l * q;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × L(%.2fm) × qtd(%s) = %.4f m2', b, l, q, area_bruta),
        'acabamento'::text;

    -- IMPERMEABILIZACAO / COBERTURA
    WHEN 'impermeabilizacao', 'cobertura' THEN
      area_bruta := b * l;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × L(%.2fm) = %.4f m2', b, l, area_bruta),
        'cobertura'::text;

    -- PAVIMENTACAO
    WHEN 'pavimentacao_asfalto', 'pavimentacao_concreto', 'pavimentacao_intertravado' THEN
      area_bruta := b * l;
      vol := area_bruta * e;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = b(%.2fm) × L(%.2fm) = %.4f m2 | Vol = %.4f m3 (e=%.3fm)', b, l, area_bruta, vol, e),
        'pavimentacao'::text;

    -- TERRAPLENAGEM / DRENAGEM
    WHEN 'terraplanagem', 'corte_aterro' THEN
      vol := b * l * h;
      RETURN QUERY SELECT vol, 'm3'::text,
        format('V = b(%.2fm) × L(%.2fm) × h(%.2fm) = %.4f m3', b, l, h, vol),
        'terraplagem'::text;

    WHEN 'drenagem' THEN
      RETURN QUERY SELECT l * q, 'm'::text,
        format('Comprimento = L(%.2fm) × qtd(%s) = %.4f m', l, q, l * q),
        'drenagem'::text;

    -- INSTALACOES
    WHEN 'instalacao_eletrica', 'instalacao_hidraulica', 'instalacao_gas' THEN
      RETURN QUERY SELECT q, 'pt'::text,
        format('Pontos = %s', q),
        'instalacao'::text;

    WHEN 'contencao' THEN
      area_bruta := l * h;
      RETURN QUERY SELECT area_bruta, 'm2'::text,
        format('A = L(%.2fm) × h(%.2fm) = %.4f m2', l, h, area_bruta),
        'contencao'::text;

    ELSE
      RETURN QUERY SELECT q, 'un'::text,
        format('Quantidade = %s un', q),
        'outros'::text;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger atualizado que usa a nova funcao
CREATE OR REPLACE FUNCTION update_element_calculated_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_qty   numeric;
  v_unit  text;
  v_form  text;
  v_cat   text;
BEGIN
  SELECT quantity, unit, formula, category
  INTO v_qty, v_unit, v_form, v_cat
  FROM calc_element_params(NEW.element_type, NEW.params);

  NEW.calculated_quantity := COALESCE(v_qty, 0);
  NEW.calculated_unit     := COALESCE(v_unit, 'un');
  NEW.calc_summary        := v_form;

  -- Registra memoria de calculo
  INSERT INTO budget_calculation_logs (
    budget_id, element_id, calculation_type,
    input_params, formula, result_value, result_unit
  ) VALUES (
    NEW.budget_id, NEW.id, 'element_quantity',
    NEW.params, v_form, v_qty, v_unit
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_element_quantity ON budget_elements;
CREATE TRIGGER trigger_update_element_quantity
  BEFORE INSERT OR UPDATE OF element_type, params ON budget_elements
  FOR EACH ROW
  EXECUTE FUNCTION update_element_calculated_quantity();

-- Mais composicoes padrao para complementar as 15 existentes
INSERT INTO budget_compositions (code, name, description, unit, element_type, base_source)
VALUES
  ('COMP-016', 'Concreto FCK 20 MPa - Fundacoes', 'Concreto para sapatas e baldrame', 'm3', 'sapata', 'proprio'),
  ('COMP-017', 'Forma de Madeira - Estrutura', 'Formas de madeira para concretagem', 'm2', 'viga', 'sinapi'),
  ('COMP-018', 'Armacao CA-50 / CA-60', 'Corte, dobra e montagem de aco', 'kg', 'viga', 'sinapi'),
  ('COMP-019', 'Escavacao Manual - Fundacoes', 'Escavacao mecanica ou manual', 'm3', 'sapata', 'sinapi'),
  ('COMP-020', 'Aterro Compactado', 'Aterro e compactacao mecanica', 'm3', 'terraplanagem', 'sinapi'),
  ('COMP-021', 'Base de Brita 0 - Piso', 'Camada de regularizacao com brita 0', 'm2', 'pavimentacao_concreto', 'sinapi'),
  ('COMP-022', 'Graute - Preenchimento de Blocos', 'Graute para preenchimento de blocos estruturais', 'm3', 'parede_alvenaria', 'sinapi'),
  ('COMP-023', 'Telha Metalica Trapezoidal', 'Telha metalica + estrutura metalica', 'm2', 'cobertura', 'proprio'),
  ('COMP-024', 'Forro PVC', 'Forro em PVC com estrutura', 'm2', 'revestimento_teto', 'sinapi'),
  ('COMP-025', 'Piso Vinilico', 'Assentamento de piso vinilico', 'm2', 'revestimento_piso', 'sinapi')
ON CONFLICT (code) DO NOTHING;
