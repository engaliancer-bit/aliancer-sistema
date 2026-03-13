CREATE OR REPLACE FUNCTION sync_customer_revenue_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_business_unit text;
  v_category text;
  v_diff numeric(15,2);
BEGIN
  v_business_unit := CASE
    WHEN COALESCE(NEW.origin_type, OLD.origin_type) IN ('quote', 'quote_installment', 'ribbed_slab_quote') THEN 'factory'
    WHEN COALESCE(NEW.origin_type, OLD.origin_type) = 'construction_work' THEN 'construction'
    ELSE 'factory'
  END;

  v_category := CASE
    WHEN COALESCE(NEW.origin_type, OLD.origin_type) = 'construction_work' THEN 'Receita de Obra'
    ELSE 'Receita de Venda'
  END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estornado = true THEN
      RETURN NEW;
    END IF;

    INSERT INTO cash_flow (
      type, category, amount, description, date, payment_method, business_unit, customer_revenue_id
    ) VALUES (
      'income',
      v_category,
      NEW.payment_amount,
      'Recebimento: ' || COALESCE(NEW.origin_description, 'Cliente'),
      NEW.payment_date,
      COALESCE(NEW.payment_method, 'outros'),
      v_business_unit,
      NEW.id
    )
    ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estornado = false AND NEW.estornado = true THEN
      DELETE FROM cash_flow WHERE customer_revenue_id = NEW.id;
      RETURN NEW;
    END IF;

    IF OLD.payment_amount IS DISTINCT FROM NEW.payment_amount THEN
      v_diff := NEW.payment_amount - OLD.payment_amount;

      IF v_diff > 0 THEN
        INSERT INTO cash_flow (
          type, category, amount, description, date, payment_method, business_unit, customer_revenue_id
        ) VALUES (
          'income',
          v_category,
          v_diff,
          'Recebimento: ' || COALESCE(NEW.origin_description, 'Cliente'),
          NEW.payment_date,
          COALESCE(NEW.payment_method, 'outros'),
          v_business_unit,
          NEW.id
        );
      ELSIF v_diff < 0 THEN
        UPDATE cash_flow
        SET
          amount = amount + v_diff,
          date = NEW.payment_date,
          payment_method = COALESCE(NEW.payment_method, 'outros')
        WHERE id = (
          SELECT id FROM cash_flow
          WHERE customer_revenue_id = NEW.id
          ORDER BY date DESC, id DESC
          LIMIT 1
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM cash_flow WHERE customer_revenue_id = OLD.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_revenue_to_cash_flow ON customer_revenue;
CREATE TRIGGER trigger_sync_customer_revenue_to_cash_flow
  AFTER INSERT OR DELETE OR UPDATE OF payment_amount, payment_date, payment_method, estornado ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_revenue_to_cash_flow();