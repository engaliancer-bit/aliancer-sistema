/*
  # Criar tabela de contatos de fornecedores

  1. Nova Tabela
    - supplier_contacts
      - id (uuid, primary key)
      - supplier_id (uuid, foreign key para suppliers)
      - name (text) - Nome do contato/vendedor
      - phone (text) - Telefone/WhatsApp do contato
      - email (text) - Email do contato
      - role (text) - Cargo/função do contato (ex: vendedor, gerente)
      - is_primary (boolean) - Se é o contato principal
      - is_whatsapp (boolean) - Se o telefone tem WhatsApp
      - notes (text) - Observações sobre o contato
      - created_at (timestamptz)
  
  2. Segurança
    - Habilitar RLS na tabela supplier_contacts
    - Adicionar políticas para acesso autenticado
  
  3. Observações
    - O campo contact da tabela suppliers continua existindo como contato principal/importado do XML
    - Esta tabela permite adicionar múltiplos contatos adicionais
    - Ao enviar WhatsApp, usuário poderá escolher qual contato usar
*/

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  role text DEFAULT '',
  is_primary boolean DEFAULT false,
  is_whatsapp boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read supplier contacts"
  ON supplier_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert supplier contacts"
  ON supplier_contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update supplier contacts"
  ON supplier_contacts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete supplier contacts"
  ON supplier_contacts FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_is_primary ON supplier_contacts(is_primary);
