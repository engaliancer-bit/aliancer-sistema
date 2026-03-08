/*
  # Adicionar campo de vencimento ao fluxo de caixa

  ## Descrição
  Adiciona o campo due_date à tabela cash_flow para permitir registro de vencimento
  em despesas manuais. Este campo é usado para despesas não pagas, permitindo
  controle de contas a pagar diretamente no fluxo de caixa.

  ## Alterações
  - Adiciona coluna `due_date` (date) à tabela cash_flow
  - Campo opcional, usado apenas para despesas não pagas

  ## Notas
  - Quando a despesa é paga, o campo `date` é preenchido e `due_date` pode ser ignorado
  - Este campo ajuda a distinguir entre despesas lançadas e despesas a pagar
*/

-- Adicionar campo due_date à tabela cash_flow se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN due_date date;
  END IF;
END $$;

-- Criar índice para buscar por vencimento
CREATE INDEX IF NOT EXISTS idx_cash_flow_due_date ON cash_flow(due_date) WHERE due_date IS NOT NULL;
