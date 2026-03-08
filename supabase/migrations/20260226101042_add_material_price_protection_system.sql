/*
  # Sistema de Protecao de Preco de Insumos

  ## Resumo
  Adiciona controle de travamento de preco em insumos e historico de alteracoes,
  para evitar que importacoes de NF-e ou registros de compra alterem precos
  sem autorizacao do usuario.

  ## Novos campos em `materials`
  - `price_locked` (boolean, default false) — trava o preco contra alteracoes automaticas
  - `price_lock_note` (text, nullable) — anotacao do usuario ao travar
  - `price_updated_at` (timestamptz) — ultima vez que o preco foi alterado
  - `price_updated_by_source` (text) — origem da ultima alteracao: manual | nfe_import | purchase

  ## Nova tabela `material_price_history`
  Registra cada alteracao de preco com origem, valores anterior e novo, e chave da NF-e se aplicavel.

  ## Seguranca
  - RLS habilitado com politicas de acesso publico (mesmo padrao do sistema)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'price_locked'
  ) THEN
    ALTER TABLE materials ADD COLUMN price_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'price_lock_note'
  ) THEN
    ALTER TABLE materials ADD COLUMN price_lock_note text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'price_updated_at'
  ) THEN
    ALTER TABLE materials ADD COLUMN price_updated_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'price_updated_by_source'
  ) THEN
    ALTER TABLE materials ADD COLUMN price_updated_by_source text DEFAULT 'manual';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS material_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  old_unit_cost numeric,
  new_unit_cost numeric,
  old_unit text,
  new_unit text,
  old_package_size numeric,
  new_package_size numeric,
  source text NOT NULL DEFAULT 'manual',
  nfe_key text,
  notes text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_price_history_material_id
  ON material_price_history (material_id, changed_at DESC);

ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read material_price_history"
  ON material_price_history FOR SELECT USING (true);

CREATE POLICY "Allow public insert material_price_history"
  ON material_price_history FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update material_price_history"
  ON material_price_history FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete material_price_history"
  ON material_price_history FOR DELETE USING (true);
