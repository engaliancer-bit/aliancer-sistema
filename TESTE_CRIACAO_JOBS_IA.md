# Teste de Criação de Jobs IA com Validação de Sessão

## Data da Correção
11 de fevereiro de 2026

## Problema Corrigido
Erro "usuário não autenticado" ao clicar em "Gerar" no fluxo de criação de documentos IA.

## Correções Implementadas

### 1. Migration de Banco de Dados
**Arquivo**: `fix_project_ia_jobs_created_by_default.sql`

```sql
-- Adicionar default auth.uid() na coluna created_by
ALTER TABLE project_ia_jobs
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Tornar coluna NOT NULL
ALTER TABLE project_ia_jobs
ALTER COLUMN created_by SET NOT NULL;
```

**Resultado**: A coluna `created_by` agora é preenchida automaticamente com o ID do usuário autenticado.

### 2. Frontend - Validação de Sessão

#### Arquivo: `GenerateIADocumentModal.tsx`

**Mudanças**:
- Adicionado `checkSession()` no `useEffect` para validar sessão ao abrir modal
- Adicionado validação defensiva no `handleGenerate()` antes de criar o job
- Botão "Gerar Documento" desabilitado quando sessão inválida
- Mensagem de erro com botão "Ir para login" quando sessão expirada
- Logs em DEV para diagnóstico

**Código de Validação**:
```typescript
const checkSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!session || !user) {
    setSessionValid(false);
    setError('Sessão expirada. Faça login novamente.');
    return;
  }

  setSessionValid(true);
  setUserId(user.id);
};
```

### 3. Supabase Client - Configuração de Persistência

#### Arquivo: `src/lib/supabase.ts`

**Adicionado**:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
```

**Resultado**: A sessão é mantida entre reloads e renovada automaticamente.

## Como Testar

### 1. Teste com Sessão Válida

1. Faça login no sistema
2. Navegue até um projeto de engenharia
3. Clique na aba "Documentos IA"
4. Clique em "+ Novo Documento IA"
5. Selecione um template (ex: PRAD)
6. Preencha o briefing
7. Clique em "Gerar Documento"

**Resultado Esperado**:
- ✅ Job criado com sucesso
- ✅ Redirecionado para visualização do job
- ✅ `created_by` preenchido no banco

**Verificar no Console (DEV)**:
```
[DEV] Session check: { hasSession: true, hasUser: true, userId: "..." }
[DEV] Generate - Session check: { hasSession: true, hasUser: true, userId: "..." }
[DEV] Job creation result: { jobId: "...", jobError: null, userId: "..." }
```

### 2. Teste com Sessão Expirada

1. Abra as DevTools → Application → Storage → Local Storage
2. Delete a chave `sb-<project>-auth-token`
3. Clique em "+ Novo Documento IA"

**Resultado Esperado**:
- ✅ Mensagem: "Sessão expirada. Faça login novamente."
- ✅ Botão "Ir para login" visível
- ✅ Botão "Gerar Documento" desabilitado

### 3. Validar no Banco de Dados

```sql
-- Verificar jobs criados recentemente
SELECT
  id,
  created_at,
  created_by,
  status,
  template_id,
  project_id
FROM project_ia_jobs
ORDER BY created_at DESC
LIMIT 5;

-- Verificar se created_by está preenchido
SELECT
  COUNT(*) as total_jobs,
  COUNT(created_by) as jobs_com_created_by,
  COUNT(*) - COUNT(created_by) as jobs_sem_created_by
FROM project_ia_jobs;
```

**Resultado Esperado**:
- ✅ Todos os jobs com `created_by` preenchido
- ✅ `jobs_sem_created_by` = 0

## Critérios de Aceitação

- [x] Usuário logado consegue clicar "Gerar" e o registro do job é criado
- [x] O job fica com `created_by` preenchido e aparece na lista do projeto
- [x] Se o usuário não estiver logado, o sistema impede a criação e direciona para login
- [x] Logs de diagnóstico disponíveis no console em modo DEV
- [x] RLS validando corretamente `created_by = auth.uid()`

## Segurança

### RLS Policies Validadas

```sql
-- SELECT
CREATE POLICY "Users can view own jobs"
  ON project_ia_jobs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- INSERT
CREATE POLICY "Users can create jobs"
  ON project_ia_jobs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE
CREATE POLICY "Users can update own jobs"
  ON project_ia_jobs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE
CREATE POLICY "Users can delete own jobs"
  ON project_ia_jobs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
```

## Notas Adicionais

1. **Função RPC**: A função `create_project_ia_job` já validava `auth.uid()` internamente
2. **Default Value**: O default `auth.uid()` no banco é uma camada extra de segurança
3. **Persistência**: Com `persistSession: true`, a sessão sobrevive a reloads da página
4. **Auto-refresh**: O token é renovado automaticamente antes de expirar

## Próximos Passos

1. Monitorar logs em produção
2. Adicionar telemetria para rastrear sessões expiradas
3. Implementar renovação proativa de sessão em background
4. Considerar adicionar banner de aviso quando token está próximo de expirar
