/*
  # Atualização do Sistema de Prazos para Imóveis Gerais

  ## Resumo
  Modifica o sistema de prazos de documentos para permitir prazos gerais que se aplicam
  a todos os imóveis de um tipo específico (rural ou urbano), ao invés de apenas imóveis individuais.

  ## Modificações

  1. **Alterações na tabela document_deadlines:**
    - Torna `property_id` NULLABLE (agora é opcional)
    - Adiciona `property_type` (text) - tipo do imóvel: 'rural', 'urban', ou null
    - Adiciona `applies_to_all` (boolean) - indica se o prazo se aplica a todos os imóveis
    
  2. **Lógica de aplicação:**
    - Se `applies_to_all = true` e `property_type` definido: aplica para TODOS os imóveis daquele tipo
    - Se `applies_to_all = false` e `property_id` definido: aplica apenas para aquele imóvel específico
    
  3. **Novos índices:**
    - Índice em `property_type` para buscas eficientes
    - Índice em `applies_to_all` para filtros

  ## Notas Importantes
    - Prazos existentes mantêm sua vinculação com imóveis específicos
    - Novos prazos podem ser criados como gerais ou específicos
    - O sistema de notificações foi atualizado para lidar com ambos os tipos
*/

-- Adicionar novos campos à tabela document_deadlines
DO $$
BEGIN
  -- Tornar property_id nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_deadlines' 
    AND column_name = 'property_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE document_deadlines ALTER COLUMN property_id DROP NOT NULL;
  END IF;

  -- Adicionar campo property_type se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_deadlines' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE document_deadlines ADD COLUMN property_type text;
  END IF;

  -- Adicionar campo applies_to_all se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_deadlines' AND column_name = 'applies_to_all'
  ) THEN
    ALTER TABLE document_deadlines ADD COLUMN applies_to_all boolean DEFAULT false;
  END IF;
END $$;

-- Adicionar constraint para garantir consistência
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_deadlines_property_check'
  ) THEN
    ALTER TABLE document_deadlines ADD CONSTRAINT document_deadlines_property_check
    CHECK (
      (applies_to_all = true AND property_type IS NOT NULL AND property_id IS NULL) OR
      (applies_to_all = false AND property_id IS NOT NULL)
    );
  END IF;
END $$;

-- Adicionar constraint para property_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_deadlines_property_type_check'
  ) THEN
    ALTER TABLE document_deadlines ADD CONSTRAINT document_deadlines_property_type_check
    CHECK (property_type IN ('rural', 'urban') OR property_type IS NULL);
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_document_deadlines_property_type 
  ON document_deadlines(property_type);

CREATE INDEX IF NOT EXISTS idx_document_deadlines_applies_to_all 
  ON document_deadlines(applies_to_all);

CREATE INDEX IF NOT EXISTS idx_document_deadlines_type_and_applies 
  ON document_deadlines(property_type, applies_to_all) 
  WHERE applies_to_all = true;

-- Atualizar registros existentes para manter compatibilidade
UPDATE document_deadlines 
SET applies_to_all = false 
WHERE applies_to_all IS NULL AND property_id IS NOT NULL;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN document_deadlines.property_id IS 'ID do imóvel específico (null se applies_to_all = true)';
COMMENT ON COLUMN document_deadlines.property_type IS 'Tipo de imóvel: rural ou urban (obrigatório se applies_to_all = true)';
COMMENT ON COLUMN document_deadlines.applies_to_all IS 'Se true, aplica a todos os imóveis do property_type especificado';
