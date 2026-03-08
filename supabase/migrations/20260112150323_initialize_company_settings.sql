/*
  # Inicialização das Configurações da Empresa

  ## Resumo
  Garante que todas as configurações necessárias para o sistema de notificações 
  WhatsApp existem na tabela company_settings com valores padrão.

  ## Configurações Criadas
    1. **company_name** - Nome da empresa (padrão: 'Aliancer Engenharia')
    2. **company_phone** - Telefone do escritório (padrão: vazio)
    3. **whatsapp_sender_number** - Número WhatsApp remetente (padrão: vazio)
    4. **bank_name** - Nome do banco (padrão: vazio)
    5. **bank_agency** - Agência bancária (padrão: vazio)
    6. **bank_account** - Conta bancária (padrão: vazio)
    7. **bank_pix** - Chave PIX (padrão: vazio)
    8. **whatsapp_api_url** - URL da API WhatsApp (padrão: vazio)
    9. **whatsapp_api_token** - Token da API WhatsApp (padrão: vazio)

  ## Notas
    - Usa INSERT ... ON CONFLICT DO NOTHING para não sobrescrever valores existentes
    - Administradores devem preencher essas configurações antes de usar o sistema
*/

-- Inserir configurações padrão se não existirem
INSERT INTO company_settings (setting_key, setting_value, description) 
VALUES 
  ('company_name', 'Aliancer Engenharia', 'Nome da empresa que aparecerá nas mensagens'),
  ('company_phone', '', 'Telefone do escritório para contato'),
  ('whatsapp_sender_number', '', 'Número de WhatsApp da empresa (formato internacional, ex: 556399999999)'),
  ('bank_name', '', 'Nome do banco para pagamentos'),
  ('bank_agency', '', 'Agência bancária'),
  ('bank_account', '', 'Número da conta bancária'),
  ('bank_pix', '', 'Chave PIX para pagamentos'),
  ('whatsapp_api_url', '', 'URL da API do WhatsApp Business'),
  ('whatsapp_api_token', '', 'Token de autenticação da API WhatsApp')
ON CONFLICT (setting_key) DO NOTHING;

-- Atualizar descrição do whatsapp_sender_number se já existir mas sem descrição
UPDATE company_settings 
SET description = 'Número de WhatsApp da empresa (formato internacional, ex: 556399999999)'
WHERE setting_key = 'whatsapp_sender_number' 
AND (description IS NULL OR description = '');
