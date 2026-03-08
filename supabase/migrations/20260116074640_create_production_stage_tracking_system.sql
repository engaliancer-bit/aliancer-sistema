/*
  # Criar sistema de acompanhamento de etapas de produção

  1. Nova Estrutura
    - Adiciona campo `enable_stage_tracking` na tabela `products`
    - Nova tabela `production_stages` para definir as etapas do processo
    - Nova tabela `production_tracking_stages` para registrar conclusão de etapas
    - Relaciona etapas com o tracking de produtos via QR code

  2. Tabela `production_stages`
    - `id` (uuid, primary key) - Identificador único
    - `stage_key` (text, unique) - Chave única da etapa (ex: 'concrete_poured')
    - `stage_name` (text) - Nome da etapa em português
    - `stage_order` (integer) - Ordem de execução da etapa
    - `description` (text, nullable) - Descrição da etapa
    - `created_at` (timestamptz) - Data de criação

  3. Tabela `production_tracking_stages`
    - `id` (uuid, primary key) - Identificador único
    - `tracking_id` (uuid, foreign key) - Referência ao product_tracking
    - `stage_id` (uuid, foreign key) - Referência à production_stages
    - `completed_at` (timestamptz) - Data/hora de conclusão da etapa
    - `completed_by` (text) - Nome do responsável que concluiu
    - `photo_url` (text, nullable) - URL da foto da etapa
    - `notes` (text, nullable) - Observações sobre a etapa
    - `created_at` (timestamptz) - Data de criação do registro

  4. Alterações em Products
    - Adiciona campo `enable_stage_tracking` (boolean) - Se ativa acompanhamento de etapas

  5. Segurança
    - Habilita RLS em todas as novas tabelas
    - Políticas para acesso público (compatível com sistema atual)

  6. Dados Iniciais
    - Insere as 7 etapas padrão do processo de produção
*/

-- Adicionar campo de acompanhamento de etapas aos produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS enable_stage_tracking boolean DEFAULT false;

-- Criar tabela de etapas de produção
CREATE TABLE IF NOT EXISTS production_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key text UNIQUE NOT NULL,
  stage_name text NOT NULL,
  stage_order integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de registro de etapas concluídas
CREATE TABLE IF NOT EXISTS production_tracking_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES product_tracking(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES production_stages(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by text NOT NULL DEFAULT 'Sistema',
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tracking_id, stage_id)
);

-- Habilitar RLS
ALTER TABLE production_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tracking_stages ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para production_stages
CREATE POLICY "Allow public read access to production_stages"
  ON production_stages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to production_stages"
  ON production_stages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to production_stages"
  ON production_stages FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to production_stages"
  ON production_stages FOR DELETE
  TO public
  USING (true);

-- Políticas de acesso público para production_tracking_stages
CREATE POLICY "Allow public read access to production_tracking_stages"
  ON production_tracking_stages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to production_tracking_stages"
  ON production_tracking_stages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to production_tracking_stages"
  ON production_tracking_stages FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to production_tracking_stages"
  ON production_tracking_stages FOR DELETE
  TO public
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_production_stages_key ON production_stages(stage_key);
CREATE INDEX IF NOT EXISTS idx_production_stages_order ON production_stages(stage_order);
CREATE INDEX IF NOT EXISTS idx_production_tracking_stages_tracking ON production_tracking_stages(tracking_id);
CREATE INDEX IF NOT EXISTS idx_production_tracking_stages_stage ON production_tracking_stages(stage_id);
CREATE INDEX IF NOT EXISTS idx_production_tracking_stages_completed ON production_tracking_stages(completed_at);

-- Inserir etapas padrão do processo de produção
INSERT INTO production_stages (stage_key, stage_name, stage_order, description) VALUES
  ('quote_created', 'Realização do Orçamento', 1, 'Orçamento foi criado e enviado ao cliente'),
  ('quote_approved', 'Aprovação do Orçamento e Ordem de Produção', 2, 'Orçamento aprovado e ordem de produção gerada'),
  ('concrete_poured', 'Concretagem', 3, 'Peça foi concretada'),
  ('demolding_finishing', 'Desmolde e Acabamento', 4, 'Peça foi desmoldada e recebeu acabamento'),
  ('loading_delivery', 'Carregamento/Entrega', 5, 'Peça foi carregada e/ou entregue'),
  ('assembly', 'Montagem', 6, 'Peça foi montada no local'),
  ('completion', 'Finalização', 7, 'Processo finalizado')
ON CONFLICT (stage_key) DO NOTHING;

-- Criar bucket de storage para fotos das etapas se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-stages', 'production-stages', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage para upload público
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public uploads to production-stages'
  ) THEN
    CREATE POLICY "Allow public uploads to production-stages"
      ON storage.objects FOR INSERT
      TO public
      WITH CHECK (bucket_id = 'production-stages');
  END IF;
END $$;

-- Política de storage para acesso público
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public access to production-stages'
  ) THEN
    CREATE POLICY "Allow public access to production-stages"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'production-stages');
  END IF;
END $$;