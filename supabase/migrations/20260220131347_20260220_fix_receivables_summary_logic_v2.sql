/*
  # Fix Receivables Summary Logic V2

  1. Update Function
    - Fixed quote filtering to exclude quotes linked to projects
    - Improved project receivables aggregation
*/

DROP FUNCTION IF EXISTS get_factory_receivables();

CREATE OR REPLACE FUNCTION get_factory_receivables()
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  origin_type text,
  origin_id uuid,
  origin_reference text,
  due_date date,
  total_amount numeric,
  paid_amount numeric,
  outstanding_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  (SELECT 
    c.id,
    c.name,
    'ORÇAMENTO'::text,
    q.id,
    'ORÇ. ' || SUBSTRING(q.id::text, 1, 8),
    q.delivery_deadline,
    COALESCE(q.total_value, 0),
    COALESCE((SELECT COALESCE(SUM(rp.valor_pago), 0) FROM receivable_payments rp WHERE rp.receivable_id = q.id AND rp.estornado = false), 0),
    COALESCE(q.total_value, 0) - COALESCE((SELECT COALESCE(SUM(rp.valor_pago), 0) FROM receivable_payments rp WHERE rp.receivable_id = q.id AND rp.estornado = false), 0)
  FROM customers c
  INNER JOIN quotes q ON q.customer_id = c.id
  WHERE q.status = 'aprovado'
    AND q.total_value > 0
    AND NOT EXISTS (SELECT 1 FROM unified_sales us WHERE us.origem_tipo = 'quote' AND us.origem_id = q.id))
  
  UNION ALL
  
  (SELECT
    c.id,
    c.name,
    'OBRA'::text,
    ep.id,
    'OBRA ' || SUBSTRING(ep.name, 1, 20),
    ep.deadline_date,
    COALESCE(ep.grand_total, 0),
    COALESCE(ep.total_received, 0),
    COALESCE(ep.balance, 0)
  FROM customers c
  INNER JOIN engineering_projects ep ON ep.customer_id = c.id
  WHERE ep.status NOT IN ('cancelado', 'concluído')
    AND COALESCE(ep.balance, 0) > 0);
END;
$$ LANGUAGE plpgsql;
