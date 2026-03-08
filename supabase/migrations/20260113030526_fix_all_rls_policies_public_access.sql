/*
  # Garantir Acesso Público a Todas as Tabelas
  
  1. Alterações
    - Adiciona políticas públicas para todas as tabelas que estão faltando
    - Garante que todas as tabelas tenham acesso completo para usuários anônimos e autenticados
    - Remove bloqueios de RLS sem políticas
  
  2. Tabelas Afetadas
    - module_permissions
    - user_profiles
    - E todas as outras tabelas do sistema para garantir consistência
  
  3. Segurança
    - Sistema de acesso público total
    - Todas as operações permitidas sem autenticação
*/

-- Garantir que todas as tabelas tenham políticas públicas
DO $$ 
DECLARE
  tbl RECORD;
BEGIN
  -- Para cada tabela no schema public
  FOR tbl IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    -- Remover políticas existentes para evitar conflitos
    EXECUTE format('DROP POLICY IF EXISTS "Public access for all operations" ON %I', tbl.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated access for all operations" ON %I', tbl.tablename);
    
    -- Criar políticas públicas
    EXECUTE format('CREATE POLICY "Public access for all operations" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl.tablename);
    EXECUTE format('CREATE POLICY "Authenticated access for all operations" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl.tablename);
    
    -- Garantir que RLS esteja habilitado
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;
