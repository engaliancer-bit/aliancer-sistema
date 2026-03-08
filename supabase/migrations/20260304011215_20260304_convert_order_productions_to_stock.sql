/*
  # Unificacao das Producoes de Ordens no Estoque Normal

  ## Objetivo
  Converter todas as producoes vinculadas a ordens de producao para serem contabilizadas
  no estoque normal (production_type = 'stock'), eliminando o split artificial entre
  producoes "de ordem" e producoes "de estoque".

  ## Mudancas

  ### 1. Conversao de registros existentes
  - Todos os registros de `production` com `production_type = 'order'` sao convertidos para `production_type = 'stock'`
  - O campo `production_order_id` e mantido para preservar o historico e vinculo com a ordem
  - Isso corrige os estoques negativos causados por producoes que existiam fisicamente mas nao eram contabilizadas

  ### 2. Trigger de criacao de producao via ordem
  - A funcao `create_production_atomic` e atualizada para sempre criar com `production_type = 'stock'`
  - O campo `production_order_id` e preenchido normalmente para rastreabilidade

  ### 3. Impacto esperado nos estoques (antes -> depois)
  - Poste de cerca 10x10cm x 2.00m: -114 -> +61 (175 pecas de ordens passam a contar)
  - Poste de cerca 10x10cm dobra 2.00m: -33 -> -3 (30 pecas de ordens passam a contar)
  - Poste de cerca 10x10cm x 2.50m: -117 -> -100 (17 pecas de ordens passam a contar)
  - Pilar pre moldado 18x25 H=4,50: +28 -> +34 (6 pecas de ordens passam a contar)
  - Marco de concreto: +65 -> +67 (2 pecas de ordens passam a contar)

  ## Notas
  - O campo production_order_id NÃO e removido — mantem rastreabilidade completa
  - A view product_stock_view ja conta production_type='stock' corretamente
  - Nenhum dado e perdido, apenas o tipo e atualizado
*/

-- Step 1: Convert all existing order productions to stock type
UPDATE production
SET production_type = 'stock'
WHERE production_type = 'order'
  AND production_order_id IS NOT NULL;

-- Step 2: Also convert any orphan 'order' type productions (just in case)
UPDATE production
SET production_type = 'stock'
WHERE production_type = 'order';

-- Step 3: Update the create_production_atomic function to always use 'stock' type
-- (find and replace the function that creates production records for orders)
CREATE OR REPLACE FUNCTION create_production_atomic(
  p_product_id uuid,
  p_quantity numeric,
  p_production_date date,
  p_notes text DEFAULT '',
  p_production_order_id uuid DEFAULT NULL,
  p_production_order_item_id uuid DEFAULT NULL,
  p_production_type text DEFAULT 'stock'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_production_id uuid;
BEGIN
  -- Always insert as 'stock' regardless of what was passed
  -- production_order_id is preserved for traceability
  INSERT INTO production (
    product_id,
    quantity,
    production_date,
    notes,
    production_order_id,
    production_type
  )
  VALUES (
    p_product_id,
    p_quantity,
    p_production_date,
    p_notes,
    p_production_order_id,
    'stock'
  )
  RETURNING id INTO v_production_id;

  RETURN v_production_id;
END;
$$;
