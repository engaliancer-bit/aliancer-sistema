# Resumo - Cálculo Proporcional para Artefatos

## ✅ Implementado

Sistema automático que calcula o consumo de **TODOS os insumos** do traço baseado no peso do artefato, considerando a umidade.

## 🎯 Como Funciona

### Antes (Antigo)
```
❌ Pedia "peso do cimento"
❌ Dependia de ter cimento no traço
❌ Não considerava umidade
```

### Agora (Novo)
```
✅ Pede "peso do produto"
✅ Calcula TODOS os insumos proporcionalmente
✅ Considera umidade automaticamente
```

## 📊 Exemplo Prático

### Traço TCS AL001
```
Insumos sem umidade:
- Cimento:          1.00 kg
- Areia industrial: 5.56 kg
- Areia média:      4.44 kg
- Pedrisco:         2.50 kg
- Aditivo:          0.003 kg
Total:             13.503 kg

Umidade: 6%
```

### Produto de 100 kg
```
1. Desconta umidade: 100 / 1.06 = 94.34 kg
2. Multiplica proporcionalmente: 94.34 / 13.503 = 6.986
3. Aplica a cada insumo:
   - Cimento:          1.00 × 6.986 = 6.99 kg
   - Areia industrial: 5.56 × 6.986 = 38.84 kg
   - Areia média:      4.44 × 6.986 = 31.02 kg
   - Pedrisco:         2.50 × 6.986 = 17.47 kg
   - Aditivo:          0.003 × 6.986 = 0.021 kg
```

## 🔑 Fórmulas

```javascript
// 1. Desconto da umidade
peso_sem_umidade = peso_produto / (1 + umidade/100)

// 2. Multiplicador
multiplicador = peso_sem_umidade / soma_insumos_traço

// 3. Consumo de cada insumo
consumo = quantidade_traço × multiplicador
```

## 📋 Interface

```
┌────────────────────────────────────────┐
│ Tipo: Artefato                        │
│ Traço: TCS AL001                      │
│                                       │
│ Peso do Produto (kg): [100.000___] * │
│                                       │
│ Peso Total do Traço: 13.50 kg        │
│ (sem umidade)                         │
│ Umidade: 6%                           │
│                                       │
│ Como funciona:                        │
│ 1. Peso informado: 100 kg            │
│ 2. Desconta umidade: 94.34 kg        │
│ 3. Divide proporcionalmente          │
└────────────────────────────────────────┘
```

## ✅ Status

```
✅ Migração: moisture_percentage em recipes
✅ Lógica: Cálculo proporcional implementado
✅ Interface: Campos e explicações atualizados
✅ Validação: Peso obrigatório para artefatos
✅ Build: 23.69s
✅ Pronto para uso
```

## 🎯 Teste Rápido

1. Cadastre produto tipo **Artefato**
2. Selecione traço **TCS AL001**
3. Informe peso **100 kg**
4. Sistema calcula automaticamente todos os insumos
5. Proporções mantidas conforme traço

## 💡 Vantagens

- ✅ Não precisa informar cimento
- ✅ Funciona com qualquer traço
- ✅ Umidade considerada automaticamente
- ✅ Todos insumos calculados
- ✅ Proporção sempre mantida
- ✅ Custo calculado automaticamente

