/*
  # Corrigir políticas RLS da tabela assets

  1. Alterações
    - Remove políticas RLS restritivas da tabela `assets`
    - Adiciona novas políticas permitindo acesso público (anônimo)
    - Mantém consistência com outras tabelas do sistema (purchases, purchase_items, etc)
  
  2. Políticas
    - Permite SELECT, INSERT, UPDATE e DELETE para role public
    - Garante que a importação de XML funcione corretamente
  
  3. Security
    - Mantém RLS habilitado
    - Permite operações para todos os usuários (public)
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view assets" ON assets;
DROP POLICY IF EXISTS "Users can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can update assets" ON assets;
DROP POLICY IF EXISTS "Users can delete assets" ON assets;

-- Criar novas políticas com acesso público
CREATE POLICY "Permitir visualização de ativos"
  ON assets FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção de ativos"
  ON assets FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de ativos"
  ON assets FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão de ativos"
  ON assets FOR DELETE
  TO public
  USING (true);