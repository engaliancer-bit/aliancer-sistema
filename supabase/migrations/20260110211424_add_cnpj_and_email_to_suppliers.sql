/*
  # Adicionar CNPJ e Email aos Fornecedores

  1. Alterações na Tabela suppliers
    - Adicionar coluna `cnpj` (text) - CNPJ do fornecedor
    - Adicionar coluna `email` (text) - Email do fornecedor
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'cnpj'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN cnpj text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'email'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN email text DEFAULT '';
  END IF;
END $$;