/*
  # Adicionar dias úteis às metas de vendas

  1. Modificações
    - Adiciona coluna `working_days` à tabela `sales_targets`
      - Armazena o número de dias úteis do mês para cálculo preciso da meta diária
      - Valor padrão: dias corridos do mês (28-31 dependendo do mês)
    
  2. Notas Importantes
    - Meta diária será calculada como: target_amount / working_days
    - Validação: target_amount = daily_target × working_days
    - Permite ao usuário definir dias úteis reais (ex: 22 dias úteis em um mês de 30 dias)
*/

-- Adiciona coluna de dias úteis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_targets' AND column_name = 'working_days'
  ) THEN
    ALTER TABLE sales_targets ADD COLUMN working_days integer NOT NULL DEFAULT 22;
  END IF;
END $$;

-- Adiciona comentário explicativo
COMMENT ON COLUMN sales_targets.working_days IS 'Número de dias úteis do mês para cálculo da meta diária';