/*
  # Adicionar tipos de documentos CCIR e ITR

  1. Alterações
    - Expandir os tipos permitidos de documentos de propriedade para incluir:
      - 'ccir' - Certificado de Cadastro de Imóvel Rural
      - 'itr' - Imposto Territorial Rural
    
  2. Observações
    - Esta alteração permite que os documentos CCIR e ITR sejam anexados separadamente
    - Cada documento pode ter seu próprio anexo e extração de dados
*/

DO $$
BEGIN
  ALTER TABLE property_documents
    DROP CONSTRAINT IF EXISTS property_documents_document_type_check;

  ALTER TABLE property_documents
    ADD CONSTRAINT property_documents_document_type_check
    CHECK (document_type IN ('registration', 'ccir', 'itr', 'car_receipt', 'map', 'memorial', 'kml', 'legal_reserve', 'other'));
END $$;
