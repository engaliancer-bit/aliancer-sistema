/*
  # Adicionar Vencimento às Compras XML

  ## Descrição
  Adiciona o campo `due_date` à tabela `purchases` para permitir que
  compras importadas de XML possam ter data de vencimento e serem
  gerenciadas no sistema de contas a pagar.

  ## Alterações
  1. **purchases**
     - Adiciona coluna `due_date` (date, nullable)
     - Permite definir quando a compra vence para pagamento

  ## Segurança
  - Não afeta as políticas RLS existentes
*/

-- Adicionar campo de vencimento às compras
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS due_date date;

-- Criar índice para consultas por vencimento
CREATE INDEX IF NOT EXISTS idx_purchases_due_date ON purchases(due_date);
