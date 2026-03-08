/*
  # Adicionar Prazo às Ordens de Produção

  1. Alterações
    - Adiciona coluna `deadline` (date, opcional) na tabela `production_orders`
      - Campo para registrar o prazo/deadline para conclusão da ordem de produção
      - Será usado ao gerar ordens automaticamente a partir de orçamentos aprovados
  
  2. Objetivo
    - Permitir definir prazos para ordens de produção
    - Facilitar planejamento e controle de produção
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'deadline'
  ) THEN
    ALTER TABLE production_orders ADD COLUMN deadline date;
  END IF;
END $$;