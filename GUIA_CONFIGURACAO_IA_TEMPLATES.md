# Guia de Configuração de IA por Template

## Visão Geral

Sistema de configuração personalizada de IA para cada template de documento. Cada template pode ter suas próprias:
- Perguntas de intake
- Seções obrigatórias
- Regras de geração
- Guia de estilo
- Tipo de documento

---

## 📋 Campos de Configuração

### 1. **ia_enabled** (boolean)
Habilita ou desabilita geração por IA para este template

```sql
UPDATE ai_document_templates
SET ia_enabled = true
WHERE id = 'template_id';
```

**Uso:**
- `true` = IA habilitada (mostra badge "IA" no template)
- `false` = IA desabilitada

---

### 2. **ia_doc_type** (enum)
Tipo de documento técnico

**Valores possíveis:**
- `laudo` - Laudo técnico
- `relatorio` - Relatório
- `estudo` - Estudo técnico
- `diagnostico` - Diagnóstico
- `memorial` - Memorial descritivo
- `projeto_textual` - Projeto textual
- `outro` - Outro tipo

```sql
UPDATE ai_document_templates
SET ia_doc_type = 'laudo'
WHERE id = 'template_id';
```

**Uso:**
A IA adapta o tom e estrutura conforme o tipo de documento.

---

### 3. **ia_sections** (jsonb)
Lista ordenada de seções obrigatórias do documento

**Estrutura:**
```json
[
  {
    "order": 1,
    "title": "1. Identificação",
    "required": true,
    "description": "Dados do solicitante e identificação do imóvel"
  },
  {
    "order": 2,
    "title": "2. Objeto da Vistoria",
    "required": true,
    "description": "Descrição do que está sendo vistoriado"
  }
]
```

**Campos:**
- `order` - Ordem de exibição (1, 2, 3...)
- `title` - Título da seção
- `required` - Se é obrigatória
- `description` - Descrição do conteúdo esperado

**Exemplo de uso:**
```sql
UPDATE ai_document_templates
SET ia_sections = jsonb_build_array(
  jsonb_build_object('order', 1, 'title', '1. Introdução', 'required', true),
  jsonb_build_object('order', 2, 'title', '2. Metodologia', 'required', true),
  jsonb_build_object('order', 3, 'title', '3. Resultados', 'required', true)
)
WHERE name = 'Meu Template';
```

**Uso pela IA:**
- A IA gera EXATAMENTE estas seções na ordem especificada
- Seções com `required: true` nunca podem ser puladas
- `description` é usada como guia para o conteúdo

---

### 4. **ia_intake_questions** (jsonb)
Perguntas para coleta de informações ANTES da geração

**Estrutura:**
```json
[
  {
    "id": "q1",
    "question": "Qual o tipo de edificação?",
    "type": "select",
    "options": ["Residencial", "Comercial", "Industrial"],
    "required": true
  },
  {
    "id": "q2",
    "question": "Qual o motivo da vistoria?",
    "type": "textarea",
    "required": true,
    "placeholder": "Ex: Avaliação de patologias"
  },
  {
    "id": "q3",
    "question": "Há projeto aprovado?",
    "type": "boolean",
    "required": true
  },
  {
    "id": "q4",
    "question": "Data da vistoria",
    "type": "date",
    "required": true
  }
]
```

**Tipos de perguntas:**
- `text` - Campo de texto curto
- `textarea` - Campo de texto longo
- `select` - Lista de opções (requer campo `options`)
- `boolean` - Sim/Não (radio buttons)
- `date` - Seletor de data
- `number` - Número

**Campos:**
- `id` - Identificador único (q1, q2, q3...)
- `question` - Texto da pergunta
- `type` - Tipo do campo
- `options` - Opções (apenas para type=select)
- `required` - Se é obrigatória
- `placeholder` - Texto de exemplo

**Exemplo de uso:**
```sql
UPDATE ai_document_templates
SET ia_intake_questions = jsonb_build_array(
  jsonb_build_object(
    'id', 'q1',
    'question', 'Qual o tipo de obra?',
    'type', 'select',
    'options', jsonb_build_array('Nova', 'Reforma', 'Ampliação'),
    'required', true
  ),
  jsonb_build_object(
    'id', 'q2',
    'question', 'Observações gerais',
    'type', 'textarea',
    'required', false,
    'placeholder', 'Descreva aspectos relevantes'
  )
)
WHERE name = 'Meu Template';
```

**Fluxo:**
1. Usuário clica "Gerar"
2. Sistema mostra modal com perguntas
3. Usuário responde
4. Respostas são salvas em `ai_generated_documents.intake_answers`
5. Job de geração usa as respostas como contexto

---

### 5. **ia_required_inputs** (jsonb)
Campos mínimos obrigatórios para gerar o documento

**Estrutura:**
```json
["customer_id", "project_id", "property_id"]
```

**Valores possíveis:**
- `customer_id` - Cliente obrigatório
- `project_id` - Projeto obrigatório
- `property_id` - Propriedade obrigatória

**Exemplo:**
```sql
UPDATE ai_document_templates
SET ia_required_inputs = '["customer_id", "project_id"]'::jsonb
WHERE name = 'Meu Template';
```

**Uso:**
Sistema valida antes de permitir geração.

---

### 6. **ia_style_guide** (text)
Guia de estilo e tom do documento

**Estrutura:**
Texto livre descrevendo o estilo desejado.

**Exemplo:**
```sql
UPDATE ai_document_templates
SET ia_style_guide = 'Tom técnico e objetivo. Linguagem formal conforme padrões ABNT e normas técnicas da engenharia civil. Manter imparcialidade e embasamento técnico. Estilo corporativo Aliancer: claro, preciso e profissional.'
WHERE name = 'Laudo Técnico';
```

**Boas práticas:**
- Especificar tom (técnico, formal, objetivo)
- Mencionar normas aplicáveis (ABNT, NBR)
- Definir público-alvo (técnicos, leigos, juízes)
- Incluir estilo corporativo

**Uso pela IA:**
Incorporado no prompt de geração para guiar o estilo de escrita.

---

### 7. **ia_rules** (jsonb)
Regras específicas para geração

**Estrutura:**
```json
{
  "not_invent_data": true,
  "use_placeholders": true,
  "generate_pending_list": true,
  "require_technical_review": false,
  "description": "REGRAS IMPORTANTES: (1) NUNCA inventar dados técnicos...",
  "references": [
    "ABNT NBR 16747:2020 - Inspeção predial",
    "ABNT NBR 16280:2015 - Reforma em edificações"
  ],
  "placeholders_rules": "Sempre usar formato [A COMPLETAR: descrição]"
}
```

**Campos:**

#### `not_invent_data` (boolean)
- `true` = IA NUNCA inventa dados
- Quando não há informação, usa placeholder [A COMPLETAR]

#### `use_placeholders` (boolean)
- `true` = Usar [A COMPLETAR: descrição] quando dado falta
- Formato padrão: `[A COMPLETAR: área total do imóvel em m²]`

#### `generate_pending_list` (boolean)
- `true` = Gera seção "PENDÊNCIAS" ao final
- Lista todos os [A COMPLETAR] encontrados

#### `require_technical_review` (boolean)
- `true` = Documento requer revisão técnica antes de aprovar
- Adiciona aviso no final do documento

#### `description` (text)
Descrição detalhada das regras

#### `references` (array)
Lista de normas técnicas a referenciar

#### `placeholders_rules` (text)
Regras específicas para placeholders

**Exemplo:**
```sql
UPDATE ai_document_templates
SET ia_rules = jsonb_build_object(
  'not_invent_data', true,
  'use_placeholders', true,
  'generate_pending_list', true,
  'require_technical_review', true,
  'description', 'NUNCA inventar dados. Sempre usar [A COMPLETAR] quando não houver informação. Gerar lista de pendências ao final.',
  'references', jsonb_build_array('ABNT NBR 16747:2020', 'ABNT NBR 16280:2015')
)
WHERE name = 'Laudo Técnico';
```

---

## 🎯 Exemplo Completo: Laudo Técnico

```sql
-- Template completo configurado
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  is_active,
  ia_enabled,
  ia_doc_type,
  ia_sections,
  ia_intake_questions,
  ia_required_inputs,
  ia_style_guide,
  ia_rules
) VALUES (
  'Laudo Técnico de Vistoria',
  'laudo_tecnico',
  'Laudo completo para vistoria de imóveis',
  true,
  true,
  'laudo',

  -- Seções
  jsonb_build_array(
    jsonb_build_object('order', 1, 'title', '1. Identificação', 'required', true, 'description', 'Dados do solicitante'),
    jsonb_build_object('order', 2, 'title', '2. Objeto da Vistoria', 'required', true, 'description', 'O que está sendo vistoriado'),
    jsonb_build_object('order', 3, 'title', '3. Metodologia', 'required', true, 'description', 'Procedimentos utilizados'),
    jsonb_build_object('order', 4, 'title', '4. Inspeção Visual', 'required', true, 'description', 'Observações da inspeção'),
    jsonb_build_object('order', 5, 'title', '5. Diagnóstico', 'required', true, 'description', 'Análise técnica'),
    jsonb_build_object('order', 6, 'title', '6. Conclusões', 'required', true, 'description', 'Conclusão técnica'),
    jsonb_build_object('order', 7, 'title', '7. Registro Fotográfico', 'required', false, 'description', 'Fotos'),
    jsonb_build_object('order', 8, 'title', '8. Responsável Técnico', 'required', true, 'description', 'Dados do RT')
  ),

  -- Perguntas de intake
  jsonb_build_array(
    jsonb_build_object('id', 'q1', 'question', 'Tipo de edificação?', 'type', 'select',
                       'options', jsonb_build_array('Residencial', 'Comercial', 'Industrial'), 'required', true),
    jsonb_build_object('id', 'q2', 'question', 'Motivo da vistoria?', 'type', 'textarea',
                       'required', true, 'placeholder', 'Ex: Avaliação de patologias'),
    jsonb_build_object('id', 'q3', 'question', 'Há projeto aprovado?', 'type', 'boolean', 'required', true),
    jsonb_build_object('id', 'q4', 'question', 'Data da vistoria', 'type', 'date', 'required', true),
    jsonb_build_object('id', 'q5', 'question', 'Problemas estruturais?', 'type', 'boolean', 'required', true),
    jsonb_build_object('id', 'q6', 'question', 'Principais problemas', 'type', 'textarea', 'required', false)
  ),

  -- Campos obrigatórios
  jsonb_build_array('customer_id', 'project_id', 'property_id'),

  -- Guia de estilo
  'Tom técnico e objetivo. Linguagem formal conforme padrões ABNT e normas técnicas da engenharia civil. Manter imparcialidade e embasamento técnico. Estilo corporativo Aliancer: claro, preciso e profissional.',

  -- Regras
  jsonb_build_object(
    'not_invent_data', true,
    'use_placeholders', true,
    'generate_pending_list', true,
    'require_technical_review', true,
    'description', 'REGRAS IMPORTANTES: (1) NUNCA inventar dados técnicos - sempre usar [A COMPLETAR] quando não houver informação específica; (2) Ao final do documento, gerar seção "PENDÊNCIAS" listando todas as informações que precisam ser complementadas; (3) Manter linguagem técnica e formal; (4) Referenciar normas técnicas quando aplicável (ABNT, NBR); (5) Documento requer revisão técnica antes de aprovação final',
    'references', jsonb_build_array('ABNT NBR 16747:2020 - Inspeção predial', 'ABNT NBR 16280:2015 - Reforma em edificações'),
    'placeholders_rules', 'Sempre usar formato [A COMPLETAR: descrição do que precisa ser preenchido]. Exemplo: [A COMPLETAR: área total do imóvel em m²]'
  )
);
```

---

## 🔧 Como Usar na Interface

### Passo 1: Configurar Template

1. Acesse "Documentos IA" → Aba "Templates"
2. Clique no ícone de engrenagem (⚙️) no template desejado
3. Configure:
   - ✓ IA Habilitada (checkbox)
   - Tipo de Documento (select)
   - Guia de Estilo (textarea)
4. Clique "Salvar Configuração"

### Passo 2: Criar Documento

1. Clique "Novo Documento"
2. Selecione template e projeto
3. Clique "Criar"

**Se template tem perguntas:**
- Modal de intake abre automaticamente
- Responda as perguntas
- Clique "Gerar Documento"

**Se template NÃO tem perguntas:**
- Documento criado diretamente
- Clique "Gerar" quando quiser iniciar

### Passo 3: Geração Assíncrona

1. Job criado em background
2. UI mostra "Gerando 0%"
3. Progresso atualiza a cada 3s (polling)
4. Quando completo: status muda para "Gerado"

---

## 📊 Snapshot de Configuração

Ao criar documento, sistema faz **snapshot** da configuração de IA:

```sql
-- Snapshot salvo em ai_generated_documents.ia_config_snapshot
{
  "ia_enabled": true,
  "ia_doc_type": "laudo",
  "ia_sections": [...],
  "ia_intake_questions": [...],
  "ia_style_guide": "...",
  "ia_rules": {...},
  "snapshot_at": "2026-02-11T12:00:00Z"
}
```

**Benefício:**
- Documentos preservam configuração usada na geração
- Mudanças no template não afetam documentos já gerados
- Auditoria completa

---

## 🔍 Consultas Úteis

### Ver templates com IA habilitada
```sql
SELECT name, ia_doc_type, ia_enabled
FROM ai_document_templates
WHERE ia_enabled = true;
```

### Ver perguntas de intake de um template
```sql
SELECT name, ia_intake_questions
FROM ai_document_templates
WHERE name = 'Laudo Técnico';
```

### Ver respostas de intake de um documento
```sql
SELECT
  d.document_title,
  d.intake_answers
FROM ai_generated_documents d
WHERE d.id = 'document_id';
```

### Validar configuração de template
```sql
SELECT validate_ia_config('template_id');
```

---

## ✅ Checklist de Configuração

Template bem configurado deve ter:

- [ ] `ia_enabled = true`
- [ ] `ia_doc_type` definido
- [ ] **Mínimo 3 seções** em `ia_sections`
- [ ] **Mínimo 2 perguntas** em `ia_intake_questions`
- [ ] `ia_style_guide` com pelo menos 50 caracteres
- [ ] `ia_rules.not_invent_data = true`
- [ ] `ia_rules.use_placeholders = true`
- [ ] `ia_rules.generate_pending_list = true`

---

## 🚀 Fluxo Completo

```
1. Usuário configura template
   ↓
2. Usuário cria documento
   ↓
3. Sistema faz snapshot da config
   ↓
4. Modal de intake aparece
   ↓
5. Usuário responde perguntas
   ↓
6. Respostas salvas em intake_answers
   ↓
7. Job de geração criado
   ↓
8. Edge Function processa:
   - Lê ia_sections do snapshot
   - Lê intake_answers
   - Aplica ia_rules
   - Usa ia_style_guide
   - Gera seções em ordem
   ↓
9. Documento gerado!
   ↓
10. Lista de pendências criada
```

---

## 📝 Template de Exemplo Incluído

Sistema já vem com template de exemplo:
- **Nome:** "Laudo Técnico de Vistoria - Exemplo"
- **8 seções** configuradas
- **6 perguntas** de intake
- **Regras completas**
- **Referências ABNT**

Use como base para criar seus templates!

---

## 🎓 Boas Práticas

### Seções
- Mínimo 3, máximo 15 seções
- Títulos numerados (1. 2. 3.)
- Descrições claras do conteúdo esperado
- Marcar como `required` apenas essenciais

### Perguntas de Intake
- Máximo 10 perguntas
- Perguntas curtas e objetivas
- Usar `placeholder` para exemplos
- Agrupar por tema
- Obrigatórias apenas o essencial

### Guia de Estilo
- Mínimo 50 caracteres
- Especificar tom
- Mencionar normas
- Definir público-alvo

### Regras
- **SEMPRE** ativar `not_invent_data`
- **SEMPRE** ativar `use_placeholders`
- **SEMPRE** ativar `generate_pending_list`
- Incluir normas relevantes

---

**Resultado:** Sistema totalmente configurável por template! Cada tipo de documento pode ter sua própria personalidade, perguntas e regras. 🎉
