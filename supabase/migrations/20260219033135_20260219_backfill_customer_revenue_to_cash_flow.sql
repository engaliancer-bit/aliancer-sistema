/*
  # Backfill: Sincronizar customer_revenue existentes para cash_flow

  ## Objetivo
  Popular o cash_flow com todos os registros de customer_revenue que já existem
  no banco e ainda não possuem um espelho em cash_flow.

  ## Notas
  - Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente (seguro para re-executar)
  - Somente registros com payment_amount > 0 são sincronizados
  - Registros que já existem (por customer_revenue_id) são ignorados
*/

INSERT INTO cash_flow (
  date,
  type,
  category,
  description,
  amount,
  notes,
  business_unit,
  customer_revenue_id
)
SELECT
  COALESCE(cr.payment_date, cr.created_at::date),
  'income',
  'receita_cliente',
  COALESCE(cr.origin_description, 'Recebimento de Cliente'),
  cr.payment_amount,
  CASE
    WHEN cr.receipt_number IS NOT NULL THEN 'Recibo: ' || cr.receipt_number
    ELSE cr.notes
  END,
  'factory',
  cr.id
FROM customer_revenue cr
WHERE cr.payment_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM cash_flow cf
    WHERE cf.customer_revenue_id = cr.id
  )
ON CONFLICT (customer_revenue_id) DO NOTHING;
