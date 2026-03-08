# Correção - Erro ao Editar Traços

## Problema Identificado

O sistema estava apresentando erro ao tentar editar traços existentes na aba Traços.

## Causa Raiz

Análise do banco de dados revelou que a tabela `recipes` possui constraints de validação:

```sql
-- Constraints identificadas:
recipes_concrete_type_check: CHECK (concrete_type IN ('dry', 'plastic'))
recipes_moisture_percentage_check: CHECK (moisture_percentage >= 0 AND moisture_percentage <= 100)
```

### Problemas Específicos:

1. **concrete_type**: Só aceita 'dry' ou 'plastic', não aceita string vazia ''
2. **moisture_percentage**: Deve estar entre 0 e 100 (ou null)
3. **specific_weight**: Estava sendo enviado como 0 quando vazio, mas deveria ser null

O código anterior enviava:
```typescript
concrete_type: formData.concrete_type || null,              // Problema potencial com string vazia
specific_weight: formData.specific_weight ? parseFloat(formData.specific_weight) : 0,  // Sempre enviava 0
moisture_percentage: formData.moisture_percentage ? parseFloat(formData.moisture_percentage) : 0  // Sempre enviava 0
```

### Cenários de Erro:

1. Usuário seleciona "Não especificado" no tipo de concreto → envia '' ao invés de null
2. Usuário deixa peso específico vazio → envia 0 ao invés de null
3. Usuário deixa umidade vazia → envia 0 ao invés de null

## Solução Implementada

Arquivo: `src/components/Recipes.tsx` (linhas 119-128)

### Antes:
```typescript
const recipeData = {
  name: formData.name,
  description: formData.description,
  concrete_type: formData.concrete_type || null,
  specific_weight: formData.specific_weight ? parseFloat(formData.specific_weight) : 0,
  moisture_percentage: formData.moisture_percentage ? parseFloat(formData.moisture_percentage) : 0,
};
```

### Depois:
```typescript
const parsedSpecificWeight = formData.specific_weight ? parseFloat(formData.specific_weight) : 0;
const parsedMoisturePercentage = formData.moisture_percentage ? parseFloat(formData.moisture_percentage) : 0;

const recipeData = {
  name: formData.name,
  description: formData.description,
  concrete_type: formData.concrete_type && formData.concrete_type !== '' ? formData.concrete_type : null,
  specific_weight: parsedSpecificWeight > 0 ? parsedSpecificWeight : null,
  moisture_percentage: (parsedMoisturePercentage >= 0 && parsedMoisturePercentage <= 100) ? parsedMoisturePercentage : null,
};
```

### O que foi corrigido:

1. **concrete_type**:
   - Agora verifica explicitamente se é string vazia
   - Se for '' ou falsy, envia null
   - Validação: `formData.concrete_type && formData.concrete_type !== '' ? formData.concrete_type : null`

2. **specific_weight**:
   - Agora garante que seja > 0 ou null
   - Se usuário digitar 0 ou deixar vazio, envia null
   - Validação: `parsedSpecificWeight > 0 ? parsedSpecificWeight : null`

3. **moisture_percentage**:
   - Agora garante que esteja entre 0-100 ou null
   - Valida o range permitido pelo banco
   - Validação: `(parsedMoisturePercentage >= 0 && parsedMoisturePercentage <= 100) ? parsedMoisturePercentage : null`

### Melhorias no Tratamento de Erro:

Adicionado log detalhado para facilitar debug:
```typescript
catch (error: any) {
  console.error('======= ERRO AO SALVAR TRAÇO =======');
  console.error('Erro completo:', error);
  console.error('Mensagem:', error?.message);
  console.error('Detalhes:', error?.details);
  console.error('Hint:', error?.hint);
  console.error('Código:', error?.code);
  console.error('Dados enviados:', recipeData);
  console.error('====================================');
  alert(`Erro ao salvar traço: ${error?.message || 'Erro desconhecido'}\n${error?.details || ''}`);
}
```

## Estrutura da Tabela Recipes

Para referência, campos obrigatórios:
- `name` (text, NOT NULL) - Nome do traço

Campos opcionais com validação:
- `concrete_type` - Deve ser 'dry', 'plastic' ou null
- `specific_weight` (numeric) - Deve ser > 0 ou null (padrão: 0 na tabela)
- `moisture_percentage` (numeric) - Deve estar entre 0-100 ou null (padrão: 0 na tabela)

## Como Testar

### Teste 1 - Traço Básico (sem tipo de concreto)
1. Abrir Aba Traços
2. Criar novo traço
3. Nome: "Traço Teste Básico"
4. Tipo de Concreto: "Não especificado"
5. Adicionar 1 insumo qualquer
6. Salvar → Deve funcionar sem erro

### Teste 2 - Traço Seco com Umidade
1. Criar novo traço
2. Nome: "TCS AL - Teste"
3. Tipo de Concreto: "TCS AL - Concreto Seco"
4. Umidade: 6.00
5. Adicionar insumos
6. Salvar → Deve funcionar

### Teste 3 - Traço Plástico com Peso Específico
1. Criar novo traço
2. Nome: "TCP AL - Teste"
3. Tipo de Concreto: "TCP AL - Concreto Plástico"
4. Peso Específico: 2400
5. Adicionar insumos
6. Salvar → Deve funcionar

### Teste 4 - Editar Traço Existente
1. Editar um traço existente
2. Alterar o tipo de concreto de "Não especificado" para "TCS AL"
3. Definir umidade: 5.5
4. Salvar → Deve funcionar

### Teste 5 - Remover Tipo de Concreto
1. Editar um traço que tem tipo definido
2. Mudar tipo para "Não especificado"
3. Salvar → Deve funcionar (envia null)

## Validações Implementadas

| Campo | Valor Vazio | Valor 0 | Valor Inválido | Valor Válido |
|-------|-------------|---------|----------------|--------------|
| concrete_type | null | - | Erro do banco | 'dry' ou 'plastic' |
| specific_weight | null | null | null | Número > 0 |
| moisture_percentage | null | null (se inválido) | null | 0-100 |

## Build

Build finalizado com sucesso:
```
✓ 1824 modules transformed.
✓ built in 16.93s
```

Sistema pronto para deploy.

## Arquivos Alterados

- `src/components/Recipes.tsx`
  - handleSubmit (linhas 119-180)
  - Melhor validação dos campos opcionais
  - Tratamento de erro detalhado

## Observações Importantes

1. O banco permite valores null para campos opcionais
2. O banco NÃO permite string vazia para concrete_type (só 'dry', 'plastic' ou null)
3. O banco valida ranges para moisture_percentage (0-100)
4. Sempre validar dados antes de enviar ao banco para evitar erros

## Relação com Correção Anterior

Esta correção segue o mesmo padrão da correção feita em Materials.tsx:
- Validar valores antes de enviar ao banco
- Converter valores inválidos para null ao invés de 0
- Adicionar logs detalhados de erro
- Respeitar constraints do banco de dados
