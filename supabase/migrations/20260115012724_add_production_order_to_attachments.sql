/*
  # Adicionar tipo production_order aos anexos

  1. Alterações
    - Adicionar 'production_order' como tipo válido de entidade na tabela attachments
    - Permite anexar planos de corte e outros documentos às ordens de produção
  
  2. Observações
    - Esta alteração permite que ordens de produção tenham anexos como planos de corte de treliças
    - Os arquivos continuarão sendo armazenados no bucket 'attachments'
*/

-- Remover a constraint antiga
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;

-- Adicionar nova constraint com production_order incluído
ALTER TABLE attachments ADD CONSTRAINT attachments_entity_type_check 
  CHECK (entity_type IN ('product', 'composition', 'quote', 'customer', 'production_order'));