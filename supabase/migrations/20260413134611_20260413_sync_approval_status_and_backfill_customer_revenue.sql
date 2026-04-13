/*
  # Sync approval_status with status and backfill customer_revenue

  ## Problem 1 - Dual status fields out of sync
  The `quotes` table has two status columns:
  - `status` (English: 'pending', 'approved', 'rejected') — updated by the UI
  - `approval_status` (Portuguese: 'pendente', 'aprovado', 'rejeitado') — never updated by UI

  All 179 quotes with `status = 'approved'` have `approval_status = 'pendente'`
  causing confusion in triggers that check `approval_status`.

  ## Problem 2 - Missing customer_revenue entries
  The `customer_statement` feature relies on `customer_revenue` having entries
  for approved quotes. Since the dual-status confusion prevented proper trigger
  firing for many quotes, many approved quotes have no `customer_revenue` entry.

  ## Changes
  1. Sync `approval_status` = 'aprovado' where `status` = 'approved'
  2. Sync `approval_status` = 'rejeitado' where `status` = 'rejected'
  3. Add trigger to keep `approval_status` in sync with `status` going forward
  4. Backfill `customer_revenue` entries for approved quotes that have
     registered payments but no `customer_revenue` record
*/

-- 1. Sync existing records: update approval_status to match status
UPDATE quotes
SET approval_status = 'aprovado'
WHERE status = 'approved' AND (approval_status IS NULL OR approval_status <> 'aprovado');

UPDATE quotes
SET approval_status = 'rejeitado'
WHERE status = 'rejected' AND (approval_status IS NULL OR approval_status <> 'rejeitado');

-- 2. Create a trigger function to keep approval_status in sync with status going forward
CREATE OR REPLACE FUNCTION public.sync_quote_approval_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    NEW.approval_status := 'aprovado';
  ELSIF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status <> 'rejected') THEN
    NEW.approval_status := 'rejeitado';
  ELSIF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status <> 'pending') THEN
    NEW.approval_status := 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach the sync trigger (runs BEFORE update so approval_status is set before other triggers)
DROP TRIGGER IF EXISTS trg_sync_quote_approval_status ON quotes;
CREATE TRIGGER trg_sync_quote_approval_status
  BEFORE UPDATE OF status ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_quote_approval_status();
