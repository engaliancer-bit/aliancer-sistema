/*
  # Fix get_factory_receivables — Factory Quotes Only

  ## Changes
  - Removes the OBRA (engineering_projects) section from the factory receivables function
  - Engineering project receivables belong to the escritorio module, not the factory
  - Factory quotes have quote_type IS NULL (construction quotes use 'complete_construction')
  - Also fixes the status filter: factory quotes use 'aprovado' status

  ## Affected Functions
  - `get_factory_receivables()` — now returns only approved factory quotes with outstanding balance
*/

CREATE OR REPLACE FUNCTION public.get_factory_receivables()
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  origin_type text,
  origin_id uuid,
  origin_reference text,
  due_date date,
  total_amount numeric,
  paid_amount numeric,
  outstanding_amount numeric
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    'ORÇAMENTO'::text,
    q.id,
    'ORÇ. ' || SUBSTRING(q.id::text, 1, 8),
    q.delivery_deadline,
    COALESCE(q.total_value, 0),
    COALESCE((
      SELECT COALESCE(SUM(rp.valor_pago), 0)
      FROM receivable_payments rp
      WHERE rp.receivable_id = q.id
        AND rp.estornado = false
    ), 0),
    COALESCE(q.total_value, 0) - COALESCE((
      SELECT COALESCE(SUM(rp.valor_pago), 0)
      FROM receivable_payments rp
      WHERE rp.receivable_id = q.id
        AND rp.estornado = false
    ), 0)
  FROM customers c
  INNER JOIN quotes q ON q.customer_id = c.id
  WHERE q.status = 'aprovado'
    AND (q.quote_type IS NULL OR q.quote_type NOT IN ('complete_construction'))
    AND q.total_value > 0
    AND (
      COALESCE(q.total_value, 0) - COALESCE((
        SELECT COALESCE(SUM(rp.valor_pago), 0)
        FROM receivable_payments rp
        WHERE rp.receivable_id = q.id
          AND rp.estornado = false
      ), 0)
    ) > 0;
END;
$function$;
