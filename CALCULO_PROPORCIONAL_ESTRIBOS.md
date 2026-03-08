# Cálculo Proporcional Automático de Estribos

## Visão Geral

O sistema agora calcula automaticamente a quantidade correta de estribos transversais para produtos que usam fôrmas, baseado no **estribo marcado como padrão (⭐)** na fôrma.

## Como Funciona

### 1. Configure a Fôrma (Uma Vez)

No cadastro de **Fôrmas**, aba "2. Configuração de Armaduras":

```
Fôrma: Viga V-15x30
Comprimento de referência: 10 metros

Armaduras Transversais:
├─ E1: 66 estribos × 2.5m  ⭐ PADRÃO (marcado com estrela)
├─ E2: 50 estribos × 2.0m
└─ E3: 33 estribos × 1.8m
```

### 2. Cadastre Produtos com Comprimentos Diferentes

Ao cadastrar um produto usando essa fôrma:

#### Exemplo 1: Produto com 5 metros
```
Produto: Pilar P1
Fôrma: Viga V-15x30
Comprimento: 5 metros

Cálculo automático:
├─ E1 (PADRÃO): 66 ÷ 10m × 5m = 33 estribos  ✅ AJUSTADO
├─ E2: 50 estribos (mantém original)
└─ E3: 33 estribos (mantém original)
```

#### Exemplo 2: Produto com 15 metros
```
Produto: Pilar P2
Fôrma: Viga V-15x30
Comprimento: 15 metros

Cálculo automático:
├─ E1 (PADRÃO): 66 ÷ 10m × 15m = 99 estribos  ✅ AJUSTADO
├─ E2: 50 estribos (mantém original)
└─ E3: 33 estribos (mantém original)
```

#### Exemplo 3: Produto com 3.5 metros
```
Produto: Pilar P3
Fôrma: Viga V-15x30
Comprimento: 3.5 metros

Cálculo automático:
├─ E1 (PADRÃO): 66 ÷ 10m × 3.5m = 23 estribos  ✅ AJUSTADO
├─ E2: 50 estribos (mantém original)
└─ E3: 33 estribos (mantém original)
```

## Fórmula do Cálculo

```javascript
quantidade_ajustada = Math.round(
  (quantidade_padrão_fôrma / comprimento_referência_fôrma) × comprimento_produto
)
```

### Variáveis:
- **quantidade_padrão_fôrma**: Quantidade de estribos da fôrma marcada com ⭐
- **comprimento_referência_fôrma**: Medida de referência da fôrma
- **comprimento_produto**: Comprimento total informado no cadastro do produto
- **Math.round()**: Arredonda para o número inteiro mais próximo

## Quando o Cálculo é Aplicado

O cálculo proporcional é aplicado **automaticamente** quando:

✅ O produto usa uma fôrma
✅ A fôrma tem uma armadura transversal marcada como padrão (⭐)
✅ O comprimento do produto é informado
✅ A fôrma tem comprimento de referência configurado

## Comportamento dos Estribos

### Estribo Padrão (⭐)
- **Quantidade**: Ajustada proporcionalmente ao comprimento
- **Comprimento**: Mantém o valor da fôrma
- **Finalidade**: Serve como referência para cálculos

### Outros Estribos (sem ⭐)
- **Quantidade**: Mantém o valor original da fôrma
- **Comprimento**: Mantém o valor da fôrma
- **Finalidade**: Estribos especiais/fixos que não variam com o comprimento

## Exemplo Completo: Viga de Pilar

### Configuração na Fôrma

```
Fôrma: Viga V-15x30
Comprimento de referência: 10.00 metros
Volume de referência: 0.045 m³

Armaduras Longitudinais:
├─ A: 4 barras × 10.2m (Ø 12.5mm)
└─ B: 4 barras × 10.2m (Ø 10.0mm)

Armaduras Transversais:
├─ E1 - Padrão do comprimento: 66 estribos × 2.5m (Ø 5.0mm) ⭐ PADRÃO
├─ E2 - Base/Topo: 10 estribos × 2.8m (Ø 6.0mm)
└─ E3 - Emendas: 20 estribos × 2.6m (Ø 5.0mm)
```

### Produto 1: Pilar de 5 metros

```
Produto: Pilar P1 - 5m
Comprimento: 5.00 metros

Armaduras carregadas:
├─ A: 4 barras × 5.2m  (ajustado para 5m + 0.2m sobra)
├─ B: 4 barras × 5.2m  (ajustado para 5m + 0.2m sobra)
├─ E1: 33 estribos × 2.5m  ⭐ CALCULADO: 66/10 × 5 = 33
├─ E2: 10 estribos × 2.8m  (mantém fixo)
└─ E3: 20 estribos × 2.6m  (mantém fixo)

Espaçamento E1: 5.00m ÷ 33 = 0.15m (15cm entre estribos)
```

### Produto 2: Pilar de 12 metros

```
Produto: Pilar P2 - 12m
Comprimento: 12.00 metros

Armaduras carregadas:
├─ A: 4 barras × 12.2m  (ajustado para 12m + 0.2m sobra)
├─ B: 4 barras × 12.2m  (ajustado para 12m + 0.2m sobra)
├─ E1: 79 estribos × 2.5m  ⭐ CALCULADO: 66/10 × 12 = 79
├─ E2: 10 estribos × 2.8m  (mantém fixo)
└─ E3: 20 estribos × 2.6m  (mantém fixo)

Espaçamento E1: 12.00m ÷ 79 = 0.15m (15cm entre estribos)
```

### Produto 3: Pilar de 8 metros

```
Produto: Pilar P3 - 8m
Comprimento: 8.00 metros

Armaduras carregadas:
├─ A: 4 barras × 8.2m  (ajustado para 8m + 0.2m sobra)
├─ B: 4 barras × 8.2m  (ajustado para 8m + 0.2m sobra)
├─ E1: 53 estribos × 2.5m  ⭐ CALCULADO: 66/10 × 8 = 53
├─ E2: 10 estribos × 2.8m  (mantém fixo)
└─ E3: 20 estribos × 2.6m  (mantém fixo)

Espaçamento E1: 8.00m ÷ 53 = 0.15m (15cm entre estribos)
```

## Vantagens do Sistema

### 1. Espaçamento Consistente
O espaçamento entre estribos permanece o mesmo, independente do comprimento do pilar:
- **5 metros**: 15cm entre estribos
- **8 metros**: 15cm entre estribos
- **12 metros**: 15cm entre estribos

### 2. Automação Total
Você não precisa calcular manualmente quantos estribos usar em cada produto. O sistema faz isso automaticamente.

### 3. Precisão nos Custos
Com a quantidade correta de estribos, o cálculo de custos fica preciso automaticamente.

### 4. Flexibilidade
- **Estribo padrão**: Ajusta automaticamente (para espaçamento uniforme)
- **Estribos especiais**: Permanecem fixos (quantidade constante independente do comprimento)

## Logs no Console

Quando você carrega uma fôrma em um produto, veja no console do navegador (F12):

```
🔍 Carregando dados da fôrma: <id-da-forma>
📏 Diferença de comprimento: -2m (Produto: 8m - Referência: 10m)
⭐ Ajustando estribo PADRÃO "E1 - Padrão do comprimento": 66 estribos / 10m × 8m = 53 estribos
✅ Armaduras carregadas da fôrma: [...]
```

## Quando NÃO Usa Cálculo Proporcional

O sistema **não aplica** o cálculo proporcional quando:

❌ Nenhuma armadura transversal está marcada como padrão (sem ⭐)
❌ O produto não tem comprimento informado
❌ A fôrma não tem comprimento de referência
❌ A armadura transversal não tem quantidade configurada

Nesses casos, as quantidades da fôrma são mantidas como estão.

## Como Marcar o Estribo Padrão

### Passo a Passo:

1. **Acesse**: Menu → Fôrmas
2. **Edite**: A fôrma desejada
3. **Vá para**: Aba "2. Configuração de Armaduras"
4. **Adicione**: Estribos transversais se ainda não tiver
5. **Marque**: Clique no ícone de estrela (⭐) do estribo que deve ter a quantidade ajustada
6. **Salve**: A fôrma

### Indicadores Visuais:

```
Estribo COM estrela marcada:
┌──────────────────────────────────────┐
│ ⭐ E1 - Padrão do comprimento         │
│ 66 estribos × 2.5m                   │
│ ✓ ESTE é o padrão de referência      │
└──────────────────────────────────────┘
```

```
Estribo SEM estrela marcada:
┌──────────────────────────────────────┐
│ ☆ E2 - Base/Topo                     │
│ 10 estribos × 2.8m                   │
│ Clique para marcar como padrão       │
└──────────────────────────────────────┘
```

## Fluxo de Dados

```
1. FÔRMA (Configuração base)
   ├─ Comprimento de referência: 10m
   └─ E1: 66 estribos ⭐ PADRÃO
         ↓
2. PRODUTO (Usa a fôrma)
   ├─ Comprimento: 5m
   └─ Sistema calcula: 66 / 10 × 5 = 33 estribos
         ↓
3. RESULTADO
   └─ E1: 33 estribos (ajustado)
         ↓
4. ORDEM DE PRODUÇÃO
   └─ Usa 33 estribos para calcular materiais
         ↓
5. CUSTOS
   └─ Calcula baseado em 33 estribos
```

## Casos de Uso

### Caso 1: Pilares de Diferentes Alturas

```
Fôrma: Pilar P15x30
Referência: 3.00m
E1: 20 estribos ⭐

Produtos:
├─ Pilar térreo (2.80m)    → 19 estribos
├─ Pilar 1º andar (3.00m)  → 20 estribos
├─ Pilar 2º andar (3.20m)  → 21 estribos
└─ Pilar cobertura (2.50m) → 17 estribos
```

### Caso 2: Vigas de Diferentes Vãos

```
Fôrma: Viga V15x50
Referência: 6.00m
E1: 40 estribos ⭐

Produtos:
├─ Viga V1 (4.50m)  → 30 estribos
├─ Viga V2 (6.00m)  → 40 estribos
├─ Viga V3 (7.80m)  → 52 estribos
└─ Viga V4 (10.00m) → 67 estribos
```

### Caso 3: Tesouras de Diferentes Tamanhos

```
Fôrma: Tesoura T20
Referência: 8.00m
E1: 53 estribos ⭐

Produtos:
├─ Tesoura pequena (6.00m)  → 40 estribos
├─ Tesoura média (8.00m)    → 53 estribos
└─ Tesoura grande (10.00m)  → 66 estribos
```

## Código Relevante

### Arquivo: `src/components/Products.tsx`

```typescript
// Linha 614-620
if (mr.is_standard_pattern && totalLength && moldData.reference_measurement_meters && moldData.reference_measurement_meters > 0) {
  const productLength = parseFloat(totalLength);
  const referenceLength = moldData.reference_measurement_meters;
  const proportionalCount = Math.round((mr.stirrup_standard_quantity / referenceLength) * productLength);
  barCount = proportionalCount;
  console.log(`⭐ Ajustando estribo PADRÃO "${mr.description}": ${mr.stirrup_standard_quantity} estribos / ${referenceLength}m × ${productLength}m = ${proportionalCount} estribos`);
}
```

### Campo no Banco: `mold_reinforcements.is_standard_pattern`

- **Tipo**: `boolean`
- **Padrão**: `false`
- **Descrição**: Indica se esta armadura transversal é a padrão da fôrma
- **Constraint**: Apenas uma armadura transversal pode ser padrão por fôrma

## Perguntas Frequentes

### P: Posso ter mais de um estribo padrão por fôrma?
**R**: Tecnicamente sim, mas recomenda-se ter apenas um. O sistema ajustará todos os marcados como padrão.

### P: O que acontece se eu não marcar nenhum estribo como padrão?
**R**: As quantidades da fôrma são mantidas como estão, sem cálculo proporcional.

### P: O comprimento dos estribos também é ajustado?
**R**: Não, apenas a **quantidade** é ajustada. O comprimento individual de cada estribo permanece o mesmo.

### P: E se eu alterar o comprimento do produto depois de salvá-lo?
**R**: Você precisa recarregar a fôrma. Altere o campo "Selecionar Fôrma" para recarregar e recalcular.

### P: Os custos são recalculados automaticamente?
**R**: Sim! Com a quantidade correta de estribos, o sistema calcula automaticamente o custo total de material.

### P: Posso editar manualmente a quantidade depois?
**R**: Sim, mas ao recarregar a fôrma, o cálculo proporcional será reaplicado.

## Benefícios Práticos

### Para o Engenheiro
✅ Não precisa calcular quantos estribos usar em cada pilar
✅ Espaçamento consistente em todos os produtos
✅ Menos erros de dimensionamento

### Para o Orçamentista
✅ Custos precisos automaticamente
✅ Não precisa ajustar quantidades manualmente
✅ Relatórios com valores corretos

### Para a Produção
✅ Especificações corretas nas ordens de produção
✅ Consumo de material calculado corretamente
✅ Menos retrabalho

### Para a Empresa
✅ Padronização de processos
✅ Redução de desperdícios
✅ Maior produtividade

## Resumo

O sistema de cálculo proporcional automático:

1. **Identifica** o estribo marcado como padrão (⭐) na fôrma
2. **Calcula** a quantidade proporcional baseada no comprimento do produto
3. **Ajusta** automaticamente a quantidade de estribos
4. **Mantém** o espaçamento uniforme entre estribos
5. **Atualiza** os custos automaticamente

Tudo isso de forma **automática**, **precisa** e **consistente**!
