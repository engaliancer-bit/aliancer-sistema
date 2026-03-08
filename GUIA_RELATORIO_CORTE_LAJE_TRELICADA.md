# Guia: Relatório de Corte - Laje Treliçada

## O Que É?

O **Relatório de Corte** é um documento PDF que mostra como cortar as vigotas treliçadas de forma otimizada para sua obra. Ele calcula automaticamente o melhor aproveitamento do material, minimizando desperdícios.

## Como Usar

### Passo 1: Configure o Orçamento

1. Acesse a aba **"Orçamento de Laje Treliçada"**
2. Selecione ou crie um novo orçamento
3. Preencha os dados básicos:
   - Cliente
   - Comprimento da Treliça (ex: 6.0m, 8.0m, 12.0m)
   - Material da tavela/bloco

### Passo 2: Adicione os Cômodos

1. Clique em **"Adicionar Cômodo"**
2. Para cada cômodo, preencha:
   - Nome do cômodo (ex: "Sala", "Quarto 1")
   - Largura do cômodo (metros)
   - Comprimento do cômodo (metros)
   - Espaçamento entre vigotas (ex: 0.38m, 0.42m)
   - Dimensões da tavela (lado A e lado B)

3. O sistema calculará automaticamente:
   - Quantidade de vigotas necessárias
   - Comprimento de cada vigota
   - Quantidade de tavelas/blocos

### Passo 3: Gerar o Relatório

1. Após adicionar todos os cômodos, clique no botão **"Relatório Corte"** (ícone de tesoura)
2. O sistema irá:
   - Validar se todos os dados estão preenchidos
   - Calcular o plano de corte otimizado
   - Gerar um PDF automaticamente

3. O PDF será baixado com o nome: `plano_corte_[nome_do_orcamento].pdf`

## O Que o Relatório Contém

### 1. Cabeçalho
- Nome do orçamento
- Comprimento da treliça utilizada
- Data de geração

### 2. Resumo do Plano
- Total de treliças necessárias
- Eficiência média de aproveitamento (%)
- Perda real (sobras pequenas até 0,90m)
- Sobras reutilizáveis (acima de 0,90m)

### 3. Necessidade de Vigotas por Cômodo
Tabela mostrando:
- Nome de cada cômodo
- Quantidade de vigotas
- Comprimento de cada vigota

### 4. Quantidade de Tavelas/Blocos
Tabela mostrando:
- Nome do cômodo
- Dimensões da tavela (ex: 0.12×0.25m)
- Quantidade total de tavelas necessárias

### 5. Padrões de Corte
Para cada padrão de corte:
- Número de treliças que devem usar este padrão
- Eficiência do padrão
- Perda por treliça
- Lista detalhada de cortes (ex: "2× vigotas de 4.5m")
- **Visualização gráfica** mostrando como cortar a treliça

### 6. Resumo Total
- Treliças necessárias no total
- Perda real total
- Sobras reutilizáveis
- Aproveitamento médio

## Mensagens de Erro e Soluções

### Erro: "Adicione pelo menos um cômodo antes de gerar o relatório de corte"

**Causa:** Você tentou gerar o relatório sem adicionar nenhum cômodo.

**Solução:**
1. Clique em "Adicionar Cômodo"
2. Preencha os dados do cômodo
3. Clique em "Salvar Cômodo"
4. Tente gerar o relatório novamente

### Erro: "Defina o comprimento da treliça antes de gerar o relatório de corte"

**Causa:** O campo "Comprimento da Treliça" está vazio ou zerado.

**Solução:**
1. Localize o campo "Comprimento da Treliça" no formulário
2. Digite o comprimento padrão das treliças que você usa (ex: 6.0, 8.0, 12.0)
3. Tente gerar o relatório novamente

### Erro: "Erro ao gerar relatório de corte..."

**Causa:** Houve um problema técnico durante a geração do PDF.

**Possíveis soluções:**
1. Verifique se todos os campos obrigatórios estão preenchidos
2. Certifique-se de que os valores numéricos são válidos (sem letras)
3. Tente recarregar a página e gerar novamente
4. Verifique o console do navegador (F12) para mais detalhes técnicos

## Exemplo Prático

### Cenário: Casa com 3 Cômodos

**Configuração:**
- Comprimento da Treliça: 6.0m
- Cliente: João Silva
- Tavela: 0.12m × 0.25m

**Cômodos:**

1. **Sala**
   - Largura: 4.0m
   - Comprimento: 5.0m
   - Espaçamento: 0.38m
   - Resultado: 11 vigotas de 5.0m

2. **Quarto 1**
   - Largura: 3.0m
   - Comprimento: 3.5m
   - Espaçamento: 0.38m
   - Resultado: 8 vigotas de 3.5m

3. **Cozinha**
   - Largura: 3.0m
   - Comprimento: 4.0m
   - Espaçamento: 0.38m
   - Resultado: 8 vigotas de 4.0m

**Resultado do Relatório:**

O sistema calcularia automaticamente o melhor plano de corte, por exemplo:

- **Padrão 1:** 1× vigota de 5.0m + 1× vigota de 1.0m (sobra de 0m)
- **Padrão 2:** 1× vigota de 4.0m + 1× vigota de 2.0m (sobra de 0m)
- **Padrão 3:** 1× vigota de 3.5m + 1× vigota de 2.5m (sobra de 0m)

**Total:**
- Treliças: ~15 unidades
- Eficiência: ~95%
- Perda: ~0.5m

## Dicas de Uso

### ✅ FAÇA:

1. **Revise os dados antes de gerar**
   - Confira se todos os cômodos foram adicionados
   - Verifique se as medidas estão corretas
   - Certifique-se do comprimento correto da treliça

2. **Use medidas padronizadas**
   - Comprimentos de treliça comuns: 6m, 8m, 10m, 12m
   - Espaçamentos padrão: 0.38m, 0.42m, 0.50m

3. **Guarde o relatório**
   - Salve o PDF para referência futura
   - Imprima e leve para o canteiro de obras
   - Use para solicitar materiais ao fornecedor

4. **Verifique a eficiência**
   - Busque padrões com eficiência acima de 90%
   - Considere ajustar comprimentos se a perda for muito alta

### ❌ NÃO FAÇA:

1. **Não tente gerar sem dados**
   - Sempre adicione pelo menos um cômodo
   - Preencha o comprimento da treliça

2. **Não use medidas incorretas**
   - Verifique as medidas reais da obra
   - Confirme o espaçamento com o projeto estrutural

3. **Não ignore as sobras**
   - Sobras acima de 0.90m podem ser reutilizadas
   - Guarde para pequenos reparos ou ajustes

## Como o Cálculo Funciona

O sistema usa um **algoritmo de otimização de corte** que:

1. Analisa todas as vigotas necessárias
2. Agrupa vigotas do mesmo comprimento
3. Calcula todas as combinações possíveis de corte
4. Escolhe os padrões que minimizam o desperdício
5. Separa sobras pequenas (perda) de grandes (reutilizáveis)

**Critério de Sobra Reutilizável:**
- Sobras ≤ 0.90m = Perda real (muito pequenas para usar)
- Sobras > 0.90m = Reutilizáveis (podem ser usadas em outros projetos)

## Visualização Gráfica

O relatório inclui visualizações coloridas de cada padrão de corte:

```
┌─────────────────────────────────────────────┐
│ Padrão 1: 6.0m de treliça                   │
├─────────────────────────────────────────────┤
│ [████ 4.5m ████][██ 1.5m ██][perda]       │
└─────────────────────────────────────────────┘
```

Cada cor representa um corte diferente, facilitando a visualização.

## Integração com Produção

Ao aprovar o orçamento e gerar a ordem de produção:
- O relatório de corte é anexado automaticamente
- Fica disponível para a equipe de produção
- Pode ser acessado na área de Ordens de Produção

## Perguntas Frequentes

### 1. Posso gerar o relatório várias vezes?

**Sim!** Você pode gerar quantas vezes quiser. Se alterar os cômodos ou medidas, gere novamente para obter um novo cálculo.

### 2. O relatório salva automaticamente?

**Não.** O relatório é gerado como PDF e baixado automaticamente no seu computador. Você deve salvá-lo onde preferir.

### 3. Posso editar o PDF gerado?

O PDF é gerado para leitura e impressão. Se precisar de alterações, modifique os dados no sistema e gere um novo relatório.

### 4. O que fazer se a eficiência está baixa?

Baixa eficiência (< 80%) pode indicar:
- Comprimento de treliça inadequado para a obra
- Muitos comprimentos diferentes de vigotas
- Considere usar treliças mais longas ou curtas

### 5. Como sei quantas treliças comprar?

O relatório mostra claramente no **RESUMO TOTAL** quantas treliças você precisa. Considere comprar 5-10% a mais para margem de segurança.

### 6. Posso usar o relatório para cotação?

**Sim!** O relatório é perfeito para:
- Solicitar orçamento de fornecedores
- Mostrar ao cliente a quantidade necessária
- Planejar a logística de entrega

### 7. O que significa "Padrão de Corte"?

Um padrão é uma forma específica de cortar uma treliça. Por exemplo:
- Padrão 1: cortar uma treliça de 6m em 1× 4.5m + 1× 1.5m
- Use este padrão 8 vezes para obter 8 vigotas de 4.5m e 8 de 1.5m

### 8. As sobras realmente podem ser usadas?

**Sim!** Sobras acima de 0.90m são suficientes para:
- Pequenos ajustes na obra
- Reparos futuros
- Projetos menores
- Guarde-as adequadamente

## Checklist Antes de Gerar

Antes de clicar em "Relatório Corte", verifique:

- [ ] Orçamento selecionado
- [ ] Comprimento da treliça definido
- [ ] Pelo menos um cômodo adicionado
- [ ] Medidas dos cômodos corretas
- [ ] Espaçamento entre vigotas definido
- [ ] Dimensões das tavelas preenchidas

## Onde Encontrar

**Localização:** Menu Principal > Fábrica > Orçamento de Laje Treliçada

**Botão:** Procure pelo ícone de tesoura (✂️) com o texto "Relatório Corte"

**Atalho:** O botão fica visível logo após adicionar os cômodos

---

## Resumo Rápido

| Passo | Ação |
|-------|------|
| 1 | Configure o comprimento da treliça |
| 2 | Adicione os cômodos com medidas |
| 3 | Clique em "Relatório Corte" |
| 4 | Baixe e salve o PDF gerado |
| 5 | Use na obra ou para cotação |

**Sistema corrigido!** Agora com validações e mensagens de erro claras para facilitar o uso.
