/*
  # Adicionar acesso anônimo às categorias de custos

  1. Alterações
    - Adiciona políticas RLS para permitir acesso anônimo (role 'anon') à tabela cost_categories
    - Permite todas as operações (SELECT, INSERT, UPDATE, DELETE) para usuários anônimos
    
  2. Segurança
    - Mantém as políticas existentes para usuários autenticados
    - Adiciona políticas complementares para acesso anônimo
*/

-- Remover políticas antigas se existirem e criar novas
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Allow anonymous read access to cost_categories" ON cost_categories;
  DROP POLICY IF EXISTS "Allow anonymous insert access to cost_categories" ON cost_categories;
  DROP POLICY IF EXISTS "Allow anonymous update access to cost_categories" ON cost_categories;
  DROP POLICY IF EXISTS "Allow anonymous delete access to cost_categories" ON cost_categories;
END $$;

-- Adicionar política de leitura para usuários anônimos
CREATE POLICY "Allow anonymous read access to cost_categories"
  ON cost_categories
  FOR SELECT
  TO anon
  USING (true);

-- Adicionar política de inserção para usuários anônimos
CREATE POLICY "Allow anonymous insert access to cost_categories"
  ON cost_categories
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Adicionar política de atualização para usuários anônimos
CREATE POLICY "Allow anonymous update access to cost_categories"
  ON cost_categories
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Adicionar política de exclusão para usuários anônimos
CREATE POLICY "Allow anonymous delete access to cost_categories"
  ON cost_categories
  FOR DELETE
  TO anon
  USING (true);
