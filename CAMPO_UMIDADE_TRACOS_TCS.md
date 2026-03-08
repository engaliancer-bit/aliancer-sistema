# Campo de Umidade da Massa em Traços TCS

## Implementação Completa

Foi adicionado o campo de **umidade da massa** aos traços do tipo **TCS AL (Concreto Seco)**.

## O que foi feito

### 1. Banco de Dados
✅ Migração aplicada: `add_moisture_percentage_to_recipes`
- Nova coluna: `moisture_percentage` (decimal 5,2)
- Valores permitidos: 0 a 100
- Padrão: 0
- Validação: CHECK constraint para garantir valor entre 0-100

### 2. Interface do Usuário

#### Formulário de Cadastro/Edição
- Campo aparece **apenas** quando tipo = "TCS AL - Concreto Seco"
- Label: "Umidade da Massa (%)"
- Placeholder: "Ex: 6.00"
- Aceita valores decimais com 2 casas (ex: 6.50%)
- Validação: min=0, max=100

#### Visualização de Detalhes
Quando um traço TCS possui umidade cadastrada:
1. **Seção de Informações Técnicas**
   - Mostra o tipo do traço
   - Exibe o percentual de umidade

2. **Cálculo Automático**
   - Peso total dos insumos
   - Peso da umidade calculado
   - Peso total com umidade

3. **Exemplo Visual**
   ```
   Exemplo: 100.00 kg + 6.00 kg = 106.00 kg total
   ```

## Como Usar

### Criar Novo Traço TCS com Umidade

1. Vá em **Fábrica > Cadastro > Traços**
2. Preencha o nome do traço
3. Selecione **Tipo de Concreto**: "TCS AL - Concreto Seco"
4. ✅ Campo "Umidade da Massa (%)" aparece automaticamente
5. Informe o percentual (ex: `6.00`)
6. Adicione os insumos
7. Salve o traço

### Editar Traço Existente

1. Clique em **Editar** no traço
2. Se tipo for TCS, campo de umidade estará visível
3. Altere o valor desejado
4. Salve as alterações

### Visualizar Traço com Umidade

1. Clique em **Detalhes** no traço
2. Verá uma seção azul com informações técnicas:
   ```
   ┌─────────────────────────────────────┐
   │ Informações Técnicas:               │
   ├─────────────────────────────────────┤
   │ Tipo: 🔹 TCS AL - Concreto Seco    │
   │ Umidade da Massa: 6.00%             │
   │                                     │
   │ Cálculo do Peso Total:              │
   │ Peso dos insumos + 6.00% de umidade│
   │ Exemplo: 100 kg + 6 kg = 106 kg     │
   └─────────────────────────────────────┘
   ```

3. No rodapé, verá dois totais:
   - **Peso Total dos Insumos**: soma dos insumos
   - **Peso Total com Umidade**: soma + percentual de umidade

## Exemplos de Cálculo

### Exemplo 1: Traço com 6% de umidade
```
Insumos:
- Cimento: 50 kg
- Areia: 150 kg
- Pedra: 200 kg

Total Insumos: 400 kg
Umidade (6%): 400 × 0.06 = 24 kg
Total com Umidade: 400 + 24 = 424 kg
```

### Exemplo 2: Traço com 8% de umidade
```
Insumos:
- Cimento: 30 kg
- Areia: 90 kg
- Brita: 120 kg

Total Insumos: 240 kg
Umidade (8%): 240 × 0.08 = 19.20 kg
Total com Umidade: 240 + 19.20 = 259.20 kg
```

## Estrutura Visual

### Formulário
```
┌────────────────────────────────────────┐
│ Nome do Traço: [__________________]   │
│ Tipo: [TCS AL - Concreto Seco ▼]      │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Umidade da Massa (%)               │ │
│ │ [6.00___________________]          │ │
│ │ Percentual de umidade adicionado   │ │
│ │ ao peso total dos insumos          │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Descrição: [_____________________]    │
└────────────────────────────────────────┘
```

### Modal de Detalhes
```
┌──────────────────────────────────────────┐
│  Traço TCS 1:2:3                    [×] │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Informações Técnicas:             │  │
│  │                                    │  │
│  │ Tipo: 🔹 TCS AL - Concreto Seco   │  │
│  │ Umidade da Massa: 6.00%           │  │
│  │                                    │  │
│  │ ──────────────────────────────────│  │
│  │ Cálculo do Peso Total:            │  │
│  │ Peso dos insumos + 6.00% umidade  │  │
│  │ Exemplo: 100 kg + 6 kg = 106 kg   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Insumos:                                │
│  • Cimento         50.0000 kg           │
│  • Areia          150.0000 kg           │
│  • Pedra          200.0000 kg           │
│                                          │
│  ────────────────────────────────────    │
│  Peso Total dos Insumos:    400.0000 kg │
│  Peso Total com Umidade:    424.0000 kg │
└──────────────────────────────────────────┘
```

## Diferenças entre TCS e TCP

### TCS AL (Concreto Seco)
- ✅ Campo de **Umidade da Massa** (%)
- Não possui peso específico
- Usado para blocos, pisos intertravados, etc.

### TCP AL (Concreto Plástico)
- ✅ Campo de **Peso Específico** (kg/m³)
- Não possui campo de umidade
- Usado para pré-moldados, pilares, vigas, etc.

## Validações

1. ✅ Valor entre 0 e 100
2. ✅ Aceita decimais (ex: 6.50)
3. ✅ Campo opcional (pode ser 0)
4. ✅ Somente para traços TCS
5. ✅ Não interfere em traços TCP

## Integração com Sistema

### Onde é usado
- ✅ Cadastro de traços
- ✅ Edição de traços
- ✅ Visualização de traços
- ✅ Cálculo automático de peso total

### Onde NÃO afeta
- Traços tipo TCP (plástico)
- Cálculos de produtos pré-moldados
- Cálculos de artefatos
- Sistema de ordens de produção

## Banco de Dados

### Estrutura
```sql
-- Coluna adicionada à tabela recipes
moisture_percentage DECIMAL(5,2) DEFAULT 0 
  CHECK (moisture_percentage >= 0 AND moisture_percentage <= 100)
```

### Exemplos de Query
```sql
-- Buscar traços TCS com umidade
SELECT name, moisture_percentage
FROM recipes
WHERE concrete_type = 'dry'
AND moisture_percentage > 0;

-- Calcular peso total com umidade
SELECT 
  name,
  (SELECT SUM(quantity) FROM recipe_items WHERE recipe_id = recipes.id) as peso_insumos,
  moisture_percentage,
  (SELECT SUM(quantity) FROM recipe_items WHERE recipe_id = recipes.id) * 
    (1 + moisture_percentage/100) as peso_total
FROM recipes
WHERE concrete_type = 'dry';
```

## Status

✅ **IMPLEMENTAÇÃO COMPLETA**
- Migração aplicada ✓
- Interface atualizada ✓
- Cálculos funcionando ✓
- Validações implementadas ✓
- Build: 15.09s ✓

## Arquivos Modificados

| Arquivo | Descrição |
|---------|-----------|
| Migration | `add_moisture_percentage_to_recipes` |
| `Recipes.tsx` | Interface + cálculos + visualização |

## Testes Recomendados

1. ✅ Criar traço TCS sem umidade (0%)
2. ✅ Criar traço TCS com umidade (6%)
3. ✅ Editar traço e alterar umidade
4. ✅ Visualizar detalhes e validar cálculo
5. ✅ Criar traço TCP (não deve mostrar campo)
6. ✅ Testar valores extremos (0%, 100%)
7. ✅ Testar valores decimais (6.50%)

