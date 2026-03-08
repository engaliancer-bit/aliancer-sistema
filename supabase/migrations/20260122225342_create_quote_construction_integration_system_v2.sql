/*
  # Sistema de Integração Orçamento-Obra com Composições e Gestão de Estoque
  
  1. Nova Tabela
    - `construction_quote_items` - Rastreamento detalhado dos itens de composição vinculados à obra
      - `id` (uuid, primary key)
      - `construction_project_id` (uuid, referência a construction_projects)
      - `quote_id` (uuid, referência a quotes ou ribbed_slab_quotes)
      - `quote_type` (text, 'quote' ou 'ribbed_slab')
      - `quote_item_id` (uuid)
      - `composition_id` (uuid, referência a compositions)
      - `product_id` (uuid, referência a products)
      - `quantity_required` (decimal, quantidade necessária)
      - `quantity_in_stock` (decimal, quantidade disponível em estoque)
      - `quantity_to_produce` (decimal, quantidade que precisa ser produzida)
      - `status` (text, status do item)
      - `production_order_id` (uuid, referência a production_orders)
      - `delivery_id` (uuid, referência a deliveries)
      - `notes` (text, observações)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Funções
    - `get_product_stock()` - Calcula estoque disponível de um produto
    - `check_composition_stock()` - Verifica estoque dos produtos da composição
    - `process_quote_approval_for_construction()` - Processa aprovação automaticamente
    - `update_construction_item_status()` - Atualiza status conforme produção avança
  
  3. Triggers
    - Trigger para atualizar status quando produção é concluída
  
  4. Segurança
    - Habilitar RLS e políticas de acesso
*/

-- Criar tabela de itens da obra vinculados ao orçamento
CREATE TABLE IF NOT EXISTS construction_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construction_project_id uuid REFERENCES construction_projects(id) ON DELETE CASCADE,
  quote_id uuid,
  quote_type text CHECK (quote_type IN ('quote', 'ribbed_slab')),
  quote_item_id uuid,
  composition_id uuid REFERENCES compositions(id),
  product_id uuid REFERENCES products(id),
  quantity_required decimal(10,2) NOT NULL DEFAULT 0,
  quantity_in_stock decimal(10,2) NOT NULL DEFAULT 0,
  quantity_to_produce decimal(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_stock_check' CHECK (status IN (
    'pending_stock_check', 
    'available_for_delivery', 
    'in_production', 
    'partially_available',
    'delivered'
  )),
  production_order_id uuid REFERENCES production_orders(id),
  delivery_id uuid REFERENCES deliveries(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_construction_quote_items_project 
  ON construction_quote_items(construction_project_id);
CREATE INDEX IF NOT EXISTS idx_construction_quote_items_quote 
  ON construction_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_construction_quote_items_status 
  ON construction_quote_items(status);
CREATE INDEX IF NOT EXISTS idx_construction_quote_items_product 
  ON construction_quote_items(product_id);

-- Função para calcular estoque disponível de um produto
CREATE OR REPLACE FUNCTION get_product_stock(product_id_param uuid)
RETURNS decimal AS $$
DECLARE
  v_produced decimal;
  v_delivered decimal;
  v_stock decimal;
BEGIN
  -- Total produzido
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_produced
  FROM production
  WHERE product_id = product_id_param;
  
  -- Total entregue
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_delivered
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE di.product_id = product_id_param
  AND d.status IN ('completed', 'in_progress');
  
  -- Estoque = Produzido - Entregue
  v_stock := v_produced - v_delivered;
  
  RETURN GREATEST(v_stock, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para verificar estoque de uma composição
CREATE OR REPLACE FUNCTION check_composition_stock(
  composition_id_param uuid, 
  quantity_multiplier decimal
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  quantity_required decimal,
  quantity_in_stock decimal,
  quantity_to_produce decimal,
  has_sufficient_stock boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.product_id,
    p.name as product_name,
    (cp.quantity * quantity_multiplier) as quantity_required,
    get_product_stock(cp.product_id) as quantity_in_stock,
    GREATEST(
      (cp.quantity * quantity_multiplier) - get_product_stock(cp.product_id),
      0
    ) as quantity_to_produce,
    get_product_stock(cp.product_id) >= (cp.quantity * quantity_multiplier) as has_sufficient_stock
  FROM composition_products cp
  JOIN products p ON p.id = cp.product_id
  WHERE cp.composition_id = composition_id_param;
END;
$$ LANGUAGE plpgsql;

-- Função para processar aprovação de orçamento vinculado a obra
CREATE OR REPLACE FUNCTION process_quote_approval_for_construction(
  quote_id_param uuid,
  quote_type_param text,
  construction_project_id_param uuid
)
RETURNS jsonb AS $$
DECLARE
  v_quote_item RECORD;
  v_stock_info RECORD;
  v_production_order_id uuid;
  v_order_number text;
  v_next_number int;
  v_result jsonb;
  v_items_created int := 0;
  v_orders_created int := 0;
  v_total_items int := 0;
  v_construction_item_id uuid;
BEGIN
  RAISE NOTICE 'Processando orçamento % do tipo % para obra %', 
    quote_id_param, quote_type_param, construction_project_id_param;
  
  -- Processar itens do orçamento baseado no tipo
  IF quote_type_param = 'quote' THEN
    -- Processar quote_items
    FOR v_quote_item IN 
      SELECT qi.id, qi.composition_id, qi.quantity
      FROM quote_items qi
      WHERE qi.quote_id = quote_id_param
      AND qi.composition_id IS NOT NULL
    LOOP
      v_total_items := v_total_items + 1;
      
      -- Para cada produto na composição
      FOR v_stock_info IN 
        SELECT * FROM check_composition_stock(
          v_quote_item.composition_id, 
          v_quote_item.quantity
        )
      LOOP
        -- Criar registro de item da obra
        INSERT INTO construction_quote_items (
          construction_project_id,
          quote_id,
          quote_type,
          quote_item_id,
          composition_id,
          product_id,
          quantity_required,
          quantity_in_stock,
          quantity_to_produce,
          status,
          notes
        ) VALUES (
          construction_project_id_param,
          quote_id_param,
          quote_type_param,
          v_quote_item.id,
          v_quote_item.composition_id,
          v_stock_info.product_id,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce,
          CASE 
            WHEN v_stock_info.has_sufficient_stock THEN 'available_for_delivery'
            WHEN v_stock_info.quantity_in_stock > 0 THEN 'partially_available'
            ELSE 'in_production'
          END,
          CASE
            WHEN v_stock_info.has_sufficient_stock THEN 
              format('✅ Estoque disponível: %.0f unidades', v_stock_info.quantity_in_stock)
            WHEN v_stock_info.quantity_in_stock > 0 THEN
              format('⚠️ Estoque parcial: %.0f de %.0f unidades. Faltam %.0f', 
                v_stock_info.quantity_in_stock, 
                v_stock_info.quantity_required,
                v_stock_info.quantity_to_produce)
            ELSE
              format('🏭 Aguardando produção: %.0f unidades', v_stock_info.quantity_to_produce)
          END
        ) RETURNING id INTO v_construction_item_id;
        
        v_items_created := v_items_created + 1;
        
        -- Se precisa produzir, criar ordem de produção
        IF v_stock_info.quantity_to_produce > 0 THEN
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';
          
          v_order_number := 'OP-' || v_next_number;
          
          INSERT INTO production_orders (
            order_number,
            product_id,
            quantity,
            priority,
            status,
            notes
          ) VALUES (
            v_order_number,
            v_stock_info.product_id,
            v_stock_info.quantity_to_produce,
            'high',
            'open',
            format('🏗️ Ordem para obra - Produto: %s | Orçamento aprovado', 
              v_stock_info.product_name)
          ) RETURNING id INTO v_production_order_id;
          
          -- Vincular ordem ao item da obra
          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;
          
          v_orders_created := v_orders_created + 1;
          
          RAISE NOTICE 'Ordem % criada: % x %.0f un', 
            v_order_number, v_stock_info.product_name, v_stock_info.quantity_to_produce;
        END IF;
      END LOOP;
    END LOOP;
    
  ELSIF quote_type_param = 'ribbed_slab' THEN
    -- Processar ribbed_slab_rooms
    FOR v_quote_item IN 
      SELECT 
        rsr.id, 
        rsr.composition_id,
        CEIL(rsr.area / NULLIF(c.coverage_area_m2, 0)) as quantity
      FROM ribbed_slab_rooms rsr
      JOIN ribbed_slab_floors rsf ON rsf.id = rsr.floor_id
      JOIN compositions c ON c.id = rsr.composition_id
      WHERE rsf.quote_id = quote_id_param
      AND rsr.composition_id IS NOT NULL
      AND c.coverage_area_m2 > 0
    LOOP
      v_total_items := v_total_items + 1;
      
      -- Para cada produto na composição
      FOR v_stock_info IN 
        SELECT * FROM check_composition_stock(
          v_quote_item.composition_id, 
          v_quote_item.quantity
        )
      LOOP
        INSERT INTO construction_quote_items (
          construction_project_id,
          quote_id,
          quote_type,
          quote_item_id,
          composition_id,
          product_id,
          quantity_required,
          quantity_in_stock,
          quantity_to_produce,
          status,
          notes
        ) VALUES (
          construction_project_id_param,
          quote_id_param,
          quote_type_param,
          v_quote_item.id,
          v_quote_item.composition_id,
          v_stock_info.product_id,
          v_stock_info.quantity_required,
          v_stock_info.quantity_in_stock,
          v_stock_info.quantity_to_produce,
          CASE 
            WHEN v_stock_info.has_sufficient_stock THEN 'available_for_delivery'
            WHEN v_stock_info.quantity_in_stock > 0 THEN 'partially_available'
            ELSE 'in_production'
          END,
          CASE
            WHEN v_stock_info.has_sufficient_stock THEN 
              format('✅ Estoque disponível: %.0f unidades', v_stock_info.quantity_in_stock)
            WHEN v_stock_info.quantity_in_stock > 0 THEN
              format('⚠️ Estoque parcial: %.0f de %.0f un. Faltam %.0f', 
                v_stock_info.quantity_in_stock, 
                v_stock_info.quantity_required,
                v_stock_info.quantity_to_produce)
            ELSE
              format('🏭 Aguardando produção: %.0f unidades', v_stock_info.quantity_to_produce)
          END
        ) RETURNING id INTO v_construction_item_id;
        
        v_items_created := v_items_created + 1;
        
        IF v_stock_info.quantity_to_produce > 0 THEN
          SELECT COALESCE(
            MAX(CAST(SUBSTRING(order_number FROM '[0-9]+') AS INTEGER)), 0
          ) + 1
          INTO v_next_number
          FROM production_orders
          WHERE order_number ~ '^OP-[0-9]+$';
          
          v_order_number := 'OP-' || v_next_number;
          
          INSERT INTO production_orders (
            order_number,
            product_id,
            quantity,
            priority,
            status,
            notes
          ) VALUES (
            v_order_number,
            v_stock_info.product_id,
            v_stock_info.quantity_to_produce,
            'high',
            'open',
            format('🏗️ Laje treliçada - Produto: %s', v_stock_info.product_name)
          ) RETURNING id INTO v_production_order_id;
          
          UPDATE construction_quote_items
          SET production_order_id = v_production_order_id
          WHERE id = v_construction_item_id;
          
          v_orders_created := v_orders_created + 1;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'total_composition_items', v_total_items,
    'construction_items_created', v_items_created,
    'production_orders_created', v_orders_created,
    'message', format(
      '✅ %s composições analisadas | %s produtos registrados | %s ordens de produção criadas',
      v_total_items, v_items_created, v_orders_created
    )
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar status quando produção é concluída
CREATE OR REPLACE FUNCTION update_construction_item_on_production()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar items da obra que aguardam esse produto
  UPDATE construction_quote_items cqi
  SET 
    quantity_in_stock = get_product_stock(NEW.product_id),
    quantity_to_produce = GREATEST(
      quantity_required - get_product_stock(NEW.product_id),
      0
    ),
    status = CASE
      WHEN get_product_stock(NEW.product_id) >= quantity_required 
        THEN 'available_for_delivery'
      WHEN get_product_stock(NEW.product_id) > 0 
        THEN 'partially_available'
      ELSE status
    END,
    notes = CASE
      WHEN get_product_stock(NEW.product_id) >= quantity_required THEN
        format('✅ Estoque disponível: %.0f unidades', get_product_stock(NEW.product_id))
      WHEN get_product_stock(NEW.product_id) > 0 THEN
        format('⚠️ Estoque parcial: %.0f de %.0f un. Faltam %.0f', 
          get_product_stock(NEW.product_id),
          quantity_required,
          quantity_required - get_product_stock(NEW.product_id))
      ELSE notes
    END,
    updated_at = now()
  WHERE product_id = NEW.product_id
  AND status IN ('in_production', 'partially_available', 'pending_stock_check');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_construction_item_on_production ON production;
CREATE TRIGGER trigger_update_construction_item_on_production
  AFTER INSERT ON production
  FOR EACH ROW
  EXECUTE FUNCTION update_construction_item_on_production();

-- Habilitar RLS
ALTER TABLE construction_quote_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir acesso total a construction_quote_items"
  ON construction_quote_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
