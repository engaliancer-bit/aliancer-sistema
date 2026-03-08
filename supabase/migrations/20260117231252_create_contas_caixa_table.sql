/*
  # Criar Sistema de Contas de Caixa

  1. Nova Tabela
    - `contas_caixa`
      - `id` (uuid, primary key)
      - `unidade` (text) - Fabrica, Escritorio, Construtora
      - `nome` (text) - Nome da conta (ex: Banco Itaú, Caixa Físico)
      - `ativo` (boolean) - Se a conta está ativa
      - `saldo_inicial` (numeric) - Saldo inicial da conta
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Ajustes
    - Adicionar campo `conta_caixa_id` em receivables (se não existir)
    - Adicionar campo `conta_caixa_id` em cash_flow (se não existir)

  3. Segurança
    - Habilitar RLS
    - Política de acesso público (para o sistema interno)

  4. Dados Iniciais
    - Criar contas padrão para cada unidade
*/

-- Criar tabela contas_caixa
CREATE TABLE IF NOT EXISTS public.contas_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade text NOT NULL CHECK (unidade IN ('Fabrica', 'Escritorio', 'Construtora')),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  saldo_inicial numeric(15, 2) DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contas_caixa_unidade ON public.contas_caixa(unidade);
CREATE INDEX IF NOT EXISTS idx_contas_caixa_ativo ON public.contas_caixa(ativo);

-- Adicionar campos de conta_caixa se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receivables' AND column_name = 'conta_caixa_id'
  ) THEN
    ALTER TABLE public.receivables ADD COLUMN conta_caixa_id uuid REFERENCES public.contas_caixa(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'conta_caixa_id'
  ) THEN
    ALTER TABLE public.cash_flow ADD COLUMN conta_caixa_id uuid REFERENCES public.contas_caixa(id);
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.contas_caixa ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (público para sistema interno)
DROP POLICY IF EXISTS "Permitir acesso público a contas_caixa" ON public.contas_caixa;
CREATE POLICY "Permitir acesso público a contas_caixa"
  ON public.contas_caixa
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Inserir contas padrão
INSERT INTO public.contas_caixa (unidade, nome, ativo, saldo_inicial) VALUES
  ('Fabrica', 'Caixa Físico - Fábrica', true, 0),
  ('Fabrica', 'Banco Principal - Fábrica', true, 0),
  ('Escritorio', 'Caixa Físico - Escritório', true, 0),
  ('Escritorio', 'Banco Principal - Escritório', true, 0),
  ('Construtora', 'Caixa Físico - Construtora', true, 0),
  ('Construtora', 'Banco Principal - Construtora', true, 0)
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_contas_caixa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contas_caixa_updated_at ON public.contas_caixa;
CREATE TRIGGER trigger_update_contas_caixa_updated_at
  BEFORE UPDATE ON public.contas_caixa
  FOR EACH ROW
  EXECUTE FUNCTION update_contas_caixa_updated_at();
