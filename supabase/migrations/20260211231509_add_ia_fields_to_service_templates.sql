/*
  # Adicionar campos de IA aos templates de serviços

  1. Alterações
    - Adiciona colunas JSONB para configuração de IA nos templates:
      - `ia_sections`: Array de seções estruturadas do documento
      - `ia_intake_questions`: Perguntas de coleta de dados
      - `ia_required_inputs`: Inputs obrigatórios
      - `ia_checklist_items`: Itens do checklist
      - `ia_rules`: Regras para geração do documento
    
  2. Segurança
    - Mantém RLS existente
*/

-- Adicionar colunas de configuração de IA
ALTER TABLE engineering_service_templates
ADD COLUMN IF NOT EXISTS ia_sections JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ia_intake_questions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ia_required_inputs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ia_checklist_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ia_rules JSONB DEFAULT '[]'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN engineering_service_templates.ia_sections IS 'Estrutura de seções do documento com título, descrição e tipo';
COMMENT ON COLUMN engineering_service_templates.ia_intake_questions IS 'Perguntas de coleta de dados com tipo, obrigatoriedade e opções';
COMMENT ON COLUMN engineering_service_templates.ia_required_inputs IS 'Lista de campos obrigatórios';
COMMENT ON COLUMN engineering_service_templates.ia_checklist_items IS 'Itens do checklist de validação';
COMMENT ON COLUMN engineering_service_templates.ia_rules IS 'Regras para a IA seguir na geração do documento';
