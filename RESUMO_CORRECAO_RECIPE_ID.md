# Resumo - Correção recipe_id na Production

## Problema
Erro ao registrar produção: `column "recipe_id" of relation "production" does not exist`

## Causa
Funções `create_production_atomic` e `create_production_with_costs` tentavam inserir `recipe_id` na tabela `production`, mas esse campo não existe.

## Estrutura da Tabela Production

```sql
-- Campos que EXISTEM:
id, product_id, quantity, production_date, notes, created_at,
production_order_id, production_type, production_order_item_id,
custos_no_momento (JSONB)

-- Campo que NÃO EXISTE:
recipe_id  ❌
```

## Solução

### Migration Aplicada
`fix_create_production_atomic_remove_recipe_id.sql`

**O que foi feito:**
1. Removido `recipe_id` do INSERT nas funções
2. Mantido `p_recipe_id` como parâmetro (usado para calcular custos)
3. Adicionados logs RAISE NOTICE para debug

**Antes (errado):**
```sql
INSERT INTO production (
  product_id,
  recipe_id,        -- ❌ não existe!
  quantity,
  ...
)
```

**Depois (correto):**
```sql
INSERT INTO production (
  product_id,       -- ✓ sem recipe_id
  quantity,
  custos_no_momento -- ✓ info do recipe vai aqui (JSONB)
  ...
)
```

### Logs Adicionados no Frontend
`src/components/DailyProduction.tsx`

- Log completo do payload antes da chamada RPC
- Log detalhado de erros (message, details, hint, code)
- Log de sucesso com ID da produção criada

## Por que recipe_id não precisa estar na tabela?

O `recipe_id` é usado para **calcular custos**, e essas informações (incluindo dados do recipe) são armazenadas no campo JSONB `custos_no_momento`:

```json
{
  "materials": { ... },
  "recipe": {
    "id": "recipe_uuid",
    "name": "Traço 1:2:3"
  },
  "total_cost": 150.50
}
```

## Como Testar

1. **Produção com data atual** → Deve funcionar
2. **Produção com data passada** → Deve funcionar ✓ (antes falhava)
3. **Produção via ordem** → Deve funcionar
4. **Verificar console** → Logs detalhados aparecendo

## Verificação Rápida

```sql
-- Ver últimas produções
SELECT
  p.id,
  prod.name,
  p.quantity,
  p.production_date,
  p.custos_no_momento->'recipe'->>'name' as recipe_usado
FROM production p
LEFT JOIN products prod ON prod.id = p.product_id
ORDER BY p.created_at DESC
LIMIT 5;
```

## Status

✅ Migration aplicada com sucesso
✅ Build concluído sem erros
✅ Logs detalhados implementados
✅ Sistema pronto para uso

## Arquivos Alterados

1. **Nova Migration:** `supabase/migrations/fix_create_production_atomic_remove_recipe_id.sql`
2. **Frontend:** `src/components/DailyProduction.tsx` (logs detalhados)

## Documentação Completa

Ver arquivo: `CORRECAO_RECIPE_ID_PRODUCTION.md`
