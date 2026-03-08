# Sistema de IA para Projetos de Engenharia

## Visão Geral

Sistema completo de geração de documentos técnicos com IA integrado aos projetos de engenharia. Permite criar jobs de geração, anexar arquivos e gerenciar outputs versionados.

---

## 📊 Estrutura de Tabelas

### 1. **project_ia_jobs**

Tabela principal para gerenciar jobs de geração de IA.

**Campos principais:**

```sql
id                      uuid PRIMARY KEY
created_at              timestamptz
updated_at              timestamptz
created_by              uuid (fk auth.users)

-- Relacionamentos
project_id              uuid (fk engineering_projects) NOT NULL
template_id             uuid (fk ai_document_templates) NOT NULL
customer_id             uuid (fk customers) NOT NULL
property_id             uuid (fk properties) nullable

-- Status
status                  project_ia_job_status (pending/processing/completed/failed/cancelled)
started_at              timestamptz
completed_at            timestamptz

-- Entrada
briefing                text NOT NULL
intake_answers          jsonb NOT NULL

-- Progresso
progress                integer (0-100)
current_section         text

-- Resultado
error_message           text nullable
tokens_used             integer
processing_time_seconds integer
```

**Índices:**
- `project_id, created_at DESC`
- `status, created_at DESC`
- `created_by`
- `customer_id`
- `template_id`

---

### 2. **project_ia_job_files**

Arquivos anexados aos jobs.

**Campos principais:**

```sql
id              uuid PRIMARY KEY
job_id          uuid (fk project_ia_jobs) NOT NULL
created_at      timestamptz

-- Storage
storage_bucket  text DEFAULT 'ia-files'
storage_path    text NOT NULL
storage_url     text

-- Metadados
file_name       text NOT NULL
mime_type       text NOT NULL
file_size       bigint NOT NULL
uploaded_by     uuid (fk auth.users)
description     text nullable
```

**Índices:**
- `job_id`
- `uploaded_by`

**Constraint:**
- UNIQUE `(job_id, storage_path)`

---

### 3. **project_ia_outputs**

Outputs gerados pelos jobs (versionados).

**Campos principais:**

```sql
id                      uuid PRIMARY KEY
job_id                  uuid (fk project_ia_jobs) NOT NULL
created_at              timestamptz

-- Versionamento
version                 integer NOT NULL (auto-increment)

-- Conteúdo
output_markdown         text NOT NULL
executive_summary       text nullable
pending_items           jsonb NOT NULL

-- Exportação
docx_storage_path       text nullable
docx_generated_at       timestamptz

-- Estatísticas (calculadas automaticamente)
word_count              integer
section_count           integer
placeholders_count      integer

-- Auditoria
generated_by            uuid (fk auth.users)
reviewed_by             uuid (fk auth.users)
reviewed_at             timestamptz
```

**Índices:**
- `job_id, version DESC`
- `generated_by`

**Constraint:**
- UNIQUE `(job_id, version)`

---

## 🔐 Segurança (RLS)

### Política: Acesso Restrito ao Criador

Todas as 3 tabelas seguem a mesma política:

**SELECT, INSERT, UPDATE, DELETE:**
- ✅ Apenas o criador (`created_by = auth.uid()`)
- ❌ Outros usuários não podem acessar

**Exemplo de política:**

```sql
-- project_ia_jobs
CREATE POLICY "Users can view own jobs"
  ON project_ia_jobs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
```

**Para arquivos e outputs:**
- Verifica se o usuário é dono do job relacionado
- Usa `EXISTS` para validar através de `project_ia_jobs`

---

## 🔧 Funções Auxiliares

### 1. `create_project_ia_job()`

Cria um novo job de IA.

**Uso:**

```sql
SELECT create_project_ia_job(
  p_project_id := 'uuid-do-projeto',
  p_template_id := 'uuid-do-template',
  p_briefing := 'Gerar laudo técnico completo...',
  p_intake_answers := '{"q1": "Residencial", "q2": "Avaliação de patologias"}'::jsonb
);
```

**Retorna:** `uuid` do job criado

**Automático:**
- Pega `customer_id` e `property_id` do projeto
- Define `created_by` como usuário atual
- Status inicial: `pending`

---

### 2. `get_latest_output()`

Retorna o output mais recente de um job.

**Uso:**

```sql
SELECT * FROM get_latest_output('uuid-do-job');
```

**Retorna:** Registro completo do tipo `project_ia_outputs`

---

### 3. `count_placeholders()`

Conta quantos `[A COMPLETAR]` existem no texto.

**Uso:**

```sql
SELECT count_placeholders('Texto com [A COMPLETAR: dados] pendentes');
-- Retorna: 1
```

---

## 🎯 Triggers Automáticos

### 1. Atualizar `updated_at`

```sql
CREATE TRIGGER trigger_update_project_ia_jobs_updated_at
  BEFORE UPDATE ON project_ia_jobs
```

Atualiza automaticamente `updated_at` ao modificar job.

---

### 2. Auto-incrementar versão

```sql
CREATE TRIGGER trigger_auto_increment_output_version
  BEFORE INSERT ON project_ia_outputs
```

Calcula automaticamente próximo número de versão por job.

**Exemplo:**
- Job A, version 1
- Job A, version 2 (automático)
- Job A, version 3 (automático)

---

### 3. Atualizar status ao criar output

```sql
CREATE TRIGGER trigger_update_job_status_on_output
  AFTER INSERT ON project_ia_outputs
```

Quando output é criado:
- Status do job → `completed`
- Progress → `100`
- `completed_at` → agora

---

### 4. Calcular estatísticas do output

```sql
CREATE TRIGGER trigger_calculate_output_stats
  BEFORE INSERT OR UPDATE ON project_ia_outputs
```

Calcula automaticamente:
- `word_count` - Total de palavras
- `section_count` - Total de seções (#)
- `placeholders_count` - Total de [A COMPLETAR]

---

## 📊 Views

### 1. `project_ia_jobs_detail`

Lista jobs com informações completas.

**Campos extras:**
- `project_name`
- `property_type`
- `template_name`
- `template_type`
- `ia_doc_type`
- `customer_name`
- `customer_type`
- `property_name`
- `files_count` (total de arquivos)
- `outputs_count` (total de versões)
- `latest_version` (versão mais recente)

**Uso:**

```sql
SELECT * FROM project_ia_jobs_detail
WHERE project_id = 'uuid-do-projeto'
ORDER BY created_at DESC;
```

---

### 2. `project_ia_outputs_detail`

Lista outputs com informações do job.

**Campos extras:**
- `job_status`
- `project_id`
- `project_name`
- `template_name`
- `customer_name`

**Uso:**

```sql
SELECT * FROM project_ia_outputs_detail
WHERE job_id = 'uuid-do-job'
ORDER BY version DESC;
```

---

## 📦 Storage

### Bucket: `ia-files`

**Configuração:**
- Nome: `ia-files`
- Público: `false` (privado)

**Policies:**
- ✅ Usuários autenticados podem upload
- ✅ Usuários autenticados podem visualizar
- ✅ Usuários autenticados podem deletar

**Estrutura sugerida:**

```
ia-files/
  └── job-uuid-1/
      ├── documento1.pdf
      ├── foto1.jpg
      └── planilha.xlsx
  └── job-uuid-2/
      └── ...
```

---

## 🔄 Fluxo Completo

### 1. Criar Job

```typescript
// Frontend
const { data: jobId, error } = await supabase
  .rpc('create_project_ia_job', {
    p_project_id: projectId,
    p_template_id: templateId,
    p_briefing: 'Gerar laudo técnico de vistoria...',
    p_intake_answers: {
      q1: 'Residencial',
      q2: 'Avaliação de patologias',
      q3: true
    }
  });
```

---

### 2. Upload de Arquivos

```typescript
// Upload para storage
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('ia-files')
  .upload(`${jobId}/documento.pdf`, file);

// Registrar no banco
const { error: dbError } = await supabase
  .from('project_ia_job_files')
  .insert({
    job_id: jobId,
    storage_path: `${jobId}/documento.pdf`,
    file_name: 'documento.pdf',
    mime_type: file.type,
    file_size: file.size,
    uploaded_by: userId
  });
```

---

### 3. Processar Job (Backend/Edge Function)

```typescript
// Marcar como processando
await supabase
  .from('project_ia_jobs')
  .update({
    status: 'processing',
    started_at: new Date().toISOString(),
    progress: 0
  })
  .eq('id', jobId);

// Processar seções (atualizar progresso)
for (let i = 0; i < sections.length; i++) {
  const progress = Math.round((i / sections.length) * 100);

  await supabase
    .from('project_ia_jobs')
    .update({
      progress,
      current_section: sections[i].title
    })
    .eq('id', jobId);

  // Gerar seção...
}
```

---

### 4. Criar Output

```typescript
// Quando geração completa
const { error } = await supabase
  .from('project_ia_outputs')
  .insert({
    job_id: jobId,
    output_markdown: markdownContent,
    executive_summary: summary,
    pending_items: pendingList,
    generated_by: userId
  });

// Trigger automático:
// - Define version (auto-increment)
// - Calcula estatísticas
// - Atualiza job para 'completed'
```

---

### 5. Consultar Resultados

```typescript
// Listar jobs do projeto
const { data: jobs } = await supabase
  .from('project_ia_jobs_detail')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false });

// Obter último output
const { data: output } = await supabase
  .from('project_ia_outputs')
  .select('*')
  .eq('job_id', jobId)
  .order('version', { ascending: false })
  .limit(1)
  .single();

// Listar arquivos
const { data: files } = await supabase
  .from('project_ia_job_files')
  .select('*')
  .eq('job_id', jobId);
```

---

## 📈 Estatísticas

### Jobs por Status

```sql
SELECT
  status,
  COUNT(*) as total,
  AVG(processing_time_seconds) as avg_time,
  SUM(tokens_used) as total_tokens
FROM project_ia_jobs
GROUP BY status;
```

### Outputs por Template

```sql
SELECT
  t.name as template_name,
  COUNT(DISTINCT j.id) as jobs_count,
  COUNT(o.id) as outputs_count,
  AVG(o.word_count) as avg_words,
  AVG(o.placeholders_count) as avg_placeholders
FROM project_ia_jobs j
INNER JOIN ai_document_templates t ON t.id = j.template_id
LEFT JOIN project_ia_outputs o ON o.job_id = j.id
GROUP BY t.id, t.name
ORDER BY jobs_count DESC;
```

---

## 🔍 Queries Úteis

### Jobs pendentes

```sql
SELECT * FROM project_ia_jobs_detail
WHERE status = 'pending'
ORDER BY created_at;
```

### Jobs do projeto com outputs

```sql
SELECT
  j.*,
  o.version,
  o.word_count,
  o.placeholders_count
FROM project_ia_jobs j
LEFT JOIN project_ia_outputs o ON o.job_id = j.id
WHERE j.project_id = 'uuid-do-projeto'
ORDER BY j.created_at DESC, o.version DESC;
```

### Arquivos por job

```sql
SELECT
  j.id as job_id,
  j.project_name,
  f.file_name,
  f.file_size,
  f.created_at
FROM project_ia_jobs_detail j
LEFT JOIN project_ia_job_files f ON f.job_id = j.id
WHERE j.project_id = 'uuid-do-projeto'
ORDER BY f.created_at DESC;
```

### Jobs com erro

```sql
SELECT * FROM project_ia_jobs_detail
WHERE status = 'failed'
AND error_message IS NOT NULL
ORDER BY created_at DESC;
```

---

## ✅ Checklist de Implementação

Sistema está **100% pronto** no banco:

- [x] Tabela `project_ia_jobs` criada
- [x] Tabela `project_ia_job_files` criada
- [x] Tabela `project_ia_outputs` criada
- [x] Todos os índices criados
- [x] RLS habilitado em todas as tabelas
- [x] Políticas de segurança configuradas
- [x] Triggers automáticos funcionando
- [x] Views auxiliares criadas
- [x] Funções utilitárias criadas
- [x] Storage bucket configurado
- [x] Storage policies configuradas

---

## 🚀 Próximos Passos

### Frontend (a implementar):

1. ✅ **Componente de criação de job**
   - Form com projeto, template e briefing
   - Modal de perguntas de intake
   - Upload de arquivos

2. ✅ **Lista de jobs**
   - Filtros por projeto/status
   - Indicador de progresso
   - Link para outputs

3. ✅ **Visualização de output**
   - Renderizar markdown
   - Mostrar resumo executivo
   - Lista de pendências
   - Exportar DOCX

4. ✅ **Gerenciamento de arquivos**
   - Lista de anexos
   - Upload múltiplo
   - Preview de PDFs/imagens

### Backend/Edge Function (a implementar):

1. ✅ **Edge Function de processamento**
   - Receber job pending
   - Chamar API de IA
   - Gerar markdown por seção
   - Criar output versionado

2. ✅ **Exportação DOCX**
   - Converter markdown → DOCX
   - Upload para storage
   - Atualizar `docx_storage_path`

---

## 📝 Exemplo Completo

```typescript
// 1. Criar job
const { data: jobId } = await supabase.rpc('create_project_ia_job', {
  p_project_id: '123',
  p_template_id: '456',
  p_briefing: 'Laudo de vistoria completo',
  p_intake_answers: { q1: 'Residencial', q2: true }
});

// 2. Upload arquivo
await supabase.storage
  .from('ia-files')
  .upload(`${jobId}/planta.pdf`, file);

await supabase.from('project_ia_job_files').insert({
  job_id: jobId,
  storage_path: `${jobId}/planta.pdf`,
  file_name: 'planta.pdf',
  mime_type: 'application/pdf',
  file_size: file.size
});

// 3. Backend processa e cria output
// (Edge Function automática)

// 4. Consultar resultado
const { data: output } = await supabase
  .from('project_ia_outputs')
  .select('*')
  .eq('job_id', jobId)
  .order('version', { ascending: false })
  .single();

console.log(output.output_markdown);
console.log(output.executive_summary);
console.log(output.pending_items);
console.log(`Palavras: ${output.word_count}`);
console.log(`Pendências: ${output.placeholders_count}`);
```

---

**Sistema completo de IA para projetos pronto no banco de dados!** 🎉
