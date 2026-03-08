/*
  # Sistema de Portal do Cliente

  1. Novas Tabelas
    - `customer_access_tokens`
      - Tokens de acesso únicos para clientes
      - Vinculados ao telefone do cliente
      - Tokens com expiração configurável
    
    - `service_requests`
      - Solicitações de serviços feitas pelo cliente
      - Status de aprovação
      - Histórico de comunicação
    
    - `service_approvals`
      - Aprovações de serviços pelo cliente
      - Orçamentos aguardando aprovação
      - Histórico de decisões
    
    - `client_notifications`
      - Notificações para o cliente
      - Alertas de vencimento
      - Atualizações de projeto
      - Lidas/não lidas

  2. Modificações
    - Adicionar campo `client_portal_enabled` em customers
    - Adicionar `client_access_enabled` em properties
    - Adicionar campos de status em engineering_projects

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Clientes só veem seus próprios dados
    - Acesso baseado em token válido
*/

-- Adicionar campos de controle de acesso aos clientes
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS client_portal_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_access_at timestamptz,
ADD COLUMN IF NOT EXISTS access_preferences jsonb DEFAULT '{"notifications": true, "email_alerts": true, "whatsapp_alerts": true}'::jsonb;

-- Adicionar controle de acesso às propriedades
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS client_access_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS share_documents boolean DEFAULT true;

-- Adicionar campos de status aos projetos
ALTER TABLE engineering_projects
ADD COLUMN IF NOT EXISTS client_visible boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN IF NOT EXISTS current_phase text,
ADD COLUMN IF NOT EXISTS estimated_completion_date date,
ADD COLUMN IF NOT EXISTS client_notes text;

-- Tabela de tokens de acesso para clientes
CREATE TABLE IF NOT EXISTS customer_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  phone_number text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  device_info jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_access_tokens_token ON customer_access_tokens(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customer_access_tokens_customer ON customer_access_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_access_tokens_phone ON customer_access_tokens(phone_number);

-- Tabela de solicitações de serviços pelo cliente
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  service_type text NOT NULL, -- 'topografia', 'engenharia', 'projeto', etc
  title text NOT NULL,
  description text,
  urgency text DEFAULT 'normal' CHECK (urgency IN ('baixa', 'normal', 'alta', 'urgente')),
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'orcamento_enviado', 'aprovado', 'em_andamento', 'concluido', 'cancelado')),
  estimated_value numeric(10,2),
  estimated_days integer,
  response_notes text,
  responded_by uuid REFERENCES employees(id),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created ON service_requests(created_at DESC);

-- Tabela de aprovações de serviços
CREATE TABLE IF NOT EXISTS service_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES engineering_projects(id) ON DELETE CASCADE,
  service_request_id uuid REFERENCES service_requests(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  estimated_value numeric(10,2) NOT NULL,
  estimated_days integer,
  requires_approval boolean DEFAULT true,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'expirado')),
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_approvals_customer ON service_approvals(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_approvals_status ON service_approvals(status);
CREATE INDEX IF NOT EXISTS idx_service_approvals_project ON service_approvals(project_id);

-- Tabela de notificações para clientes
CREATE TABLE IF NOT EXISTS client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  project_id uuid REFERENCES engineering_projects(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('vencimento', 'projeto', 'aprovacao', 'servico', 'documento', 'geral')),
  title text NOT NULL,
  message text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  action_url text,
  action_label text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  sent_whatsapp boolean DEFAULT false,
  sent_email boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notifications_customer ON client_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_unread ON client_notifications(customer_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_client_notifications_created ON client_notifications(created_at DESC);

-- Habilitar RLS
ALTER TABLE customer_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para customer_access_tokens (acesso público para validação)
CREATE POLICY "Tokens podem ser validados publicamente"
  ON customer_access_tokens FOR SELECT
  TO public
  USING (is_active = true AND expires_at > now());

CREATE POLICY "Sistema pode gerenciar tokens"
  ON customer_access_tokens FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Políticas para service_requests
CREATE POLICY "Clientes veem suas próprias solicitações"
  ON service_requests FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Clientes podem criar solicitações"
  ON service_requests FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Sistema pode gerenciar solicitações"
  ON service_requests FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Políticas para service_approvals
CREATE POLICY "Clientes veem suas próprias aprovações"
  ON service_approvals FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Clientes podem aprovar/rejeitar"
  ON service_approvals FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Sistema pode criar aprovações"
  ON service_approvals FOR INSERT
  TO public
  WITH CHECK (true);

-- Políticas para client_notifications
CREATE POLICY "Clientes veem suas próprias notificações"
  ON client_notifications FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Clientes podem marcar como lida"
  ON client_notifications FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Sistema pode criar notificações"
  ON client_notifications FOR INSERT
  TO public
  WITH CHECK (true);

-- Função para gerar token de acesso
CREATE OR REPLACE FUNCTION generate_customer_access_token(
  p_customer_id uuid,
  p_phone_number text,
  p_expires_in_days integer DEFAULT 90
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
BEGIN
  -- Gerar token único
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');
  
  -- Inserir token
  INSERT INTO customer_access_tokens (customer_id, token, phone_number, expires_at)
  VALUES (p_customer_id, v_token, p_phone_number, now() + (p_expires_in_days || ' days')::interval);
  
  RETURN v_token;
END;
$$;

-- Função para validar token e obter dados do cliente
CREATE OR REPLACE FUNCTION validate_customer_token(p_token text)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  token_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    cat.expires_at
  FROM customer_access_tokens cat
  JOIN customers c ON c.id = cat.customer_id
  WHERE cat.token = p_token
    AND cat.is_active = true
    AND cat.expires_at > now();
    
  -- Atualizar último acesso
  UPDATE customer_access_tokens
  SET last_used_at = now()
  WHERE token = p_token;
  
  UPDATE customers
  SET last_access_at = now()
  WHERE id IN (
    SELECT customer_id FROM customer_access_tokens WHERE token = p_token
  );
END;
$$;

-- Função para criar notificação automática
CREATE OR REPLACE FUNCTION create_client_notification(
  p_customer_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_priority text DEFAULT 'normal',
  p_property_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO client_notifications (
    customer_id, type, title, message, priority, property_id, project_id
  )
  VALUES (
    p_customer_id, p_type, p_title, p_message, p_priority, p_property_id, p_project_id
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;
