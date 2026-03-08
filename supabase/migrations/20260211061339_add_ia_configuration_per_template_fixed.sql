/*
  # Adicionar Configurações de IA por Template
  
  ## Visão Geral
  Adiciona campos de configuração de IA para cada template, permitindo
  personalizar o comportamento da geração de documentos por tipo.
  
  ## Novos Campos em `ai_document_templates`
  
  ### 1. `ia_enabled`
  Habilita/desabilita geração por IA para este template
  
  ### 2. `ia_doc_type`
  Tipo de documento técnico (laudo, relatório, estudo, etc.)
  
  ### 3. `ia_sections`
  Lista ordenada de seções obrigatórias do documento
  
  ### 4. `ia_intake_questions`
  Perguntas para coleta de informações antes da geração
  
  ### 5. `ia_required_inputs`
  Campos mínimos obrigatórios para gerar o documento
  
  ### 6. `ia_style_guide`
  Guia de estilo (tom técnico, corporativo Aliancer, etc.)
  
  ### 7. `ia_rules`
  Regras específicas para geração (não inventar dados, usar [A COMPLETAR], etc.)
*/

-- Enum para tipo de documento
DO $$ BEGIN
  CREATE TYPE ia_document_type AS ENUM (
    'laudo',
    'relatorio',
    'estudo',
    'diagnostico',
    'memorial',
    'projeto_textual',
    'outro'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar campos de configuração IA aos templates
ALTER TABLE ai_document_templates
  ADD COLUMN IF NOT EXISTS ia_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ia_doc_type ia_document_type DEFAULT 'relatorio',
  ADD COLUMN IF NOT EXISTS ia_sections jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ia_intake_questions jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ia_required_inputs jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ia_style_guide text DEFAULT 'Tom técnico e profissional. Linguagem clara e objetiva conforme padrões da Aliancer.',
  ADD COLUMN IF NOT EXISTS ia_rules jsonb DEFAULT '{"not_invent_data": true, "use_placeholders": true, "generate_pending_list": true, "require_technical_review": false}';

-- Adicionar campo para armazenar respostas do intake
ALTER TABLE ai_generated_documents
  ADD COLUMN IF NOT EXISTS intake_answers jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ia_config_snapshot jsonb DEFAULT '{}';

-- Comentários descritivos
COMMENT ON COLUMN ai_document_templates.ia_enabled IS 'Habilita/desabilita geração por IA para este template';
COMMENT ON COLUMN ai_document_templates.ia_doc_type IS 'Tipo de documento técnico (laudo, relatório, estudo, etc.)';
COMMENT ON COLUMN ai_document_templates.ia_sections IS 'Lista ordenada de seções: [{"order": 1, "title": "Introdução", "required": true}]';
COMMENT ON COLUMN ai_document_templates.ia_intake_questions IS 'Perguntas para coleta: [{"id": "q1", "question": "Qual o tipo?", "type": "text", "required": true}]';
COMMENT ON COLUMN ai_document_templates.ia_required_inputs IS 'Campos obrigatórios: ["cliente", "projeto", "propriedade"]';
COMMENT ON COLUMN ai_document_templates.ia_style_guide IS 'Guia de estilo e tom do documento';
COMMENT ON COLUMN ai_document_templates.ia_rules IS 'Regras de geração: {"not_invent_data": true, "use_placeholders": true}';

COMMENT ON COLUMN ai_generated_documents.intake_answers IS 'Respostas das perguntas de intake fornecidas pelo usuário';
COMMENT ON COLUMN ai_generated_documents.ia_config_snapshot IS 'Snapshot da configuração de IA usada na geração (para auditoria)';

-- Atualizar templates existentes com configuração padrão
UPDATE ai_document_templates
SET 
  ia_enabled = true,
  ia_doc_type = 'relatorio'::ia_document_type,
  ia_sections = '[]'::jsonb,
  ia_intake_questions = '[]'::jsonb,
  ia_required_inputs = '["customer_id", "project_id"]'::jsonb,
  ia_style_guide = 'Tom técnico e profissional. Linguagem clara e objetiva conforme padrões da Aliancer. Manter formalidade adequada ao contexto de engenharia.',
  ia_rules = jsonb_build_object(
    'not_invent_data', true,
    'use_placeholders', true,
    'generate_pending_list', true,
    'require_technical_review', false,
    'description', 'Regras: (1) Nunca inventar dados - use [A COMPLETAR] quando não houver informação; (2) Gerar lista de pendências ao final; (3) Manter padrão técnico Aliancer'
  )
WHERE ia_enabled IS NULL;

-- Função para validar configuração de IA
CREATE OR REPLACE FUNCTION validate_ia_config(p_template_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_config jsonb;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  SELECT jsonb_build_object(
    'ia_enabled', ia_enabled,
    'ia_doc_type', ia_doc_type,
    'ia_sections', ia_sections,
    'ia_intake_questions', ia_intake_questions,
    'ia_required_inputs', ia_required_inputs,
    'ia_style_guide', ia_style_guide,
    'ia_rules', ia_rules
  )
  INTO v_config
  FROM ai_document_templates
  WHERE id = p_template_id;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Template não encontrado']);
  END IF;
  
  -- Validar seções
  IF jsonb_array_length(v_config->'ia_sections') = 0 THEN
    v_errors := array_append(v_errors, 'Nenhuma seção configurada');
  END IF;
  
  -- Validar perguntas de intake
  IF (v_config->>'ia_enabled')::boolean = true 
     AND jsonb_array_length(v_config->'ia_intake_questions') = 0 THEN
    v_errors := array_append(v_errors, 'Recomenda-se adicionar perguntas de intake');
  END IF;
  
  -- Validar style guide
  IF LENGTH(v_config->>'ia_style_guide') < 20 THEN
    v_errors := array_append(v_errors, 'Style guide muito curto');
  END IF;
  
  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('valid', false, 'errors', v_errors, 'config', v_config);
  ELSE
    RETURN jsonb_build_object('valid', true, 'config', v_config);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para copiar configuração de IA para documento
CREATE OR REPLACE FUNCTION snapshot_ia_config_to_document()
RETURNS TRIGGER AS $$
BEGIN
  -- Ao criar um documento, copiar configuração de IA do template
  SELECT jsonb_build_object(
    'ia_enabled', ia_enabled,
    'ia_doc_type', ia_doc_type,
    'ia_sections', ia_sections,
    'ia_intake_questions', ia_intake_questions,
    'ia_required_inputs', ia_required_inputs,
    'ia_style_guide', ia_style_guide,
    'ia_rules', ia_rules,
    'snapshot_at', now()
  )
  INTO NEW.ia_config_snapshot
  FROM ai_document_templates
  WHERE id = NEW.template_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para snapshot da config
DROP TRIGGER IF EXISTS trigger_snapshot_ia_config ON ai_generated_documents;
CREATE TRIGGER trigger_snapshot_ia_config
  BEFORE INSERT ON ai_generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_ia_config_to_document();

-- View para listar templates com configuração de IA
CREATE OR REPLACE VIEW ai_templates_with_config AS
SELECT
  t.id,
  t.name,
  t.document_type,
  t.description,
  t.ia_enabled,
  t.ia_doc_type,
  jsonb_array_length(t.ia_sections) as sections_count,
  jsonb_array_length(t.ia_intake_questions) as questions_count,
  t.ia_style_guide,
  t.ia_rules,
  t.is_active,
  t.created_at,
  t.updated_at,
  COUNT(d.id) as documents_count
FROM ai_document_templates t
LEFT JOIN ai_generated_documents d ON d.template_id = t.id
GROUP BY t.id
ORDER BY t.name;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_templates_ia_enabled ON ai_document_templates(ia_enabled);
CREATE INDEX IF NOT EXISTS idx_templates_ia_doc_type ON ai_document_templates(ia_doc_type);

-- Exemplo de template configurado
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  -- Buscar ou criar template de exemplo
  INSERT INTO ai_document_templates (
    name,
    document_type,
    description,
    is_active,
    ia_enabled,
    ia_doc_type,
    ia_sections,
    ia_intake_questions,
    ia_required_inputs,
    ia_style_guide,
    ia_rules
  ) VALUES (
    'Laudo Técnico de Vistoria - Exemplo',
    'laudo_tecnico',
    'Template de exemplo para laudo técnico com configuração completa de IA',
    true,
    true,
    'laudo',
    jsonb_build_array(
      jsonb_build_object('order', 1, 'title', '1. Identificação', 'required', true, 'description', 'Dados do solicitante e identificação do imóvel'),
      jsonb_build_object('order', 2, 'title', '2. Objeto da Vistoria', 'required', true, 'description', 'Descrição do que está sendo vistoriado'),
      jsonb_build_object('order', 3, 'title', '3. Metodologia', 'required', true, 'description', 'Procedimentos técnicos utilizados'),
      jsonb_build_object('order', 4, 'title', '4. Inspeção Visual', 'required', true, 'description', 'Observações da inspeção'),
      jsonb_build_object('order', 5, 'title', '5. Diagnóstico', 'required', true, 'description', 'Análise técnica dos problemas encontrados'),
      jsonb_build_object('order', 6, 'title', '6. Conclusões e Recomendações', 'required', true, 'description', 'Conclusão técnica e recomendações'),
      jsonb_build_object('order', 7, 'title', '7. Registro Fotográfico', 'required', false, 'description', 'Fotos da vistoria'),
      jsonb_build_object('order', 8, 'title', '8. Responsável Técnico', 'required', true, 'description', 'Dados do responsável técnico')
    ),
    jsonb_build_array(
      jsonb_build_object('id', 'q1', 'question', 'Qual o tipo de edificação?', 'type', 'select', 'options', jsonb_build_array('Residencial', 'Comercial', 'Industrial', 'Mista'), 'required', true),
      jsonb_build_object('id', 'q2', 'question', 'Qual o motivo da vistoria?', 'type', 'textarea', 'required', true, 'placeholder', 'Ex: Avaliação de patologias, perícia judicial, etc.'),
      jsonb_build_object('id', 'q3', 'question', 'Há projeto aprovado?', 'type', 'boolean', 'required', true),
      jsonb_build_object('id', 'q4', 'question', 'Data da vistoria', 'type', 'date', 'required', true),
      jsonb_build_object('id', 'q5', 'question', 'Foram identificados problemas estruturais?', 'type', 'boolean', 'required', true),
      jsonb_build_object('id', 'q6', 'question', 'Descreva os principais problemas encontrados', 'type', 'textarea', 'required', false, 'placeholder', 'Liste os principais problemas observados')
    ),
    jsonb_build_array('customer_id', 'project_id', 'property_id'),
    'Tom técnico e objetivo. Linguagem formal conforme padrões ABNT e normas técnicas da engenharia civil. Manter imparcialidade e embasamento técnico. Estilo corporativo Aliancer: claro, preciso e profissional.',
    jsonb_build_object(
      'not_invent_data', true,
      'use_placeholders', true,
      'generate_pending_list', true,
      'require_technical_review', true,
      'description', 'REGRAS IMPORTANTES: (1) NUNCA inventar dados técnicos - sempre usar [A COMPLETAR] quando não houver informação específica; (2) Ao final do documento, gerar seção "PENDÊNCIAS" listando todas as informações que precisam ser complementadas; (3) Manter linguagem técnica e formal; (4) Referenciar normas técnicas quando aplicável (ABNT, NBR); (5) Documento requer revisão técnica antes de aprovação final',
      'references', jsonb_build_array('ABNT NBR 16747:2020 - Inspeção predial', 'ABNT NBR 16280:2015 - Reforma em edificações'),
      'placeholders_rules', 'Sempre usar formato [A COMPLETAR: descrição do que precisa ser preenchido]. Exemplo: [A COMPLETAR: área total do imóvel em m²]'
    )
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_template_id;

  IF v_template_id IS NOT NULL THEN
    RAISE NOTICE 'Template de exemplo criado com ID: %', v_template_id;
  END IF;
END $$;
