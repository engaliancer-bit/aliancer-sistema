/*
  # Adicionar Configurações Estendidas da Empresa

  1. Novos Campos
    - CNPJ da empresa
    - Inscrição Estadual
    - Inscrição Municipal
    - Endereço completo (rua, número, complemento, bairro, cidade, estado, CEP)
    - Email da empresa
    - Website
    - Nome do responsável legal
    - CPF do responsável legal
    - Razão social
    - Nome fantasia
    - Atividade principal
    - Logo URL
    
  2. Segurança
    - Usa a estrutura key-value existente da tabela company_settings
    - Adiciona novos registros com valores padrão vazios
*/

-- Adicionar novos campos de configuração da empresa
INSERT INTO company_settings (setting_key, setting_value, description) VALUES
  ('company_cnpj', '', 'CNPJ da empresa'),
  ('company_state_registration', '', 'Inscrição Estadual'),
  ('company_municipal_registration', '', 'Inscrição Municipal'),
  ('company_email', '', 'Email da empresa'),
  ('company_website', '', 'Website da empresa'),
  ('company_address_street', '', 'Rua/Avenida'),
  ('company_address_number', '', 'Número'),
  ('company_address_complement', '', 'Complemento'),
  ('company_address_neighborhood', '', 'Bairro'),
  ('company_address_city', '', 'Cidade'),
  ('company_address_state', '', 'Estado'),
  ('company_address_zipcode', '', 'CEP'),
  ('company_legal_name', '', 'Razão Social'),
  ('company_trade_name', '', 'Nome Fantasia'),
  ('company_main_activity', '', 'Atividade Principal'),
  ('company_legal_representative', '', 'Responsável Legal'),
  ('company_legal_representative_cpf', '', 'CPF do Responsável Legal'),
  ('company_logo_url', '', 'URL do Logotipo')
ON CONFLICT (setting_key) DO NOTHING;