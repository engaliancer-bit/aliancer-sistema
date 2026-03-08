/*
  # Adicionar campo do responsável nas configurações da empresa

  1. Alterações
    - Adicionar configuração `company_responsible_name` para identificar quem assina os orçamentos
    
  Nota: Este campo será usado nas assinaturas de orçamentos e relatórios
*/

INSERT INTO company_settings (setting_key, setting_value, description)
VALUES (
  'company_responsible_name',
  '',
  'Nome do responsável que assina os orçamentos e documentos'
) ON CONFLICT (setting_key) DO NOTHING;