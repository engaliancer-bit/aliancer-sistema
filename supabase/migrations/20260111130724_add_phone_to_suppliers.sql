/*
  # Adicionar coluna phone à tabela suppliers

  1. Alterações
    - Adicionar coluna `phone` (text) à tabela suppliers
    - Esta coluna armazena o telefone do fornecedor separadamente do campo contact
  
  2. Observações
    - A coluna permite valores nulos
    - Valor padrão é string vazia
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'phone'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN phone text DEFAULT '';
  END IF;
END $$;