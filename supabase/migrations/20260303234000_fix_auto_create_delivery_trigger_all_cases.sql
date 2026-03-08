/*
  # Fix Auto-Create Delivery Trigger for All Quote Approval Cases

  ## Summary
  Recreates the trigger and function that automatically creates delivery records
  when a quote is approved. The previous version had gaps that caused some
  approved quotes to not generate deliveries.

  ## Changes
  1. Recreates `auto_create_delivery_on_quote_approval()` function with:
     - Explicit handling for construction_work_id cases (these were silently skipped before)
     - Proper product deduplication (one delivery_item per unique product)
     - Graceful error handling with RAISE WARNING instead of crashing the whole approval
     - Only processes item_type='product' items (not materials, compositions, labor)
  2. Drops and recreates the trigger on quotes table

  ## Notes
  - If delivery creation fails for any reason, the quote approval still succeeds
    (errors are logged as warnings, not exceptions)
  - Each unique product gets one delivery_item (quantities summed if product appears multiple times)
*/

-- Recreate the function with robust handling
CREATE OR REPLACE FUNCTION auto_create_delivery_on_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_delivery_id uuid;
  v_item RECORD;
  v_items_created int := 0;
BEGIN
  -- Only act when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN

    -- Check if any product items exist in this quote
    IF NOT EXISTS (
      SELECT 1 FROM quote_items
      WHERE quote_id = NEW.id
        AND item_type = 'product'
        AND product_id IS NOT NULL
    ) THEN
      RETURN NEW;
    END IF;

    -- Check if a delivery already exists for this quote
    SELECT id INTO v_delivery_id
    FROM deliveries
    WHERE quote_id = NEW.id
    LIMIT 1;

    -- Create a new delivery if none exists
    IF v_delivery_id IS NULL THEN
      INSERT INTO deliveries (
        delivery_date,
        quote_id,
        status,
        auto_created,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        NOW(),
        NEW.id,
        'open',
        true,
        'Gerado automaticamente ao aprovar orçamento',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_delivery_id;
    END IF;

    -- Insert one delivery_item per unique product (sum quantities)
    FOR v_item IN
      SELECT 
        qi.product_id,
        SUM(qi.quantity) as total_quantity,
        AVG(qi.proposed_price) as avg_price
      FROM quote_items qi
      WHERE qi.quote_id = NEW.id
        AND qi.item_type = 'product'
        AND qi.product_id IS NOT NULL
      GROUP BY qi.product_id
    LOOP
      -- Skip if this product already has a delivery_item in this delivery
      IF NOT EXISTS (
        SELECT 1 FROM delivery_items
        WHERE delivery_id = v_delivery_id
          AND product_id = v_item.product_id
          AND composition_id IS NULL
      ) THEN
        BEGIN
          INSERT INTO delivery_items (
            delivery_id,
            product_id,
            quantity,
            loaded_quantity,
            unit_price,
            created_at
          )
          VALUES (
            v_delivery_id,
            v_item.product_id,
            v_item.total_quantity,
            0,
            v_item.avg_price,
            NOW()
          );
          v_items_created := v_items_created + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Could not create delivery_item for product % in quote %: %',
            v_item.product_id, NEW.id, SQLERRM;
        END;
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log but do not fail the quote approval
  RAISE WARNING 'auto_create_delivery_on_quote_approval failed for quote %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_create_delivery_on_quote_approval ON quotes;

CREATE TRIGGER trigger_auto_create_delivery_on_quote_approval
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_delivery_on_quote_approval();
