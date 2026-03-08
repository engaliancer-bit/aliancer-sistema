/*
  # Atualizar Cálculo de Estoque para Reserva Imediata

  ## Nova Lógica de Estoque

  ### Regras de Negócio
  
  1. **Produção "Para Estoque"** (production_type='stock'):
     - Apenas produção marcada como "Para Estoque" entra no cálculo
     - Produção vinculada a ordens (production_type='order') NÃO conta no estoque geral
  
  2. **Reserva Imediata ao Aprovar Orçamento**:
     - Ao aprovar um orçamento, uma entrega é criada automaticamente (status='open')
     - Os produtos são IMEDIATAMENTE descontados do estoque disponível
     - O estoque considera a QUANTIDADE DO PEDIDO (quantity), não a carregada
     - Isso reserva os produtos para aquela entrega específica
  
  3. **Cálculo de Estoque Disponível**:
     ```
     Estoque Disponível = 
       Produção "Para Estoque" 
       - Entregas Ativas (open, in_progress, closed)
     ```
  
  ### Exemplo Prático
  
  **Cenário: Blocos de Vedação 14 com Encaixe**
  
  1. Cadastro de Produção:
     - 2000 blocos produzidos
     - production_type = 'stock' (Para Estoque)
     - Estoque disponível = 2000
  
  2. Aprovação de Orçamento:
     - Cliente solicita 800 blocos
     - Orçamento aprovado (status='pending' → 'approved')
     - Sistema cria entrega automaticamente (status='open')
     - Entrega tem 800 blocos (quantity=800, loaded_quantity=0)
     - **Estoque disponível = 2000 - 800 = 1200** ✅ (descontado imediatamente!)
  
  3. Carregamento:
     - Operador marca 800 blocos como carregados
     - loaded_quantity atualizado para 800
     - Estoque disponível continua 1200 (já estava descontado)
  
  4. Fechamento:
     - Entrega fechada (status='closed')
     - Estoque disponível continua 1200 (já estava descontado)
  
  ### Benefícios
  
  - ✅ Estoque sempre preciso e em tempo real
  - ✅ Produtos reservados no momento da venda
  - ✅ Evita vender o mesmo produto duas vezes
  - ✅ Visibilidade clara do que está disponível vs comprometido
  - ✅ Suporte para entregas parciais
  - ✅ Separa produção "Para Estoque" de produção "Para Ordem"

  ## Mudanças Implementadas
  
  1. View `product_stock_view`:
     - Filtra apenas production_type='stock'
     - Desconta quantity de entregas não canceladas
  
  2. Funções `get_product_stock()` e `get_product_available_stock()`:
     - Atualizadas para usar a nova lógica
  
  3. View adicional `product_stock_detailed_view`:
     - Mostra estoque detalhado com breakdown por status de entrega
     - Útil para análise e debug
*/

-- =====================================================
-- 1. VIEW PRINCIPAL DE ESTOQUE
-- =====================================================

CREATE OR REPLACE VIEW product_stock_view AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.code as product_code,
  
  -- Total produzido APENAS "Para Estoque"
  COALESCE(prod_stock.total_produced_for_stock, 0) as total_produced,
  
  -- Total reservado em entregas ativas (open, in_progress, closed)
  COALESCE(deliv.total_reserved, 0) as total_delivered,
  
  -- Estoque disponível = Produzido Para Estoque - Reservado
  COALESCE(prod_stock.total_produced_for_stock, 0) - COALESCE(deliv.total_reserved, 0) as available_stock
  
FROM products p

-- Produção "Para Estoque" (production_type='stock')
LEFT JOIN (
  SELECT 
    product_id, 
    SUM(quantity) as total_produced_for_stock
  FROM production
  WHERE production_type = 'stock'  -- APENAS produção para estoque!
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = p.id

-- Entregas ativas (reservas)
LEFT JOIN (
  SELECT 
    di.product_id, 
    SUM(di.quantity) as total_reserved
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')  -- Todas as entregas ativas
  GROUP BY di.product_id
) deliv ON deliv.product_id = p.id;

-- =====================================================
-- 2. VIEW DETALHADA DE ESTOQUE (para análise)
-- =====================================================

CREATE OR REPLACE VIEW product_stock_detailed_view AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.code as product_code,
  
  -- Produção
  COALESCE(prod_all.total_produced_all, 0) as total_produced_all,
  COALESCE(prod_stock.total_produced_for_stock, 0) as total_produced_for_stock,
  COALESCE(prod_order.total_produced_for_orders, 0) as total_produced_for_orders,
  
  -- Entregas por status
  COALESCE(deliv_open.total_open, 0) as total_in_open_deliveries,
  COALESCE(deliv_progress.total_in_progress, 0) as total_in_progress_deliveries,
  COALESCE(deliv_closed.total_closed, 0) as total_in_closed_deliveries,
  COALESCE(deliv_cancelled.total_cancelled, 0) as total_in_cancelled_deliveries,
  
  -- Totais
  COALESCE(deliv_active.total_reserved, 0) as total_reserved,
  COALESCE(deliv_closed.total_delivered, 0) as total_delivered_and_closed,
  
  -- Estoque disponível
  COALESCE(prod_stock.total_produced_for_stock, 0) - COALESCE(deliv_active.total_reserved, 0) as available_stock
  
FROM products p

-- Toda produção
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total_produced_all
  FROM production
  GROUP BY product_id
) prod_all ON prod_all.product_id = p.id

-- Produção "Para Estoque"
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total_produced_for_stock
  FROM production
  WHERE production_type = 'stock'
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = p.id

-- Produção "Para Ordem"
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total_produced_for_orders
  FROM production
  WHERE production_type = 'order'
  GROUP BY product_id
) prod_order ON prod_order.product_id = p.id

-- Entregas abertas
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as total_open
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'open'
  GROUP BY di.product_id
) deliv_open ON deliv_open.product_id = p.id

-- Entregas em progresso
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as total_in_progress
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'in_progress'
  GROUP BY di.product_id
) deliv_progress ON deliv_progress.product_id = p.id

-- Entregas fechadas
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as total_closed, SUM(di.loaded_quantity) as total_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
  GROUP BY di.product_id
) deliv_closed ON deliv_closed.product_id = p.id

-- Entregas canceladas
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as total_cancelled
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'cancelled'
  GROUP BY di.product_id
) deliv_cancelled ON deliv_cancelled.product_id = p.id

-- Total reservado (open + in_progress + closed)
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as total_reserved
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')
  GROUP BY di.product_id
) deliv_active ON deliv_active.product_id = p.id;

-- =====================================================
-- 3. ATUALIZAR FUNÇÕES
-- =====================================================

-- Função para obter estoque disponível
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

-- Função para obter estoque (compatibilidade)
DROP FUNCTION IF EXISTS get_product_stock(uuid);
CREATE OR REPLACE FUNCTION get_product_stock(p_product_id uuid)
RETURNS integer AS $$
DECLARE
  v_total_produced integer;
  v_total_reserved integer;
BEGIN
  -- Total produzido "Para Estoque"
  SELECT COALESCE(SUM(quantity), 0)::integer
  INTO v_total_produced
  FROM production
  WHERE product_id = p_product_id
    AND production_type = 'stock';
  
  -- Total reservado em entregas ativas
  SELECT COALESCE(SUM(di.quantity), 0)::integer
  INTO v_total_reserved
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE di.product_id = p_product_id
    AND d.status IN ('open', 'in_progress', 'closed');
  
  RETURN v_total_produced - v_total_reserved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. COMENTÁRIOS EXPLICATIVOS
-- =====================================================

COMMENT ON VIEW product_stock_view IS 
  'Calcula estoque disponível de produtos com reserva imediata.
   
   Lógica:
   - total_produced: Apenas produção "Para Estoque" (production_type=''stock'')
   - total_delivered: Soma de quantity em entregas ativas (open, in_progress, closed)
   - available_stock: Produzido Para Estoque - Reservado
   
   Ao aprovar um orçamento, uma entrega é criada e os produtos são imediatamente
   descontados do estoque disponível, evitando dupla venda.';

COMMENT ON VIEW product_stock_detailed_view IS
  'View detalhada de estoque mostrando breakdown completo de produção e entregas.
   Útil para análise, relatórios e debug do sistema de estoque.';

COMMENT ON FUNCTION get_product_available_stock(uuid) IS
  'Retorna o estoque disponível de um produto (produzido para estoque - reservado).
   Considera apenas production_type=''stock'' e desconta entregas ativas.';

COMMENT ON FUNCTION get_product_stock(uuid) IS
  'Retorna o estoque disponível de um produto (compatibilidade).
   Usa a mesma lógica: produzido para estoque - reservado em entregas ativas.';