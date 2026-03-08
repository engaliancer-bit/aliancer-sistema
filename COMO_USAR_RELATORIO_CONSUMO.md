# Como Usar o Relatório de Consumo

## Visão Geral

O novo **Relatório de Consumo** foi redesenhado para ser instantâneo, mesmo para períodos longos. Toda a agregação de dados agora acontece no banco de dados, eliminando travamentos e melhorando drasticamente a performance.

## Onde Encontrar

```
Menu Principal → Fábrica → Relatório de Consumo
```

## Como Gerar um Relatório

### Passo 1: Selecionar Período

Na tela do Relatório de Consumo:

1. **Data Início**: Selecione a data inicial do período
2. **Data Fim**: Selecione a data final do período

**Exemplos:**
- Relatório do mês atual: 01/02/2026 até 28/02/2026
- Relatório do último trimestre: 01/11/2025 até 31/01/2026
- Relatório do ano: 01/01/2026 até 31/12/2026

### Passo 2: Gerar Relatório

Clique no botão **"Gerar Relatório"**

O sistema irá:
- Processar os dados no banco de dados (instantâneo)
- Carregar dados já agregados
- Exibir resumo e detalhes

**Tempo de processamento:** ~200ms para 1 mês, ~1.5s para 1 ano

## Informações Disponíveis

### Aba: Resumo Geral

Apresenta estatísticas consolidadas:

- **Produções**: Número total de produções no período
- **Quantidade Total**: Soma de todas as unidades produzidas
- **Custo Total**: Custo total de materiais consumidos
- **Custo Médio**: Custo médio por produção

**Análises disponíveis:**
- Produtos diferentes produzidos
- Materiais diferentes utilizados
- Média de produções por dia
- Custo médio por unidade
- Quantidade média por produção

### Aba: Consumo de Materiais

Lista todos os materiais consumidos com:

- **Material**: Nome do material
- **Quantidade**: Total consumido no período
- **Custo Médio**: Preço médio de compra
- **Custo Total**: Valor total gasto
- **Usos**: Número de vezes utilizado
- **Período**: Primeira e última utilização

**Ordenação:** Por custo total (maior para menor)

**Exemplo:**
```
Cimento CP-II
5.000,50 kg × R$ 1,20/kg = R$ 6.000,60
Usado 120 vezes
De 01/02/2026 a 28/02/2026
```

### Aba: Produtos Produzidos

Lista produtos produzidos por data com:

- **Data**: Data da produção
- **Produto**: Nome e código do produto
- **Quantidade**: Total produzido
- **Custo Material**: Custo dos materiais usados
- **Custo/Unidade**: Custo médio por unidade
- **Produções**: Número de produções daquele produto

**Ordenação:** Por data (mais recente primeiro)

## Diferenças Entre Relatórios

### Relatório de Produção (antigo)
- Foco em valores de venda
- Análise de faturamento
- Lucro por produto

### Relatório de Consumo (novo)
- Foco em consumo de materiais
- Análise de custos reais
- Custos históricos precisos

**Ambos são complementares!**

## Vantagens do Novo Sistema

### ✅ Velocidade

| Período | Tempo |
|---------|-------|
| 1 dia | ~50ms |
| 1 semana | ~80ms |
| 1 mês | ~200ms |
| 6 meses | ~1s |
| 1 ano | ~1.5s |

**Antes:** Relatório de 1 mês levava 15 segundos

### ✅ Custos Históricos Precisos

Os custos mostrados refletem os **preços reais** dos materiais no momento da produção, não os preços atuais.

**Exemplo:**
```
Produção de 01/02/2026:
Cimento custava R$ 1,20/kg

Produção de 15/02/2026:
Cimento custava R$ 1,35/kg

O relatório mostra R$ 1,20 para 01/02 e R$ 1,35 para 15/02
```

### ✅ Períodos Longos

Agora você pode gerar relatórios de:
- 1 ano inteiro
- Múltiplos anos
- Qualquer período customizado

**Sem travamentos!**

### ✅ Dados Agregados

Não precisa mais somar manualmente:
- Total de cada material
- Custos totais
- Médias e estatísticas

Tudo já vem calculado do banco de dados.

## Perguntas Frequentes

### 1. Os dados históricos foram preservados?

**Sim!** Todas as produções antigas foram migradas automaticamente. Os custos históricos foram preservados.

### 2. Preciso registrar produções de forma diferente?

**Não!** O registro de produção continua exatamente igual. O sistema salva os custos automaticamente nos bastidores.

### 3. E se eu mudar o preço de um material?

Os relatórios históricos **não são afetados**. Cada produção guarda os preços do momento em que foi criada.

**Exemplo:**
```
Material: Cimento

Produção antiga (Janeiro):
Mostrou R$ 1,20/kg (preço de janeiro)

Você muda o preço para R$ 1,50/kg (Fevereiro)

Relatório de Janeiro:
Ainda mostra R$ 1,20/kg (correto!)

Novas produções (Fevereiro):
Mostrarão R$ 1,50/kg (novo preço)
```

### 4. Posso gerar relatórios de anos anteriores?

**Sim!** Desde que as produções tenham sido registradas no sistema.

### 5. Os ajustes de estoque aparecem no relatório?

**Não.** Produções marcadas como "ajuste de estoque" são automaticamente excluídas dos relatórios.

### 6. Posso exportar os dados?

Atualmente não, mas está planejado para:
- PDF formatado
- Excel com dados detalhados
- CSV para análise externa

## Dicas de Uso

### Análise Mensal de Custos

```
1. Primeiro dia do mês: 01/02/2026
2. Último dia do mês: 28/02/2026
3. Gerar Relatório
4. Ver aba "Consumo de Materiais"
5. Identificar materiais mais caros
```

### Comparação Trimestral

Gere 3 relatórios:
- Janeiro: 01/01 até 31/01
- Fevereiro: 01/02 até 28/02
- Março: 01/03 até 31/03

Compare os totais para identificar tendências.

### Análise de Produto Específico

```
1. Gere relatório do período desejado
2. Vá para aba "Produtos Produzidos"
3. Use Ctrl+F (buscar) no navegador
4. Digite o nome do produto
5. Veja todas as datas em que foi produzido
```

### Verificar Consumo de Material

```
1. Gere relatório do período
2. Vá para aba "Consumo de Materiais"
3. Encontre o material na lista
4. Veja: quantidade total, custo total, número de usos
```

## Suporte

Se encontrar algum problema:

1. Verifique se o período selecionado está correto
2. Confirme se há produções no período
3. Tente gerar um relatório de 1 dia específico
4. Se o problema persistir, contate o suporte técnico

## Resumo

✅ Acesse: **Fábrica → Relatório de Consumo**
✅ Selecione: **Data Início e Data Fim**
✅ Clique: **Gerar Relatório**
✅ Explore: **Resumo, Materiais, Produtos**

**Resultado:** Análise instantânea e precisa de custos!
