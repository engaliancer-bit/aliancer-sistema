/*
  # Adicionar campo de URL do logotipo nas configurações da empresa

  1. Novos Campos
    - Adiciona `company_logo_url` nas configurações da empresa
    - Adiciona `report_show_logo` para controlar exibição da logo

  2. Alterações
    - Insere registros iniciais para as novas configurações
*/

-- Inserir configuração para URL do logotipo
INSERT INTO company_settings (setting_key, setting_value, description)
VALUES (
  'company_logo_url',
  '',
  'URL pública do logotipo da empresa (exibido nos relatórios)'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Inserir configuração para exibir logo nos relatórios
INSERT INTO company_settings (setting_key, setting_value, description)
VALUES (
  'report_show_logo',
  'true',
  'Exibir logotipo nos relatórios'
)
ON CONFLICT (setting_key) DO NOTHING;