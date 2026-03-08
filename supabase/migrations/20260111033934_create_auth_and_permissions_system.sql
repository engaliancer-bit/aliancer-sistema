/*
  # Sistema de Autenticação e Permissões de Módulos

  ## Descrição
  Cria o sistema de autenticação e controle de acesso por módulos.
  Permite que administradores definam quais módulos cada usuário pode acessar.

  ## Tabelas Criadas

  ### 1. user_profiles
  Perfis de usuários vinculados ao auth.users do Supabase
  - `id` (uuid, primary key) - Referência ao auth.users
  - `email` (text) - Email do usuário
  - `full_name` (text) - Nome completo
  - `is_admin` (boolean) - Define se é administrador do sistema
  - `active` (boolean) - Define se o usuário está ativo
  - `created_at` (timestamptz) - Data de criação

  ### 2. module_permissions
  Define as permissões de acesso aos módulos por usuário
  - `id` (uuid, primary key) - Identificador único
  - `user_id` (uuid) - Referência ao usuário
  - `module_id` (text) - ID do módulo (products, materials, etc)
  - `can_access` (boolean) - Se tem permissão de acesso
  - `created_at` (timestamptz) - Data de criação

  ## Segurança (RLS)
  - Políticas para usuários autenticados visualizarem seu próprio perfil
  - Políticas para admins gerenciarem todos os perfis e permissões
  - Políticas para usuários visualizarem suas próprias permissões

  ## Módulos Disponíveis
  Os módulos que podem ter permissões controladas são:
  - products, materials, suppliers, customers, quotes
  - production-orders, recipes, production, inventory
  - material-inventory, employees, indirect-costs
  - production-costs, sales-prices, sales-report, dashboard
*/

-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  is_admin boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de permissões de módulos
CREATE TABLE IF NOT EXISTS module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  can_access boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para user_profiles

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins podem inserir novos perfis
CREATE POLICY "Admins can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins podem atualizar perfis
CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Políticas para module_permissions

-- Usuários podem ver suas próprias permissões
CREATE POLICY "Users can view own permissions"
  ON module_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins podem ver todas as permissões
CREATE POLICY "Admins can view all permissions"
  ON module_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins podem inserir permissões
CREATE POLICY "Admins can insert permissions"
  ON module_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins podem atualizar permissões
CREATE POLICY "Admins can update permissions"
  ON module_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admins podem deletar permissões
CREATE POLICY "Admins can delete permissions"
  ON module_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_module_permissions_user_id ON module_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_module_permissions_module_id ON module_permissions(module_id);

-- Função para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();