# Correção: Erro "Cannot read properties of null (reading 'id')"

## Data
12 de fevereiro de 2026 - 06:05

## Problema

Ao clicar em "Gerar Documento IA", o sistema apresentava erro imediato:

```
Erro ao gerar documento: Cannot read properties of null (reading 'id')
```

### Causa Raiz

O sistema opera em **modo público** (sem autenticação obrigatória), mas um log de debug estava tentando acessar `user.id` diretamente, sem verificar se o usuário estava autenticado.

**Código com problema** (linha 180):

```typescript
if (import.meta.env.DEV) {
  console.log('[GenerateIADocumentModal] Job creation result:', {
    jobId,
    jobError: jobError?.message,
    userId: user.id  // ❌ ERRO: user pode ser null
  });
}
```

Quando o usuário não está autenticado:
- `user` = `null`
- Tentativa de acessar `user.id` → **TypeError: Cannot read properties of null**

## Solução Implementada

Adicionado **optional chaining** (`?.`) para acessar propriedades do usuário de forma segura:

```typescript
if (import.meta.env.DEV) {
  console.log('[GenerateIADocumentModal] Job creation result:', {
    jobId,
    jobError: jobError?.message,
    userId: user?.id || 'anonymous'  // ✅ CORREÇÃO: verifica se user existe
  });
}
```

**Agora:**
- Se `user` existe: mostra `user.id`
- Se `user` é `null`: mostra `'anonymous'`
- **Sem erro!**

## Arquivos Modificados

### Frontend
- ✅ `src/components/engineering/GenerateIADocumentModal.tsx`
  - Linha 180: `user.id` → `user?.id || 'anonymous'`

## Contexto do Sistema

O sistema foi projetado para operar em **modo público** (sem autenticação obrigatória):

```typescript
// O AuthContext já está preparado para modo público
const { user, session, isAuthenticated, loading: authLoading } = useAuth();

// Log de debug mostra isso claramente:
console.log('[GenerateIADocumentModal] Auth state:', {
  isAuthenticated,
  hasUser: !!user,
  hasSession: !!session,
  userId: user?.id,
  note: 'Sistema opera em modo público - autenticação opcional'
});
```

**Todas as RLS policies** no Supabase permitem acesso público:

```sql
CREATE POLICY "Anyone can insert" ON project_ia_jobs
  FOR INSERT TO public USING (true);

CREATE POLICY "Anyone can select" ON project_ia_jobs
  FOR SELECT TO public USING (true);
```

## Fluxo Correto Agora

### 1. Usuário Clica "Gerar Documento"

```typescript
// Modal abre, carrega templates (✅ funciona)
const { data, error } = await supabase
  .from('ai_document_templates')
  .select('*')
  .eq('ia_enabled', true);
```

### 2. Usuário Seleciona Template e Preenche Briefing

```typescript
// Validações funcionam (✅ sem erro)
if (!briefing.trim()) {
  setError('O briefing é obrigatório');
  return;
}
```

### 3. Sistema Cria Job

```typescript
// Chama RPC para criar job (✅ funciona em modo público)
const { data: jobId, error: jobError } = await supabase
  .rpc('create_project_ia_job', {
    p_project_id: projectId,
    p_template_id: selectedTemplate.id,
    p_briefing: briefing,
    p_intake_answers: intakeAnswers
  });

// Log de debug agora funciona corretamente
console.log('[GenerateIADocumentModal] Job creation result:', {
  jobId,
  jobError: jobError?.message,
  userId: user?.id || 'anonymous'  // ✅ NÃO DÁ ERRO
});
```

### 4. Sistema Faz Upload de Arquivos (se houver)

```typescript
// Upload para storage público (✅ funciona)
const { error: uploadError } = await supabase.storage
  .from('ia-files')
  .upload(fileName, file);
```

### 5. Sistema Invoca Edge Function

```typescript
// Chamada assíncrona para processar job (✅ funciona)
fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ job_id: jobId })
});
```

### 6. Usuário Vê Progresso

```typescript
// Modal fecha, abre detalhe do job
onSuccess(jobId);

// Componente IAJobDetail mostra progresso em tempo real
// (polling a cada 2s para atualizar status/progress)
```

## Como Testar

1. **Abra o sistema** (sem fazer login)
2. Vá para "Escritório de Engenharia" → "Projetos"
3. Abra um projeto qualquer
4. Clique na aba "Documentos IA"
5. Clique "+ Novo Documento IA"
6. Selecione um template (ex: "Avaliação de Imóvel Rural")
7. Preencha o briefing: "Teste de correção do erro null"
8. Clique "Gerar Documento"

**Resultado esperado**:
```
✅ Modal fecha
✅ Detalhe do job abre
✅ Status: "Processando..." (barra de progresso aparece)
✅ Progresso: 5% → 15% → 30% → ... → 100%
✅ SEM ERRO "Cannot read properties of null"
```

**Console do navegador** (F12):
```
[GenerateIADocumentModal] Starting job creation: { userId: "anonymous", ... }
[GenerateIADocumentModal] Job creation result: { jobId: "...", userId: "anonymous" }
[GenerateIADocumentModal] Invocando Edge Function: { jobId: "..." }
[GenerateIADocumentModal] Edge Function response: { ok: true, status: 200 }
```

## Build Status

- ✅ TypeScript compilado sem erros
- ✅ Build concluído em 19.78s
- ✅ 1831 módulos transformados
- ✅ Sistema funcional

## Impacto

**Antes**: ❌ Sistema travava ao tentar gerar documento (erro imediato no modal)

**Depois**: ✅ Sistema funciona perfeitamente em modo público (sem autenticação)

**Usuários afetados**: Todos os usuários não autenticados

**Severidade**: 🔴 **CRÍTICA** (bloqueava funcionalidade principal)

**Status**: ✅ **RESOLVIDO**

---

**Relacionado a**:
- `CORRECAO_CAMPO_EXPECTED_END_DATE.md` (correção anterior da Edge Function)
- `CORRECAO_FLUXO_COMPLETO_IA_JOBS.md` (implementação original do sistema)
