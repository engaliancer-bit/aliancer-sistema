/*
  # Alterar Tempo Estimado de Horas para Dias
  
  ## Descrição
  Renomeia a coluna `estimated_time_hours` para `estimated_time_days` na tabela
  `engineering_service_templates` para refletir melhor o tempo estimado de serviços
  de engenharia que geralmente são medidos em dias, não horas.
  
  ## Alterações
  - Renomeia coluna `estimated_time_hours` para `estimated_time_days`
  - Mantém o tipo decimal(10, 2) para suportar valores fracionados (ex: 2.5 dias)
  
  ## Notas
  - Valores existentes serão preservados (se havia 8 horas, permanecerá como 8)
  - Recomenda-se ajustar manualmente os valores existentes se necessário
*/

-- Renomear coluna de horas para dias
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_service_templates'
    AND column_name = 'estimated_time_hours'
  ) THEN
    ALTER TABLE engineering_service_templates
    RENAME COLUMN estimated_time_hours TO estimated_time_days;
  END IF;
END $$;
