/*
  # Adicionar Inscrição Estadual aos Clientes

  ## Descrição
  Adiciona o campo de inscrição estadual para clientes pessoa jurídica.

  ## Mudanças
  1. Adiciona coluna `state_registration` (Inscrição Estadual) à tabela customers
     - Campo opcional (apenas para PJ)
     - Armazena o número da inscrição estadual
*/

-- Adicionar coluna de inscrição estadual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'state_registration'
  ) THEN
    ALTER TABLE customers ADD COLUMN state_registration text;
  END IF;
END $$;
