/*
  # Fix sync_customer_revenue_to_cash_flow trigger - add missing category column

  ## Problem
  The trigger `sync_customer_revenue_to_cash_flow` inserts records into `cash_flow`
  without providing the `category` column, which has a NOT NULL constraint.
  This causes every payment registration from the customer statement to fail with:
    "null value in column 'category' of relation 'cash_flow' violates not-null constraint"

  ## Fix
  Recreate the trigger function with the `category` field included in the INSERT,
  using 'Receita de Venda' for factory quotes and 'Receita de Obra' for construction works.
*/

CREATE OR REPLACE FUNCTION sync_customer_revenue_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_business_unit text;
  v_category text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_business_unit := CASE
      WHEN NEW.origin_type IN ('quote', 'ribbed_slab_quote') THEN 'factory'
      WHEN NEW.origin_type = 'construction_work' THEN 'construction'
      ELSE 'factory'
    END;

    v_category := CASE
      WHEN NEW.origin_type = 'construction_work' THEN 'Receita de Obra'
      ELSE 'Receita de Venda'
    END;

    INSERT INTO cash_flow (
      type,
      category,
      amount,
      description,
      date,
      payment_method,
      business_unit,
      customer_revenue_id
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

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM cash_flow WHERE customer_revenue_id = OLD.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
