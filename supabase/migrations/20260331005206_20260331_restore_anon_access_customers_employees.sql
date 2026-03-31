/*
  # Restaurar Acesso Anônimo - Clientes e Colaboradores

  ## Problema
  As tabelas `customers` e `employees` possuem políticas RLS que exigem
  autenticação ou token de compartilhamento (via can_access_module). O sistema
  opera sem login (acesso anônimo), então essas políticas bloqueiam a listagem.

  ## Solução
  Adicionar políticas permissivas para o role `anon` nas tabelas:
  - `customers` (SELECT, INSERT, UPDATE, DELETE)
  - `employees` (SELECT, INSERT, UPDATE, DELETE)
  - `overtime_records` (SELECT, INSERT, UPDATE, DELETE)
  - `payroll_charges` (SELECT, INSERT, UPDATE, DELETE)
  - `monthly_extra_payments` (SELECT, INSERT, UPDATE, DELETE)

  ## Padrão
  Segue o mesmo padrão já existente na tabela `clientes`:
  "Anonymous users can view all clientes" → qual: true para role anon
*/

-- =============================================
-- CUSTOMERS: acesso anônimo completo
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anonymous users can view all customers'
  ) THEN
    CREATE POLICY "Anonymous users can view all customers"
      ON customers FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anonymous users can insert customers'
  ) THEN
    CREATE POLICY "Anonymous users can insert customers"
      ON customers FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anonymous users can update customers'
  ) THEN
    CREATE POLICY "Anonymous users can update customers"
      ON customers FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'customers' AND policyname = 'Anonymous users can delete customers'
  ) THEN
    CREATE POLICY "Anonymous users can delete customers"
      ON customers FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- =============================================
-- EMPLOYEES: acesso anônimo completo
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'Anonymous users can view all employees'
  ) THEN
    CREATE POLICY "Anonymous users can view all employees"
      ON employees FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'Anonymous users can insert employees'
  ) THEN
    CREATE POLICY "Anonymous users can insert employees"
      ON employees FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'Anonymous users can update employees'
  ) THEN
    CREATE POLICY "Anonymous users can update employees"
      ON employees FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employees' AND policyname = 'Anonymous users can delete employees'
  ) THEN
    CREATE POLICY "Anonymous users can delete employees"
      ON employees FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- =============================================
-- OVERTIME_RECORDS: acesso anônimo
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'overtime_records' AND policyname = 'Anonymous users can access overtime_records'
  ) THEN
    CREATE POLICY "Anonymous users can access overtime_records"
      ON overtime_records FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'overtime_records' AND policyname = 'Anonymous users can insert overtime_records'
  ) THEN
    CREATE POLICY "Anonymous users can insert overtime_records"
      ON overtime_records FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'overtime_records' AND policyname = 'Anonymous users can update overtime_records'
  ) THEN
    CREATE POLICY "Anonymous users can update overtime_records"
      ON overtime_records FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'overtime_records' AND policyname = 'Anonymous users can delete overtime_records'
  ) THEN
    CREATE POLICY "Anonymous users can delete overtime_records"
      ON overtime_records FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- =============================================
-- PAYROLL_CHARGES: acesso anônimo
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payroll_charges' AND policyname = 'Anonymous users can access payroll_charges'
  ) THEN
    CREATE POLICY "Anonymous users can access payroll_charges"
      ON payroll_charges FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payroll_charges' AND policyname = 'Anonymous users can insert payroll_charges'
  ) THEN
    CREATE POLICY "Anonymous users can insert payroll_charges"
      ON payroll_charges FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payroll_charges' AND policyname = 'Anonymous users can update payroll_charges'
  ) THEN
    CREATE POLICY "Anonymous users can update payroll_charges"
      ON payroll_charges FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payroll_charges' AND policyname = 'Anonymous users can delete payroll_charges'
  ) THEN
    CREATE POLICY "Anonymous users can delete payroll_charges"
      ON payroll_charges FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- =============================================
-- MONTHLY_EXTRA_PAYMENTS: acesso anônimo
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_extra_payments' AND policyname = 'Anonymous users can access monthly_extra_payments'
  ) THEN
    CREATE POLICY "Anonymous users can access monthly_extra_payments"
      ON monthly_extra_payments FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_extra_payments' AND policyname = 'Anonymous users can insert monthly_extra_payments'
  ) THEN
    CREATE POLICY "Anonymous users can insert monthly_extra_payments"
      ON monthly_extra_payments FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_extra_payments' AND policyname = 'Anonymous users can update monthly_extra_payments'
  ) THEN
    CREATE POLICY "Anonymous users can update monthly_extra_payments"
      ON monthly_extra_payments FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_extra_payments' AND policyname = 'Anonymous users can delete monthly_extra_payments'
  ) THEN
    CREATE POLICY "Anonymous users can delete monthly_extra_payments"
      ON monthly_extra_payments FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;
