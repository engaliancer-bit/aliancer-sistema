/*
  # Sistema Completo de Fluxograma, Etapas, Anexos e Alertas para Projetos

  ## Visão Geral
  Sistema abrangente que adiciona:
  - Templates de projetos com etapas predefinidas
  - Fluxograma automático ao criar projeto
  - Sistema de transmissão entre setores/responsáveis
  - Alertas de vencimento
  - Anexos digitais
  - Notificações de atualização de documentos
  - Separação entre projetos em andamento e concluídos

  ## Novas Tabelas

  ### 1. `engineering_project_templates`
  Templates de projetos com etapas predefinidas

  ### 2. `engineering_project_template_stages`
  Etapas predefinidas dos templates

  ### 3. `engineering_project_stages`
  Etapas efetivas de cada projeto

  ### 4. `engineering_project_transfers`
  Histórico de transmissões entre setores

  ### 5. `engineering_project_attachments`
  Anexos digitais dos projetos

  ### 6. `engineering_project_alerts`
  Alertas de vencimento e notificações

  ### 7. `engineering_project_document_updates`
  Notificações de atualização de documentos

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Acesso público permitido
  - Triggers automáticos
*/

-- Enum para tipos de projeto
DO $$ BEGIN
  CREATE TYPE engineering_project_type AS ENUM (
    'levantamento_topografico',
    'projeto_executivo',
    'projeto_arquitetonico',
    'licenciamento_ambiental',
    'regularizacao_fundiaria',
    'desmembramento',
    'unificacao',
    'consultoria',
    'fiscalizacao',
    'outros'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para status de etapa
DO $$ BEGIN
  CREATE TYPE project_stage_status AS ENUM (
    'pendente',
    'em_andamento',
    'concluida',
    'cancelada',
    'bloqueada'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de alerta
DO $$ BEGIN
  CREATE TYPE project_alert_type AS ENUM (
    'vencimento_proximo',
    'vencimento_vencido',
    'etapa_concluida',
    'documento_atualizado',
    'transferencia_recebida',
    'projeto_concluido'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para tipo de anexo
DO $$ BEGIN
  CREATE TYPE attachment_type AS ENUM (
    'licenca_ambiental',
    'alvara',
    'contrato',
    'projeto_tecnico',
    'memorial_descritivo',
    'art',
    'certidao',
    'documento_propriedade',
    'foto',
    'outros'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Templates de projetos
CREATE TABLE IF NOT EXISTS engineering_project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_type engineering_project_type NOT NULL,
  description text,
  estimated_total_days integer NOT NULL DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_total_days CHECK (estimated_total_days > 0)
);

-- 2. Etapas dos templates
CREATE TABLE IF NOT EXISTS engineering_project_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES engineering_project_templates(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  description text,
  estimated_days integer NOT NULL DEFAULT 5,
  order_index integer NOT NULL DEFAULT 0,
  default_responsible_department text,
  is_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_estimated_days CHECK (estimated_days > 0)
);

-- 3. Etapas efetivas dos projetos
CREATE TABLE IF NOT EXISTS engineering_project_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  template_stage_id uuid REFERENCES engineering_project_template_stages(id) ON DELETE SET NULL,
  stage_name text NOT NULL,
  description text,
  status project_stage_status NOT NULL DEFAULT 'pendente',
  order_index integer NOT NULL DEFAULT 0,
  estimated_days integer NOT NULL DEFAULT 5,
  start_date date,
  due_date date,
  completed_date date,
  responsible_department text,
  responsible_user text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_completion CHECK (
    completed_date IS NULL OR 
    (start_date IS NULL OR completed_date >= start_date)
  )
);

-- 4. Transferências de etapas
CREATE TABLE IF NOT EXISTS engineering_project_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES engineering_project_stages(id) ON DELETE CASCADE,
  from_department text,
  from_user text,
  to_department text NOT NULL,
  to_user text,
  transfer_reason text,
  transfer_notes text,
  transferred_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  accepted_by text
);

-- 5. Anexos digitais
CREATE TABLE IF NOT EXISTS engineering_project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES engineering_project_stages(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type attachment_type NOT NULL,
  file_size_bytes bigint,
  file_path text NOT NULL,
  storage_url text,
  mime_type text,
  description text,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT now(),
  CONSTRAINT valid_file_size CHECK (file_size_bytes >= 0)
);

-- 6. Alertas de vencimento
CREATE TABLE IF NOT EXISTS engineering_project_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES engineering_project_stages(id) ON DELETE CASCADE,
  alert_type project_alert_type NOT NULL,
  alert_title text NOT NULL,
  alert_message text NOT NULL,
  alert_date date NOT NULL,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  priority text DEFAULT 'normal',
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  CONSTRAINT valid_priority CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente'))
);

-- 7. Notificações de atualização de documentos
CREATE TABLE IF NOT EXISTS engineering_project_document_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES engineering_projects(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  old_value text,
  new_value text,
  update_description text,
  updated_by text,
  is_confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  confirmed_by text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_document_type CHECK (
    document_type IN ('matricula', 'car', 'ccir', 'cib_itr', 'outros')
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_project_templates_type ON engineering_project_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_project_templates_active ON engineering_project_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_template_stages_template ON engineering_project_template_stages(template_id);
CREATE INDEX IF NOT EXISTS idx_template_stages_order ON engineering_project_template_stages(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_project_stages_project ON engineering_project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_status ON engineering_project_stages(status);
CREATE INDEX IF NOT EXISTS idx_project_stages_due_date ON engineering_project_stages(due_date);
CREATE INDEX IF NOT EXISTS idx_project_transfers_project ON engineering_project_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_transfers_stage ON engineering_project_transfers(stage_id);
CREATE INDEX IF NOT EXISTS idx_project_attachments_project ON engineering_project_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_attachments_stage ON engineering_project_attachments(stage_id);
CREATE INDEX IF NOT EXISTS idx_project_attachments_type ON engineering_project_attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_project_alerts_project ON engineering_project_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_alerts_unread ON engineering_project_alerts(is_read, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_project_alerts_date ON engineering_project_alerts(alert_date);
CREATE INDEX IF NOT EXISTS idx_document_updates_project ON engineering_project_document_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_document_updates_property ON engineering_project_document_updates(property_id);
CREATE INDEX IF NOT EXISTS idx_document_updates_confirmed ON engineering_project_document_updates(is_confirmed);

-- Adicionar campo template_id aos projetos
DO $$ BEGIN
  ALTER TABLE engineering_projects 
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES engineering_project_templates(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Função para criar etapas automaticamente ao criar projeto
CREATE OR REPLACE FUNCTION create_project_stages_from_template()
RETURNS TRIGGER AS $$
DECLARE
  stage_record RECORD;
  next_date date;
BEGIN
  IF NEW.template_id IS NOT NULL THEN
    next_date := NEW.start_date;
    
    FOR stage_record IN 
      SELECT * FROM engineering_project_template_stages 
      WHERE template_id = NEW.template_id 
      ORDER BY order_index
    LOOP
      INSERT INTO engineering_project_stages (
        project_id,
        template_stage_id,
        stage_name,
        description,
        status,
        order_index,
        estimated_days,
        start_date,
        due_date,
        responsible_department
      ) VALUES (
        NEW.id,
        stage_record.id,
        stage_record.stage_name,
        stage_record.description,
        'pendente',
        stage_record.order_index,
        stage_record.estimated_days,
        next_date,
        next_date + (stage_record.estimated_days || ' days')::interval,
        stage_record.default_responsible_department
      );
      
      next_date := next_date + (stage_record.estimated_days || ' days')::interval;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar etapas automaticamente
DROP TRIGGER IF EXISTS auto_create_project_stages ON engineering_projects;
CREATE TRIGGER auto_create_project_stages
  AFTER INSERT ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_stages_from_template();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_project_stage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at das etapas
DROP TRIGGER IF EXISTS update_project_stages_updated_at ON engineering_project_stages;
CREATE TRIGGER update_project_stages_updated_at
  BEFORE UPDATE ON engineering_project_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_project_stage_updated_at();

-- Função para criar alerta quando etapa é concluída
CREATE OR REPLACE FUNCTION notify_stage_completion()
RETURNS TRIGGER AS $$
DECLARE
  project_name text;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    SELECT ep.project_name INTO project_name
    FROM engineering_projects ep
    WHERE ep.id = NEW.project_id;
    
    INSERT INTO engineering_project_alerts (
      project_id,
      stage_id,
      alert_type,
      alert_title,
      alert_message,
      alert_date,
      priority
    ) VALUES (
      NEW.project_id,
      NEW.id,
      'etapa_concluida',
      'Etapa concluída',
      'A etapa "' || NEW.stage_name || '" do projeto "' || project_name || '" foi concluída.',
      CURRENT_DATE,
      'normal'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar conclusão de etapa
DROP TRIGGER IF EXISTS notify_on_stage_completion ON engineering_project_stages;
CREATE TRIGGER notify_on_stage_completion
  AFTER UPDATE ON engineering_project_stages
  FOR EACH ROW
  EXECUTE FUNCTION notify_stage_completion();

-- Função para criar alerta de transferência
CREATE OR REPLACE FUNCTION notify_transfer()
RETURNS TRIGGER AS $$
DECLARE
  project_name text;
  stage_name text;
BEGIN
  SELECT ep.project_name, ps.stage_name 
  INTO project_name, stage_name
  FROM engineering_projects ep
  JOIN engineering_project_stages ps ON ps.project_id = ep.id
  WHERE ep.id = NEW.project_id AND ps.id = NEW.stage_id;
  
  INSERT INTO engineering_project_alerts (
    project_id,
    stage_id,
    alert_type,
    alert_title,
    alert_message,
    alert_date,
    priority
  ) VALUES (
    NEW.project_id,
    NEW.stage_id,
    'transferencia_recebida',
    'Etapa transferida',
    'A etapa "' || stage_name || '" do projeto "' || project_name || '" foi transferida para ' || NEW.to_department || 
    COALESCE(' (' || NEW.to_user || ')', ''),
    CURRENT_DATE,
    'alta'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar transferência
DROP TRIGGER IF EXISTS notify_on_transfer ON engineering_project_transfers;
CREATE TRIGGER notify_on_transfer
  AFTER INSERT ON engineering_project_transfers
  FOR EACH ROW
  EXECUTE FUNCTION notify_transfer();

-- Função para notificar atualização de documento
CREATE OR REPLACE FUNCTION notify_document_update()
RETURNS TRIGGER AS $$
DECLARE
  project_name text;
BEGIN
  SELECT ep.project_name INTO project_name
  FROM engineering_projects ep
  WHERE ep.id = NEW.project_id;
  
  INSERT INTO engineering_project_alerts (
    project_id,
    alert_type,
    alert_title,
    alert_message,
    alert_date,
    priority
  ) VALUES (
    NEW.project_id,
    'documento_atualizado',
    'Documento atualizado',
    'O documento "' || NEW.document_type || '" do projeto "' || project_name || '" foi atualizado.',
    CURRENT_DATE,
    'alta'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar atualização de documento
DROP TRIGGER IF EXISTS notify_on_document_update ON engineering_project_document_updates;
CREATE TRIGGER notify_on_document_update
  AFTER INSERT ON engineering_project_document_updates
  FOR EACH ROW
  EXECUTE FUNCTION notify_document_update();

-- Habilitar RLS
ALTER TABLE engineering_project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_project_document_updates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Public access to project_templates"
  ON engineering_project_templates FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to template_stages"
  ON engineering_project_template_stages FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to project_stages"
  ON engineering_project_stages FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to project_transfers"
  ON engineering_project_transfers FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to project_attachments"
  ON engineering_project_attachments FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to project_alerts"
  ON engineering_project_alerts FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access to document_updates"
  ON engineering_project_document_updates FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Inserir templates de exemplo
INSERT INTO engineering_project_templates (name, project_type, description, estimated_total_days)
VALUES 
  ('Levantamento Topográfico Completo', 'levantamento_topografico', 'Levantamento planialtimétrico com memorial descritivo', 15),
  ('Projeto Executivo de Edificação', 'projeto_executivo', 'Projeto completo para construção', 45),
  ('Licenciamento Ambiental', 'licenciamento_ambiental', 'Processo completo de licenciamento ambiental', 90),
  ('Regularização Fundiária', 'regularizacao_fundiaria', 'Processo de regularização de propriedade', 120)
ON CONFLICT DO NOTHING;

-- Inserir etapas de exemplo
DO $$
DECLARE
  template_id_topo uuid;
BEGIN
  SELECT id INTO template_id_topo 
  FROM engineering_project_templates 
  WHERE name = 'Levantamento Topográfico Completo'
  LIMIT 1;
  
  IF template_id_topo IS NOT NULL THEN
    INSERT INTO engineering_project_template_stages (template_id, stage_name, description, estimated_days, order_index, default_responsible_department)
    VALUES 
      (template_id_topo, 'Contrato e Documentação', 'Assinatura de contrato e coleta de documentos', 2, 1, 'Administrativo'),
      (template_id_topo, 'Levantamento em Campo', 'Execução do levantamento topográfico', 3, 2, 'Topografia'),
      (template_id_topo, 'Processamento de Dados', 'Processamento e cálculos topográficos', 4, 3, 'Topografia'),
      (template_id_topo, 'Elaboração de Plantas', 'Desenho das plantas topográficas', 3, 4, 'Desenho Técnico'),
      (template_id_topo, 'Memorial Descritivo', 'Elaboração do memorial descritivo', 2, 5, 'Engenharia'),
      (template_id_topo, 'Revisão e ART', 'Revisão final e emissão de ART', 1, 6, 'Engenharia')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;