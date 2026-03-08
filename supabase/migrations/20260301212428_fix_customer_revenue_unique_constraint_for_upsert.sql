/*
  # Fix customer_revenue UNIQUE constraint for UPSERT

  ## Problem
  The trigger `sync_quote_payment_to_customer_revenue` uses:
    ON CONFLICT (customer_id, origin_type, origin_id) DO UPDATE ...
  
  However, there is no UNIQUE constraint on (customer_id, origin_type, origin_id),
  only a regular index. PostgreSQL requires a UNIQUE constraint (or unique index)
  for ON CONFLICT to work. This causes every payment registration to fail with an error.

  ## Fix
  1. Drop the existing non-unique index on (origin_type, origin_id)
  2. Create a proper UNIQUE constraint on (customer_id, origin_type, origin_id)
*/

DROP INDEX IF EXISTS idx_customer_revenue_origin;

ALTER TABLE customer_revenue
  ADD CONSTRAINT customer_revenue_customer_origin_unique
  UNIQUE (customer_id, origin_type, origin_id);
