# Sistema de Geração de Documentos Técnicos com IA

## Visão Geral

Sistema completo para geração automatizada de documentos técnicos (laudos, relatórios, estudos, diagnósticos e projetos textuais) usando Inteligência Artificial, integrado ao fluxo de projetos de engenharia.

## Características Principais

### 1. Templates Configuráveis
- Templates de documentos por tipo de serviço
- Seções personalizáveis com prompts de IA
- Estrutura flexível (capa, sumário, referências, anexos)
- Configurações de IA por template (modelo, temperatura, tokens)

### 2. Tipos de Documentos Suportados
1. **Avaliação de Imóveis** - Laudos técnicos conforme NBR 14653
2. **Georreferenciamento** - Memorial descritivo conforme Lei 10.267/2001
3. **PRAD** - Plano de Recuperação de Área Degradada
4. **Realocação de Reserva Legal** - Projeto conforme Código Florestal
5. **Projetos de Terraplanagem** - Memorial de cálculo

### 3. Fluxo de Trabalho
- Criação de documento a partir de template
- Geração automática de conteúdo com IA
- Revisão e edição manual
- Versionamento automático
- Aprovação e finalização
- Exportação em múltiplos formatos

## Estrutura do Banco de Dados

### Tabelas Criadas

#### 1. `ai_document_templates`
Templates de documentos técnicos com configuração de IA.

**Campos principais:**
- `name` - Nome do template
- `document_type` - Tipo de documento técnico
- `service_template_id` - Vínculo com template de serviço
- `include_cover_page`, `include_table_of_contents`, `include_references` - Configurações de estrutura
- `ai_model` - Modelo de IA (padrão: gpt-4)
- `temperature` - Criatividade da IA (0.0 a 2.0)
- `max_tokens` - Limite de tokens por geração

#### 2. `ai_document_sections`
Seções dos templates com prompts de IA.

**Campos principais:**
- `template_id` - Referência ao template
- `section_title` - Título da seção
- `section_number` - Numeração (1, 2, 3.1, etc)
- `order_index` - Ordem de apresentação
- `content_type` - Tipo de conteúdo (texto, lista, tabela, etc)
- `ai_prompt` - Prompt para a IA gerar o conteúdo
- `generation_instructions` - Instruções específicas de geração
- `example_output` - Exemplo de saída esperada

#### 3. `ai_generated_documents`
Documentos gerados a partir dos templates.

**Campos principais:**
- `template_id`, `project_id`, `customer_id`, `property_id` - Vínculos
- `document_title` - Título do documento
- `version` - Número da versão
- `status` - Status do documento (rascunho, gerando, gerado, em_revisao, aprovado, etc)
- `context_data` - Dados de contexto do projeto (JSON)
- `technical_data` - Dados técnicos específicos (JSON)
- `tokens_used` - Total de tokens utilizados
- `estimated_cost` - Custo estimado da geração

#### 4. `ai_document_section_contents`
Conteúdo gerado para cada seção de um documento.

**Campos principais:**
- `document_id`, `section_id` - Vínculos
- `generated_content` - Conteúdo gerado pela IA
- `is_manually_edited` - Se foi editado manualmente
- `edited_content` - Conteúdo após edição
- `prompt_used` - Prompt utilizado na geração
- `ai_response_raw` - Resposta bruta da IA

#### 5. `ai_document_revisions`
Histórico de revisões e alterações.

**Campos principais:**
- `document_id` - Referência ao documento
- `version_number` - Número da versão
- `revision_type` - Tipo de revisão (criacao, edicao_manual, regeneracao_ia, aprovacao, rejeicao)
- `previous_content`, `new_content` - Conteúdo anterior e novo (JSON)
- `changes_summary` - Resumo das alterações

## Como Usar

### 1. Acessar o Sistema

No módulo **Escritório de Engenharia e Topografia**, acesse a aba **Documentos IA**.

### 2. Criar um Novo Documento

1. Clique em **"Novo Documento"**
2. Selecione um **Template** (ex: Laudo de Avaliação de Imóvel)
3. Selecione o **Projeto** relacionado
4. Defina o **Título do Documento** (opcional, usa o nome do template por padrão)
5. Clique em **"Criar Documento"**

O sistema criará um documento em status "rascunho" com todas as seções vazias.

### 3. Gerar Conteúdo com IA

Existem duas opções:

**A) Gerar Documento Completo:**
- Clique em **"Gerar com IA"** no card do documento
- O sistema gerará todas as seções automaticamente
- Status muda para "gerando" e depois "gerado"

**B) Gerar Seção Individual:**
- Clique em **"Visualizar"** no documento
- Expanda a seção desejada
- Clique em **"Gerar com IA"** na seção específica

### 4. Revisar e Editar

1. Visualize o documento gerado
2. Expanda cada seção para revisar o conteúdo
3. Clique em **"Editar"** para fazer alterações manuais
4. As edições ficam marcadas e rastreadas no histórico

### 5. Aprovar e Exportar

1. Revise todo o conteúdo
2. Clique em **"Aprovar"** quando estiver pronto
3. Clique em **"Exportar PDF"** para gerar o documento final
4. O sistema também pode exportar em DOCX (Word)

## Integração com APIs de IA

### Configuração Necessária

O sistema está preparado para integração com OpenAI (GPT-4), mas você precisa configurar:

#### 1. Criar Edge Function para Geração

Crie um arquivo `supabase/functions/generate-document-section/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentId, sectionId, context } = await req.json();

    // Buscar seção e prompt
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: section } = await supabase
      .from('ai_document_sections')
      .select('*')
      .eq('id', sectionId)
      .single();

    if (!section) throw new Error('Seção não encontrada');

    // Processar prompt com variáveis de contexto
    let prompt = section.ai_prompt;
    Object.keys(context).forEach(key => {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), context[key] || '');
    });

    // Chamar OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em documentos técnicos de engenharia. ' +
                     'Gere conteúdo profissional, formal e tecnicamente preciso.'
          },
          {
            role: 'user',
            content: prompt + '\n\nInstruções: ' + section.generation_instructions
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const aiResult = await openaiResponse.json();
    const generatedContent = aiResult.choices[0].message.content;
    const tokensUsed = aiResult.usage.total_tokens;

    // Salvar conteúdo gerado
    await supabase
      .from('ai_document_section_contents')
      .update({
        generated_content: generatedContent,
        prompt_used: prompt,
        ai_response_raw: JSON.stringify(aiResult),
        tokens_used: tokensUsed,
        generated_at: new Date().toISOString()
      })
      .eq('document_id', documentId)
      .eq('section_id', sectionId);

    return new Response(
      JSON.stringify({
        content: generatedContent,
        tokensUsed: tokensUsed
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

#### 2. Configurar Variáveis de Ambiente

No Supabase Dashboard, configure:
- `OPENAI_API_KEY` - Sua chave da API do OpenAI

#### 3. Atualizar Componente AIDocumentGenerator

No método `handleGenerateSection`, substitua o alerta por:

```typescript
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document-section`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    documentId: selectedDocument.id,
    sectionId: sectionId,
    context: {
      ...selectedDocument.context_data,
      ...selectedDocument.technical_data
    }
  })
});

const data = await response.json();

if (!response.ok) throw new Error(data.error);

// Recarregar seções
await loadDocumentSections();
```

### Custos Estimados

Com GPT-4:
- Entrada: ~$0.03 por 1K tokens
- Saída: ~$0.06 por 1K tokens

Documento típico de 10 páginas:
- ~3.000-5.000 tokens
- Custo estimado: $0.30 - $0.50

## Variáveis de Contexto

Os prompts de IA suportam variáveis de contexto usando a sintaxe `{{variavel}}`.

### Variáveis Disponíveis

**Do Projeto:**
- `{{project_name}}` - Nome do projeto
- `{{customer_name}}` - Nome do cliente
- `{{property_name}}` - Nome do imóvel

**Do Imóvel:**
- `{{property_type}}` - Tipo (rural/urbano)
- `{{property_address}}` - Endereço completo
- `{{area_total}}` - Área total
- `{{municipality}}` - Município
- `{{state}}` - Estado

**Dados Técnicos (customizáveis):**
- `{{evaluation_method}}` - Método de avaliação
- `{{coordinates}}` - Coordenadas geográficas
- `{{final_value}}` - Valor final
- Qualquer outro dado que você adicionar em `technical_data`

## Templates Pré-Configurados

### 1. Laudo de Avaliação de Imóvel

**Seções:**
1. Introdução
2. Caracterização do Imóvel
3. Metodologia de Avaliação
4. Pesquisa de Mercado e Dados Comparativos
5. Cálculos e Análise de Resultados
6. Conclusão e Valor de Avaliação

### 2. Memorial Descritivo de Georreferenciamento

**Seções:**
1. Objetivo e Finalidade
2. Descrição do Imóvel e Localização
3. Metodologia e Equipamentos
4. Memorial Descritivo
5. Tabela de Coordenadas

### 3. PRAD

**Seções:**
1. Caracterização da Área Degradada
2. Objetivos da Recuperação
3. Metodologia de Recuperação
4. Cronograma de Execução
5. Monitoramento e Manutenção

### 4. Realocação de Reserva Legal

(Template a ser configurado)

### 5. Projeto de Terraplanagem

(Template a ser configurado)

## Personalização de Templates

### Criar Novo Template

1. Acesse o banco de dados
2. Insira novo registro em `ai_document_templates`:

```sql
INSERT INTO ai_document_templates (
  name,
  document_type,
  description,
  include_cover_page,
  include_table_of_contents,
  ai_model,
  temperature
) VALUES (
  'Meu Template Personalizado',
  'laudo_tecnico',
  'Descrição do template',
  true,
  true,
  'gpt-4',
  0.7
);
```

### Adicionar Seções ao Template

```sql
INSERT INTO ai_document_sections (
  template_id,
  section_title,
  section_number,
  order_index,
  content_type,
  ai_prompt,
  generation_instructions
) VALUES (
  'uuid-do-template',
  'Título da Seção',
  '1',
  1,
  'texto',
  'Prompt detalhado para a IA. Use variáveis: {{property_name}}, {{area_total}}',
  'Instruções específicas: use linguagem formal, cite normas técnicas, etc.'
);
```

## Exportação de Documentos

### Exportar para PDF

O sistema usa jsPDF para gerar PDFs. A função de exportação (a ser implementada) irá:

1. Buscar todas as seções do documento
2. Aplicar formatação e estilo
3. Gerar PDF com:
   - Capa (se habilitado)
   - Sumário (se habilitado)
   - Conteúdo das seções
   - Referências (se habilitado)
4. Salvar URL do PDF no documento

### Exportar para DOCX

Usando a biblioteca `docx`, é possível gerar arquivos Word:

```typescript
import { Document, Packer, Paragraph, TextRun } from 'docx';

const doc = new Document({
  sections: [{
    properties: {},
    children: sections.map(section =>
      new Paragraph({
        children: [new TextRun(section.generated_content)]
      })
    )
  }]
});

const blob = await Packer.toBlob(doc);
// Salvar blob no Supabase Storage
```

## Monitoramento de Custos

O sistema rastreia automaticamente:
- Tokens utilizados por seção
- Tokens totais por documento
- Custo estimado (baseado em tabela de preços da API)

### Query para Relatório de Custos

```sql
SELECT
  d.document_title,
  d.document_type,
  d.tokens_used,
  d.estimated_cost,
  d.created_at,
  c.name as customer_name,
  p.project_name
FROM ai_generated_documents d
JOIN customers c ON c.id = d.customer_id
JOIN engineering_projects p ON p.id = d.project_id
WHERE d.created_at >= NOW() - INTERVAL '30 days'
ORDER BY d.estimated_cost DESC;
```

## Boas Práticas

### 1. Prompts Eficazes

- **Seja específico:** Quanto mais detalhado o prompt, melhor o resultado
- **Use exemplos:** Inclua exemplos de saída esperada
- **Defina o tom:** Formal, técnico, objetivo, etc.
- **Cite normas:** Mencione NBR, leis e normas técnicas aplicáveis
- **Use variáveis:** Aproveite o contexto do projeto

### 2. Revisão Humana

- **Sempre revise:** IA pode cometer erros ou incluir informações incorretas
- **Verifique cálculos:** Números e valores devem ser conferidos manualmente
- **Adapte ao caso:** Ajuste o conteúdo para o contexto específico
- **Edite linguagem:** Melhore a redação quando necessário

### 3. Segurança de Dados

- **Dados sensíveis:** Não inclua dados confidenciais nos prompts
- **Revisão de privacidade:** Revise o documento antes de compartilhar
- **Controle de acesso:** Use as políticas RLS do Supabase

### 4. Otimização de Custos

- **Use temperatura adequada:** Valores menores (0.6-0.7) são mais consistentes e baratos
- **Limite tokens:** Configure `max_tokens` apropriado para cada seção
- **Reutilize conteúdo:** Não regenere desnecessariamente
- **Cache respostas:** Mantenha histórico de gerações bem-sucedidas

## Roadmap Futuro

### Próximas Funcionalidades

1. **Exportação Avançada**
   - Geração de PDF com formatação profissional
   - Exportação para DOCX
   - Assinatura digital de documentos

2. **Modelos de IA Alternativos**
   - Suporte para Claude (Anthropic)
   - Suporte para Gemini (Google)
   - Modelos locais (Llama, etc)

3. **Geração de Imagens**
   - Mapas e diagramas com IA
   - Gráficos e tabelas visuais
   - Renderização de plantas técnicas

4. **Colaboração**
   - Comentários em seções
   - Aprovação multi-nível
   - Fluxo de revisão estruturado

5. **Análise e Relatórios**
   - Dashboard de documentos gerados
   - Métricas de qualidade
   - Análise de custos

## Suporte e Documentação

### Arquivos Relacionados

- **Migration:** `supabase/migrations/create_ai_document_generation_system.sql`
- **Componente:** `src/components/AIDocumentGenerator.tsx`
- **App:** `src/App.tsx` (integração)

### Logs e Debug

O sistema registra automaticamente:
- Prompts utilizados
- Respostas brutas da IA
- Tokens consumidos
- Erros de geração

Acesse a tabela `ai_document_section_contents` para debugging.

## Conclusão

O Sistema de Geração de Documentos Técnicos com IA transforma o processo de criação de laudos, relatórios e documentos técnicos, reduzindo drasticamente o tempo de elaboração enquanto mantém a qualidade profissional exigida.

Com templates pré-configurados e totalmente personalizáveis, o sistema se adapta às necessidades específicas de cada escritório de engenharia.

---

**Data de Criação:** 11 de fevereiro de 2026
**Versão:** 1.0
**Status:** Pronto para Integração com API de IA
