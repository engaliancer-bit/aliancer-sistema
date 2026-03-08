/*
  # Corrigir políticas RLS para tabelas de compras

  1. Alterações
    - Remover políticas restritivas que exigem autenticação
    - Adicionar políticas que permitem acesso público (anônimo e autenticado)
    - Alinhado com o padrão usado nas outras tabelas do sistema

  2. Segurança
    - Mantém RLS habilitado
    - Permite acesso para usuários anônimos e autenticados
*/

-- Remover políticas antigas de purchases
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar compras" ON purchases;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir compras" ON purchases;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar compras" ON purchases;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir compras" ON purchases;

-- Remover políticas antigas de purchase_items
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar itens de compra" ON purchase_items;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir itens de compra" ON purchase_items;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens de compra" ON purchase_items;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir itens de compra" ON purchase_items;

-- Criar novas políticas para purchases (acesso público)
CREATE POLICY "Permitir visualização de compras"
  ON purchases FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção de compras"
  ON purchases FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de compras"
  ON purchases FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão de compras"
  ON purchases FOR DELETE
  USING (true);

-- Criar novas políticas para purchase_items (acesso público)
CREATE POLICY "Permitir visualização de itens de compra"
  ON purchase_items FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção de itens de compra"
  ON purchase_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de itens de compra"
  ON purchase_items FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão de itens de compra"
  ON purchase_items FOR DELETE
  USING (true);