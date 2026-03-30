
/*
  # Add FK from budgets.cliente_id to clientes.id

  ## Problem
  budgets.cliente_id has no FK constraint. The Supabase JS embed syntax
  (e.g. `clientes(id, nome_razao_social)`) only works when a FK exists.
  Budgets created with the new clientes table don't show the customer name.

  ## Changes
  1. Clean orphaned cliente_id values pointing to deleted clientes records
  2. Add FK constraint budgets.cliente_id -> clientes.id ON DELETE SET NULL
*/

-- Clean orphaned cliente_id values
UPDATE budgets
SET cliente_id = NULL
WHERE cliente_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes WHERE id = budgets.cliente_id
  );

-- Add FK so Supabase JS embed works
ALTER TABLE budgets
  ADD CONSTRAINT budgets_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
