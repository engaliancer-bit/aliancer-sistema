/*
  # Backfill customer_revenue entries for approved quotes

  ## Problem
  162 out of 179 approved quotes have no entry in `customer_revenue`,
  which is the source table for the Extrato do Cliente (Customer Statement) feature.
  This means the customer statement shows no data for these quotes.

  ## Cause
  The `customer_revenue` table is populated by triggers that fire when payments
  are registered via `quote_payments`. For quotes that were approved but never had
  payments registered through that flow, no entry was created.

  The CustomerStatement component queries approved quotes directly (status = 'approved'),
  so it CAN show data even without customer_revenue entries. However, the payment
  tracking (paid_amount, balance) won't be available for those quotes.

  ## Solution
  For approved quotes missing a customer_revenue entry, insert a base record
  with the quote's total_value and whatever paid_amount is already tracked on
  the quote itself. This ensures the customer statement shows all approved quotes.

  ## Notes
  - Only inserts for quotes that have no existing customer_revenue entry
  - Uses quote's own paid_amount/total_value fields as the source of truth
  - payment_date defaults to the quote's created_at date
  - These are base records; any subsequent payments via quote_payments will
    update them via the existing sync trigger
*/

INSERT INTO customer_revenue (
  customer_id,
  cliente_id,
  origin_type,
  origin_id,
  origin_description,
  total_amount,
  paid_amount,
  balance,
  payment_date,
  payment_amount,
  payment_method,
  notes
)
SELECT
  q.customer_id,
  q.customer_id,
  'quote',
  q.id,
  COALESCE(q.structure_description, 'Orçamento aprovado'),
  COALESCE(q.total_value, 0),
  COALESCE(q.paid_amount, 0),
  GREATEST(COALESCE(q.total_value, 0) - COALESCE(q.paid_amount, 0), 0),
  q.created_at::date,
  COALESCE(q.paid_amount, 0),
  'outros',
  'Registro gerado retroativamente - Orçamento aprovado'
FROM quotes q
WHERE q.status = 'approved'
  AND q.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customer_revenue cr
    WHERE cr.origin_id = q.id
    AND cr.origin_type = 'quote'
  );
