/*
  # Create Receivables Summary System

  1. New Function
    - `get_factory_receivables()`: Aggregates customer receivables from quotes and projects
    
  2. Function Logic
    - Retrieves approved quotes NOT linked to projects (origem_id = NULL for projects)
    - Retrieves engineering projects with outstanding balance
    - Excludes payments already received
    - Groups by customer
    
  3. Data Structure
    - customer_id, customer_name, origin_type (quote/project), origin_id
    - due_date, total_amount, paid_amount, outstanding_amount
*/

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
  -- Get receivables from quotes (aprovado status, not linked to projects)
  RETURN QUERY
  SELECT
    c.id as customer_id,
    c.name as customer_name,
    'ORÇAMENTO'::text as origin_type,
    q.id as origin_id,
    'ORÇ. ' || COALESCE(q.id::text, '')::text as origin_reference,
    q.delivery_deadline as due_date,
    COALESCE(q.total_value, 0) as total_amount,
    COALESCE(SUM(rp.valor_pago), 0) as paid_amount,
    COALESCE(q.total_value, 0) - COALESCE(SUM(rp.valor_pago), 0) as outstanding_amount
  FROM customers c
  INNER JOIN quotes q ON q.customer_id = c.id
  LEFT JOIN receivable_payments rp ON rp.receivable_id = q.id AND rp.estornado = false
  WHERE q.status = 'aprovado'
    AND NOT EXISTS (
      SELECT 1 FROM unified_sales us
      WHERE us.origem_tipo = 'quote' AND us.origem_id = q.id
    )
    AND q.total_value > 0
  GROUP BY c.id, c.name, q.id, q.total_value, q.delivery_deadline
  HAVING COALESCE(q.total_value, 0) - COALESCE(SUM(rp.valor_pago), 0) > 0

  UNION ALL

  -- Get receivables from projects with outstanding balance
  SELECT
    c.id as customer_id,
    c.name as customer_name,
    'OBRA'::text as origin_type,
    ep.id as origin_id,
    'OBRA ' || COALESCE(ep.name, '')::text as origin_reference,
    ep.deadline_date as due_date,
    COALESCE(ep.grand_total, 0) as total_amount,
    COALESCE(ep.total_received, 0) as paid_amount,
    COALESCE(ep.balance, 0) as outstanding_amount
  FROM customers c
  INNER JOIN engineering_projects ep ON ep.customer_id = c.id
  WHERE ep.status NOT IN ('cancelado', 'concluído')
    AND COALESCE(ep.balance, 0) > 0;
END;
$$ LANGUAGE plpgsql;
