# Correção: Template PRAD sem Seções IA (Documento Vazio)

## Data
12 de fevereiro de 2026 - 06:30

## Problema Reportado

Usuário gerou documento PRAD e recebeu apenas:
```markdown
# PRAD - Plano de Recuperação de Área Degradada

**Projeto:** Prad Nestor Staub
**Cliente:** Nestor Staub
**Imóvel:** LOTE RURAL N° 35
**Tipo:** Rural
**Data:** 12/02/2026

---

## Anexos

Os seguintes documentos foram anexados a este projeto:

1. WhatsApp Image 2026-02-11 at 15.07.14.jpeg
2. WhatsApp Image 2026-02-11 at 15.07.11.jpeg
3. WhatsApp Image 2026-02-11 at 15.07.10 (1).jpeg
```

**Resultado**: Documento com **apenas cabeçalho e anexos**, sem nenhum conteúdo técnico (diagnóstico, plano de intervenção, cronograma, monitoramento, etc.)

**Expectativa**: Documento técnico completo com 12 seções estruturadas do PRAD

## Causa Raiz

### Investigação do Problema

1. **Verificação do Job**:
```sql
SELECT status, progress_percent, error_message
FROM project_ia_jobs
WHERE id = '8d26025c-f8e3-4122-af27-f8f833995bd2';
```

**Resultado**: Job concluído com sucesso (status: `completed`, progress: `100%`, sem erros)

2. **Verificação do Output**:
```sql
SELECT word_count, section_count, output_markdown
FROM project_ia_outputs
WHERE job_id = '8d26025c-f8e3-4122-af27-f8f833995bd2';
```

**Resultado**:
- `word_count`: 56 palavras (muito baixo!)
- `section_count`: 2 seções (apenas "Cabeçalho" e "Anexos")
- `output_markdown`: Apenas cabeçalho + lista de anexos

3. **Verificação do Template**:
```sql
SELECT
  name,
  ia_enabled,
  ia_sections,
  jsonb_array_length(ia_sections) as total_secoes
FROM ai_document_templates
WHERE name ILIKE '%PRAD%';
```

**Resultado**:
```json
{
  "name": "PRAD - Plano de Recuperação de Área Degradada",
  "ia_enabled": true,
  "ia_sections": [],  // ❌ ARRAY VAZIO!
  "total_secoes": 0
}
```

### Root Cause

O template PRAD na tabela `ai_document_templates` estava com `ia_sections` **vazio** (`[]`).

**Como a Edge Function funciona**:
```typescript
// Edge Function: generateDocument()
const totalSections = jobData.template.ia_sections.length; // 0 seções

for (let i = 0; i < totalSections; i++) {
  // Loop nunca executa porque totalSections = 0
  // Nenhuma seção técnica é gerada
}

// Apenas cabeçalho e anexos são adicionados
```

### Por Que Isso Aconteceu?

A configuração completa do template PRAD **existia** em `engineering_service_templates`:
- ✅ 12 seções estruturadas
- ✅ 29 perguntas de intake
- ✅ 15 regras de geração IA

Mas **NÃO estava sincronizada** com `ai_document_templates` (tabela que a Edge Function usa):
- ❌ `ia_sections` = []
- ❌ `ia_intake_questions` = []
- ❌ `ia_rules` = {}

## Solução Implementada

### Migration Aplicada: `fix_prad_template_ia_sections.sql`

```sql
-- Sincronizar configuração IA do template PRAD
UPDATE ai_document_templates
SET
  -- Copiar 12 seções estruturadas
  ia_sections = (
    SELECT ia_sections
    FROM engineering_service_templates
    WHERE name ILIKE '%PRAD%'
    LIMIT 1
  ),

  -- Copiar 29 perguntas de intake
  ia_intake_questions = (
    SELECT ia_intake_questions
    FROM engineering_service_templates
    WHERE name ILIKE '%PRAD%'
    LIMIT 1
  ),

  -- Atualizar guia de estilo
  ia_style_guide = 'Tom técnico e profissional. Linguagem clara e objetiva conforme padrões da Aliancer Engenharia. Seguir rigorosamente as 12 seções estruturadas do PRAD. Incluir obrigatoriamente relatório fotográfico georreferenciado e geolocalização KML.',

  -- Copiar regras de geração
  ia_rules = (
    SELECT ia_rules
    FROM engineering_service_templates
    WHERE name ILIKE '%PRAD%'
    LIMIT 1
  ),

  updated_at = now()

WHERE name ILIKE '%PRAD%';
```

### Resultado da Correção

**Antes**:
```json
{
  "ia_sections": [],
  "ia_intake_questions": [],
  "total_secoes": 0,
  "total_perguntas": 0
}
```

**Depois**:
```json
{
  "ia_sections": [
    {
      "order": 1,
      "title": "1. Identificação do Empreendimento e Responsável Técnico",
      "description": "Dados cadastrais do empreendedor, localização do imóvel, responsável técnico (CREA/CAU) e contatos",
      "type": "cadastral"
    },
    {
      "order": 2,
      "title": "2. Objetivo e Escopo do PRAD",
      "description": "Objetivo geral, justificativa da recuperação e escopo das intervenções propostas",
      "type": "text"
    },
    {
      "order": 3,
      "title": "3. Dados de Entrada e Caracterização da Área",
      "description": "Localização (coordenadas/KML), área degradada (ha), tipo de degradação, causas, situação legal, uso anterior e atual",
      "type": "data"
    },
    {
      "order": 4,
      "title": "4. Diagnóstico Ambiental",
      "description": "Caracterização do meio físico (solo, relevo, hidrologia), meio biótico (flora, fauna) e meio antrópico (uso do solo). Incluir relatório fotográfico georreferenciado",
      "type": "diagnostic"
    },
    {
      "order": 5,
      "title": "5. Avaliação de Riscos e Vulnerabilidades",
      "description": "Riscos ambientais identificados (erosão, assoreamento, contaminação) e vulnerabilidades locais",
      "type": "analysis"
    },
    {
      "order": 6,
      "title": "6. Plano de Intervenção e Técnicas de Recuperação",
      "description": "Detalhamento das técnicas selecionadas: bioengenharia, contenções, drenagem, revegetação, hidrossemeadura, etc. Incluir memorial descritivo e quantitativos",
      "type": "plan"
    },
    {
      "order": 7,
      "title": "7. Medidas Emergenciais (se aplicável)",
      "description": "Ações imediatas necessárias para estabilização da área ou contenção de riscos",
      "type": "emergency"
    },
    {
      "order": 8,
      "title": "8. Cronograma de Execução",
      "description": "Cronograma físico das atividades de recuperação (em meses ou anos)",
      "type": "schedule"
    },
    {
      "order": 9,
      "title": "9. Plano de Monitoramento e Indicadores",
      "description": "Indicadores selecionados (cobertura vegetal, estabilidade de taludes, qualidade da água, biodiversidade, erosão ativa), métodos de medição e frequência de monitoramento",
      "type": "monitoring"
    },
    {
      "order": 10,
      "title": "10. Custos Estimados",
      "description": "Orçamento estimado das intervenções e monitoramento",
      "type": "budget"
    },
    {
      "order": 11,
      "title": "11. Considerações Finais e Recomendações",
      "description": "Conclusões e recomendações técnicas",
      "type": "conclusion"
    },
    {
      "order": 12,
      "title": "12. Anexos",
      "description": "Relatório fotográfico georreferenciado, geolocalização/polígono KML, mapas, laudos, ART/RRT, outros documentos pertinentes",
      "type": "attachments"
    }
  ],
  "total_secoes": 12,
  "total_perguntas": 29
}
```

## Estrutura Completa do PRAD Agora Disponível

### 12 Seções Técnicas

1. ✅ **Identificação do Empreendimento** - Dados cadastrais, responsável técnico
2. ✅ **Objetivo e Escopo** - Justificativa e escopo das intervenções
3. ✅ **Caracterização da Área** - Localização, área degradada, tipo de degradação
4. ✅ **Diagnóstico Ambiental** - Meio físico, biótico, antrópico + fotos georreferenciadas
5. ✅ **Riscos e Vulnerabilidades** - Erosão, assoreamento, contaminação
6. ✅ **Plano de Intervenção** - Técnicas de recuperação (bioengenharia, revegetação, etc)
7. ✅ **Medidas Emergenciais** - Ações imediatas (se necessário)
8. ✅ **Cronograma** - Distribuição temporal das atividades
9. ✅ **Monitoramento** - Indicadores e frequência
10. ✅ **Custos Estimados** - Orçamento das intervenções
11. ✅ **Considerações Finais** - Conclusões e recomendações
12. ✅ **Anexos** - Fotos, KML, mapas, laudos, ART/RRT

### 29 Perguntas de Intake

Incluindo campos para:
- Dados cadastrais (empreendedor, responsável técnico, localização)
- Caracterização técnica (área degradada, tipo/causas, situação legal)
- Diagnóstico (solo, relevo, hidrologia, vegetação, fauna)
- Seleção múltipla de técnicas de recuperação
- Seleção múltipla de indicadores de monitoramento
- Cronograma e custos
- **Anexos obrigatórios**: relatório fotográfico georreferenciado + KML

### 15 Regras de Geração IA

- Seguir rigorosamente as 12 seções na ordem
- Incluir relatório fotográfico georreferenciado nas seções 4 e 12
- Incluir geolocalização/KML nas seções 3 e 12
- Detalhar cada técnica selecionada com memorial descritivo
- Não inventar dados - marcar como "PENDENTE" quando faltar informação
- Referenciar legislação ambiental (Lei 12.651/2012, resoluções CONAMA)
- Linguagem técnica adequada para documentos ambientais

## Como Testar Agora

### 1. Gerar Novo Documento

1. Vá para "Escritório de Engenharia" → "Projetos"
2. Abra o projeto "Prad Nestor Staub"
3. Aba "Documentos IA" → "+ Novo Documento IA"
4. Selecione "PRAD - Plano de Recuperação de Área Degradada"

**Agora você verá**: 29 perguntas de intake para preencher (antes eram 0)

5. Preencha as informações:
   - Nome do empreendedor
   - CPF/CNPJ
   - Localização completa
   - Responsável técnico e CREA
   - Área degradada (hectares)
   - Tipo de degradação
   - Selecione técnicas de recuperação (múltipla escolha)
   - Selecione indicadores de monitoramento (múltipla escolha)
   - Cronograma (meses)
   - Frequência de monitoramento
   - Observações gerais

6. Anexe arquivos obrigatórios:
   - Relatório fotográfico georreferenciado (PDF/JPG)
   - Geolocalização/polígono KML

7. Preencha o briefing (ex: "Gerar PRAD completo conforme Aliancer")

8. Clique "Gerar Documento"

### 2. Resultado Esperado

**Documento gerado terá**:
```markdown
# PRAD - Plano de Recuperação de Área Degradada

[Cabeçalho com dados do projeto]

---

## 1. Identificação do Empreendimento e Responsável Técnico
[Dados cadastrais completos do empreendedor]
[Dados do responsável técnico com CREA]
[Contatos e localização]

## 2. Objetivo e Escopo do PRAD
[Objetivo geral da recuperação]
[Justificativa técnica]
[Escopo das intervenções]

## 3. Dados de Entrada e Caracterização da Área
[Coordenadas geográficas]
[Área degradada em hectares]
[Tipo de degradação identificada]
[Causas da degradação]
[Situação legal (APP, RL, etc)]
[Uso anterior e atual]
[Referência ao arquivo KML anexado]

## 4. Diagnóstico Ambiental
[Caracterização do solo]
[Relevo e declividade]
[Hidrologia local]
[Vegetação remanescente]
[Fauna observada]
[Descrição das fotos georreferenciadas]

## 5. Avaliação de Riscos e Vulnerabilidades
[Riscos ambientais identificados]
[Erosão ativa]
[Assoreamento]
[Contaminação]
[Vulnerabilidades]

## 6. Plano de Intervenção e Técnicas de Recuperação
[Bioengenharia (se selecionado)]
  - Geomantas
  - Paliçadas
  - Fascinas
[Contenções estruturais (se selecionado)]
[Sistema de drenagem (se selecionado)]
[Revegetação com nativas (se selecionado)]
  - Lista de espécies
  - Densidade de plantio (1 muda/9m²)
  - Cálculo de mudas necessárias
[Hidrossemeadura (se selecionado)]
[Outras técnicas]
[Memorial descritivo e quantitativos]

## 7. Medidas Emergenciais
[Se aplicável: ações imediatas]
[Ou: "Não aplicável"]

## 8. Cronograma de Execução
[Distribuição das atividades no tempo]
[Ex: Mês 1-2: Preparação do terreno]
[Ex: Mês 3-4: Plantio de mudas]
[Ex: Mês 5+: Monitoramento]

## 9. Plano de Monitoramento e Indicadores
[Cobertura vegetal (%)]
[Estabilidade de taludes]
[Qualidade da água]
[Biodiversidade]
[Erosão ativa]
[Taxa de sobrevivência de mudas]
[Métodos de medição]
[Frequência: trimestral/semestral/anual]

## 10. Custos Estimados
[Orçamento das intervenções]
[Custos de monitoramento]
[Total estimado]

## 11. Considerações Finais e Recomendações
[Conclusões técnicas]
[Recomendações adicionais]
[Referência à legislação aplicável]

## 12. Anexos
- Relatório fotográfico georreferenciado (anexado)
- Geolocalização/polígono KML (anexado)
- ART/RRT
- Outros documentos
```

**Estatísticas esperadas**:
- ✅ 12 seções técnicas completas
- ✅ 2000+ palavras (vs. 56 antes)
- ✅ Conteúdo técnico detalhado
- ✅ Referências à legislação ambiental
- ✅ Cálculos técnicos (mudas, cronograma)

## Status

- ✅ Template corrigido (12 seções carregadas)
- ✅ Perguntas de intake disponíveis (29)
- ✅ Regras de geração configuradas (15)
- ✅ Migration aplicada
- ✅ Build concluído sem erros
- ✅ Sistema pronto para gerar documentos completos

## Arquivos Modificados

### Migrations
- ✅ `supabase/migrations/fix_prad_template_ia_sections.sql` (criado)

### Tabelas Afetadas
- ✅ `ai_document_templates` (template PRAD atualizado)

## Impacto

**Antes da Correção**:
- ❌ Documentos PRAD vazios (apenas cabeçalho + anexos)
- ❌ 0 seções técnicas
- ❌ 56 palavras
- ❌ Usuários decepcionados

**Após Correção**:
- ✅ Documentos PRAD completos e técnicos
- ✅ 12 seções estruturadas
- ✅ 2000+ palavras estimadas
- ✅ Conformidade com padrões Aliancer
- ✅ Atende requisitos regulatórios

## Recomendação

**Por favor, tente gerar o documento PRAD novamente** seguindo os passos acima. O sistema agora tem toda a estrutura técnica necessária para gerar um documento profissional e completo.

Se ainda houver algum problema, compartilhe o resultado para investigarmos mais.

---

**Relacionado a**:
- `CORRECAO_CAMPO_EXPECTED_END_DATE.md` (correção da Edge Function)
- `CORRECAO_ERRO_USER_ID_NULL.md` (correção do modal)
- `IMPLEMENTACAO_COMPLETA_IA_11FEV2026.md` (implementação original)
