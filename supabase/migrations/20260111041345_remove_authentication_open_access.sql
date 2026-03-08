/*
  # Remover Autenticação e Liberar Acesso Público
  
  1. Alterações
    - Remove todas as políticas RLS restritivas
    - Adiciona políticas públicas para todas as tabelas
    - Permite acesso completo (SELECT, INSERT, UPDATE, DELETE) para usuários anônimos
  
  2. Segurança
    - Sistema sem autenticação
    - Acesso público irrestrito a todos os dados
    - Todas as operações permitidas sem login
*/

-- Remover todas as políticas existentes de todas as tabelas
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Criar políticas públicas para todas as tabelas
CREATE POLICY "Public access for all operations" ON products FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON materials FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON quotes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON production_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON recipes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON recipe_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON production FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON material_movements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON product_material_weights FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON employees FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON overtime_records FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON monthly_extra_payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON payroll_charges FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON indirect_costs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON depreciation_assets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON production_costs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON sales_targets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON daily_sales_summary FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access for all operations" ON investments FOR ALL TO anon USING (true) WITH CHECK (true);

-- Políticas adicionais para authenticated (caso alguém use)
CREATE POLICY "Authenticated access for all operations" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON production_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON recipe_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON production FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON material_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON product_material_weights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON overtime_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON monthly_extra_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON payroll_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON indirect_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON depreciation_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON production_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON sales_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON daily_sales_summary FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access for all operations" ON investments FOR ALL TO authenticated USING (true) WITH CHECK (true);