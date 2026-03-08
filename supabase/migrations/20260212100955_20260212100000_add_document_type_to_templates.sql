/*
  # Adicionar tipo de documento aos templates
  
  1. Alterações
    - Adiciona coluna `document_type` para identificar tipo do template
    - Atualiza template PRAD existente com tipo 'prad'
    
  2. Segurança
    - Não afeta RLS existente
*/

-- Adicionar coluna document_type
ALTER TABLE engineering_service_templates
ADD COLUMN IF NOT EXISTS document_type TEXT;

-- Atualizar template PRAD existente
UPDATE engineering_service_templates
SET document_type = 'prad'
WHERE name ILIKE '%prad%'
  OR name ILIKE '%recuperação%área%degradada%';

-- Comentário
COMMENT ON COLUMN engineering_service_templates.document_type IS 
  'Tipo do documento para identificação (prad, laudo, vistoria, etc.)';