# Tabelas de Preços - Vendedor e Gerencial

## Visão Geral

Sistema completo de visualização e exportação de tabelas de preços com dois formatos distintos:

1. **Tabela Vendedor** - Sem informações de custo (para equipe de vendas)
2. **Tabela Gerencial** - Com informações completas de custo e margem (para gestão)

## Princípios Fundamentais

### Fonte Única de Dados

A tabela de preços **NÃO calcula valores**. Ela apenas **exibe** os valores já calculados e salvos nos cadastros:

#### Para Produtos:
- **Preço Sugerido** = `final_sale_price` (preço com impostos)
- Se `final_sale_price` estiver vazio, usa `sale_price` (preço sem impostos)
- **Custo Unitário** = `custo_unitario_materiais` ou `production_cost`

#### Para Insumos de Revenda:
- **Preço Sugerido** = `resale_price` (calculado automaticamente)
- **Custo Unitário** = `unit_cost`
- Fórmula do `resale_price`: `unit_cost + (unit_cost × resale_tax_percentage / 100) + (unit_cost × resale_margin_percentage / 100)`

### Sincronização Automática

- A tabela atualiza automaticamente quando:
  - Um produto é salvo ou editado na aba "Produtos"
  - Um insumo de revenda é salvo ou editado na aba "Insumos"
  - Qualquer valor de preço é modificado no banco de dados

## Estrutura da Aba "Tabela de Preços"

### Cabeçalho

- Título: "Tabela de Preços"
- Subtítulo: "Sincronizada com cadastros de Produtos e Insumos"
- Botão "Atualizar": Força recarregamento manual dos dados

### Cards de Resumo

1. **Total de Itens** - Quantidade total de produtos + insumos de revenda
2. **Com Preço** - Itens que têm preço calculado
3. **Sem Preço** - Itens sem preço definido (aparecem como "Preço não calculado")

### Filtros

#### 1. Formato de Tabela
- **Vendedor (sem custo)** - Oculta informações de custo
- **Gerencial (com custo/margem)** - Exibe todas as informações

#### 2. Categoria
- **Todos** - Produtos e Insumos de revenda
- **Produtos** - Apenas produtos cadastrados
- **Revenda** - Apenas insumos marcados como revenda

#### 3. Status
- **Checkbox "Apenas ativos"** - Marcado por padrão

#### 4. Busca
- Campo de texto para buscar por nome ou código
- Busca em tempo real (filtra enquanto digita)

### Botões de Exportação

1. **Exportar CSV** - Exporta para arquivo CSV compatível com Excel
2. **Exportar PDF** - Gera PDF formatado profissionalmente

## Tabela Vendedor (sem custo)

### Colunas Exibidas

| Coluna | Descrição | Origem dos Dados |
|--------|-----------|------------------|
| Categoria | Produto ou Revenda | Classificação automática |
| Código | Código/SKU | `products.code` ou ID abreviado |
| Descrição | Nome do item | `name` |
| Unidade | Unidade de medida | `unit` |
| Preço de Venda | Preço sugerido | `final_sale_price` / `resale_price` |
| Desc. Máx. | Desconto máximo permitido | Reservado (futuro) |
| Preço Mín. | Preço mínimo de venda | Reservado (futuro) |
| Observações | Notas adicionais | `package_size` para insumos |

### Características

- **Não exibe** custos, margens ou lucros
- **Ideal para** distribuir à equipe de vendas
- **Formato** retrato no PDF
- **Badge de categoria** diferenciado por cor:
  - Azul: Produto
  - Verde: Revenda

### Casos de Uso

1. Distribuir tabela de preços para vendedores externos
2. Enviar para representantes comerciais
3. Disponibilizar em pontos de venda
4. Consulta rápida de preços pela equipe comercial

## Tabela Gerencial (com custo/margem)

### Colunas Exibidas

| Coluna | Descrição | Cálculo/Origem |
|--------|-----------|----------------|
| Cat. | Categoria (P/R) | P = Produto, R = Revenda |
| Código | Código/SKU | `code` ou ID |
| Descrição | Nome do item | `name` |
| Un. | Unidade | `unit` |
| Custo Unit. | Custo unitário | `custo_unitario_materiais` / `unit_cost` |
| Imp. % | Percentual de impostos | `tax_percentage` / `resale_tax_percentage` |
| Marg. % | Margem de lucro definida | `margin_percentage` / `resale_margin_percentage` |
| Preço Sug. | Preço sugerido | `final_sale_price` / `resale_price` |
| Lucro Un. | Lucro unitário | Preço Sug. - Custo Unit. |
| Marg. Real | Margem real | (Lucro / Preço) × 100 |
| Atualização | Data última atualização | `updated_at` |

### Características

- **Exibe** todas as informações financeiras
- **Ideal para** análise gerencial e tomada de decisão
- **Formato** paisagem no PDF (para caber todas as colunas)
- **Cores indicativas**:
  - Verde: Lucro positivo / Margem positiva
  - Vermelho: Lucro negativo / Margem negativa
  - Azul: Lucro unitário

### Casos de Uso

1. Análise de rentabilidade por produto
2. Identificação de itens com margem baixa
3. Planejamento de ajuste de preços
4. Auditoria de precificação
5. Relatórios gerenciais
6. Apresentações para diretoria

## Exportação de Dados

### Formato CSV

**Características:**
- Separador: ponto e vírgula (`;`)
- Codificação: UTF-8 com BOM
- Compatível com Excel e LibreOffice
- Nome do arquivo: `tabela_precos_{formato}_{data}.csv`

**Conteúdo:**
- Primeira linha: Cabeçalhos das colunas
- Linhas seguintes: Dados conforme formato selecionado
- Valores monetários: Formato "R$ XX.XX"
- Percentuais: Formato "XX.X%"

### Formato PDF

**Características:**
- Orientação: Retrato (Vendedor) ou Paisagem (Gerencial)
- Fonte: Helvetica
- Tamanho: A4
- Nome do arquivo: `tabela_precos_{formato}_{data}.pdf`

**Estrutura:**
1. **Cabeçalho**
   - Título do relatório
   - Data e hora de emissão
   - Filtro aplicado (Todos/Produtos/Revenda)

2. **Tabela de Dados**
   - Grade formatada
   - Cabeçalho em azul
   - Linhas alternadas para melhor leitura
   - Alinhamento correto por tipo de dado

3. **Rodapé**
   - Número das páginas (se múltiplas páginas)

## Como os Preços São Calculados

### Produtos

Os preços dos produtos são calculados **na aba Produtos** ao salvar:

```
1. Custo de Produção = Material + Mão de Obra + Custos Fixos + Transporte + Perdas
2. Preço sem Impostos = Custo de Produção + (Custo × Margem %)
3. Preço Final (com impostos) = Preço sem Impostos + (Preço × Impostos %)
```

**Campos utilizados:**
- `custo_unitario_materiais`: Custo dos materiais do produto
- `production_cost`: Custo total de produção
- `margin_percentage`: Margem de lucro desejada
- `sale_price`: Preço sem impostos
- `tax_percentage`: Percentual de impostos
- `final_sale_price`: Preço final com impostos

### Insumos de Revenda

Os preços de revenda são calculados **na aba Insumos** ao salvar um insumo marcado para revenda:

```
1. Custo Base = unit_cost (custo de compra)
2. Impostos = Custo Base × (resale_tax_percentage / 100)
3. Margem = Custo Base × (resale_margin_percentage / 100)
4. Preço de Revenda = Custo Base + Impostos + Margem
```

**Campos utilizados:**
- `unit_cost`: Custo de compra do fornecedor
- `resale_enabled`: Flag indicando se é para revenda (true/false)
- `resale_tax_percentage`: Percentual de impostos na revenda
- `resale_margin_percentage`: Margem de lucro na revenda
- `resale_price`: Preço final de revenda calculado

## Fluxo de Trabalho

### 1. Cadastro de Produto

```
Aba Produtos
  ↓
Preenche custos, margem e impostos
  ↓
Sistema calcula sale_price e final_sale_price
  ↓
Salva produto
  ↓
Tabela de Preços atualiza automaticamente
```

### 2. Cadastro de Insumo para Revenda

```
Aba Insumos
  ↓
Marca "Habilitar Revenda"
  ↓
Preenche custo, impostos e margem de revenda
  ↓
Sistema calcula resale_price
  ↓
Salva insumo
  ↓
Tabela de Preços atualiza automaticamente
```

### 3. Consulta e Exportação

```
Aba Tabela de Preços
  ↓
Seleciona formato (Vendedor/Gerencial)
  ↓
Aplica filtros (Categoria/Busca)
  ↓
Visualiza ou Exporta (CSV/PDF)
```

## Situações Especiais

### Item Sem Preço Calculado

**Quando aparece:**
- Produto ou insumo sem `final_sale_price` / `resale_price` definido

**Como resolver:**
1. Acesse a aba "Produtos" (para produtos) ou "Insumos" (para revenda)
2. Localize o item
3. Preencha os campos necessários:
   - Para produtos: custos, margem e impostos
   - Para revenda: custo, margem de revenda e impostos de revenda
4. Salve o cadastro
5. O preço será calculado automaticamente
6. A tabela de preços atualizará em tempo real

### Item com Margem Negativa

**Quando aparece:**
- Preço de venda menor que o custo
- Indica prejuízo na venda do item

**Como resolver:**
1. Identifique o item na Tabela Gerencial
2. Revise:
   - O custo está correto?
   - O preço de venda está muito baixo?
   - A margem definida é insuficiente?
3. Ajuste os valores no cadastro do item
4. Reavalie a viabilidade comercial do produto

### Sincronização Não Funcionou

**Se a tabela não atualizar automaticamente:**

1. Clique no botão **"Atualizar"** no topo da página
2. Se persistir, recarregue a página (F5)
3. Verifique se o item foi realmente salvo no cadastro
4. Confira o console do navegador (F12) para erros

## Testes de Validação

### Teste 1: Sincronização de Produto

1. Acesse: Indústria > Produtos
2. Edite um produto qualquer
3. Altere o campo "Preço de Venda (sem impostos)" ou "Margem de Lucro"
4. Salve o produto
5. Acesse: Indústria > Tabela de Preços
6. **Resultado esperado:** O preço do produto deve estar atualizado

### Teste 2: Sincronização de Insumo de Revenda

1. Acesse: Indústria > Insumos
2. Edite um insumo que tenha "Habilitar Revenda" marcado
3. Altere margem de revenda ou impostos
4. Salve o insumo
5. Acesse: Indústria > Tabela de Preços
6. Filtre por "Revenda"
7. **Resultado esperado:** O preço do insumo deve estar atualizado

### Teste 3: Exportação CSV - Tabela Vendedor

1. Acesse: Indústria > Tabela de Preços
2. Selecione formato: "Vendedor (sem custo)"
3. Clique em "Exportar CSV"
4. Abra o arquivo no Excel
5. **Resultado esperado:**
   - Arquivo abre corretamente
   - 8 colunas: Categoria, Código, Descrição, Unidade, Preço de Venda, Desconto Máx., Preço Mínimo, Observações
   - Não contém informações de custo
   - Acentuação correta

### Teste 4: Exportação CSV - Tabela Gerencial

1. Acesse: Indústria > Tabela de Preços
2. Selecione formato: "Gerencial (com custo/margem)"
3. Clique em "Exportar CSV"
4. Abra o arquivo no Excel
5. **Resultado esperado:**
   - Arquivo abre corretamente
   - 11 colunas incluindo custos, margens e lucros
   - Valores monetários formatados
   - Percentuais corretos

### Teste 5: Exportação PDF - Tabela Vendedor

1. Acesse: Indústria > Tabela de Preços
2. Selecione formato: "Vendedor (sem custo)"
3. Clique em "Exportar PDF"
4. Abra o PDF gerado
5. **Resultado esperado:**
   - PDF em orientação retrato
   - Cabeçalho com título e data
   - Tabela formatada e legível
   - Sem informações de custo

### Teste 6: Exportação PDF - Tabela Gerencial

1. Acesse: Indústria > Tabela de Preços
2. Selecione formato: "Gerencial (com custo/margem)"
3. Clique em "Exportar PDF"
4. Abra o PDF gerado
5. **Resultado esperado:**
   - PDF em orientação paisagem
   - Todas as colunas visíveis e legíveis
   - Informações de custo e margem presentes

### Teste 7: Filtros

1. Acesse: Indústria > Tabela de Preços
2. Teste cada filtro:
   - **Categoria = Produtos:** Apenas produtos aparecem
   - **Categoria = Revenda:** Apenas insumos de revenda aparecem
   - **Categoria = Todos:** Produtos e insumos aparecem
   - **Busca "bloco":** Filtra itens com "bloco" no nome
3. **Resultado esperado:** Filtros funcionam corretamente e em conjunto

### Teste 8: Item Sem Preço

1. No banco de dados, crie um produto sem definir `sale_price` e `final_sale_price`
2. Acesse: Indústria > Tabela de Preços
3. Localize o produto
4. **Resultado esperado:**
   - Aparece "Preço não calculado" na Tabela Vendedor
   - Aparece "N/C" na Tabela Gerencial
   - Card "Sem Preço" incrementa em 1

## Campos do Banco de Dados

### Tabela `products`

```sql
-- Campos utilizados na Tabela de Preços
id                        uuid PRIMARY KEY
code                      varchar         -- Código do produto
name                      varchar         -- Nome do produto
unit                      varchar         -- Unidade (unid, m, kg, etc)
custo_unitario_materiais  numeric         -- Custo dos materiais
production_cost           numeric         -- Custo total de produção
sale_price                numeric         -- Preço sem impostos
final_sale_price          numeric         -- Preço final com impostos (USADO COMO PREÇO SUGERIDO)
margin_percentage         numeric         -- Margem de lucro %
tax_percentage            numeric         -- Impostos %
updated_at                timestamp       -- Data da última atualização
```

### Tabela `materials`

```sql
-- Campos utilizados na Tabela de Preços
id                           uuid PRIMARY KEY
name                         varchar         -- Nome do insumo
unit                         varchar         -- Unidade
unit_cost                    numeric         -- Custo de compra
resale_enabled               boolean         -- Flag de revenda
resale_price                 numeric         -- Preço de revenda (USADO COMO PREÇO SUGERIDO)
resale_margin_percentage     numeric         -- Margem de revenda %
resale_tax_percentage        numeric         -- Impostos de revenda %
package_size                 varchar         -- Tamanho da embalagem (obs.)
updated_at                   timestamp       -- Data da última atualização
```

## Arquitetura do Componente

### Estado (State)

```typescript
items                 // Array de todos os itens (produtos + insumos)
filteredItems         // Array de itens após aplicação dos filtros
loading               // Estado de carregamento
tableFormat           // 'vendedor' ou 'gerencial'
categoryFilter        // 'todos', 'produtos' ou 'revenda'
activeOnly            // Boolean - filtrar apenas ativos
searchTerm            // String de busca
```

### Funções Principais

```typescript
loadPriceData()       // Carrega produtos e insumos do banco
applyFilters()        // Aplica filtros aos itens
exportToCSV()         // Gera e baixa arquivo CSV
exportToPDF()         // Gera e baixa arquivo PDF
```

### Listeners

```typescript
// Listener de mudanças em products
supabase.channel('price_table_changes')
  .on('postgres_changes', { table: 'products' })

// Listener de mudanças em materials
supabase.channel('price_table_changes')
  .on('postgres_changes', { table: 'materials' })
```

## Comparação com Sistema Anterior

### Antes

- Apenas uma tabela de preços simples
- Exibia apenas produtos
- Sem filtros ou categorização
- Sem exportação
- Edição manual de preços na tabela
- Sem sincronização automática

### Agora

- Dois formatos de tabela (Vendedor e Gerencial)
- Exibe produtos E insumos de revenda
- Filtros avançados (categoria, busca, status)
- Exportação CSV e PDF
- Valores 100% sincronizados com cadastros
- Sincronização automática em tempo real
- Tabela é somente leitura (fonte única de dados)

## Vantagens do Novo Sistema

### Para a Equipe de Vendas

1. **Tabela Vendedor** sem informações sensíveis
2. Exportação fácil para distribuição
3. Busca rápida de produtos
4. Sempre atualizada com últimos preços

### Para a Gestão

1. **Tabela Gerencial** com análise completa
2. Visibilidade de margens e lucros
3. Identificação rápida de problemas de precificação
4. Relatórios profissionais em PDF
5. Dados para análise em Excel (CSV)

### Para o Sistema

1. Fonte única de dados (products e materials)
2. Não há duplicação de lógica de cálculo
3. Manutenção facilitada
4. Consistência garantida
5. Auditoria via `updated_at`

## Manutenção e Evolução

### Futuras Melhorias Sugeridas

1. **Desconto Máximo e Preço Mínimo**
   - Adicionar campos no cadastro de produtos
   - Exibir nas tabelas
   - Validar desconto no momento da venda

2. **Histórico de Preços**
   - Tabela para armazenar alterações de preço
   - Gráfico de evolução de preços
   - Relatório de reajustes

3. **Comparação com Concorrência**
   - Campo para preço de mercado
   - Indicador de competitividade
   - Alertas de preço acima da concorrência

4. **Margem por Cliente/Segmento**
   - Tabelas de preço diferenciadas
   - Descontos por volume
   - Condições especiais

5. **Exportação Excel Avançada**
   - Formato .xlsx nativo
   - Formatação e fórmulas
   - Múltiplas abas

6. **Previsão de Rentabilidade**
   - Simulador de preços
   - Análise de impacto de alterações
   - Sugestões de ajuste

## Perguntas Frequentes

### 1. Por que alguns itens aparecem sem preço?

**R:** O item não tem preço calculado no cadastro. Você precisa acessar a aba "Produtos" ou "Insumos" e preencher os campos de custo, margem e impostos.

### 2. Posso editar os preços diretamente na Tabela de Preços?

**R:** Não. A Tabela de Preços é apenas para visualização e exportação. Os preços devem ser editados nos cadastros originais (Produtos ou Insumos).

### 3. Por que o preço não atualizou depois que salvei o produto?

**R:** A sincronização é automática, mas pode levar alguns segundos. Clique no botão "Atualizar" ou recarregue a página (F5).

### 4. Qual a diferença entre Tabela Vendedor e Gerencial?

**R:** A Tabela Vendedor oculta informações de custo e margem, sendo segura para distribuir à equipe de vendas. A Tabela Gerencial mostra todas as informações financeiras para análise da gestão.

### 5. Posso exportar apenas produtos ou apenas insumos?

**R:** Sim! Use o filtro "Categoria" e selecione "Produtos" ou "Revenda" antes de exportar.

### 6. O arquivo CSV abre com problemas de acentuação no Excel

**R:** O arquivo é gerado em UTF-8 com BOM, que é o padrão do Excel. Se ainda tiver problemas:
   1. Abra o Excel
   2. Use "Dados > De Texto/CSV"
   3. Selecione o arquivo
   4. Confirme codificação UTF-8

### 7. Por que aparece "N/C" em alguns campos?

**R:** "N/C" significa "Não Calculado". Indica que o valor não está disponível (exemplo: lucro unitário quando não há custo definido).

### 8. Como faço para um insumo aparecer na tabela?

**R:** O insumo precisa estar marcado como "Habilitar Revenda" no cadastro de Insumos. Apenas insumos de revenda aparecem na Tabela de Preços.

### 9. Posso adicionar observações personalizadas?

**R:** Atualmente, as observações vêm do campo "Tamanho da Embalagem" dos insumos. Para produtos, não há campo de observações visível na tabela.

### 10. O que é a "Margem Real"?

**R:** É a margem de lucro calculada com base no preço e custo atuais: (Preço - Custo) / Preço × 100. Pode ser diferente da "Margem %" definida no cadastro se os custos mudaram.

## Conclusão

O novo sistema de Tabelas de Preços oferece:

- **Dois formatos** especializados (Vendedor e Gerencial)
- **Sincronização automática** com os cadastros
- **Fonte única de dados** (sem recálculos ou divergências)
- **Filtros avançados** para facilitar consultas
- **Exportação profissional** em CSV e PDF
- **Interface intuitiva** e fácil de usar

Todos os preços são sempre lidos diretamente dos cadastros de Produtos e Insumos, garantindo **consistência total** e eliminando possibilidade de divergências.

---

**Arquivo criado em:** 10/02/2026
**Sistema:** Gestão Industrial - Módulo de Vendas
**Componente:** `src/components/SalesPrices.tsx`
