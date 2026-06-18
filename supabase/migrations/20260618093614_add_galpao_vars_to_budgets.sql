
-- Add galpao (industrial shed) project variables to budgets table
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS vao_galpao          numeric(10,3),
  ADD COLUMN IF NOT EXISTS comprimento_total   numeric(10,3),
  ADD COLUMN IF NOT EXISTS pe_direito          numeric(10,3),
  ADD COLUMN IF NOT EXISTS espac_pilares       numeric(10,3),
  ADD COLUMN IF NOT EXISTS prof_fundacao       numeric(10,3),
  ADD COLUMN IF NOT EXISTS tamanho_aba         numeric(10,3),
  ADD COLUMN IF NOT EXISTS inclinacao_telhado  numeric(5,2) DEFAULT 27,
  ADD COLUMN IF NOT EXISTS tipo_telha          text DEFAULT 'aluzinco' CHECK (tipo_telha IN ('aluzinco','fibrocimento'));
