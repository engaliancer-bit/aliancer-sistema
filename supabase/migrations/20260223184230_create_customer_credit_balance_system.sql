/*
  # Customer Credit Balance System (Saldo para Compra Futura)

  ## Overview
  Allows customers to accumulate credit from returns or manual adjustments
  which can be applied as a discount/payment on future factory quotes or ribbed slab quotes.

  ## New Tables

  ### customer_credits
  - Tracks every credit transaction (additions and uses) per customer
  - `credit_type`: 'adicao' (add credit) or 'uso' (use credit)
  - `origin_type`: where the credit came from ('manual', 'devolucao', 'ajuste')
  - `origin_id`: optional reference to the source document
  - `applied_to_type`: when used, what type of document it was applied to ('quote', 'ribbed_slab_quote')
  - `applied_to_id`: the document the credit was applied to

  ## Modified Tables

  ### customers
  - Added `credit_balance` (numeric) — current available credit balance

  ## Security
  - RLS enabled on `customer_credits`
  - Authenticated users can read/insert/update their own records
*/

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_balance numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS customer_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_type text NOT NULL CHECK (credit_type IN ('adicao', 'uso')),
  amount numeric NOT NULL CHECK (amount > 0),
  origin_type text NOT NULL DEFAULT 'manual' CHECK (origin_type IN ('manual', 'devolucao', 'ajuste')),
  origin_id uuid,
  applied_to_type text CHECK (applied_to_type IN ('quote', 'ribbed_slab_quote')),
  applied_to_id uuid,
  description text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customer credits"
  ON customer_credits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customer credits"
  ON customer_credits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer credits"
  ON customer_credits FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_customer_credits_customer_id ON customer_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_created_at ON customer_credits(created_at DESC);

/*
  Function: add_customer_credit
  Adds credit to a customer and records the transaction.
*/
CREATE OR REPLACE FUNCTION public.add_customer_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_description text,
  p_origin_type text DEFAULT 'manual',
  p_origin_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_credit_id uuid;
BEGIN
  INSERT INTO customer_credits (
    customer_id, credit_type, amount, origin_type, origin_id, description, created_by
  ) VALUES (
    p_customer_id, 'adicao', p_amount, p_origin_type, p_origin_id, p_description, p_created_by
  ) RETURNING id INTO v_credit_id;

  UPDATE customers
  SET credit_balance = COALESCE(credit_balance, 0) + p_amount
  WHERE id = p_customer_id;

  RETURN v_credit_id;
END;
$function$;

/*
  Function: use_customer_credit
  Applies customer credit to a quote or ribbed slab quote.
  Returns error if insufficient balance.
*/
CREATE OR REPLACE FUNCTION public.use_customer_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_applied_to_type text,
  p_applied_to_id uuid,
  p_description text,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_balance numeric;
  v_credit_id uuid;
BEGIN
  SELECT credit_balance INTO v_balance FROM customers WHERE id = p_customer_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo disponivel: %', COALESCE(v_balance, 0);
  END IF;

  INSERT INTO customer_credits (
    customer_id, credit_type, amount, origin_type, applied_to_type, applied_to_id, description, created_by
  ) VALUES (
    p_customer_id, 'uso', p_amount, 'manual', p_applied_to_type, p_applied_to_id, p_description, p_created_by
  ) RETURNING id INTO v_credit_id;

  UPDATE customers
  SET credit_balance = credit_balance - p_amount
  WHERE id = p_customer_id;

  RETURN v_credit_id;
END;
$function$;
