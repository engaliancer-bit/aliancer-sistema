/*
  # Corrigir Cálculo de Estoque para Usar Quantidade Carregada

  ## Problema Identificado
  
  A view `product_stock_view` estava calculando o estoque disponível usando `di.quantity` 
  (quantidade total do pedido) ao invés de `di.loaded_quantity` (quantidade efetivamente 
  carregada e entregue).

  Isso causava descasamento no estoque:
  - Uma entrega fechada (`status='closed'`) contava TODA a quantidade como entregue
  - Mesmo que só parte dos itens tenha sido carregada (`loaded_quantity < quantity`)
  - Resultado: Estoque ficava negativo ou incorreto

  ## Exemplo do Problema
  
  - 5 postes produzidos → estoque = 5
  - Entrega criada para 5 postes → loaded_quantity = 5
  - Entrega fechada → status = 'closed'
  - View antiga contava: total_delivered = 5 (usando di.quantity)
  - Estoque disponível = 5 - 5 = 0 ✅ Correto

  MAS se a entrega foi fechada manualmente sem carregar tudo:
  - 5 postes produzidos → estoque = 5
  - Entrega criada para 5 postes
  - Apenas 3 postes carregados → loaded_quantity = 3
  - Entrega fechada manualmente → status = 'closed'
  - View antiga contava: total_delivered = 5 (usando di.quantity) ❌ ERRADO!
  - Estoque disponível = 5 - 5 = 0 (mas na verdade deveria ser 2)

  ## Solução

  Alterar a view para usar `di.loaded_quantity` ao invés de `di.quantity`:
  - Agora conta apenas o que foi REALMENTE carregado e entregue
  - Suporta entregas parciais corretamente
  - Mantém estoque preciso mesmo com finalizações manuais

  ## Impacto

  - Estoque passa a refletir a realidade (produzido - efetivamente entregue)
  - Itens não carregados permanecem disponíveis no estoque
  - Entregas parciais não causam mais desbalanceamento
*/

-- Recriar a view product_stock_view usando loaded_quantity
CREATE OR REPLACE VIEW product_stock_view AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.code as product_code,
  COALESCE(prod.total_produced, 0) as total_produced,
  COALESCE(deliv.total_delivered, 0) as total_delivered,
  COALESCE(prod.total_produced, 0) - COALESCE(deliv.total_delivered, 0) as available_stock
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total_produced
  FROM production
  GROUP BY product_id
) prod ON prod.product_id = p.id
LEFT JOIN (
  -- CORREÇÃO: Usar loaded_quantity ao invés de quantity
  SELECT di.product_id, SUM(di.loaded_quantity) as total_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
  GROUP BY di.product_id
) deliv ON deliv.product_id = p.id;

-- Dropar função antiga e recriar com a correção
DROP FUNCTION IF EXISTS get_product_available_stock(uuid);
CREATE OR REPLACE FUNCTION get_product_available_stock(p_product_id uuid)
RETURNS numeric AS $$
DECLARE
  v_stock numeric;
BEGIN
  SELECT available_stock INTO v_stock
  FROM product_stock_view
  WHERE product_id = p_product_id;
  
  RETURN COALESCE(v_stock, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dropar função antiga e recriar com a correção
DROP FUNCTION IF EXISTS get_product_stock(uuid);
CREATE OR REPLACE FUNCTION get_product_stock(p_product_id uuid)
RETURNS integer AS $$
DECLARE
  v_total_produced integer;
  v_total_delivered integer;
BEGIN
  -- Total produzido
  SELECT COALESCE(SUM(quantity), 0)::integer
  INTO v_total_produced
  FROM production
  WHERE product_id = p_product_id;
  
  -- Total efetivamente entregue (usando loaded_quantity)
  SELECT COALESCE(SUM(di.loaded_quantity), 0)::integer
  INTO v_total_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE di.product_id = p_product_id
    AND d.status = 'closed';
  
  RETURN v_total_produced - v_total_delivered;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON VIEW product_stock_view IS 
  'Calcula estoque disponível de produtos usando loaded_quantity (quantidade efetivamente carregada) 
   ao invés de quantity (quantidade do pedido). Isso garante que entregas parciais sejam tratadas 
   corretamente e o estoque reflita a realidade.';

COMMENT ON FUNCTION get_product_available_stock(uuid) IS
  'Retorna o estoque disponível de um produto. Usa loaded_quantity para contar apenas itens 
   efetivamente entregues.';

COMMENT ON FUNCTION get_product_stock(uuid) IS
  'Retorna o estoque de um produto (total_produced - total_delivered). 
   Usa loaded_quantity para garantir precisão em entregas parciais.';