/*
  # Sistema de Cadastro de Imóveis

  1. Nova Tabela - properties
    - `id` (uuid, primary key)
    - `customer_id` (uuid, foreign key para customers)
    - `property_type` (text) - 'rural' ou 'urban'
    - `name` (text) - nome ou descrição do imóvel
    - `registration_number` (text) - número da matrícula
    - `municipality` (text) - município do imóvel
    - `state` (text) - estado (UF)
    
    ## Campos específicos para Imóvel Rural
    - `ccir` (text) - Certificado de Cadastro de Imóvel Rural
    - `itr` (text) - Imposto Territorial Rural
    - `cib_number` (text) - número do CIB
    - `car_receipt_code` (text) - código do recibo do CAR
    
    ## Campos específicos para Imóvel Urbano
    - `municipal_registration` (text) - cadastro imobiliário no município
    
    - `notes` (text) - observações adicionais
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Nova Tabela - property_documents
    - `id` (uuid, primary key)
    - `property_id` (uuid, foreign key para properties)
    - `document_type` (text) - tipo do documento (matrícula, car_receipt, map, memorial, kml, legal_reserve, outros)
    - `file_name` (text)
    - `file_path` (text) - caminho no storage
    - `file_type` (text) - MIME type
    - `file_size` (bigint)
    - `description` (text)
    - `created_at` (timestamptz)

  3. Segurança
    - Habilitar RLS em ambas as tabelas
    - Adicionar políticas para acesso autenticado

  4. Observações
    - Sistema completo para gestão de imóveis rurais e urbanos
    - Documentos organizados por tipo
    - Permite filtros por tipo e município
*/

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_type text NOT NULL CHECK (property_type IN ('rural', 'urban')),
  name text NOT NULL,
  registration_number text DEFAULT '',
  municipality text NOT NULL,
  state text DEFAULT 'TO',
  ccir text DEFAULT '',
  itr text DEFAULT '',
  cib_number text DEFAULT '',
  car_receipt_code text DEFAULT '',
  municipal_registration text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('registration', 'car_receipt', 'map', 'memorial', 'kml', 'legal_reserve', 'other')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read properties"
  ON properties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete properties"
  ON properties FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read property_documents"
  ON property_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert property_documents"
  ON property_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update property_documents"
  ON property_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete property_documents"
  ON property_documents FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_properties_customer ON properties(customer_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_municipality ON properties(municipality);
CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_type ON property_documents(document_type);
