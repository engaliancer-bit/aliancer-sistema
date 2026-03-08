/*
  # Atualização da tabela whatsapp_notifications para suportar prazos gerais

  ## Resumo
  Torna o campo property_id nullable na tabela whatsapp_notifications para permitir
  notificações relacionadas a prazos gerais que não estão vinculados a um imóvel específico.

  ## Modificações
    - Torna `property_id` NULLABLE (agora é opcional)
    - Mantém a foreign key para quando property_id for informado
    - Remove a constraint NOT NULL de property_id

  ## Notas
    - Registros existentes não serão afetados
    - Novos registros podem ter property_id null quando relacionados a prazos gerais
*/

-- Tornar property_id nullable na tabela whatsapp_notifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_notifications' 
    AND column_name = 'property_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE whatsapp_notifications ALTER COLUMN property_id DROP NOT NULL;
  END IF;
END $$;

-- Comentário na coluna para documentação
COMMENT ON COLUMN whatsapp_notifications.property_id IS 'ID do imóvel específico (null para notificações de prazos gerais)';
