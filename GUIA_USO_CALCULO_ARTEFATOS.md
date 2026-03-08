# Guia de Uso - Cálculo de Consumo para Artefatos

## Como Usar a Funcionalidade

### Passo 1: Editar um Produto Artefato

1. Acesse **Cadastro de Produtos**
2. Localize e clique em **editar** no produto tipo "Artefato" (ex: "Bloco Canaleta 14")
3. O formulário de edição será aberto

### Passo 2: Selecionar o Traço

1. Procure o campo **"Traço de Concreto"**
2. Selecione o traço desejado (ex: "TCS AL001")
3. Uma nova seção aparecerá automaticamente: **"Cálculo de Consumo de Insumos para Artefatos"**

### Passo 3: Informar o Peso

1. Na seção que apareceu, informe o **"Peso Unitário do Produto (kg)"**
2. Digite o peso de uma unidade do produto em quilogramas
3. Exemplo: Se o Bloco Canaleta 14 pesa 14,5 kg, informe `14.5`

### Passo 4: Visualizar o Cálculo

1. O sistema calculará automaticamente o consumo de cada insumo
2. Role a página para baixo até a seção **"Detalhamento do Custo de Materiais"**
3. Você verá:
   - Cada insumo do traço
   - Consumo proporcional de cada um
   - Custo unitário
   - Custo total por insumo
   - **Custo total de materiais**

## Exemplo Prático com Traço TCS AL001

### Composição do Traço TCS AL001
```
Para cada porção do traço:
- Cimento: 1,00 kg
- Areia Industrial: 5,56 kg
- Areia Média: 4,44 kg
- Pedrisco: 2,50 kg
- Aditivo CQ Plast PM 9000: 0,003 kg
-------------------------
TOTAL DO TRAÇO: 13,503 kg
```

### Produto: Bloco Canaleta 14
**Peso**: 100 kg

### Cálculo Automático

**Passo 1: Calcular o Multiplicador**
```
Peso Total do Traço = 1 + 5,56 + 4,44 + 2,5 + 0,003 = 13,503 kg
Peso do Produto = 100 kg
Multiplicador = 100 ÷ 13,503 = 7,406
```

**Passo 2: Calcular Consumo de Cada Insumo**

```
Cimento:
  Consumo = 1,00 kg × 7,406 = 7,406 kg
  Custo = 7,406 × R$ 0,60/kg = R$ 4,44

Areia Industrial:
  Consumo = 5,56 kg × 7,406 = 41,18 kg
  Custo = 41,18 × R$ 0,08/kg = R$ 3,29

Areia Média:
  Consumo = 4,44 kg × 7,406 = 32,88 kg
  Custo = 32,88 × R$ 0,07/kg = R$ 2,30

Pedrisco:
  Consumo = 2,50 kg × 7,406 = 18,52 kg
  Custo = 18,52 × R$ 0,12/kg = R$ 2,22

Aditivo CQ Plast PM 9000:
  Consumo = 0,003 kg × 7,406 = 0,022 kg
  Custo = 0,022 × R$ 15,00/kg = R$ 0,33
```

**Resultado Final**
```
CUSTO TOTAL DE MATERIAIS = R$ 12,58
```

## Como Funciona a Proporção

A lógica mantém **exatamente a mesma proporção** do traço original:

1. **Para cada 1 kg de cimento no traço**:
   - 5,56 kg de areia industrial
   - 4,44 kg de areia média
   - 2,50 kg de pedrisco
   - 0,003 kg de aditivo

2. **Quando você informa que o produto pesa 100 kg**:
   - O sistema calcula: "Quantas porções deste traço cabem em 100 kg?"
   - Resposta: 100 ÷ 13,503 = 7,406 porções

3. **Então multiplica cada material por 7,406**:
   - Cimento: 1,00 × 7,406 = 7,406 kg
   - Areia Industrial: 5,56 × 7,406 = 41,18 kg
   - Areia Média: 4,44 × 7,406 = 32,88 kg
   - E assim por diante...

## Verificação da Proporção

Para verificar que a proporção está correta:

```
Soma dos consumos = 7,406 + 41,18 + 32,88 + 18,52 + 0,022 = 100,008 kg ✓
(pequena diferença devido a arredondamentos)
```

A soma dos consumos é praticamente igual ao peso do produto (100 kg), confirmando que a proporção está correta!

## Requisitos para o Cálculo Funcionar

1. ✅ **Produto tipo "Artefato"**
2. ✅ **Traço de concreto selecionado**
3. ✅ **Traço contém cimento cadastrado** (material com nome contendo "cimento")
4. ✅ **Peso do produto informado**

## Alertas do Sistema

### Quando o Traço Não Tem Cimento
Se o traço não tiver um material identificado como cimento, você verá:
```
⚠️ Cimento não encontrado no traço

O traço selecionado não possui cimento cadastrado.
Adicione cimento ao traço para calcular o consumo proporcional dos insumos.
```

**Solução**: Vá em "Cadastro de Traços" e adicione cimento ao traço.

## Observações Importantes

1. **Unidade de Medida**: O peso deve ser informado em **quilogramas (kg)**

2. **Casas Decimais**: O sistema aceita valores decimais
   - Exemplo: `14.5` para 14,5 kg
   - Exemplo: `100.75` para 100,75 kg

3. **Atualização Automática**: Qualquer mudança no peso recalcula instantaneamente

4. **Mudança de Traço**: Se você trocar o traço, o cálculo é refeito automaticamente

5. **Custo dos Materiais**: Os custos são buscados do cadastro de materiais (campo "Custo Unitário")

## Integração com Sistema de Custos

Após o cálculo de materiais, o sistema preenche automaticamente:

1. **Custo de Material**: Soma do custo de todos os insumos
2. **Mão de Obra**: Percentual sobre o custo de material
3. **Custos Fixos**: Percentual sobre o custo de material
4. **Transporte**: Valor fixo informado
5. **Perdas**: Percentual sobre o custo de material
6. **Custo de Produção Total**: Soma de todos os custos acima

## Exemplo de Fluxo Completo

```
1. Abrir "Bloco Canaleta 14" para edição
   ↓
2. Selecionar traço "TCS AL001"
   ↓
3. Seção "Cálculo de Consumo" aparece
   ↓
4. Informar peso: 100 kg
   ↓
5. Sistema calcula:
   - Cimento: 7,406 kg (R$ 4,44)
   - Areia Industrial: 41,18 kg (R$ 3,29)
   - Areia Média: 32,88 kg (R$ 2,30)
   - Pedrisco: 18,52 kg (R$ 2,22)
   - Aditivo: 0,022 kg (R$ 0,33)
   ↓
6. Custo Total de Materiais = R$ 12,58
   ↓
7. Informar outros custos:
   - Mão de Obra: 30% = R$ 3,77
   - Custos Fixos: 20% = R$ 2,52
   - Transporte: R$ 5,00
   - Perdas: 5% = R$ 0,63
   ↓
8. Custo Total de Produção = R$ 24,50
   ↓
9. Adicionar margem de lucro: 40% = R$ 9,80
   ↓
10. Preço Final de Venda = R$ 34,30
```

## Status

✅ **Funcionalidade Pronta e Testada**
- Build compilado com sucesso
- Lógica de proporção implementada corretamente
- Interface responsiva e intuitiva
- Pronto para uso em produção
