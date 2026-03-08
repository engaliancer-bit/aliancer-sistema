# Correção - Erro recipe_id na Tabela Production

## Problema Identificado

O sistema estava apresentando erro ao tentar registrar produção (especialmente com data passada), devido a tentativa de inserir o campo `recipe_id` na tabela `production`, mas esse campo não existe na estrutura da tabela.

## Causa Raiz

### Estrutura da Tabela Production

A tabela `production` possui os seguintes campos:

```sql
-- Campos existentes:
id                      UUID (PK)
product_id              UUID (NOT NULL)
quantity                NUMERIC (NOT NULL)
production_date         DATE (NOT NULL, padrão: CURRENT_DATE)
notes                   TEXT (opcional)
created_at              TIMESTAMP (padrão: now())
production_order_id     UUID (opcional)
production_type         TEXT (NOT NULL, padrão: 'stock')
production_order_item_id UUID (opcional)
custos_no_momento       JSONB (opcional, padrão: {})
```

**NÃO existe o campo `recipe_id` na tabela!**

### Problema nas Stored Functions

Duas funções do banco de dados estavam tentando inserir `recipe_id`:

1. **create_production_atomic**: Recebia `p_recipe_id` como parâmetro e tentava inserir na tabela
2. **create_production_with_costs**: Mesma situação

```sql
-- CÓDIGO ANTIGO (INCORRETO)
INSERT INTO production (
  product_id,
  recipe_id,        -- ❌ Este campo não existe!
  quantity,
  production_date,
  ...
) VALUES (...)
```

### Erro Gerado

```
Error: column "recipe_id" of relation "production" does not exist
```

Esse erro ocorria ao:
- Registrar nova produção
- Registrar produção com data passada
- Criar produção via ordem de produção

## Solução Implementada

### 1. Migration Criada

Arquivo: `supabase/migrations/fix_create_production_atomic_remove_recipe_id.sql`

**O que foi feito:**

1. **Removido `recipe_id` dos INSERTs** em ambas as funções
2. **Mantido `p_recipe_id` como parâmetro** para cálculo de custos
3. **Adicionados logs detalhados** (RAISE NOTICE) para debug

### Código Corrigido - create_production_atomic

```sql
CREATE OR REPLACE FUNCTION create_production_atomic(
  p_product_id UUID,
  p_recipe_id UUID,  -- ✓ Mantido para calcular custos
  p_quantity NUMERIC,
  p_production_date DATE,
  ...
)
RETURNS UUID
AS $$
BEGIN
  -- Calcular custos usando p_recipe_id
  IF p_custos IS NULL THEN
    p_custos := calculate_production_costs(p_recipe_id, p_quantity);
  END IF;

  -- Inserir SEM recipe_id
  INSERT INTO production (
    product_id,        -- ✓ Sem recipe_id
    quantity,
    production_date,
    production_order_item_id,
    production_type,
    notes,
    custos_no_momento  -- ✓ Informações do recipe são armazenadas aqui
  ) VALUES (...);

  RETURN v_production_id;
END;
$$;
```

**Por que o recipe_id não precisa estar na tabela:**

O `recipe_id` é usado para calcular os custos de produção, e essas informações (incluindo dados do recipe) são armazenadas no campo JSONB `custos_no_momento`. Exemplo:

```json
{
  "materials": {
    "material_uuid_1": {
      "name": "Cimento",
      "quantity": 50,
      "unit": "kg",
      "unit_cost": 0.45,
      "total_cost": 22.50
    },
    ...
  },
  "recipe": {
    "id": "recipe_uuid",
    "name": "Traço 1:2:3",
    "type": "dry"
  },
  "total_material_cost": 100.50,
  ...
}
```

### 2. Logs Adicionados no Frontend

Arquivo: `src/components/DailyProduction.tsx`

**Antes da chamada RPC:**
```typescript
console.log('=== PAYLOAD ENVIADO PARA create_production_atomic ===');
console.log('p_product_id:', rpcPayload.p_product_id);
console.log('p_recipe_id:', rpcPayload.p_recipe_id);
console.log('p_quantity:', rpcPayload.p_quantity);
console.log('p_production_date:', rpcPayload.p_production_date);
// ... outros campos
console.log('=============================================');
```

**No erro:**
```typescript
if (rpcError) {
  console.error('======= ERRO AO CRIAR PRODUÇÃO =======');
  console.error('Erro completo:', rpcError);
  console.error('Mensagem:', rpcError?.message);
  console.error('Detalhes:', rpcError?.details);
  console.error('Hint:', rpcError?.hint);
  console.error('Código:', rpcError?.code);
  console.error('Payload enviado:', rpcPayload);
  console.error('====================================');
  throw rpcError;
}
```

**No sucesso:**
```typescript
console.log('✓ Produção criada com sucesso! ID:', productionId);
```

### 3. Logs no Banco de Dados

A função agora possui RAISE NOTICE em pontos estratégicos:

```sql
RAISE NOTICE 'create_production_atomic - Início';
RAISE NOTICE '  p_product_id: %', p_product_id;
RAISE NOTICE '  p_recipe_id: %', p_recipe_id;
RAISE NOTICE '  p_quantity: %', p_quantity;
-- ...
RAISE NOTICE 'Inserindo na tabela production...';
RAISE NOTICE 'Produção criada com ID: %', v_production_id;
RAISE NOTICE 'create_production_atomic - Concluído com sucesso';
```

Para visualizar esses logs no Supabase, use:
```sql
-- Habilitar logs de NOTICE
SET client_min_messages = 'notice';
```

## Como Testar

### Teste 1 - Produção Normal (Data Atual)
1. Ir em "Produção Diária"
2. Selecionar um produto
3. Informar quantidade
4. Deixar data como hoje
5. Clicar em "Registrar Produção"
6. ✓ Deve funcionar sem erro

### Teste 2 - Produção com Data Passada
1. Ir em "Produção Diária"
2. Selecionar um produto
3. Informar quantidade
4. **Alterar data para uma data passada** (ex: ontem)
5. Clicar em "Registrar Produção"
6. ✓ Deve funcionar sem erro (era aqui que falhava antes)

### Teste 3 - Produção via Ordem de Produção
1. Criar uma ordem de produção
2. Ir em "Produção Diária"
3. Selecionar tipo "Ordem de Produção"
4. Selecionar a ordem criada
5. Registrar produção
6. ✓ Deve funcionar sem erro

### Teste 4 - Verificar Console Logs
1. Abrir DevTools (F12) → aba Console
2. Registrar uma produção
3. Verificar os logs detalhados:
   ```
   === PAYLOAD ENVIADO PARA create_production_atomic ===
   p_product_id: uuid-do-produto
   p_recipe_id: uuid-do-recipe (ou null)
   p_quantity: 10
   p_production_date: 2026-02-03
   ...
   ✓ Produção criada com sucesso! ID: uuid-da-producao
   ```

### Teste 5 - Verificar Custos Armazenados
```sql
-- Verificar se custos foram armazenados corretamente
SELECT
  p.id,
  p.product_id,
  p.quantity,
  p.production_date,
  p.custos_no_momento->>'total_material_cost' as custo_materiais,
  jsonb_pretty(p.custos_no_momento) as custos_detalhados
FROM production p
ORDER BY p.created_at DESC
LIMIT 5;
```

Deve retornar custos detalhados em JSON, incluindo informações do recipe se aplicável.

## Fluxo de Dados Corrigido

### 1. Frontend (DailyProduction.tsx)
```typescript
// Busca recipe_id do produto
const product = products.find(p => p.id === formData.product_id);
const recipe_id = product?.recipe_id || null;

// Calcula custos usando recipe_id
const costs = await calculateProductionCosts(
  product_id,
  recipe_id,  // ✓ Usado para calcular
  quantity,
  product_type,
  total_weight
);

// Envia para função RPC
await supabase.rpc('create_production_atomic', {
  p_recipe_id: recipe_id,  // ✓ Enviado para função
  p_custos: costs,          // ✓ Custos já calculados
  ...
});
```

### 2. Banco de Dados (create_production_atomic)
```sql
-- Recebe p_recipe_id
-- Usa p_recipe_id para calcular custos (se necessário)
-- Armazena custos em custos_no_momento (JSONB)
-- NÃO tenta inserir recipe_id na tabela production
```

### 3. Tabela Production
```sql
-- Armazena:
production {
  id: uuid
  product_id: uuid          -- ✓ Produto produzido
  quantity: numeric         -- ✓ Quantidade
  production_date: date     -- ✓ Data
  custos_no_momento: jsonb  -- ✓ Inclui info do recipe
}
```

## Queries Úteis para Debug

### Verificar estrutura da tabela production
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'production'
ORDER BY ordinal_position;
```

### Verificar se recipe_id existe (não deve existir)
```sql
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'production'
  AND column_name = 'recipe_id'
) as recipe_id_exists;
-- Deve retornar: false
```

### Ver últimas produções com custos
```sql
SELECT
  p.id,
  prod.name as produto,
  p.quantity,
  p.production_date,
  p.custos_no_momento->>'total_cost' as custo_total,
  p.custos_no_momento->'recipe'->>'name' as recipe_nome
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
ORDER BY p.created_at DESC
LIMIT 10;
```

### Verificar funções criadas corretamente
```sql
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('create_production_atomic', 'create_production_with_costs')
ORDER BY proname;
```

## Impacto da Correção

### ✅ O que está funcionando agora:
1. Registro de produção com data atual
2. Registro de produção com data passada
3. Registro de produção via ordem de produção
4. Cálculo correto de custos históricos
5. Armazenamento de informações do recipe no JSONB
6. Logs detalhados para debug em produção

### ⚠️ Atenção:
- O `recipe_id` continua sendo usado para calcular custos
- As informações do recipe são armazenadas em `custos_no_momento`
- Para recuperar o recipe usado, deve-se acessar `custos_no_momento.recipe.id`

### 🔍 Monitoramento:
- Verificar logs do console ao registrar produção
- Monitorar tabela `production` para garantir integridade dos custos
- Verificar se `custos_no_momento` está sendo populado corretamente

## Outras Funções Afetadas

Apenas duas funções foram corrigidas:
1. `create_production_atomic` - Usada em DailyProduction.tsx
2. `create_production_with_costs` - Usada em outros fluxos (não identificado uso ativo)

Nenhuma outra função ou trigger foi identificada com o problema.

## Build Status

✅ Build concluído com sucesso
✅ TypeScript sem erros
✅ Migration aplicada com sucesso
✅ Sistema pronto para deploy

## Arquivos Alterados

1. **Nova Migration:**
   - `supabase/migrations/fix_create_production_atomic_remove_recipe_id.sql`

2. **Frontend:**
   - `src/components/DailyProduction.tsx`
     - Adicionado logs detalhados do payload (linhas ~242-265)
     - Adicionado tratamento de erro detalhado (linhas ~272-282)

## Lições Aprendidas

1. **Sempre verificar estrutura da tabela** antes de implementar funções que fazem INSERT
2. **Usar JSONB para dados históricos** ao invés de FK quando apropriado
3. **Adicionar logs em pontos críticos** para facilitar debug em produção
4. **Testar com diferentes cenários** (data atual, data passada, etc.)
5. **Documentar diferença entre parâmetros e campos da tabela**

## Próximos Passos Recomendados

1. ✅ Testar registro de produção em produção
2. ✅ Monitorar logs por 24-48h
3. ⚠️ Considerar criar índice em `production.custos_no_momento` para queries rápidas
4. ⚠️ Documentar estrutura do JSONB `custos_no_momento` para equipe

## Exemplo de Uso Correto

```typescript
// Frontend
const { data: productionId, error } = await supabase.rpc(
  'create_production_atomic',
  {
    p_product_id: 'uuid-do-produto',
    p_recipe_id: 'uuid-do-recipe',  // Usado para calcular, não inserido
    p_quantity: 10,
    p_production_date: '2026-02-03',
    p_custos: costs,  // Já inclui info do recipe
    // ...
  }
);

// Para recuperar recipe usado na produção:
const { data: production } = await supabase
  .from('production')
  .select('custos_no_momento')
  .eq('id', productionId)
  .single();

const recipeUsed = production.custos_no_momento?.recipe;
console.log('Recipe usado:', recipeUsed.name);
```
