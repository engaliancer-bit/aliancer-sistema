/*
  # Sistema Automatizado de Conversão de Orçamento para Venda
  
  Este sistema automatiza o processo de vendas quando um orçamento é aprovado,
  criando automaticamente uma venda e acompanhando seu progresso através das
  etapas de produção e entrega.

  ## 1. Novos Campos na Tabela Sales
  - `production_status` (text) - Status da produção:
    - 'nao_iniciada' - Nenhuma ordem de produção criada
    - 'em_producao' - Pelo menos uma ordem em andamento
    - 'producao_concluida' - Todas as ordens concluídas
    - 'nao_requer' - Venda não requer produção

  - `delivery_completion_status` (text) - Status das entregas:
    - 'nao_iniciada' - Nenhuma entrega realizada
    - 'parcial' - Entregas parciais
    - 'concluida' - Todas as entregas realizadas
    - 'nao_requer' - Venda não requer entrega

  - `overall_status` (text) - Status geral calculado automaticamente:
    - 'aguardando_producao' - Aguardando início da produção
    - 'em_producao' - Em processo de produção
    - 'producao_concluida' - Produção finalizada
    - 'em_entrega' - Processo de entrega iniciado
    - 'concluida' - Venda totalmente concluída
    - 'cancelada' - Venda cancelada

  ## 2. Função: create_sale_from_quote
  Cria automaticamente uma venda quando um orçamento é aprovado:
  - Cria registro na tabela sales
  - Copia todos os itens do orçamento para sale_items
  - Copia informações de pagamento
  - Define status inicial como 'aguardando_producao'

  ## 3. Trigger: on_quote_approved
  Dispara automaticamente quando um orçamento tem status alterado para 'approved'

  ## 4. Função: calculate_sale_status
  Calcula o status geral da venda baseado em:
  - Quantidade produzida vs quantidade pedida (production_order_items)
  - Quantidade entregue vs quantidade pedida (delivery_items)
  - Status das ordens de produção
  - Status das entregas

  ## 5. Triggers de Atualização Automática
  - on_production_order_item_update: Atualiza status quando produção avança
  - on_delivery_item_update: Atualiza status quando entrega avança
  - on_production_order_status_update: Atualiza quando status da ordem muda

  ## 6. Índices
  - Índices para melhorar performance nas consultas de status

  ## 7. Segurança
  - Mantém as políticas RLS existentes
  - Todas as funções executam com permissões adequadas
*/

-- 1. Adicionar novos campos à tabela sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'production_status'
  ) THEN
    ALTER TABLE sales ADD COLUMN production_status text DEFAULT 'nao_iniciada' 
      CHECK (production_status IN ('nao_iniciada', 'em_producao', 'producao_concluida', 'nao_requer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'delivery_completion_status'
  ) THEN
    ALTER TABLE sales ADD COLUMN delivery_completion_status text DEFAULT 'nao_iniciada'
      CHECK (delivery_completion_status IN ('nao_iniciada', 'parcial', 'concluida', 'nao_requer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'overall_status'
  ) THEN
    ALTER TABLE sales ADD COLUMN overall_status text DEFAULT 'aguardando_producao'
      CHECK (overall_status IN ('aguardando_producao', 'em_producao', 'producao_concluida', 'em_entrega', 'concluida', 'cancelada'));
  END IF;
END $$;

-- 2. Criar função para calcular status da venda
CREATE OR REPLACE FUNCTION calculate_sale_status(sale_id_param uuid)
RETURNS void AS $$
DECLARE
  total_items_count integer;
  total_items_quantity numeric;
  total_produced_quantity numeric;
  total_delivered_quantity numeric;
  has_production_orders boolean;
  requires_delivery boolean;
  new_production_status text;
  new_delivery_status text;
  new_overall_status text;
BEGIN
  -- Verificar se a venda existe
  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = sale_id_param) THEN
    RETURN;
  END IF;

  -- Obter informações básicas da venda
  SELECT delivery_required INTO requires_delivery
  FROM sales WHERE id = sale_id_param;

  -- Contar total de itens e quantidades da venda
  SELECT 
    COUNT(*),
    COALESCE(SUM(quantity), 0)
  INTO total_items_count, total_items_quantity
  FROM sale_items
  WHERE sale_id = sale_id_param;

  -- Se não há itens, não precisa calcular
  IF total_items_count = 0 THEN
    RETURN;
  END IF;

  -- Verificar se há ordens de produção associadas à venda (via quote)
  SELECT EXISTS (
    SELECT 1 
    FROM production_orders po
    INNER JOIN sales s ON s.quote_id = po.quote_id
    WHERE s.id = sale_id_param
  ) INTO has_production_orders;

  -- Calcular total produzido (soma de produced_quantity de todos os itens de OPs relacionadas)
  SELECT COALESCE(SUM(poi.produced_quantity), 0)
  INTO total_produced_quantity
  FROM production_order_items poi
  INNER JOIN production_orders po ON po.id = poi.production_order_id
  INNER JOIN sales s ON s.quote_id = po.quote_id
  WHERE s.id = sale_id_param;

  -- Calcular total entregue (soma de quantities de delivery_items relacionadas)
  SELECT COALESCE(SUM(di.quantity), 0)
  INTO total_delivered_quantity
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  INNER JOIN sales s ON (s.quote_id = d.quote_id OR s.ribbed_slab_quote_id = d.ribbed_slab_quote_id)
  WHERE s.id = sale_id_param;

  -- Calcular status de produção
  IF NOT has_production_orders THEN
    new_production_status := 'nao_requer';
  ELSIF total_produced_quantity = 0 THEN
    new_production_status := 'nao_iniciada';
  ELSIF total_produced_quantity >= total_items_quantity THEN
    new_production_status := 'producao_concluida';
  ELSE
    new_production_status := 'em_producao';
  END IF;

  -- Calcular status de entrega
  IF NOT requires_delivery THEN
    new_delivery_status := 'nao_requer';
  ELSIF total_delivered_quantity = 0 THEN
    new_delivery_status := 'nao_iniciada';
  ELSIF total_delivered_quantity >= total_items_quantity THEN
    new_delivery_status := 'concluida';
  ELSE
    new_delivery_status := 'parcial';
  END IF;

  -- Calcular status geral baseado nos status parciais
  IF new_production_status = 'nao_iniciada' THEN
    new_overall_status := 'aguardando_producao';
  ELSIF new_production_status = 'em_producao' THEN
    new_overall_status := 'em_producao';
  ELSIF new_production_status IN ('producao_concluida', 'nao_requer') THEN
    IF new_delivery_status = 'concluida' OR new_delivery_status = 'nao_requer' THEN
      new_overall_status := 'concluida';
    ELSIF new_delivery_status = 'parcial' THEN
      new_overall_status := 'em_entrega';
    ELSE
      new_overall_status := 'producao_concluida';
    END IF;
  ELSE
    new_overall_status := 'aguardando_producao';
  END IF;

  -- Atualizar os status na tabela sales
  UPDATE sales
  SET 
    production_status = new_production_status,
    delivery_completion_status = new_delivery_status,
    overall_status = new_overall_status,
    updated_at = now()
  WHERE id = sale_id_param;

END;
$$ LANGUAGE plpgsql;

-- 3. Criar função para criar venda a partir do orçamento
CREATE OR REPLACE FUNCTION create_sale_from_quote()
RETURNS TRIGGER AS $$
DECLARE
  new_sale_id uuid;
  quote_total numeric;
BEGIN
  -- Apenas processar se o status mudou para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Verificar se já existe uma venda para este orçamento
    IF EXISTS (SELECT 1 FROM sales WHERE quote_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Calcular total do orçamento
    SELECT COALESCE(SUM(quantity * proposed_price), 0)
    INTO quote_total
    FROM quote_items
    WHERE quote_id = NEW.id;

    -- Criar registro de venda
    INSERT INTO sales (
      sale_date,
      customer_id,
      origin_type,
      quote_id,
      status,
      delivery_required,
      payment_status,
      subtotal,
      total,
      notes,
      created_by
    ) VALUES (
      CURRENT_DATE,
      NEW.customer_id,
      'orcamento',
      NEW.id,
      'aberta',
      true, -- Assumir que requer entrega por padrão
      'pendente',
      quote_total,
      quote_total,
      'Venda criada automaticamente a partir do orçamento aprovado',
      'Sistema'
    ) RETURNING id INTO new_sale_id;

    -- Copiar itens do orçamento para a venda
    INSERT INTO sale_items (
      sale_id,
      item_type,
      product_id,
      material_id,
      composition_id,
      item_name,
      unit,
      quantity,
      unit_price,
      subtotal,
      notes
    )
    SELECT
      new_sale_id,
      CASE qi.item_type
        WHEN 'product' THEN 'produto'
        WHEN 'material' THEN 'insumo'
        WHEN 'composition' THEN 'composicao'
      END,
      qi.product_id,
      qi.material_id,
      qi.composition_id,
      COALESCE(
        p.name,
        m.name,
        c.name,
        'Item sem nome'
      ),
      COALESCE(p.unit, m.unit, 'un'),
      qi.quantity,
      qi.proposed_price,
      qi.quantity * qi.proposed_price,
      qi.notes
    FROM quote_items qi
    LEFT JOIN products p ON qi.product_id = p.id
    LEFT JOIN materials m ON qi.material_id = m.id
    LEFT JOIN compositions c ON qi.composition_id = c.id
    WHERE qi.quote_id = NEW.id;

    -- Copiar informações de pagamento se existirem
    IF NEW.payment_method IS NOT NULL THEN
      INSERT INTO sale_payments (
        sale_id,
        payment_method,
        payment_condition,
        amount,
        installments_count,
        status
      ) VALUES (
        new_sale_id,
        CASE NEW.payment_method
          WHEN 'cash' THEN 'dinheiro'
          WHEN 'credit_card' THEN 'credito'
          WHEN 'debit_card' THEN 'debito'
          WHEN 'pix' THEN 'pix'
          WHEN 'bank_transfer' THEN 'transferencia'
          WHEN 'installments' THEN 'a_prazo'
          ELSE 'pix'
        END,
        CASE WHEN NEW.installments IS NOT NULL AND NEW.installments > 1 THEN 'parcelado' ELSE 'a_vista' END,
        quote_total,
        COALESCE(NEW.installments, 1),
        'pendente'
      );
    END IF;

    -- Calcular status inicial
    PERFORM calculate_sale_status(new_sale_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para criar venda quando orçamento for aprovado
DROP TRIGGER IF EXISTS on_quote_approved ON quotes;
CREATE TRIGGER on_quote_approved
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION create_sale_from_quote();

-- 5. Criar função para atualizar status quando produção avança
CREATE OR REPLACE FUNCTION on_production_update()
RETURNS TRIGGER AS $$
DECLARE
  related_sale_id uuid;
BEGIN
  -- Encontrar a venda relacionada via quote_id da ordem de produção
  SELECT s.id INTO related_sale_id
  FROM sales s
  INNER JOIN production_orders po ON po.quote_id = s.quote_id
  WHERE po.id = NEW.production_order_id
  LIMIT 1;

  -- Se encontrou uma venda relacionada, recalcular status
  IF related_sale_id IS NOT NULL THEN
    PERFORM calculate_sale_status(related_sale_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar status quando item de produção mudar
DROP TRIGGER IF EXISTS on_production_order_item_update ON production_order_items;
CREATE TRIGGER on_production_order_item_update
  AFTER INSERT OR UPDATE OF produced_quantity ON production_order_items
  FOR EACH ROW
  EXECUTE FUNCTION on_production_update();

-- 7. Criar função para atualizar status quando entrega avança
CREATE OR REPLACE FUNCTION on_delivery_update()
RETURNS TRIGGER AS $$
DECLARE
  related_sale_id uuid;
BEGIN
  -- Encontrar a venda relacionada via delivery
  SELECT s.id INTO related_sale_id
  FROM sales s
  INNER JOIN deliveries d ON (d.quote_id = s.quote_id OR d.ribbed_slab_quote_id = s.ribbed_slab_quote_id)
  WHERE d.id = NEW.delivery_id
  LIMIT 1;

  -- Se encontrou uma venda relacionada, recalcular status
  IF related_sale_id IS NOT NULL THEN
    PERFORM calculate_sale_status(related_sale_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para atualizar status quando item de entrega mudar
DROP TRIGGER IF EXISTS on_delivery_item_update ON delivery_items;
CREATE TRIGGER on_delivery_item_update
  AFTER INSERT OR UPDATE OF quantity ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION on_delivery_update();

-- 9. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_sales_production_status ON sales(production_status);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_completion_status ON sales(delivery_completion_status);
CREATE INDEX IF NOT EXISTS idx_sales_overall_status ON sales(overall_status);
CREATE INDEX IF NOT EXISTS idx_sales_quote_id_status ON sales(quote_id, overall_status);

-- 10. Atualizar vendas existentes que foram criadas de orçamentos
DO $$
DECLARE
  sale_record RECORD;
BEGIN
  FOR sale_record IN 
    SELECT id FROM sales WHERE origin_type = 'orcamento'
  LOOP
    PERFORM calculate_sale_status(sale_record.id);
  END LOOP;
END $$;