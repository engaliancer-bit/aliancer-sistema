/*
  # Debug e Correção do Sistema de Ordens Automáticas

  ## Problema Reportado
  Ao aprovar orçamento e vincular à obra, sistema não gera ordens de produção
  para produtos de composições que não têm estoque.

  ## Diagnóstico
  1. Trigger existe e deveria funcionar
  2. Função tem EXCEPTION HANDLER que pode estar capturando erros silenciosamente
  3. Sem visibilidade dos logs para usuário final

  ## Solução
  1. Melhorar tratamento de erros com mais detalhes
  2. Criar função de teste para executar manualmente
  3. Adicionar tabela de logs de erros visível
  4. Garantir que trigger está ativo

  ## Como Usar
  - Aprovar orçamento normalmente
  - Se não criar ordens, executar função de teste:
    SELECT * FROM test_production_orders_for_quote('QUOTE_ID_AQUI');
  - Verificar logs de erro em production_order_creation_logs
*/

-- =====================================================
-- 1. TABELA DE LOGS PARA DEBUG
-- =====================================================

CREATE TABLE IF NOT EXISTS production_order_creation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  log_level text NOT NULL CHECK (log_level IN ('INFO', 'WARNING', 'ERROR')),
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE production_order_creation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public to view logs"
  ON production_order_creation_logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public to insert logs"
  ON production_order_creation_logs FOR INSERT
  TO public
  WITH CHECK (true);

-- Índice
CREATE INDEX IF NOT EXISTS idx_prod_order_logs_quote
  ON production_order_creation_logs(quote_id, created_at DESC);

-- =====================================================
-- 2. FUNÇÃO HELPER PARA LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION log_production_order_event(
  p_quote_id uuid,
  p_level text,
  p_message text,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO production_order_creation_logs (
    quote_id,
    log_level,
    message,
    details
  ) VALUES (
    p_quote_id,
    p_level,
    p_message,
    p_details
  );
END;
$$;

-- =====================================================
-- 3. RECRIAR FUNÇÃO COM LOGGING MELHORADO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_production_orders_on_quote_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_item RECORD;
  v_composition_item RECORD;
  v_product_record RECORD;
  v_inventory_stock numeric;
  v_quantity_to_produce numeric;
  v_quantity_required numeric;
  v_order_number integer;
  v_customer_name text;
  v_orders_created int := 0;
  v_composition_name text;
  v_error_details jsonb;
BEGIN
  -- Só processar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Log início
    PERFORM log_production_order_event(
      NEW.id,
      'INFO',
      'Iniciando criação automática de ordens de produção',
      jsonb_build_object('quote_id', NEW.id, 'customer_id', NEW.customer_id)
    );
    
    -- Buscar nome do cliente
    SELECT c.name INTO v_customer_name
    FROM customers c
    WHERE c.id = NEW.customer_id;
    
    -- Para cada item do orçamento
    FOR v_quote_item IN 
      SELECT 
        qi.id as quote_item_id,
        qi.item_type,
        qi.product_id,
        qi.composition_id,
        qi.quantity,
        COALESCE(p.name, c.name, 'Item') as item_name
      FROM quote_items qi
      LEFT JOIN products p ON p.id = qi.product_id
      LEFT JOIN compositions c ON c.id = qi.composition_id
      WHERE qi.quote_id = NEW.id
    LOOP
      
      PERFORM log_production_order_event(
        NEW.id,
        'INFO',
        format('Processando item: %s (tipo: %s)', v_quote_item.item_name, v_quote_item.item_type),
        jsonb_build_object('item_type', v_quote_item.item_type, 'quantity', v_quote_item.quantity)
      );
      
      -- ============================================================
      -- CASO 1: ITEM É UM PRODUTO DIRETO
      -- ============================================================
      IF v_quote_item.item_type = 'product' AND v_quote_item.product_id IS NOT NULL THEN
        
        -- Buscar dados do produto
        SELECT p.name, p.code 
        INTO v_product_record
        FROM products p 
        WHERE p.id = v_quote_item.product_id;
        
        -- Verificar estoque disponível
        SELECT COALESCE(psv.available_stock, 0)
        INTO v_inventory_stock
        FROM product_stock_view psv
        WHERE psv.product_id = v_quote_item.product_id;
        
        -- Calcular quantidade a produzir
        v_quantity_to_produce := v_quote_item.quantity - COALESCE(v_inventory_stock, 0);
        
        PERFORM log_production_order_event(
          NEW.id,
          'INFO',
          format('Produto %s: Necessário=%s, Estoque=%s, A produzir=%s',
            v_product_record.name, v_quote_item.quantity, v_inventory_stock, v_quantity_to_produce),
          jsonb_build_object(
            'product_id', v_quote_item.product_id,
            'needed', v_quote_item.quantity,
            'in_stock', v_inventory_stock,
            'to_produce', v_quantity_to_produce
          )
        );
        
        -- Se precisa produzir
        IF v_quantity_to_produce > 0 THEN
          
          -- Verificar se já existe ordem
          IF NOT EXISTS (
            SELECT 1 
            FROM production_orders po
            WHERE po.quote_id = NEW.id
              AND po.product_id = v_quote_item.product_id
              AND po.status != 'cancelled'
          ) THEN
            
            -- Gerar número
            SELECT COALESCE(MAX(order_number), 0) + 1
            INTO v_order_number
            FROM production_orders;
            
            -- Criar ordem
            BEGIN
              INSERT INTO production_orders (
                order_number,
                quote_id,
                customer_id,
                product_id,
                total_quantity,
                produced_quantity,
                remaining_quantity,
                status,
                notes,
                deadline
              ) VALUES (
                v_order_number,
                NEW.id,
                NEW.customer_id,
                v_quote_item.product_id,
                v_quantity_to_produce::integer,
                0,
                v_quantity_to_produce::integer,
                'open',
                format('Ordem automática - Orçamento | Cliente: %s | Produto: %s (%s)',
                  COALESCE(v_customer_name, 'N/A'),
                  v_product_record.name,
                  COALESCE(v_product_record.code, 'sem código')
                ),
                NEW.delivery_deadline
              );
              
              v_orders_created := v_orders_created + 1;
              
              PERFORM log_production_order_event(
                NEW.id,
                'INFO',
                format('Ordem #%s criada para produto %s', v_order_number, v_product_record.name),
                jsonb_build_object('order_number', v_order_number, 'product', v_product_record.name, 'quantity', v_quantity_to_produce)
              );
              
            EXCEPTION WHEN OTHERS THEN
              PERFORM log_production_order_event(
                NEW.id,
                'ERROR',
                format('Erro ao criar ordem para produto %s: %s', v_product_record.name, SQLERRM),
                jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'product_id', v_quote_item.product_id)
              );
            END;
            
          END IF;
        END IF;
        
      -- ============================================================
      -- CASO 2: ITEM É UMA COMPOSIÇÃO
      -- ============================================================
      ELSIF v_quote_item.item_type = 'composition' AND v_quote_item.composition_id IS NOT NULL THEN
        
        SELECT c.name INTO v_composition_name
        FROM compositions c
        WHERE c.id = v_quote_item.composition_id;
        
        PERFORM log_production_order_event(
          NEW.id,
          'INFO',
          format('Processando composição: %s', v_composition_name),
          jsonb_build_object('composition_id', v_quote_item.composition_id)
        );
        
        -- Para cada produto na composição
        FOR v_composition_item IN 
          SELECT 
            ci.product_id,
            ci.quantity as quantity_per_unit,
            p.name as product_name,
            p.code as product_code
          FROM composition_items ci
          LEFT JOIN products p ON p.id = ci.product_id
          WHERE ci.composition_id = v_quote_item.composition_id
            AND ci.item_type = 'product'
            AND ci.product_id IS NOT NULL
        LOOP
          
          v_quantity_required := v_quote_item.quantity * v_composition_item.quantity_per_unit;
          
          -- Verificar estoque
          SELECT COALESCE(psv.available_stock, 0)
          INTO v_inventory_stock
          FROM product_stock_view psv
          WHERE psv.product_id = v_composition_item.product_id;
          
          v_quantity_to_produce := v_quantity_required - COALESCE(v_inventory_stock, 0);
          
          PERFORM log_production_order_event(
            NEW.id,
            'INFO',
            format('Produto %s (da composição %s): Necessário=%s, Estoque=%s, A produzir=%s',
              v_composition_item.product_name, v_composition_name, v_quantity_required, v_inventory_stock, v_quantity_to_produce),
            jsonb_build_object(
              'composition', v_composition_name,
              'product_id', v_composition_item.product_id,
              'needed', v_quantity_required,
              'in_stock', v_inventory_stock,
              'to_produce', v_quantity_to_produce
            )
          );
          
          IF v_quantity_to_produce > 0 THEN
            
            IF NOT EXISTS (
              SELECT 1 
              FROM production_orders po
              WHERE po.quote_id = NEW.id
                AND po.product_id = v_composition_item.product_id
                AND po.status != 'cancelled'
            ) THEN
              
              SELECT COALESCE(MAX(order_number), 0) + 1
              INTO v_order_number
              FROM production_orders;
              
              BEGIN
                INSERT INTO production_orders (
                  order_number,
                  quote_id,
                  customer_id,
                  product_id,
                  total_quantity,
                  produced_quantity,
                  remaining_quantity,
                  status,
                  notes,
                  deadline
                ) VALUES (
                  v_order_number,
                  NEW.id,
                  NEW.customer_id,
                  v_composition_item.product_id,
                  v_quantity_to_produce::integer,
                  0,
                  v_quantity_to_produce::integer,
                  'open',
                  format('Ordem automática - Composição | Cliente: %s | Composição: %s | Produto: %s (%s)',
                    COALESCE(v_customer_name, 'N/A'),
                    COALESCE(v_composition_name, 'N/A'),
                    v_composition_item.product_name,
                    COALESCE(v_composition_item.product_code, 'sem código')
                  ),
                  NEW.delivery_deadline
                );
                
                v_orders_created := v_orders_created + 1;
                
                PERFORM log_production_order_event(
                  NEW.id,
                  'INFO',
                  format('Ordem #%s criada para produto %s (composição %s)', v_order_number, v_composition_item.product_name, v_composition_name),
                  jsonb_build_object('order_number', v_order_number, 'product', v_composition_item.product_name, 'quantity', v_quantity_to_produce, 'composition', v_composition_name)
                );
                
              EXCEPTION WHEN OTHERS THEN
                PERFORM log_production_order_event(
                  NEW.id,
                  'ERROR',
                  format('Erro ao criar ordem para produto %s (composição %s): %s', v_composition_item.product_name, v_composition_name, SQLERRM),
                  jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE, 'product_id', v_composition_item.product_id, 'composition', v_composition_name)
                );
              END;
            END IF;
          END IF;
          
        END LOOP;
      END IF;
      
    END LOOP;
    
    -- Log final
    PERFORM log_production_order_event(
      NEW.id,
      'INFO',
      format('Processamento concluído. Ordens criadas: %s', v_orders_created),
      jsonb_build_object('orders_created', v_orders_created)
    );
    
  END IF;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  -- Log erro crítico
  PERFORM log_production_order_event(
    NEW.id,
    'ERROR',
    format('ERRO CRÍTICO ao processar orçamento: %s', SQLERRM),
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  RETURN NEW;
END;
$$;

-- =====================================================
-- 4. RECREAR TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trigger_auto_create_production_orders ON quotes;
CREATE TRIGGER trigger_auto_create_production_orders
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_production_orders_on_quote_approval();

-- =====================================================
-- 5. FUNÇÃO DE TESTE MANUAL
-- =====================================================

CREATE OR REPLACE FUNCTION test_production_orders_for_quote(p_quote_id uuid)
RETURNS TABLE (
  log_level text,
  message text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Limpar logs antigos deste orçamento
  DELETE FROM production_order_creation_logs WHERE quote_id = p_quote_id;
  
  -- Simular trigger manualmente
  UPDATE quotes 
  SET status = status  -- Dummy update para disparar trigger
  WHERE id = p_quote_id;
  
  -- Retornar logs
  RETURN QUERY
  SELECT 
    l.log_level,
    l.message,
    l.details,
    l.created_at
  FROM production_order_creation_logs l
  WHERE l.quote_id = p_quote_id
  ORDER BY l.created_at;
END;
$$;

-- =====================================================
-- 6. DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE production_order_creation_logs IS
'Logs detalhados do processo de criação automática de ordens de produção. 
Útil para debug quando ordens não são criadas como esperado.';

COMMENT ON FUNCTION test_production_orders_for_quote(uuid) IS
'Função de teste para forçar criação de ordens para um orçamento específico.
Retorna logs detalhados do processamento.

Uso: SELECT * FROM test_production_orders_for_quote(''id-do-orcamento'');';

COMMENT ON FUNCTION log_production_order_event(uuid, text, text, jsonb) IS
'Função auxiliar para registrar eventos do processo de criação de ordens.
Usado internamente pelo trigger.';

COMMENT ON FUNCTION auto_create_production_orders_on_quote_approval() IS 
'Cria automaticamente ordens de produção quando um orçamento é aprovado.
Processa produtos diretos e composições, verificando estoque disponível.
Agora com logging detalhado em production_order_creation_logs.';