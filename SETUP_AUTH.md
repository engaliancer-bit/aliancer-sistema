# Guia de Configuração do Sistema de Autenticação

## Implementação Concluída

O sistema agora possui autenticação completa com controle de acesso por módulos. As seguintes funcionalidades foram implementadas:

### 1. Sistema de Login
- Tela de login e cadastro de usuários
- Autenticação segura via Supabase Auth (email/password)
- Sessão persistente

### 2. Controle de Acesso por Módulos
- Administradores têm acesso total a todos os módulos
- Usuários comuns só acessam módulos permitidos
- Permissões podem ser gerenciadas na aba "Gestão de Usuários" (apenas para admins)

### 3. Gestão de Usuários (Admin)
- Visualizar todos os usuários do sistema
- Tornar usuários administradores
- Ativar/desativar contas
- Configurar permissões individuais por módulo

## Como Começar

### Passo 1: Criar o Primeiro Usuário Administrador

Como o sistema agora requer login, você precisa criar o primeiro usuário administrador. Há duas formas:

#### Opção A: Através da Tela de Cadastro (Recomendado)
1. Acesse o sistema
2. Na tela de login, clique em "Não tem conta? Criar agora"
3. Preencha seu nome, email e senha
4. Clique em "Criar Conta"
5. Após criar a conta, você precisará torná-la administradora manualmente via SQL (veja Opção B abaixo)

#### Opção B: Tornar um Usuário Existente em Administrador via SQL

Execute este comando SQL no Supabase para tornar um usuário administrador:

```sql
-- Substitua 'seu@email.com' pelo email do usuário
UPDATE user_profiles
SET is_admin = true
WHERE email = 'seu@email.com';
```

### Passo 2: Criar Mais Usuários

Após ter um administrador:

1. Faça login como administrador
2. Peça para os outros usuários se cadastrarem através da tela de login
3. Como admin, acesse a aba "Gestão de Usuários"
4. Configure as permissões de cada usuário novo

### Passo 3: Configurar Permissões

Como administrador, você pode:

1. Ir em "Gestão de Usuários"
2. Selecionar um usuário
3. Marcar/desmarcar os módulos que ele pode acessar
4. Clicar em "Salvar Permissões"

## Módulos Disponíveis

Os seguintes módulos podem ter permissões controladas:

- Produtos
- Insumos
- Fornecedores
- Clientes
- Orçamentos
- Ordens de Produção
- Traços
- Produção
- Estoque Produtos
- Estoque Insumos
- Colaboradores
- Financeiro
- Custos de Produção
- Tabela de Preços
- Relatório de Produção
- Metas

**Nota:** O módulo "Gestão de Usuários" é exclusivo para administradores e não pode ser delegado.

## Funcionalidades de Segurança

### Para Administradores
- Acesso total a todos os módulos
- Pode tornar outros usuários administradores
- Pode ativar/desativar contas
- Pode gerenciar permissões de todos os usuários

### Para Usuários Comuns
- Só veem e acessam os módulos permitidos
- Não podem alterar suas próprias permissões
- Contas desativadas não conseguem acessar o sistema

## Dicas de Uso

1. **Primeiro Login**: Sempre crie um usuário administrador primeiro
2. **Segurança**: Use senhas fortes (mínimo 6 caracteres)
3. **Organização**: Crie usuários específicos para cada colaborador
4. **Permissões**: Dê acesso apenas aos módulos necessários para cada função
5. **Desativar vs Deletar**: Prefira desativar usuários em vez de deletá-los

## Estrutura do Banco de Dados

### Tabela: user_profiles
- `id`: Referência ao usuário do Supabase Auth
- `email`: Email do usuário
- `full_name`: Nome completo
- `is_admin`: Se é administrador (acesso total)
- `active`: Se a conta está ativa

### Tabela: module_permissions
- `user_id`: Referência ao usuário
- `module_id`: ID do módulo (products, materials, etc)
- `can_access`: Se tem permissão de acesso

## Mudanças Implementadas

1. ✅ Logo removida do botão "Início" no header
2. ✅ Sistema de autenticação com login e senha
3. ✅ Controle de acesso por módulos
4. ✅ Painel de gestão de usuários para administradores
5. ✅ Botão de logout no header
6. ✅ Informações do usuário logado no header
7. ✅ Indicador visual de administrador

## Suporte

Se tiver problemas:
- Verifique se o banco de dados Supabase está configurado corretamente
- Confirme que as migrações foram aplicadas
- Certifique-se de ter pelo menos um usuário administrador
