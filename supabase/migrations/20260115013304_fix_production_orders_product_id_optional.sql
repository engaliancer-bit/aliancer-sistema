/*
  # Tornar product_id opcional em production_orders

  1. Alterações
    - Remove a constraint NOT NULL do campo `product_id` na tabela `production_orders`
    - Permite que ordens de produção sejam criadas sem produto específico
    - Necessário para ordens de laje treliçada e projetos personalizados

  2. Segurança
    - Mantém RLS policies existentes
    - Sem alterações nas permissões
*/

-- Tornar product_id opcional na tabela production_orders
ALTER TABLE production_orders
ALTER COLUMN product_id DROP NOT NULL;
