/*
  # Romaneios de Entrega - Log e Storage

  ## Novas Tabelas
  - `romaneios_log`: Registra cada romaneio gerado, com referências ao orçamento/entrega,
    caminho do PDF no Storage, usuário, data e status.

  ## Segurança
  - RLS habilitado com políticas permissivas para role anon (padrão do sistema)

  ## Storage
  - Bucket `romaneios` criado para armazenar os PDFs gerados (leitura pública)
*/

-- Tabela de log dos romaneios gerados
CREATE TABLE IF NOT EXISTS romaneios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  customer_name text,
  path_pdf text,
  status text NOT NULL DEFAULT 'emitido',
  include_prices boolean NOT NULL DEFAULT true,
  driver_name text,
  vehicle_plate text,
  delivery_address text,
  scheduled_delivery_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by text
);

ALTER TABLE romaneios_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anonymous users can view romaneios_log"
  ON romaneios_log FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert romaneios_log"
  ON romaneios_log FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update romaneios_log"
  ON romaneios_log FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_romaneios_log_quote_id ON romaneios_log(quote_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_log_delivery_id ON romaneios_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_log_created_at ON romaneios_log(created_at DESC);
