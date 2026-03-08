/*
  # Fix Stock View and Delivery Synchronization

  ## Summary
  This migration fixes the critical stock calculation inconsistency in the concrete artifacts module.

  ## Problems Fixed

  ### 1. product_stock_view recalculation logic
  - **Before:** The view counted `delivery_items.quantity` (reserved amount) for ALL active deliveries (open, in_progress, closed)
    which meant items were being deducted from stock BEFORE they physically left the factory.
  - **After:** 
    - `total_delivered` = SUM of `loaded_quantity` for CLOSED deliveries (items physically delivered)
    - `quantity_reserved` = SUM of `quantity` for OPEN/IN_PROGRESS deliveries (committed but not yet loaded)
    - `available_stock` = total_produced - total_delivered - quantity_reserved
    This gives a true picture: stock on hand minus what's been physically delivered minus what's committed.

  ### 2. New columns added to product_stock_view
  - `quantity_reserved`: Items committed in open/in_progress deliveries (not yet physically loaded)

  ## Tables Modified
  - `product_stock_view` (dropped and recreated to allow column addition)

  ## Security
  - No RLS changes needed (view inherits from underlying tables)
*/

-- Drop and recreate to allow adding the new column
DROP VIEW IF EXISTS product_stock_view;

CREATE VIEW product_stock_view AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.code as product_code,

  -- Total produced for stock (only production_type='stock' counts)
  COALESCE(prod_stock.total_produced_for_stock, 0) as total_produced,

  -- Total physically delivered (loaded_quantity on CLOSED deliveries only)
  COALESCE(deliv_closed.total_physically_delivered, 0) as total_delivered,

  -- Total reserved in open/in_progress deliveries (committed but not yet loaded)
  COALESCE(deliv_open.total_reserved, 0) as quantity_reserved,

  -- Available stock = Produced - Physically Delivered - Reserved
  COALESCE(prod_stock.total_produced_for_stock, 0)
    - COALESCE(deliv_closed.total_physically_delivered, 0)
    - COALESCE(deliv_open.total_reserved, 0) as available_stock

FROM products p

-- Only count production_type='stock' entries
LEFT JOIN (
  SELECT 
    product_id, 
    SUM(quantity) as total_produced_for_stock
  FROM production
  WHERE production_type = 'stock'
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = p.id

-- Physical deliveries: use loaded_quantity on CLOSED deliveries
LEFT JOIN (
  SELECT 
    di.product_id,
    SUM(di.loaded_quantity) as total_physically_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
    AND di.loaded_quantity > 0
  GROUP BY di.product_id
) deliv_closed ON deliv_closed.product_id = p.id

-- Reserved: full quantity on OPEN or IN_PROGRESS deliveries
LEFT JOIN (
  SELECT 
    di.product_id,
    SUM(di.quantity) as total_reserved
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress')
  GROUP BY di.product_id
) deliv_open ON deliv_open.product_id = p.id;
