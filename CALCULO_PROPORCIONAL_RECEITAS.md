# Cálculo Proporcional de Consumo de Materiais por Receita

## Mudança Implementada

O sistema agora calcula o consumo de materiais baseado em **proporções por kg de cimento** e no **peso total do produto**.

## Como Funciona

### 1. Definição da Receita (Proporções)

A receita define as proporções de materiais por kg de cimento:

**Exemplo: TCP AL001**
- Cimento (OBRAS ESPECIAIS VOTORAN): 1,00 kg (base)
- Areia média: 2,50 kg
- Pedrisco: 3,47 kg
- Aditivo CQ Flow: 0,0114 kg
- **Total da mistura: 6,9814 kg**

### 2. Cálculo do Fator Multiplicador

Para cada produto, o sistema calcula o fator multiplicador baseado no peso:

```
Fator Multiplicador = Peso do Produto ÷ Peso Total da Receita
```

**Exemplo: Poste de cerca 10x10cm x 2.50m**
- Peso do produto: 52,44 kg
- Peso total da receita: 6,9814 kg
- Fator multiplicador: 52,44 ÷ 6,9814 = **7,5114**

### 3. Cálculo de Consumo por Unidade

Para cada material da receita:

```
Consumo por Unidade = Fator Multiplicador × Quantidade do Material na Receita
```

**Exemplo: Poste de cerca 10x10cm x 2.50m (1 peça)**

| Material | Qtd na Receita | Cálculo | Consumo por Unidade |
|----------|---------------|---------|---------------------|
| Cimento | 1,00 kg | 7,5114 × 1,00 | **7,5114 kg** |
| Areia média | 2,50 kg | 7,5114 × 2,50 | **18,7785 kg** |
| Pedrisco | 3,47 kg | 7,5114 × 3,47 | **26,0645 kg** |
| Aditivo CQ Flow | 0,0114 kg | 7,5114 × 0,0114 | **0,0856 kg** |

**Total: 52,44 kg** (igual ao peso do produto)

### 4. Cálculo de Consumo na Produção

Para calcular o consumo total em uma produção:

```
Consumo Total = Consumo por Unidade × Quantidade Produzida
```

**Exemplo: Produção de 10 peças do Poste de cerca**

| Material | Consumo Unitário | Quantidade | Consumo Total |
|----------|-----------------|------------|---------------|
| Cimento | 7,5114 kg | × 10 | **75,114 kg** |
| Areia média | 18,7785 kg | × 10 | **187,785 kg** |
| Pedrisco | 26,0645 kg | × 10 | **260,645 kg** |
| Aditivo CQ Flow | 0,0856 kg | × 10 | **0,856 kg** |

## Resumo do Dia

O **"Gerar Resumo do Dia"** agora mostra:

### Resumo de Produção por Produto
- Lista todos os produtos produzidos
- Quantidade total de cada produto
- Número de registros de produção

### Consumo de Insumos
- Quantidade total consumida de cada material
- Custo unitário e total de cada material
- Custo total de insumos do dia

### Resultado Financeiro
- Custo total de insumos
- Receita estimada (preço de tabela)
- Resultado financeiro (lucro/prejuízo)
- Margem de lucro (%)

## Vantagens da Nova Lógica

1. **Precisão**: Consumo calculado baseado no peso real do produto
2. **Clareza**: Receita sempre referenciada por kg de cimento (padrão da indústria)
3. **Flexibilidade**: Fácil ajustar proporções sem recalcular tudo
4. **Custo Real**: Calcula custo de produção com precisão

## Observações Importantes

1. **Peso do Produto**: O produto deve ter o campo `total_weight` preenchido para usar o cálculo proporcional
2. **Fallback**: Se o produto não tiver peso definido, usa cálculo direto (lógica antiga)
3. **Unidade**: Todas as quantidades da receita devem estar em kg
4. **Armaduras**: Armaduras continuam sendo calculadas separadamente em metros

## Validação

Para validar se o cálculo está correto:

1. Some todas as quantidades de materiais da receita = Peso Total da Receita
2. Calcule o fator: Peso do Produto ÷ Peso Total da Receita
3. Multiplique cada material pelo fator
4. Some todos os consumos = Peso do Produto (deve bater exato)

## Arquivo Modificado

- **src/components/DailyProduction.tsx** (linhas 290-351)
  - Implementado cálculo proporcional por peso
  - Adicionado fallback para produtos sem peso definido
  - Logs detalhados para debug do cálculo
