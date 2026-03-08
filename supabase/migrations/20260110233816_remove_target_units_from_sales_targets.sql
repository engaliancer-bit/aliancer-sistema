/*
  # Remover meta de unidades das metas de vendas

  1. Modificações
    - Remove a coluna `target_units` da tabela `sales_targets`
    - O sistema agora foca apenas em metas de faturamento (valores monetários)
    
  2. Notas Importantes
    - Esta é uma mudança de produto solicitada pelo usuário
    - O sistema agora rastreia apenas metas de valor (R$), não unidades
    - A remoção da coluna é segura pois é uma decisão de negócio intencional
*/

-- Remove a coluna target_units
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_targets' AND column_name = 'target_units'
  ) THEN
    ALTER TABLE sales_targets DROP COLUMN target_units;
  END IF;
END $$;