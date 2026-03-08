/*
  # Sistema de Rastreamento de Produtos com QR Code

  1. Nova Tabela
    - `product_tracking`
      - `id` (uuid, primary key) - ID único do registro
      - `qr_token` (text, unique) - Token único para gerar URL do QR code
      - `production_id` (uuid, nullable) - Referência para produção manual
      - `production_order_id` (uuid, nullable) - Referência para ordem de produção
      - `product_id` (uuid) - Produto relacionado
      - `recipe_name` (text) - Nome do traço/receita usado
      - `quantity` (decimal) - Quantidade produzida
      - `production_date` (date) - Data da produção
      - `expedition_date` (date, nullable) - Data de expedição
      - `assembly_date` (date, nullable) - Data de montagem (para pré-moldados)
      - `additional_notes` (text, nullable) - Observações adicionais
      - `created_at` (timestamptz) - Data de criação do registro
      - `updated_at` (timestamptz) - Data da última atualização

  2. Segurança
    - Habilitar RLS na tabela `product_tracking`
    - Política para leitura pública (qualquer um pode ver via QR code)
    - Política para criação apenas por usuários autenticados
    - Política para atualização apenas por usuários autenticados

  3. Índices
    - Índice único no `qr_token` para busca rápida
    - Índice em `production_id` e `production_order_id` para relacionamento
*/

-- Criar tabela de rastreamento de produtos
CREATE TABLE IF NOT EXISTS product_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_token text UNIQUE NOT NULL,
  production_id uuid REFERENCES production(id) ON DELETE CASCADE,
  production_order_id uuid REFERENCES production_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  recipe_name text NOT NULL,
  quantity decimal(10, 2) NOT NULL,
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  expedition_date date,
  assembly_date date,
  additional_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_product_tracking_qr_token ON product_tracking(qr_token);
CREATE INDEX IF NOT EXISTS idx_product_tracking_production_id ON product_tracking(production_id);
CREATE INDEX IF NOT EXISTS idx_product_tracking_production_order_id ON product_tracking(production_order_id);
CREATE INDEX IF NOT EXISTS idx_product_tracking_product_id ON product_tracking(product_id);

-- Habilitar RLS
ALTER TABLE product_tracking ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (qualquer um pode consultar via QR code)
CREATE POLICY "Anyone can view product tracking"
  ON product_tracking
  FOR SELECT
  USING (true);

-- Política para criação apenas por usuários autenticados
CREATE POLICY "Authenticated users can create product tracking"
  ON product_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para atualização apenas por usuários autenticados
CREATE POLICY "Authenticated users can update product tracking"
  ON product_tracking
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para deleção apenas por usuários autenticados
CREATE POLICY "Authenticated users can delete product tracking"
  ON product_tracking
  FOR DELETE
  TO authenticated
  USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_product_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_product_tracking_updated_at_trigger ON product_tracking;
CREATE TRIGGER update_product_tracking_updated_at_trigger
  BEFORE UPDATE ON product_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_product_tracking_updated_at();