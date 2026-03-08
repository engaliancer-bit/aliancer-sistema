# Reposicionamento da Tabela de Custos para Artefatos

## Mudança Implementada

A tabela de detalhamento de custos de materiais agora aparece **imediatamente após** o campo de peso do produto para produtos tipo **Artefato**.

## 🎯 Nova Sequência no Formulário

### Para Produtos Tipo Artefato

```
┌─────────────────────────────────────────────────┐
│ 1. Tipo de Produto: [Artefato]                │
│ 2. Traço: [TCS AL001]                          │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ Cálculo de Consumo de Insumos           │   │
│ │                                          │   │
│ │ Peso Unitário (kg): [100.000]           │   │
│ │ Peso Total do Traço: 13.50 kg           │   │
│ │ Umidade: 6%                              │   │
│ │                                          │   │
│ │ Como funciona o cálculo:                │   │
│ │ 1. Peso informado: 100 kg               │   │
│ │ 2. Desconta umidade: 94.34 kg           │   │
│ │ 3. Divide proporcionalmente             │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ 📊 Memória de Cálculo - Detalhamento     │   │
│ │                                          │   │
│ │ Materiais do Traço:                      │   │
│ │ • Cimento: 6.986 kg → R$ 5.94           │   │
│ │ • Areia Industrial: 38.84 kg → R$ 4.66  │   │
│ │ • Areia Média: 31.02 kg → R$ 3.10       │   │
│ │ • Pedrisco: 17.47 kg → R$ 2.62          │   │
│ │ • Aditivo: 0.021 kg → R$ 0.95           │   │
│ │                                          │   │
│ │ CUSTO TOTAL: R$ 17.27                    │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ 3. Cadastro Simplificado - Custos e Margens   │
│ 4. Informações de Preço                        │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

## ✅ Benefícios

### Antes
```
❌ Tabela de custos aparecia no final do formulário
❌ Usuário precisava rolar muito para ver os custos
❌ Distância entre "peso informado" e "custos calculados"
```

### Depois
```
✅ Tabela aparece logo após informar o peso
✅ Feedback imediato do cálculo
✅ Contexto visual próximo
✅ Fluxo de trabalho mais intuitivo
```

## 🔄 Comportamento por Tipo de Produto

| Tipo | Localização da Tabela de Custos |
|------|----------------------------------|
| **Artefato** | Logo após o campo de peso do produto |
| **Pré-moldado** | Seção original (após armaduras) |
| **Outros** | Seção original (após campos de cimento) |

## 📋 Estrutura da Tabela para Artefatos

A tabela exibe:

### 1. Cálculo Proporcional (Card Azul)
```
┌─────────────────────────────────────┐
│ Cálculo Proporcional:               │
│ • Peso do produto: 100.00 kg        │
│ • Umidade: 6%                       │
│ • Peso sem umidade: 94.34 kg        │
└─────────────────────────────────────┘
```

### 2. Materiais do Traço
```
┌─────────────────────────────────────┐
│ Materiais do Traço                  │
├─────────────────────────────────────┤
│ Cimento CP II          R$ 5.94      │
│ Consumo: 6.9859 kg                  │
│ Custo unit: R$ 0.85/kg              │
│─────────────────────────────────────│
│ Areia Industrial       R$ 4.66      │
│ Consumo: 38.8414 kg                 │
│ Custo unit: R$ 0.12/kg              │
│─────────────────────────────────────│
│ ... (outros materiais)              │
│─────────────────────────────────────│
│ Subtotal Materiais: R$ 17.27        │
└─────────────────────────────────────┘
```

### 3. Armaduras (se houver)
```
┌─────────────────────────────────────┐
│ Armaduras                           │
├─────────────────────────────────────┤
│ ... detalhes das armaduras          │
│─────────────────────────────────────│
│ Subtotal Armaduras: R$ X.XX         │
└─────────────────────────────────────┘
```

### 4. Materiais Auxiliares (se houver)
```
┌─────────────────────────────────────┐
│ Materiais Auxiliares                │
├─────────────────────────────────────┤
│ ... detalhes dos auxiliares         │
│─────────────────────────────────────│
│ Subtotal Auxiliares: R$ X.XX        │
└─────────────────────────────────────┘
```

### 5. Total Final (Card Laranja)
```
┌─────────────────────────────────────┐
│ CUSTO TOTAL DE MATERIAIS            │
│ Peso total: 94.34 kg                │
│                                     │
│              R$ 17.27                │
└─────────────────────────────────────┘
```

## 🎨 Design da Tabela

### Cores e Estilo
```css
Container Principal:
- Fundo: Orange-50
- Borda: Orange-200
- Padding: 16px

Cards Internos:
- Fundo: Branco
- Borda: Gray-200
- Padding: 16px

Card de Cálculo:
- Fundo: Blue-50
- Borda: Blue-200

Card de Total:
- Gradiente: Orange-500 → Orange-600
- Texto: Branco
```

### Tipografia
```
Título Principal: text-lg font-semibold
Títulos de Seção: text-sm font-semibold
Valores: text-lg font-bold
Subtotais: font-bold text-blue-600
Total Final: text-3xl font-bold
```

## 💡 Quando a Tabela Aparece

A tabela só aparece quando:

1. ✅ `product_type === 'artifact'`
2. ✅ `costMemory` está definido
3. ✅ Pelo menos uma seção tem conteúdo:
   - `traceMaterials.length > 0` OU
   - `reinforcements.length > 0` OU
   - `accessories.length > 0`

## 🔧 Mudanças Técnicas

### Arquivos Modificados
- `src/components/Products.tsx`

### Condições Atualizadas

**Nova seção (linha ~2630):**
```typescript
{formData.product_type === 'artifact' && costMemory && (
  // Tabela de custos para artefatos
)}
```

**Seção original (linha ~3534):**
```typescript
{costMemory && formData.product_type !== 'artifact' && (
  // Tabela de custos para outros produtos
)}
```

## ✅ Status

```
✅ Tabela movida para artefatos
✅ Tabela mantida para outros produtos
✅ Design responsivo
✅ Build: 18.68s
✅ Pronto para uso
```

## 🎯 Teste

1. Acesse **Fábrica > Cadastro > Produtos**
2. Selecione tipo: **Artefato**
3. Selecione traço: **TCS AL001**
4. Informe peso: **100 kg**
5. ✅ Tabela aparece **imediatamente abaixo**
6. Veja todos os custos calculados
7. Role para baixo: tabela não aparece duplicada

## 📊 Fluxo Visual

```
┌──────────────────────┐
│ Campo de Peso        │
│ [100.000 kg]         │
└──────────┬───────────┘
           │
           │ Imediato
           ▼
┌──────────────────────┐
│ 📊 Tabela de Custos  │
│                      │
│ • Cálculo            │
│ • Materiais          │
│ • Custos             │
│ • Total              │
└──────────────────────┘
```

