/*
  # Sistema de Geração de Documentos Técnicos com IA
  
  ## Visão Geral
  Sistema completo para geração automatizada de documentos técnicos (laudos, relatórios,
  estudos, diagnósticos e projetos textuais) usando IA, integrado ao fluxo de projetos
  de engenharia.
  
  ## Funcionalidades
  - Templates de documentos configuráveis por tipo de serviço
  - Seções de documento com prompts de IA personalizados
  - Geração de documentos usando contexto do projeto
  - Histórico de versões de documentos
  - Revisão e aprovação de documentos gerados
  - Exportação em múltiplos formatos (PDF, DOCX, etc)
  
  ## Tipos de Documentos Suportados
  1. Avaliação de imóveis
  2. Georreferenciamento de imóveis
  3. PRAD (Plano de Recuperação de Área Degradada)
  4. Realocação de Reserva Legal
  5. Projetos de Terraplanagem
  
  ## Novas Tabelas
  
  ### 1. `ai_document_templates`
  Templates de documentos técnicos com estrutura e configuração
  
  ### 2. `ai_document_sections`
  Seções dos templates com prompts de IA e ordem de apresentação
  
  ### 3. `ai_generated_documents`
  Documentos gerados a partir dos templates
  
  ### 4. `ai_document_section_contents`
  Conteúdo gerado para cada seção de um documento
  
  ### 5. `ai_document_revisions`
  Histórico de revisões e edições dos documentos
  
  ## Segurança
  - RLS habilitado em todas as tabelas
  - Acesso público permitido
  - Auditoria completa de gerações e edições
*/

-- Enum para tipos de documentos técnicos
DO $$ BEGIN
  CREATE TYPE technical_document_type AS ENUM (
    'avaliacao_imovel',
    'georreferenciamento',
    'prad',
    'relocacao_reserva_legal',
    'projeto_terraplanagem',
    'laudo_tecnico',
    'estudo_viabilidade',
    'diagnostico_ambiental',
    'relatorio_tecnico',
    'memorial_descritivo',
    'outros'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para status de documento
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'rascunho',
    'gerando',
    'gerado',
    'em_revisao',
    'aprovado',
    'rejeitado',
    'finalizado',
    'arquivado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de conteúdo da seção
DO $$ BEGIN
  CREATE TYPE section_content_type AS ENUM (
    'texto',
    'lista',
    'tabela',
    'imagem',
    'grafico',
    'mapa',
    'calculo',
    'conclusao'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Templates de documentos técnicos
CREATE TABLE IF NOT EXISTS ai_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document_type technical_document_type NOT NULL,
  service_template_id uuid REFERENCES engineering_service_templates(id) ON DELETE SET NULL,
  description text,
  
  -- Configurações do template
  include_cover_page boolean DEFAULT true,
  include_table_of_contents boolean DEFAULT true,
  include_references boolean DEFAULT true,
  include_annexes boolean DEFAULT false,
  
  -- Informações do cabeçalho/rodapé
  header_template text,
  footer_template text,
  
  -- Configurações de IA
  ai_model text DEFAULT 'gpt-4',
  temperature decimal(3,2) DEFAULT 0.7,
  max_tokens integer DEFAULT 2000,
  
  -- Metadados
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2),
  CONSTRAINT valid_max_tokens CHECK (max_tokens > 0 AND max_tokens <= 8000)
);

-- 2. Seções dos templates
CREATE TABLE IF NOT EXISTS ai_document_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES ai_document_templates(id) ON DELETE CASCADE,
  
  -- Identificação da seção
  section_title text NOT NULL,
  section_subtitle text,
  section_number text,
  order_index integer NOT NULL DEFAULT 0,
  
  -- Tipo e configuração
  content_type section_content_type NOT NULL DEFAULT 'texto',
  is_required boolean DEFAULT true,
  is_editable boolean DEFAULT true,
  
  -- Prompt de IA para gerar esta seção
  ai_prompt text NOT NULL,
  ai_context_variables jsonb DEFAULT '{}',
  
  -- Instruções específicas
  generation_instructions text,
  validation_rules text,
  
  -- Exemplo de saída esperada (para guiar a IA)
  example_output text,
  
  -- Metadados
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_order CHECK (order_index >= 0)
);

-- 3. Documentos gerados
CREATE TABLE IF NOT EXISTS ai_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculos
  template_id uuid NOT NULL REFERENCES ai_document_templates(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Informações do documento
  document_title text NOT NULL,
  document_type technical_document_type NOT NULL,
  version integer DEFAULT 1,
  status document_status DEFAULT 'rascunho',
  
  -- Dados de contexto usados na geração
  context_data jsonb DEFAULT '{}',
  
  -- Dados técnicos (área, coordenadas, valores, etc)
  technical_data jsonb DEFAULT '{}',
  
  -- Resultado da geração
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  generation_error text,
  
  -- Tokens utilizados (para controle de custos)
  tokens_used integer DEFAULT 0,
  estimated_cost decimal(10,4) DEFAULT 0,
  
  -- Aprovação e revisão
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  
  approved_by text,
  approved_at timestamptz,
  
  -- Exportação
  exported_pdf_url text,
  exported_docx_url text,
  last_exported_at timestamptz,
  
  -- Metadados
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_version CHECK (version > 0),
  CONSTRAINT valid_tokens CHECK (tokens_used >= 0),
  CONSTRAINT valid_cost CHECK (estimated_cost >= 0)
);

-- 4. Conteúdo das seções geradas
CREATE TABLE IF NOT EXISTS ai_document_section_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculos
  document_id uuid NOT NULL REFERENCES ai_generated_documents(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES ai_document_sections(id) ON DELETE RESTRICT,
  
  -- Conteúdo
  section_title text NOT NULL,
  section_number text,
  content_type section_content_type NOT NULL,
  
  -- Conteúdo gerado pela IA
  generated_content text,
  formatted_content text,
  
  -- Se foi editado manualmente
  is_manually_edited boolean DEFAULT false,
  edited_content text,
  edited_by text,
  edited_at timestamptz,
  
  -- Dados estruturados (para tabelas, gráficos, etc)
  structured_data jsonb DEFAULT '{}',
  
  -- Prompt usado e resposta da IA
  prompt_used text,
  ai_response_raw text,
  
  -- Metadados de geração
  generated_at timestamptz DEFAULT now(),
  tokens_used integer DEFAULT 0,
  
  CONSTRAINT unique_section_per_document UNIQUE(document_id, section_id)
);

-- 5. Histórico de revisões
CREATE TABLE IF NOT EXISTS ai_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES ai_generated_documents(id) ON DELETE CASCADE,
  
  -- Informações da revisão
  version_number integer NOT NULL,
  revision_type text NOT NULL,
  
  -- Conteúdo anterior e novo
  previous_content jsonb,
  new_content jsonb,
  
  -- Alterações detalhadas
  changes_summary text,
  sections_changed text[],
  
  -- Motivo e notas
  revision_reason text,
  revision_notes text,
  
  -- Quem fez a revisão
  revised_by text NOT NULL,
  revised_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_version_number CHECK (version_number > 0),
  CONSTRAINT valid_revision_type CHECK (
    revision_type IN ('criacao', 'edicao_manual', 'regeneracao_ia', 'aprovacao', 'rejeicao')
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON ai_document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_templates_service ON ai_document_templates(service_template_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_active ON ai_document_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_doc_sections_template ON ai_document_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_doc_sections_order ON ai_document_sections(template_id, order_index);

CREATE INDEX IF NOT EXISTS idx_generated_docs_project ON ai_generated_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_customer ON ai_generated_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_property ON ai_generated_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_status ON ai_generated_documents(status);
CREATE INDEX IF NOT EXISTS idx_generated_docs_type ON ai_generated_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_generated_docs_template ON ai_generated_documents(template_id);

CREATE INDEX IF NOT EXISTS idx_section_contents_document ON ai_document_section_contents(document_id);
CREATE INDEX IF NOT EXISTS idx_section_contents_section ON ai_document_section_contents(section_id);

CREATE INDEX IF NOT EXISTS idx_doc_revisions_document ON ai_document_revisions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_revisions_revised_at ON ai_document_revisions(revised_at);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ai_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_ai_document_templates_updated_at ON ai_document_templates;
CREATE TRIGGER update_ai_document_templates_updated_at
  BEFORE UPDATE ON ai_document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_document_updated_at();

DROP TRIGGER IF EXISTS update_ai_document_sections_updated_at ON ai_document_sections;
CREATE TRIGGER update_ai_document_sections_updated_at
  BEFORE UPDATE ON ai_document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_document_updated_at();

DROP TRIGGER IF EXISTS update_ai_generated_documents_updated_at ON ai_generated_documents;
CREATE TRIGGER update_ai_generated_documents_updated_at
  BEFORE UPDATE ON ai_generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_document_updated_at();

-- Função para criar revisão automaticamente ao editar documento
CREATE OR REPLACE FUNCTION create_document_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_changes text[];
BEGIN
  -- Verificar se houve mudanças significativas
  IF OLD.status != NEW.status OR 
     OLD.document_title != NEW.document_title OR
     OLD.technical_data::text != NEW.technical_data::text THEN
    
    v_changes := ARRAY[]::text[];
    
    IF OLD.status != NEW.status THEN
      v_changes := array_append(v_changes, 'status');
    END IF;
    
    IF OLD.document_title != NEW.document_title THEN
      v_changes := array_append(v_changes, 'titulo');
    END IF;
    
    IF OLD.technical_data::text != NEW.technical_data::text THEN
      v_changes := array_append(v_changes, 'dados_tecnicos');
    END IF;
    
    INSERT INTO ai_document_revisions (
      document_id,
      version_number,
      revision_type,
      previous_content,
      new_content,
      sections_changed,
      revised_by,
      revision_notes
    ) VALUES (
      NEW.id,
      NEW.version,
      CASE 
        WHEN OLD.status != NEW.status AND NEW.status = 'aprovado' THEN 'aprovacao'
        WHEN OLD.status != NEW.status AND NEW.status = 'rejeitado' THEN 'rejeicao'
        ELSE 'edicao_manual'
      END,
      jsonb_build_object(
        'status', OLD.status,
        'title', OLD.document_title,
        'technical_data', OLD.technical_data
      ),
      jsonb_build_object(
        'status', NEW.status,
        'title', NEW.document_title,
        'technical_data', NEW.technical_data
      ),
      v_changes,
      NEW.updated_by,
      CASE 
        WHEN OLD.status != NEW.status THEN 'Status alterado de ' || OLD.status || ' para ' || NEW.status
        ELSE 'Documento atualizado'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar coluna updated_by aos documentos
DO $$ BEGIN
  ALTER TABLE ai_generated_documents
  ADD COLUMN IF NOT EXISTS updated_by text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Trigger para criar revisão
DROP TRIGGER IF EXISTS auto_create_document_revision ON ai_generated_documents;
CREATE TRIGGER auto_create_document_revision
  AFTER UPDATE ON ai_generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION create_document_revision();

-- Habilitar RLS
ALTER TABLE ai_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_section_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_revisions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Public access to ai_document_templates"
  ON ai_document_templates FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to ai_document_sections"
  ON ai_document_sections FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to ai_generated_documents"
  ON ai_generated_documents FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to ai_document_section_contents"
  ON ai_document_section_contents FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to ai_document_revisions"
  ON ai_document_revisions FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Inserir templates de exemplo para os 5 tipos principais
-- 1. Avaliação de Imóveis
INSERT INTO ai_document_templates (
  name, 
  document_type,
  description,
  include_cover_page,
  include_table_of_contents,
  include_references,
  ai_model,
  temperature
) VALUES (
  'Laudo de Avaliação de Imóvel',
  'avaliacao_imovel',
  'Laudo técnico completo de avaliação de imóveis rurais e urbanos conforme NBR 14653',
  true,
  true,
  true,
  'gpt-4',
  0.7
) ON CONFLICT DO NOTHING;

-- 2. Georreferenciamento
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  include_cover_page,
  include_table_of_contents,
  include_references,
  ai_model,
  temperature
) VALUES (
  'Memorial Descritivo de Georreferenciamento',
  'georreferenciamento',
  'Memorial descritivo técnico de georreferenciamento de imóveis rurais conforme Lei 10.267/2001',
  true,
  true,
  true,
  'gpt-4',
  0.6
) ON CONFLICT DO NOTHING;

-- 3. PRAD
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  include_cover_page,
  include_table_of_contents,
  include_references,
  ai_model,
  temperature
) VALUES (
  'PRAD - Plano de Recuperação de Área Degradada',
  'prad',
  'Plano completo de recuperação de área degradada conforme legislação ambiental',
  true,
  true,
  true,
  'gpt-4',
  0.7
) ON CONFLICT DO NOTHING;

-- 4. Realocação de Reserva Legal
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  include_cover_page,
  include_table_of_contents,
  include_references,
  ai_model,
  temperature
) VALUES (
  'Projeto de Realocação de Reserva Legal',
  'relocacao_reserva_legal',
  'Projeto técnico para realocação de área de reserva legal conforme Código Florestal',
  true,
  true,
  true,
  'gpt-4',
  0.7
) ON CONFLICT DO NOTHING;

-- 5. Projetos de Terraplanagem
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  include_cover_page,
  include_table_of_contents,
  include_references,
  ai_model,
  temperature
) VALUES (
  'Memorial de Cálculo - Projeto de Terraplanagem',
  'projeto_terraplanagem',
  'Memorial descritivo e de cálculo para projeto de terraplanagem',
  true,
  true,
  true,
  'gpt-4',
  0.6
) ON CONFLICT DO NOTHING;

-- Inserir seções de exemplo para Avaliação de Imóvel
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM ai_document_templates
  WHERE document_type = 'avaliacao_imovel'
  LIMIT 1;
  
  IF v_template_id IS NOT NULL THEN
    -- Seção 1: Introdução
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES (
      v_template_id,
      'Introdução',
      '1',
      1,
      'texto',
      'Elabore uma introdução profissional para um laudo de avaliação de imóvel. Inclua o objetivo do laudo, a finalidade da avaliação e as normas técnicas aplicáveis (NBR 14653). Use dados do contexto: {{property_type}}, {{property_location}}, {{evaluation_purpose}}.',
      'A introdução deve ser formal, objetiva e citar a NBR 14653.'
    );
    
    -- Seção 2: Caracterização do Imóvel
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES (
      v_template_id,
      'Caracterização do Imóvel',
      '2',
      2,
      'texto',
      'Descreva detalhadamente as características do imóvel avaliado. Inclua: localização completa, área total ({{area_total}}), características físicas, benfeitorias, estado de conservação, acesso e infraestrutura disponível. Use dados: {{property_address}}, {{property_features}}, {{improvements}}.',
      'Descrição técnica e detalhada, incluindo todos os aspectos relevantes para a avaliação.'
    );
    
    -- Seção 3: Metodologia
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES (
      v_template_id,
      'Metodologia de Avaliação',
      '3',
      3,
      'texto',
      'Explique a metodologia de avaliação utilizada conforme NBR 14653. Descreva o método escolhido ({{evaluation_method}}), a pesquisa de mercado realizada, os critérios de comparação e o tratamento estatístico dos dados quando aplicável.',
      'Explicação técnica da metodologia, justificando a escolha do método.'
    );
    
    -- Seção 4: Pesquisa de Mercado
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES (
      v_template_id,
      'Pesquisa de Mercado e Dados Comparativos',
      '4',
      4,
      'tabela',
      'Apresente a pesquisa de mercado realizada com imóveis similares. Crie uma tabela comparativa incluindo: localização, área, características, valor, fonte e data da pesquisa. Use dados: {{market_research}}.',
      'Tabela organizada com dados comparativos e fontes confiáveis.'
    );
    
    -- Seção 5: Cálculos e Resultados
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES (
      v_template_id,
      'Cálculos e Análise de Resultados',
      '5',
      5,
      'calculo',
      'Apresente os cálculos realizados para determinação do valor do imóvel. Inclua: tratamento dos dados, homogeneização, cálculo do valor unitário, aplicação de fatores de ajuste e determinação do valor final. Use dados: {{calculations}}, {{unit_value}}, {{adjustment_factors}}.',
      'Cálculos detalhados e justificados tecnicamente.'
    );
    
    -- Seção 6: Conclusão
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES (
      v_template_id,
      'Conclusão e Valor de Avaliação',
      '6',
      6,
      'conclusao',
      'Apresente a conclusão do laudo com o valor final de avaliação do imóvel. Inclua: síntese dos resultados, grau de fundamentação e precisão conforme NBR 14653, valor de avaliação em moeda corrente (R$ {{final_value}}) e a data base da avaliação.',
      'Conclusão objetiva com o valor de avaliação claramente especificado.'
    );
  END IF;
END $$;

-- Inserir seções de exemplo para Georreferenciamento
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM ai_document_templates
  WHERE document_type = 'georreferenciamento'
  LIMIT 1;
  
  IF v_template_id IS NOT NULL THEN
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES 
    (
      v_template_id,
      'Objetivo e Finalidade',
      '1',
      1,
      'texto',
      'Descreva o objetivo e finalidade do georreferenciamento do imóvel rural conforme Lei 10.267/2001 e normas do INCRA. Use dados: {{property_name}}, {{property_area}}, {{municipality}}.',
      'Texto formal citando a legislação aplicável.'
    ),
    (
      v_template_id,
      'Descrição do Imóvel e Localização',
      '2',
      2,
      'texto',
      'Descreva a localização geográfica do imóvel, incluindo município, coordenadas aproximadas, vias de acesso e confrontações. Use: {{location_data}}, {{access_roads}}, {{neighbors}}.',
      'Descrição detalhada da localização e acesso.'
    ),
    (
      v_template_id,
      'Metodologia e Equipamentos',
      '3',
      3,
      'texto',
      'Descreva a metodologia utilizada no levantamento, equipamentos GPS/GNSS utilizados, método de posicionamento (RTK, PPP, etc) e precisões alcançadas. Use: {{equipment}}, {{method}}, {{accuracy}}.',
      'Descrição técnica dos equipamentos e métodos.'
    ),
    (
      v_template_id,
      'Memorial Descritivo',
      '4',
      4,
      'texto',
      'Elabore o memorial descritivo do perímetro do imóvel, descrevendo todos os vértices, azimutes, distâncias e área total. Use: {{vertices_data}}, {{perimeter}}, {{area}}.',
      'Memorial técnico conforme padrões do INCRA.'
    ),
    (
      v_template_id,
      'Tabela de Coordenadas',
      '5',
      5,
      'tabela',
      'Apresente a tabela de coordenadas geográficas de todos os vértices do perímetro em SIRGAS 2000. Use: {{coordinates_table}}.',
      'Tabela formatada com coordenadas em graus decimais e UTM.'
    );
  END IF;
END $$;

-- Inserir seções para PRAD
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM ai_document_templates
  WHERE document_type = 'prad'
  LIMIT 1;
  
  IF v_template_id IS NOT NULL THEN
    INSERT INTO ai_document_sections (
      template_id,
      section_title,
      section_number,
      order_index,
      content_type,
      ai_prompt,
      generation_instructions
    ) VALUES 
    (
      v_template_id,
      'Caracterização da Área Degradada',
      '1',
      1,
      'texto',
      'Caracterize a área degradada incluindo: localização, histórico de uso, tipo de degradação, área afetada ({{degraded_area}}), causas da degradação e estado atual. Use: {{degradation_type}}, {{history}}, {{current_state}}.',
      'Diagnóstico detalhado da degradação.'
    ),
    (
      v_template_id,
      'Objetivos da Recuperação',
      '2',
      2,
      'texto',
      'Defina os objetivos específicos do PRAD, metas de recuperação, indicadores de sucesso e cronograma previsto. Use: {{recovery_goals}}, {{timeline}}.',
      'Objetivos claros e mensuráveis.'
    ),
    (
      v_template_id,
      'Metodologia de Recuperação',
      '3',
      3,
      'texto',
      'Descreva as técnicas e métodos de recuperação propostos, incluindo: preparo de solo, espécies a serem plantadas, espaçamentos, tratos culturais e manutenção. Use: {{recovery_methods}}, {{species_list}}, {{maintenance_plan}}.',
      'Descrição técnica das ações de recuperação.'
    ),
    (
      v_template_id,
      'Cronograma de Execução',
      '4',
      4,
      'tabela',
      'Elabore um cronograma detalhado das atividades de recuperação, com prazos e responsáveis. Use: {{schedule_data}}.',
      'Cronograma físico-financeiro organizado.'
    ),
    (
      v_template_id,
      'Monitoramento e Manutenção',
      '5',
      5,
      'texto',
      'Descreva o plano de monitoramento da recuperação, indicadores a serem avaliados, frequência de vistorias e ações de manutenção. Use: {{monitoring_plan}}, {{indicators}}.',
      'Plano de monitoramento com indicadores quantitativos.'
    );
  END IF;
END $$;
