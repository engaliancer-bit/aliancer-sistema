/*
  # Sistema de Gestão de Prazos de Documentos e Notificações WhatsApp

  ## 1. Nova Tabela: document_deadlines
    
  Armazena os prazos de vencimento de documentos e o fluxo de renovação:
    
    - `id` (uuid, primary key)
    - `property_id` (uuid, foreign key para properties)
    - `document_type` (text) - tipo do documento (ccir, itr, cib, etc)
    - `document_number` (text) - número do documento
    - `expiry_date` (date) - data de vencimento
    - `renewal_cost` (numeric) - valor do serviço de renovação
    - `status` (text) - status do processo:
      - 'active' - documento válido
      - 'alert_sent' - alerta enviado ao cliente
      - 'proposal_accepted' - cliente aceitou a proposta
      - 'renewal_in_progress' - escritório renovando
      - 'renewed' - renovado, aguardando pagamento
      - 'completed' - processo completo
      - 'expired' - vencido
    - `alert_sent_at` (timestamptz) - quando foi enviado o alerta
    - `accepted_at` (timestamptz) - quando cliente aceitou
    - `renewed_at` (timestamptz) - quando foi renovado
    - `completed_at` (timestamptz) - quando foi concluído
    - `notes` (text) - observações
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. Nova Tabela: whatsapp_notifications
    
  Log de todas as notificações enviadas via WhatsApp:
    
    - `id` (uuid, primary key)
    - `deadline_id` (uuid, foreign key para document_deadlines, opcional)
    - `property_id` (uuid, foreign key para properties)
    - `customer_phone` (text) - telefone do destinatário
    - `message_type` (text) - tipo da mensagem:
      - 'expiry_alert' - alerta de vencimento
      - 'renewal_completed' - renovação concluída
      - 'payment_request' - solicitação de pagamento
    - `message_content` (text) - conteúdo da mensagem
    - `sent_at` (timestamptz) - quando foi enviada
    - `status` (text) - 'pending', 'sent', 'delivered', 'failed'
    - `response_received` (boolean) - se recebeu resposta
    - `response_content` (text) - conteúdo da resposta
    - `response_at` (timestamptz) - quando respondeu
    - `created_at` (timestamptz)

  ## 3. Nova Tabela: company_settings
    
  Configurações da empresa (dados bancários, telefones, etc):
    
    - `id` (uuid, primary key)
    - `setting_key` (text, unique) - chave da configuração
    - `setting_value` (text) - valor
    - `description` (text) - descrição
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 4. Segurança (RLS)
    
  Todas as tabelas terão RLS habilitado com políticas restritivas para usuários autenticados.
*/

-- Criar tabela de prazos de documentos
CREATE TABLE IF NOT EXISTS document_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL,
  document_number text,
  expiry_date date NOT NULL,
  renewal_cost numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'alert_sent', 'proposal_accepted', 'renewal_in_progress', 'renewed', 'completed', 'expired')),
  alert_sent_at timestamptz,
  accepted_at timestamptz,
  renewed_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de notificações WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id uuid REFERENCES document_deadlines(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  customer_phone text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('expiry_alert', 'renewal_completed', 'payment_request')),
  message_content text NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  response_received boolean DEFAULT false,
  response_content text,
  response_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de configurações da empresa
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inserir configurações padrão da empresa
INSERT INTO company_settings (setting_key, setting_value, description) VALUES
  ('company_name', 'Aliancer', 'Nome da empresa'),
  ('company_phone', '+5511999999999', 'Telefone do escritório para receber respostas'),
  ('bank_name', 'Banco do Brasil', 'Nome do banco'),
  ('bank_agency', '0001', 'Agência bancária'),
  ('bank_account', '12345-6', 'Conta bancária'),
  ('bank_pix', 'contato@aliancer.com.br', 'Chave PIX'),
  ('whatsapp_api_url', '', 'URL da API do WhatsApp Business'),
  ('whatsapp_api_token', '', 'Token da API do WhatsApp')
ON CONFLICT (setting_key) DO NOTHING;

-- Habilitar RLS
ALTER TABLE document_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para document_deadlines
CREATE POLICY "Usuários autenticados podem visualizar prazos"
  ON document_deadlines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir prazos"
  ON document_deadlines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar prazos"
  ON document_deadlines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar prazos"
  ON document_deadlines FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para whatsapp_notifications
CREATE POLICY "Usuários autenticados podem visualizar notificações"
  ON whatsapp_notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir notificações"
  ON whatsapp_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar notificações"
  ON whatsapp_notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para company_settings
CREATE POLICY "Usuários autenticados podem visualizar configurações"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem atualizar configurações"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_document_deadlines_property ON document_deadlines(property_id);
CREATE INDEX IF NOT EXISTS idx_document_deadlines_expiry ON document_deadlines(expiry_date);
CREATE INDEX IF NOT EXISTS idx_document_deadlines_status ON document_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_deadline ON whatsapp_notifications(deadline_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_property ON whatsapp_notifications(property_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_document_deadlines_updated_at ON document_deadlines;
CREATE TRIGGER update_document_deadlines_updated_at
  BEFORE UPDATE ON document_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();