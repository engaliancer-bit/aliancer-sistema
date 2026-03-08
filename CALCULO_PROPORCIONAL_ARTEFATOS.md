# Cálculo Proporcional de Consumo de Insumos para Artefatos

## Implementação Completa

Sistema automático de cálculo de consumo de insumos para produtos tipo **Artefato** baseado no peso do produto e nas proporções do traço TCS, considerando a umidade da massa.

## 🎯 Como Funciona

### Lógica de Cálculo

Para produtos tipo **Artefato**, o sistema:

1. **Obtém o peso do produto** (ex: 100 kg)
2. **Identifica a umidade do traço** (ex: 6%)
3. **Calcula o peso sem umidade**:
   ```
   peso_sem_umidade = peso_produto / (1 + umidade/100)
   
   Exemplo: 100 / 1.06 = 94.34 kg
   ```

4. **Soma o peso total do traço** (todos os insumos sem umidade)
   ```
   Exemplo:
   - Cimento: 1 kg
   - Areia industrial: 5.56 kg
   - Areia média: 4.44 kg
   - Pedrisco: 2.5 kg
   - Aditivo: 0.003 kg
   Total: 13.503 kg
   ```

5. **Calcula o multiplicador proporcional**:
   ```
   multiplicador = peso_sem_umidade / peso_total_traço
   
   Exemplo: 94.34 / 13.503 = 6.986
   ```

6. **Aplica o multiplicador a cada insumo**:
   ```
   consumo_insumo = quantidade_no_traço × multiplicador
   
   Exemplos:
   - Cimento: 1 × 6.986 = 6.986 kg
   - Areia industrial: 5.56 × 6.986 = 38.84 kg
   - Areia média: 4.44 × 6.986 = 31.02 kg
   - Pedrisco: 2.5 × 6.986 = 17.47 kg
   - Aditivo: 0.003 × 6.986 = 0.021 kg
   ```

### Proporção Mantida

A proporção entre os insumos é **sempre mantida** independente do peso do produto:

```
Proporções no traço TCS AL001:
- Cimento:          1.00 kg  (7.4%)
- Areia industrial: 5.56 kg  (41.2%)
- Areia média:      4.44 kg  (32.9%)
- Pedrisco:         2.50 kg  (18.5%)
- Aditivo:          0.003 kg (0.02%)
Total sem umidade:  13.503 kg

Para produto de 100 kg com 6% de umidade:
- Peso sem umidade: 94.34 kg
- Cimento:          6.986 kg  (7.4%)
- Areia industrial: 38.84 kg  (41.2%)
- Areia média:      31.02 kg  (32.9%)
- Pedrisco:         17.47 kg  (18.5%)
- Aditivo:          0.021 kg  (0.02%)
```

## 📋 Exemplo Prático Completo

### Cenário

**Produto**: Bloco de concreto
- Tipo: Artefato
- Peso unitário: 100 kg
- Traço: TCS AL001 (Concreto Seco)

**Traço TCS AL001**:
```
Insumos (sem umidade):
- Cimento CP II:       1.00 kg
- Areia industrial:    5.56 kg
- Areia média:         4.44 kg
- Pedrisco:            2.50 kg
- Aditivo CQ Plast:    0.003 kg
Total:                13.503 kg

Umidade da massa: 6%
Total com umidade: 14.313 kg
```

### Cálculos Passo a Passo

#### 1. Desconto da Umidade
```
Peso do produto:    100.00 kg
Umidade do traço:   6%
Cálculo:            100 / (1 + 0.06) = 100 / 1.06
Peso sem umidade:   94.34 kg
```

#### 2. Multiplicador Proporcional
```
Peso sem umidade:       94.34 kg
Peso total do traço:    13.503 kg
Multiplicador:          94.34 / 13.503 = 6.986
```

#### 3. Consumo de Cada Insumo
```
Cimento:
  Traço:    1.00 kg
  Consumo:  1.00 × 6.986 = 6.986 kg
  Custo:    6.986 × R$ 0.85 = R$ 5.94

Areia Industrial:
  Traço:    5.56 kg
  Consumo:  5.56 × 6.986 = 38.84 kg
  Custo:    38.84 × R$ 0.12 = R$ 4.66

Areia Média:
  Traço:    4.44 kg
  Consumo:  4.44 × 6.986 = 31.02 kg
  Custo:    31.02 × R$ 0.10 = R$ 3.10

Pedrisco:
  Traço:    2.50 kg
  Consumo:  2.50 × 6.986 = 17.47 kg
  Custo:    17.47 × R$ 0.15 = R$ 2.62

Aditivo CQ Plast:
  Traço:    0.003 kg
  Consumo:  0.003 × 6.986 = 0.021 kg
  Custo:    0.021 × R$ 45.00 = R$ 0.95

Total de Insumos: R$ 17.27
```

## 🖥️ Interface do Sistema

### Formulário de Cadastro

```
┌──────────────────────────────────────────────────┐
│ Tipo de Produto: [Artefato ▼]                  │
│ Traço: [TCS AL001 ▼]                            │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Cálculo de Consumo de Insumos               │ │
│ │                                              │ │
│ │ ┌─────────────────┐  ┌──────────────────┐  │ │
│ │ │ Peso Unitário * │  │ Peso Total Traço │  │ │
│ │ │ [100.000____]kg │  │   13.50 kg       │  │ │
│ │ │                 │  │ (sem umidade)    │  │ │
│ │ │                 │  │ Umidade: 6%      │  │ │
│ │ └─────────────────┘  └──────────────────┘  │ │
│ │                                              │ │
│ │ Como funciona o cálculo:                    │ │
│ │ 1. Peso informado: 100.00 kg                │ │
│ │ 2. Desconta umidade de 6%: 94.34 kg         │ │
│ │ 3. Divide proporcionalmente pelos insumos   │ │
│ │ 4. Mantém proporção do traço                │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Visualização de Custos

Quando o produto é cadastrado, o sistema exibe automaticamente:

```
┌────────────────────────────────────────────────┐
│ Memória de Cálculo - Custo do Produto         │
├────────────────────────────────────────────────┤
│                                                │
│ Produto: Bloco de Concreto 100kg              │
│ Traço: TCS AL001 (Concreto Seco)              │
│                                                │
│ Insumos do Traço:                              │
│ • Cimento CP II       6.986 kg → R$ 5.94      │
│ • Areia Industrial   38.840 kg → R$ 4.66      │
│ • Areia Média        31.020 kg → R$ 3.10      │
│ • Pedrisco           17.465 kg → R$ 2.62      │
│ • Aditivo CQ Plast    0.021 kg → R$ 0.95      │
│                                                │
│ Subtotal Insumos: R$ 17.27                     │
│                                                │
│ + Ferragens: R$ 0.00                           │
│ + Acessórios: R$ 0.00                          │
│                                                │
│ Custo Total: R$ 17.27                          │
└────────────────────────────────────────────────┘
```

## 🔄 Diferenças entre Tipos de Produtos

| Tipo | Campo de Entrada | Cálculo |
|------|------------------|---------|
| **Artefato** | Peso do Produto (kg) | Proporcional ao traço considerando umidade |
| **Pré-moldado** | Volume (m³) | Volume × Peso Específico do traço |
| **Outros** | Peso do Cimento (kg) | Proporcional baseado no cimento |

## ✅ Validações

1. ✅ Produto tipo Artefato deve ter peso_artefato informado
2. ✅ Traço deve estar selecionado
3. ✅ Traço deve ter insumos cadastrados
4. ✅ Umidade do traço é considerada (se existir)
5. ✅ Proporção é mantida para todos os insumos
6. ✅ Custos calculados automaticamente

## 🔍 Logs de Depuração

O sistema gera logs detalhados no console:

```javascript
✅ Calculando para artefato
📊 Peso total do traço (sem umidade): 13.503 kg
💧 Umidade do traço: 6 %
⚖️ Peso do artefato: 100 kg
📉 Peso sem umidade: 94.3396 kg
🔢 Multiplicador proporcional: 6.9859 (94.3396 / 13.503)
  📦 Cimento CP II: 1 kg × 6.9859 = 6.9859 kg → R$ 5.94
  📦 Areia industrial: 5.56 kg × 6.9859 = 38.8414 kg → R$ 4.66
  📦 Areia média: 4.44 kg × 6.9859 = 31.0174 kg → R$ 3.10
  📦 Pedrisco: 2.5 kg × 6.9859 = 17.4648 kg → R$ 2.62
  📦 Aditivo CQ Plast: 0.003 kg × 6.9859 = 0.0210 kg → R$ 0.95
✅ Total de materiais calculados: 5
```

## 📊 Casos de Teste

### Teste 1: Traço TCS com Umidade
```
Entrada:
- Produto: 100 kg
- Traço: 13.503 kg (sem umidade)
- Umidade: 6%

Saída:
- Peso sem umidade: 94.34 kg
- Multiplicador: 6.986
- Todos insumos calculados proporcionalmente
```

### Teste 2: Traço TCS sem Umidade
```
Entrada:
- Produto: 50 kg
- Traço: 10 kg (sem umidade)
- Umidade: 0%

Saída:
- Peso sem umidade: 50 kg
- Multiplicador: 5.0
- Todos insumos × 5
```

### Teste 3: Produto Leve
```
Entrada:
- Produto: 5 kg
- Traço: 13.503 kg
- Umidade: 6%

Saída:
- Peso sem umidade: 4.72 kg
- Multiplicador: 0.349
- Todos insumos × 0.349
```

## 🚀 Melhorias Implementadas

### Antes
- ❌ Sistema pedia "peso do cimento"
- ❌ Não considerava umidade
- ❌ Cálculo dependia de encontrar cimento no traço
- ❌ Não funcionava se traço não tivesse cimento

### Depois
- ✅ Sistema pede apenas "peso do produto"
- ✅ Considera umidade automaticamente
- ✅ Calcula todos os insumos proporcionalmente
- ✅ Funciona com qualquer traço TCS
- ✅ Interface clara e educativa
- ✅ Logs detalhados para debug

## 📝 Arquivos Modificados

| Arquivo | Alterações |
|---------|-----------|
| `Products.tsx` | Interface Recipe + lógica de cálculo + UI |

## 🎓 Fórmulas Utilizadas

### 1. Peso sem Umidade
```
peso_sem_umidade = peso_com_umidade / (1 + umidade/100)
```

### 2. Multiplicador Proporcional
```
multiplicador = peso_sem_umidade / soma_insumos_traço
```

### 3. Consumo de Cada Insumo
```
consumo = quantidade_no_traço × multiplicador
```

### 4. Custo de Cada Insumo
```
custo = consumo × custo_unitario
```

## ✨ Status

```
✅ Lógica implementada
✅ Interface atualizada
✅ Validações adicionadas
✅ Logs de debug
✅ Build: 23.69s
✅ Pronto para produção
```

## 🎯 Teste Rápido

1. Acesse **Fábrica > Cadastro > Produtos**
2. Selecione tipo: **Artefato**
3. Selecione traço: **TCS AL001**
4. Informe peso: **100 kg**
5. Veja o cálculo automático
6. Salve o produto
7. Visualize a memória de cálculo com todos os consumos

