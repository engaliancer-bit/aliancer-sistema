/*
  # Create Retroactive Deliveries for Approved Quotes Without Deliveries

  ## Summary
  This migration creates delivery records (deliveries + delivery_items) for all approved quotes
  that currently have no corresponding delivery_items. This closes the "invisible stock" gap.

  ## What This Does
  - For each approved quote with product items that have no delivery coverage:
    - Creates one delivery per quote (status='open')
    - Creates one delivery_item per unique product in that quote
    - If a quote has the same product in multiple quote_items, they are summed into one delivery_item
      (to comply with the unique product-per-delivery constraint)

  ## Important Notes
  - Only creates deliveries for product items (item_type='product')
  - loaded_quantity=0 since nothing has been physically shipped yet
  - Skips products that already have a delivery_item linked to this quote
  - Groups by product_id to avoid the duplicate product constraint on delivery_items
*/

DO $$
DECLARE
  v_quote_id uuid;
  v_delivery_id uuid;
  v_item RECORD;
  v_deliveries_created int := 0;
  v_items_created int := 0;
BEGIN

  -- Loop over each approved quote that has undelivered product items
  FOR v_quote_id IN
    SELECT DISTINCT q.id
    FROM quotes q
    JOIN quote_items qi ON qi.quote_id = q.id
    WHERE q.status = 'approved'
      AND qi.item_type = 'product'
      AND qi.product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM delivery_items di
        JOIN deliveries d ON d.id = di.delivery_id
        WHERE d.quote_id = q.id
          AND di.product_id = qi.product_id
      )
    ORDER BY 1
  LOOP

    -- Check if a delivery already exists for this quote
    SELECT id INTO v_delivery_id
    FROM deliveries
    WHERE quote_id = v_quote_id
    LIMIT 1;

    -- Create delivery if none exists
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
        v_quote_id,
        'open',
        true,
        'Entrega criada retroativamente para orçamento aprovado',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_delivery_id;

      v_deliveries_created := v_deliveries_created + 1;
    END IF;

    -- Insert one delivery_item per unique product (sum quantities for same product)
    FOR v_item IN
      SELECT 
        qi.product_id,
        SUM(qi.quantity) as total_quantity,
        AVG(qi.proposed_price) as avg_price
      FROM quote_items qi
      WHERE qi.quote_id = v_quote_id
        AND qi.item_type = 'product'
        AND qi.product_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM delivery_items di
          JOIN deliveries d ON d.id = di.delivery_id
          WHERE d.quote_id = v_quote_id
            AND di.product_id = qi.product_id
        )
      GROUP BY qi.product_id
    LOOP
      -- Only insert if this product is not already in this specific delivery
      IF NOT EXISTS (
        SELECT 1 FROM delivery_items
        WHERE delivery_id = v_delivery_id
          AND product_id = v_item.product_id
          AND composition_id IS NULL
      ) THEN
        INSERT INTO delivery_items (
          delivery_id,
          product_id,
          quantity,
          loaded_quantity,
          unit_price,
          notes,
          created_at
        )
        VALUES (
          v_delivery_id,
          v_item.product_id,
          v_item.total_quantity,
          0,
          v_item.avg_price,
          'Item retroativo - orçamento aprovado sem entrega registrada',
          NOW()
        );

        v_items_created := v_items_created + 1;
      END IF;
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Retroactive delivery creation: % deliveries created, % delivery items created',
    v_deliveries_created, v_items_created;

END $$;
