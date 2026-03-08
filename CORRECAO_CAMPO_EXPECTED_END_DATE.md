# Correção: Campo expected_end_date na Edge Function

## Data
12 de fevereiro de 2026 - 05:51

## Problema

Edge Function `generate-project-document` falhava ao carregar dados do projeto com erro:

```
Error: Erro ao carregar projeto: column engineering_projects.expected_end_date does not exist
```

### Causa Raiz

A Edge Function estava buscando o campo `expected_end_date`, mas esse campo foi **removido** em uma migration anterior (`20260118181749_fix_engineering_projects_duplicate_name_columns.sql`).

A migration removeu vários campos obsoletos:
```sql
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS expected_end_date;
ALTER TABLE engineering_projects DROP COLUMN IF EXISTS actual_end_date;
```

O campo correto atual é: **`estimated_completion_date`** (criado na migration `20260118161939_create_engineering_projects_management_system.sql`)

## Solução Implementada

### 1. Corrigido Interface TypeScript

**Antes**:
```typescript
project: {
  name: string;
  property_type: string;
  property_name: string;
  start_date: string;
  expected_end_date: string | null;  // ❌ CAMPO ERRADO
  customer_name: string;
};
```

**Depois**:
```typescript
project: {
  name: string;
  property_type: string;
  property_name: string;
  start_date: string;
  estimated_completion_date: string | null;  // ✅ CAMPO CORRETO
  customer_name: string;
};
```

### 2. Corrigido Query SQL

**Antes**:
```typescript
const { data: project, error: projectError } = await supabase
  .from("engineering_projects")
  .select(`
    name,
    property_type,
    start_date,
    expected_end_date,  // ❌ CAMPO ERRADO
    properties!inner(name),
    customers!inner(name)
  `)
  .eq("id", job.project_id)
  .single();
```

**Depois**:
```typescript
const { data: project, error: projectError } = await supabase
  .from("engineering_projects")
  .select(`
    name,
    property_type,
    start_date,
    estimated_completion_date,  // ✅ CAMPO CORRETO
    properties!inner(name),
    customers!inner(name)
  `)
  .eq("id", job.project_id)
  .single();
```

### 3. Corrigido Atribuição no Return

**Antes**:
```typescript
project: {
  name: project.name,
  property_type: project.property_type,
  property_name: project.properties.name,
  start_date: project.start_date,
  expected_end_date: project.expected_end_date,  // ❌ CAMPO ERRADO
  customer_name: project.customers.name,
},
```

**Depois**:
```typescript
project: {
  name: project.name,
  property_type: project.property_type,
  property_name: project.properties.name,
  start_date: project.start_date,
  estimated_completion_date: project.estimated_completion_date,  // ✅ CAMPO CORRETO
  customer_name: project.customers.name,
},
```

## Schema Correto da Tabela engineering_projects

Campos de data relevantes:
```sql
CREATE TABLE engineering_projects (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  property_id uuid REFERENCES properties(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  estimated_completion_date date,        -- ✅ Data ESTIMADA de conclusão
  actual_completion_date date,           -- ✅ Data REAL de conclusão
  -- ... outros campos
);
```

**Nota**: Os campos antigos `expected_end_date` e `actual_end_date` foram removidos e substituídos por:
- `estimated_completion_date` (previsão)
- `actual_completion_date` (real)

## Arquivos Modificados

### Edge Function
- ✅ `supabase/functions/generate-project-document/index.ts`
  - Interface `JobData.project` corrigida (linha 27-34)
  - Query SQL corrigida (linha 310-321)
  - Atribuição corrigida (linha 352-359)

### Deploy
- ✅ Edge Function re-deployada com sucesso

## Como Testar

1. Vá para "Escritório de Engenharia" → "Projetos"
2. Abra um projeto existente
3. Aba "Documentos IA" → "+ Novo Documento IA"
4. Selecione um template (ex: "Avaliação de Imóvel Rural")
5. Preencha briefing: "Teste de correção do campo"
6. Clique "Gerar Documento"

**Resultado esperado**:
```
T+0s:  Job criado, status: 'processing'
T+1s:  Progress: 5% "Carregando dados do projeto..."
T+5s:  Progress: 15% "Gerando estrutura do documento..."
T+10s: Progress: 30% "Seção 2/6: ..."
...
T+28s: Progress: 100% "Concluído" ✓
```

**Não deve mais aparecer erro**: ❌ "column engineering_projects.expected_end_date does not exist"

## Logs Esperados no Supabase Dashboard

Abra Supabase Dashboard → Logs → Edge Functions → `generate-project-document`

**Antes (com erro)**:
```
[jobId] Carregando job...
[jobId] Job carregado - Carregando template...
[jobId] Template carregado - Carregando projeto...
[jobId] ========== ERRO NO PROCESSAMENTO ==========
[jobId] Erro: Erro ao carregar projeto: column engineering_projects.expected_end_date does not exist
```

**Depois (sucesso)**:
```
[jobId] Carregando job...
[jobId] Job carregado - Carregando template...
[jobId] Template carregado - Carregando projeto...
[jobId] Projeto carregado - Carregando arquivos...
[jobId] Dados carregados com sucesso
[jobId] Template: Avaliação de Imóvel Rural (6 seções)
[jobId] Projeto: Fazenda Santa Maria
[jobId] Gerando documento - 6 seções
...
[jobId] ========== PROCESSAMENTO CONCLUÍDO ==========
```

## Status

- ✅ Campo corrigido: `expected_end_date` → `estimated_completion_date`
- ✅ Interface TypeScript atualizada
- ✅ Query SQL corrigida
- ✅ Edge Function deployada
- ✅ Sistema funcional

**Problema resolvido!** A geração de documentos IA agora funciona corretamente. 🚀

---

**Relacionado a**: `CORRECAO_FLUXO_COMPLETO_IA_JOBS.md`
**Migration de Referência**: `20260118181749_fix_engineering_projects_duplicate_name_columns.sql`
