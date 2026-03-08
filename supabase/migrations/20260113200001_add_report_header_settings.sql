/*
  # Adicionar Configurações de Cabeçalho de Relatórios

  1. Novas Configurações
    - Adiciona configurações para personalização de cabeçalho de relatórios
    - `report_header_title` - Título principal do cabeçalho dos relatórios
    - `report_header_subtitle` - Subtítulo do cabeçalho dos relatórios  
    - `report_footer_text` - Texto do rodapé dos relatórios
    - `report_show_logo` - Se deve exibir o logotipo nos relatórios (true/false)
    - `report_show_company_info` - Se deve exibir informações da empresa (true/false)

  2. Inicialização
    - Define valores padrão para cada nova configuração
    
  3. Descrição
    - Permite que a empresa configure um padrão visual consistente para todos os relatórios gerados pelo sistema
*/

-- Inserir novas configurações para cabeçalho de relatórios
INSERT INTO company_settings (setting_key, setting_value, description)
VALUES 
  ('report_header_title', 'Relatório Gerencial', 'Título principal exibido no cabeçalho dos relatórios'),
  ('report_header_subtitle', 'Sistema de Gestão', 'Subtítulo exibido no cabeçalho dos relatórios'),
  ('report_footer_text', 'Documento gerado automaticamente pelo sistema', 'Texto exibido no rodapé dos relatórios'),
  ('report_show_logo', 'true', 'Se deve exibir o logotipo da empresa nos relatórios (true/false)'),
  ('report_show_company_info', 'true', 'Se deve exibir informações da empresa (endereço, telefone, email) nos relatórios (true/false)')
ON CONFLICT (setting_key) DO NOTHING;