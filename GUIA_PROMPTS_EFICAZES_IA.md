# Guia de Prompts Eficazes para Documentos Técnicos

## 📚 Introdução

Este guia ensina como criar prompts de IA que geram documentos técnicos de alta qualidade para engenharia e topografia.

## 🎯 Anatomia de um Bom Prompt

Um prompt eficaz para documentos técnicos possui:

1. **Contexto Claro** - O que é e para que serve
2. **Instruções Específicas** - Como deve ser feito
3. **Formato Desejado** - Estrutura da resposta
4. **Restrições** - O que evitar
5. **Exemplo** (opcional) - Modelo de saída

### Estrutura Básica

```
[PAPEL] Você é um [especialista em X]

[CONTEXTO] Elabore [tipo de documento] para [finalidade]

[DADOS] Use os seguintes dados: {{variavel1}}, {{variavel2}}

[INSTRUÇÕES]
- Instrução 1
- Instrução 2
- Instrução 3

[FORMATO] Organize em [estrutura desejada]

[NORMAS] Siga as normas [lista de normas]

[TOM] Use linguagem [formal/técnica/objetiva]
```

## ✅ Exemplos de Prompts Eficazes

### 1. Introdução de Laudo de Avaliação

**❌ Prompt Ruim:**
```
Escreva uma introdução para avaliação de imóvel
```

**✅ Prompt Bom:**
```
Você é um engenheiro avaliador especializado em laudos conforme NBR 14653.

Elabore uma introdução profissional para um laudo de avaliação de imóvel.

Dados do imóvel:
- Tipo: {{property_type}}
- Localização: {{property_location}}
- Finalidade: {{evaluation_purpose}}

Instruções:
1. Apresente o objetivo do laudo
2. Indique a finalidade da avaliação
3. Cite a NBR 14653 como norma técnica aplicável
4. Mencione a data base da avaliação
5. Use linguagem formal e técnica
6. Extensão: 2-3 parágrafos

Formato:
- Parágrafo 1: Objetivo e contratante
- Parágrafo 2: Características do imóvel
- Parágrafo 3: Metodologia e normas

Importante: Não inclua valores ou conclusões nesta seção.
```

### 2. Memorial Descritivo de Georreferenciamento

**✅ Prompt Eficaz:**
```
Você é um engenheiro agrimensor especializado em georreferenciamento de imóveis rurais.

Elabore o memorial descritivo técnico do perímetro do imóvel conforme padrões do INCRA.

Dados disponíveis:
- Nome do imóvel: {{property_name}}
- Município: {{municipality}}, {{state}}
- Matrícula: {{registration}}
- Área total: {{area}} hectares
- Número de vértices: {{vertices_count}}
- Datum: SIRGAS 2000

Instruções:
1. Descreva o perímetro iniciando no vértice V1
2. Para cada vértice, informe:
   - Número do vértice
   - Azimute em relação ao próximo vértice
   - Distância até o próximo vértice
   - Confrontante nesse trecho
3. Feche o polígono retornando ao vértice V1
4. Inclua a área total calculada
5. Use linguagem técnica conforme padrão INCRA

Formato:
"Inicia-se a descrição deste perímetro no vértice V1, de coordenadas..."

Normas: Lei 10.267/2001 e Norma Técnica de Georreferenciamento do INCRA.
```

### 3. Caracterização de Área Degradada (PRAD)

**✅ Prompt Eficaz:**
```
Você é um engenheiro ambiental especializado em recuperação de áreas degradadas.

Caracterize tecnicamente a área degradada para elaboração de PRAD.

Dados da área:
- Localização: {{location}}
- Área afetada: {{degraded_area}} hectares
- Tipo de degradação: {{degradation_type}}
- Uso anterior: {{previous_use}}
- Estado atual: {{current_state}}

Instruções:
1. Descreva a localização geográfica precisa
2. Apresente o histórico de uso da área
3. Caracterize o tipo de degradação observado
4. Quantifique a extensão da área afetada
5. Descreva o estado atual (vegetação, solo, erosão, etc)
6. Identifique as principais causas da degradação
7. Avalie o grau de degradação (leve, moderado, severo)
8. Use terminologia técnica da legislação ambiental

Formato:
- Localização e coordenadas
- Histórico de uso
- Caracterização da degradação
- Causas identificadas
- Avaliação do grau de degradação

Legislação: Código Florestal (Lei 12.651/2012), CONAMA 429/2011.
Extensão: 3-4 parágrafos técnicos.
```

### 4. Metodologia de Avaliação

**✅ Prompt Eficaz:**
```
Você é um engenheiro avaliador experiente em métodos de avaliação imobiliária.

Explique a metodologia de avaliação utilizada neste laudo.

Dados metodológicos:
- Método escolhido: {{evaluation_method}}
- Grau de fundamentação: {{fundamentation_degree}}
- Grau de precisão: {{precision_degree}}
- Amostras coletadas: {{samples_count}}

Instruções:
1. Identifique o método conforme NBR 14653 (comparativo de dados de mercado, involutivo, evolutivo, etc)
2. Justifique tecnicamente a escolha do método
3. Descreva os procedimentos:
   - Pesquisa de mercado realizada
   - Critérios de seleção de dados
   - Tratamento de dados (homogeneização)
   - Tratamento estatístico aplicado
4. Informe o grau de fundamentação alcançado
5. Informe o grau de precisão esperado
6. Cite a NBR 14653-1 e NBR 14653-2

Formato técnico:
- Parágrafo 1: Método e justificativa
- Parágrafo 2: Procedimentos de pesquisa
- Parágrafo 3: Tratamento de dados
- Parágrafo 4: Graus de fundamentação e precisão

Tom: Formal, técnico, objetivo.
```

### 5. Conclusão de Laudo

**✅ Prompt Eficaz:**
```
Você é um engenheiro avaliador elaborando a conclusão de um laudo técnico.

Elabore a conclusão do laudo de avaliação de imóvel.

Dados para conclusão:
- Valor de avaliação: R$ {{final_value}}
- Valor unitário: R$ {{unit_value}} por m²
- Área avaliada: {{area}} m²
- Grau de fundamentação: {{fundamentation}}
- Grau de precisão: {{precision}}
- Data base: {{evaluation_date}}
- Finalidade: {{purpose}}

Instruções:
1. Apresente síntese dos trabalhos realizados
2. Informe o valor total de avaliação por extenso e numeral
3. Informe o valor unitário (R$/m²)
4. Especifique o grau de fundamentação alcançado
5. Especifique o grau de precisão alcançado
6. Indique a data base da avaliação
7. Ressalve a validade temporal da avaliação (geralmente 12 meses)
8. Inclua declaração de imparcialidade e responsabilidade técnica

Formato:
- Síntese dos trabalhos (1 parágrafo)
- Valor de avaliação (destaque)
- Graus de fundamentação e precisão
- Data base e validade
- Declaração de responsabilidade

Importante:
- Use "conclui-se" ou "concluímos"
- Escreva valores por extenso e entre parênteses
- Tom formal e conclusivo
- Não adicione novas informações técnicas
```

## 🔧 Variáveis de Contexto

### Sintaxe

Use a notação `{{nome_variavel}}` para inserir dados dinâmicos.

### Variáveis Disponíveis

#### Projeto
```
{{project_name}}          - Nome do projeto
{{project_code}}          - Código do projeto
{{start_date}}            - Data de início
{{estimated_completion}}  - Previsão de conclusão
```

#### Cliente
```
{{customer_name}}         - Nome do cliente
{{customer_cpf_cnpj}}    - CPF/CNPJ
{{customer_address}}      - Endereço
{{customer_phone}}        - Telefone
```

#### Imóvel
```
{{property_name}}         - Nome/identificação
{{property_type}}         - Tipo (rural/urbano)
{{property_address}}      - Endereço completo
{{area_total}}            - Área total
{{municipality}}          - Município
{{state}}                 - Estado
{{registration}}          - Matrícula
{{coordinates}}           - Coordenadas geográficas
```

#### Técnicos (Customizáveis)
```
{{evaluation_method}}     - Método de avaliação
{{evaluation_purpose}}    - Finalidade
{{final_value}}           - Valor final
{{unit_value}}            - Valor unitário
{{vertices_count}}        - Quantidade de vértices
{{degradation_type}}      - Tipo de degradação
{{equipment}}             - Equipamentos utilizados
{{methodology}}           - Metodologia aplicada
```

### Como Adicionar Novas Variáveis

No componente ou na tela de edição do projeto, adicione dados em `technical_data`:

```typescript
const technicalData = {
  evaluation_method: 'Comparativo de dados de mercado',
  final_value: 250000,
  unit_value: 1250,
  vertices_count: 12,
  equipment: 'GPS RTK Topcon Hiper HR',
  // ... outros dados técnicos
};
```

## 📝 Templates de Prompts por Tipo

### Texto Corrido

```
Você é um [especialista].

Elabore [tipo de seção] para [finalidade].

Dados: {{var1}}, {{var2}}

Instruções:
1. [instrução 1]
2. [instrução 2]
3. [instrução 3]

Formato: [número] parágrafos, linguagem [tom].

Normas: [lista de normas].
```

### Lista

```
Você é um [especialista].

Liste [o que listar] para [documento].

Dados disponíveis: {{var1}}, {{var2}}

Formato da lista:
- Item 1: descrição
- Item 2: descrição
- Item 3: descrição

Cada item deve conter:
1. [campo 1]
2. [campo 2]
3. [campo 3]

Importante: ordene por [critério].
```

### Tabela

```
Você é um [especialista].

Crie uma tabela de [conteúdo] para [documento].

Dados: {{var1}}, {{var2}}

Estrutura da tabela:
Colunas: [Col1] | [Col2] | [Col3] | [Col4]

Instruções:
1. Inclua no mínimo [X] linhas
2. Ordene por [critério]
3. Valores em [formato]

Formato: Markdown table ou texto formatado.
```

### Cálculo

```
Você é um engenheiro calculista.

Apresente os cálculos de [tipo] para [documento].

Dados para cálculo:
- Variável 1: {{var1}}
- Variável 2: {{var2}}
- Variável 3: {{var3}}

Instruções:
1. Mostre as fórmulas utilizadas
2. Substitua os valores nas fórmulas
3. Apresente os cálculos intermediários
4. Destaque o resultado final
5. Inclua unidades em todos os valores

Formato:
Fórmula: [equação]
Substituição: [valores]
Cálculo: [passo a passo]
Resultado: [valor final com unidade]

Normas técnicas: [lista].
```

## 🎨 Ajuste de Tom e Estilo

### Formal
```
Use linguagem formal, técnica e objetiva.
Evite gírias, coloquialismos e expressões informais.
Prefira voz passiva quando apropriado.
Use terceira pessoa.
```

### Técnico-Científico
```
Use terminologia técnica precisa.
Cite normas, leis e referências bibliográficas.
Inclua nomenclatura científica quando aplicável.
Seja específico em unidades de medida.
Mantenha impessoalidade.
```

### Descritivo
```
Seja detalhado e específico.
Descreva características observáveis.
Use adjetivos técnicos (não subjetivos).
Organize descrições de forma lógica (geral para específico).
```

### Analítico
```
Apresente análise crítica e fundamentada.
Compare com padrões e referências.
Identifique relações de causa e efeito.
Justifique conclusões tecnicamente.
```

## ⚙️ Configuração de Parâmetros IA

### Temperature (Temperatura)

Controla a criatividade da IA:

- **0.0 - 0.3:** Muito conservador
  - ✅ Bom para: Cálculos, dados factuais, normas técnicas
  - ❌ Ruim para: Textos descritivos variados

- **0.4 - 0.7:** Equilibrado (recomendado)
  - ✅ Bom para: Maioria dos documentos técnicos
  - ✅ Resultados profissionais e variados

- **0.8 - 1.0:** Criativo
  - ✅ Bom para: Textos mais flexíveis
  - ❌ Ruim para: Documentos técnicos padronizados

- **1.1 - 2.0:** Muito criativo
  - ❌ Não recomendado para documentos técnicos

### Max Tokens

Limita o tamanho da resposta:

- **500 tokens:** ~350 palavras (1 página)
- **1000 tokens:** ~700 palavras (2 páginas)
- **2000 tokens:** ~1400 palavras (4 páginas)
- **4000 tokens:** ~2800 palavras (8 páginas)

**Recomendação:** Configure por seção:
- Introdução: 800-1000 tokens
- Metodologia: 1200-1500 tokens
- Dados tabulares: 1500-2000 tokens
- Conclusão: 600-800 tokens

## 🚫 Erros Comuns a Evitar

### ❌ Prompt Muito Vago
```
"Escreva sobre o imóvel"
```
**Problema:** IA não sabe o contexto, formato, tom ou detalhes necessários.

### ❌ Sem Variáveis de Contexto
```
"Descreva a localização do imóvel"
```
**Problema:** IA vai inventar dados ao invés de usar os reais.
**Solução:** Use `{{property_address}}`, `{{municipality}}`, etc.

### ❌ Instruções Contraditórias
```
"Seja breve mas inclua todos os detalhes possíveis"
```
**Problema:** IA fica confusa entre objetivos opostos.

### ❌ Sem Especificação de Formato
```
"Liste os equipamentos"
```
**Problema:** Pode retornar em qualquer formato (parágrafo, lista, tabela).

### ❌ Tom Inadequado
```
"Fale sobre a degradação da área"
```
**Problema:** Pode usar linguagem informal ou inadequada para laudo técnico.

## 💡 Dicas Profissionais

### 1. Teste e Itere
- Teste o prompt várias vezes
- Ajuste com base nos resultados
- Mantenha histórico de prompts bem-sucedidos

### 2. Use Exemplos
Inclua exemplo de saída esperada:
```
Exemplo de formato desejado:
"O imóvel objeto da avaliação localiza-se à [endereço], no município de [município], estado de [estado]..."
```

### 3. Seja Específico em Cálculos
```
Apresente o cálculo do volume de corte e aterro:
- Fórmula: V = (A1 + A2) / 2 × L
- Substitua os valores: {{area1}}, {{area2}}, {{length}}
- Mostre o resultado em m³
```

### 4. Cite Normas Específicas
```
Siga a NBR 14653-1:2019 (Avaliação de bens - Parte 1: Procedimentos gerais)
e NBR 14653-2:2011 (Avaliação de bens - Parte 2: Imóveis urbanos)
```

### 5. Defina Limites Claros
```
- Extensão: 3 parágrafos de 4-5 linhas cada
- Não inclua: valores finais ou conclusões
- Inclua: apenas caracterização física
```

## 📖 Recursos Adicionais

### Referências de Prompts

- [OpenAI Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Prompting Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)

### Normas Técnicas Relevantes

- NBR 14653 - Avaliação de bens
- NBR 13133 - Execução de levantamento topográfico
- Lei 10.267/2001 - Georreferenciamento
- Lei 12.651/2012 - Código Florestal
- CONAMA 429/2011 - Recuperação de áreas degradadas

## 🎓 Exercício Prático

### Desafio: Criar Prompt para "Análise de Solo"

Crie um prompt eficaz para gerar uma seção de "Análise de Características do Solo" para um PRAD.

**Dados disponíveis:**
- Tipo de solo: Argissolo Vermelho-Amarelo
- Textura: Argilosa
- pH: 5.2
- Profundidade: 1.5m
- Presença de erosão: Sim, sulcos rasos

**Requisitos:**
- Descrever características físicas e químicas
- Avaliar aptidão para recuperação
- Linguagem técnica
- Extensão: 2-3 parágrafos

**Sua vez:** Escreva o prompt completo seguindo as técnicas deste guia!

---

## ✅ Checklist de Prompt Eficaz

Antes de salvar seu prompt, verifique:

- [ ] Define papel do especialista
- [ ] Contexto claro do documento
- [ ] Usa variáveis de contexto `{{variavel}}`
- [ ] Instruções numeradas e específicas
- [ ] Formato de saída definido
- [ ] Tom e linguagem especificados
- [ ] Cita normas técnicas quando aplicável
- [ ] Define extensão ou limites
- [ ] Evita contradições
- [ ] Testado e validado

---

**Bons prompts = Documentos excelentes!** 🎯

**Dúvidas? Consulte a documentação completa ou experimente no sistema.**
