# Como Tornar um Usuário Administrador

## Passo a Passo Detalhado

### 1. Crie sua conta no sistema
- Acesse o sistema (ele vai mostrar a tela de login)
- Clique em **"Não tem conta? Criar agora"**
- Preencha:
  - Nome completo
  - Email
  - Senha (mínimo 6 caracteres)
- Clique em **"Criar Conta"**

### 2. Acesse o Supabase Dashboard
1. Abra: https://supabase.com/dashboard
2. Faça login com sua conta Supabase
3. Selecione o projeto do seu sistema

### 3. Acesse o SQL Editor
1. No menu lateral **esquerdo**, procure e clique em **"SQL Editor"**
2. Clique no botão **"New Query"** (ou "+ New query")

### 4. Execute o comando SQL
Cole este comando no editor:

```sql
UPDATE user_profiles
SET is_admin = true
WHERE email = 'SEU_EMAIL_AQUI@exemplo.com';
```

**IMPORTANTE:** Substitua `SEU_EMAIL_AQUI@exemplo.com` pelo email que você usou para criar sua conta!

Exemplo:
```sql
UPDATE user_profiles
SET is_admin = true
WHERE email = 'joao.silva@aliancer.com.br';
```

5. Clique no botão **"Run"** (ou pressione **Ctrl+Enter**)

### 5. Verifique se funcionou
Você deve ver uma mensagem como:
```
UPDATE 1
```

Isso significa que 1 registro foi atualizado com sucesso!

### 6. Faça logout e login novamente
1. No sistema, clique no botão **"Sair"** no canto superior direito
2. Faça login novamente com seu email e senha
3. Agora você verá:
   - Um ícone de escudo ao lado do seu nome
   - A palavra "Administrador"
   - Um novo módulo: **"Gestão de Usuários"**

## Pronto! 🎉

Agora você é um administrador e pode:
- Acessar todos os módulos
- Gerenciar outros usuários
- Definir permissões para cada pessoa
- Tornar outros usuários administradores

## Criando mais usuários

Depois de se tornar admin:
1. Peça para outros colaboradores criarem contas através da tela de login
2. Acesse **"Gestão de Usuários"** no sistema
3. Selecione o novo usuário
4. Configure quais módulos ele pode acessar
5. Clique em **"Salvar Permissões"**

## Problemas?

Se o comando não funcionar, verifique:
- ✅ O email está correto (exatamente como você cadastrou)
- ✅ Você está no projeto correto do Supabase
- ✅ A conta foi criada com sucesso (tente fazer login primeiro)
- ✅ As aspas estão corretas no SQL (use aspas simples: 'email')

## Localização do SQL Editor no Supabase

```
Dashboard do Supabase
├── Project Dashboard
├── Table Editor
├── Authentication
├── Storage
├── 📝 SQL Editor  ← CLIQUE AQUI
├── Database
├── Functions
└── ...
```
