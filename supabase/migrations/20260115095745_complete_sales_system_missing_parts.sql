/*
  # Completar Sistema de Vendas - Partes Faltantes

  1. Criar tabelas faltantes
    - `services` - Cadastro de serviços vendáveis
    - `sale_deliveries` - Controle de entregas

  2. Adicionar coluna sale_id em cash_flow

  3. Criar triggers e funções
*/

-- 1. Criar tabela de serviços (se não existir)
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  unit text DEFAULT 'serviço',
  default_price numeric(15,2) DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on services" ON services;
CREATE POLICY "Allow all operations on services"
  ON services FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Criar tabela de entregas (se não existir)
CREATE TABLE IF NOT EXISTS sale_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  delivered boolean DEFAULT false,
  delivery_date date,
  responsible_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  delivery_location text DEFAULT '',
  delivery_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sale_id)
);

ALTER TABLE sale_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on sale_deliveries" ON sale_deliveries;
CREATE POLICY "Allow all operations on sale_deliveries"
  ON sale_deliveries FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Adicionar coluna sale_id à tabela cash_flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cash_flow' AND column_name = 'sale_id'
  ) THEN
    ALTER TABLE cash_flow ADD COLUMN sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;
    CREATE INDEX idx_cash_flow_sale ON cash_flow(sale_id);
  END IF;
END $$;

-- 4. Função para gerar número sequencial de venda
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  year_str text;
  sale_number text;
BEGIN
  year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(sale_number FROM 'VND-' || year_str || '-(\d+)') AS integer
    )
  ), 0) + 1
  INTO next_number
  FROM sales
  WHERE sale_number LIKE 'VND-' || year_str || '-%';
  
  sale_number := 'VND-' || year_str || '-' || LPAD(next_number::text, 6, '0');
  
  RETURN sale_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para gerar número da venda
CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_sale_number ON sales;
CREATE TRIGGER trigger_set_sale_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();

-- 6. Trigger para atualizar totais da venda
CREATE OR REPLACE FUNCTION update_sale_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales
  SET 
    gross_total = (
      SELECT COALESCE(SUM(quantity * unit_price), 0)
      FROM sale_items
      WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
    ),
    discount_total = (
      SELECT COALESCE(SUM(discount_amount), 0)
      FROM sale_items
      WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
    ),
    net_total = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM sale_items
      WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sale_totals_insert ON sale_items;
CREATE TRIGGER trigger_update_sale_totals_insert
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_totals();

DROP TRIGGER IF EXISTS trigger_update_sale_totals_update ON sale_items;
CREATE TRIGGER trigger_update_sale_totals_update
  AFTER UPDATE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_totals();

DROP TRIGGER IF EXISTS trigger_update_sale_totals_delete ON sale_items;
CREATE TRIGGER trigger_update_sale_totals_delete
  AFTER DELETE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_totals();

-- 7. Trigger para validar origem da venda
CREATE OR REPLACE FUNCTION validate_sale_origin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.origin_type = 'orcamento' AND NEW.quote_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento é obrigatório quando origem for "orcamento"';
  END IF;
  
  IF NEW.origin_type = 'ordem_producao' AND NEW.production_order_id IS NULL THEN
    RAISE EXCEPTION 'Ordem de Produção é obrigatória quando origem for "ordem_producao"';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_sale_origin ON sales;
CREATE TRIGGER trigger_validate_sale_origin
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION validate_sale_origin();

-- 8. Trigger para atualizar status de pagamento
CREATE OR REPLACE FUNCTION update_sale_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_amount numeric;
  paid_amount numeric;
  sale_id_var uuid;
BEGIN
  sale_id_var := COALESCE(NEW.sale_id, OLD.sale_id);
  
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN status = 'pago' THEN amount ELSE 0 END), 0)
  INTO total_amount, paid_amount
  FROM sale_payments
  WHERE sale_id = sale_id_var;
  
  UPDATE sales
  SET 
    payment_status = CASE
      WHEN paid_amount = 0 THEN 'pendente'
      WHEN paid_amount >= total_amount THEN 'pago'
      ELSE 'parcial'
    END,
    updated_at = now()
  WHERE id = sale_id_var;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sale_payment_status_insert ON sale_payments;
CREATE TRIGGER trigger_update_sale_payment_status_insert
  AFTER INSERT ON sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_payment_status();

DROP TRIGGER IF EXISTS trigger_update_sale_payment_status_update ON sale_payments;
CREATE TRIGGER trigger_update_sale_payment_status_update
  AFTER UPDATE ON sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_payment_status();

DROP TRIGGER IF EXISTS trigger_update_sale_payment_status_delete ON sale_payments;
CREATE TRIGGER trigger_update_sale_payment_status_delete
  AFTER DELETE ON sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_payment_status();
