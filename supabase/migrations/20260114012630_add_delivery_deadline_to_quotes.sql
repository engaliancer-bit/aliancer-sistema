/*
  # Adicionar Prazo de Entrega aos Orçamentos

  1. Alterações
    - Adiciona coluna `delivery_deadline` (date, opcional) na tabela `quotes`
      - Campo opcional para registrar o prazo de entrega prometido
      - Será exibido no orçamento impresso quando preenchido
  
  2. Objetivo
    - Permitir que o usuário registre o prazo de entrega ao criar orçamentos
    - Campo opcional - não obrigatório
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'delivery_deadline'
  ) THEN
    ALTER TABLE quotes ADD COLUMN delivery_deadline date;
  END IF;
END $$;