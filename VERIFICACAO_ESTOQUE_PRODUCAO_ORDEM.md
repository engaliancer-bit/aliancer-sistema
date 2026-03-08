# Verificação: Estoque x Produção para Ordem

## Resumo

O sistema está funcionando **CORRETAMENTE**. Quando você altera uma produção de "Para Estoque" (production_type='stock') para "Para Ordem" (production_type='order'), o produto é automaticamente excluído do estoque disponível.

## Como Funciona

### Tipos de Produção

1. **Para Estoque** (production_type='stock')
   - Produtos disponíveis para venda geral
   - ENTRA no cálculo de estoque disponível
   - Exemplo: Produção de blocos para estoque

2. **Para Ordem** (production_type='order')
   - Produtos vinculados a uma ordem de produção específica
   - NÃO ENTRA no cálculo de estoque disponível
   - Exemplo: Produção de pilares para uma obra específica

### Cálculo de Estoque

```
Estoque Disponível =
  Σ Produção "Para Estoque" (stock)
  - Σ Entregas Ativas (open, in_progress, closed)
```

**Importante**: Produção "Para Ordem" NÃO é contabilizada no estoque geral!

## Exemplo Prático Verificado

**Produto**: Poste de cerca 10x10cm x 2.00m

| Métrica | Valor | Descrição |
|---------|-------|-----------|
| Produção para Estoque | 63 un. | Conta no estoque ✅ |
| Produção para Ordem | 175 un. | NÃO conta no estoque ❌ |
| Produção Total | 238 un. | Soma de ambas |
| Total Entregue | 135 un. | Entregas ativas |
| **Estoque Disponível** | **-72 un.** | 63 - 135 = -72 ✅ |

**Conclusão**: As 175 unidades produzidas para ordens NÃO estão no estoque, comportamento CORRETO!

## Queries de Verificação

### 1. Verificar Estoque de um Produto Específico

```sql
-- Substitua o UUID pelo ID do seu produto
WITH produto_teste AS (
  SELECT 'SEU-PRODUCT-ID-AQUI'::uuid as product_id
)
SELECT
  p.name as produto,
  p.code as codigo,

  -- Produção por tipo
  COALESCE(prod_stock.qty_stock, 0) as producao_para_estoque,
  COALESCE(prod_order.qty_order, 0) as producao_para_ordem,
  COALESCE(prod_total.qty_total, 0) as producao_total,

  -- Entregas
  COALESCE(deliv.qty_delivered, 0) as total_entregue,

  -- Estoque disponível
  COALESCE(psv.available_stock, 0) as estoque_disponivel,

  -- Verificação
  CASE
    WHEN COALESCE(prod_stock.qty_stock, 0) - COALESCE(deliv.qty_delivered, 0) = COALESCE(psv.available_stock, 0)
    THEN '✅ CORRETO'
    ELSE '❌ DIVERGÊNCIA'
  END as status_calculo

FROM produto_teste pt
JOIN products p ON p.id = pt.product_id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_stock
  FROM production
  WHERE production_type = 'stock' AND product_id = (SELECT product_id FROM produto_teste)
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = pt.product_id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_order
  FROM production
  WHERE production_type = 'order' AND product_id = (SELECT product_id FROM produto_teste)
  GROUP BY product_id
) prod_order ON prod_order.product_id = pt.product_id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_total
  FROM production
  WHERE product_id = (SELECT product_id FROM produto_teste)
  GROUP BY product_id
) prod_total ON prod_total.product_id = pt.product_id

LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as qty_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')
    AND di.product_id = (SELECT product_id FROM produto_teste)
  GROUP BY di.product_id
) deliv ON deliv.product_id = pt.product_id

LEFT JOIN product_stock_view psv ON psv.product_id = pt.product_id;
```

### 2. Listar Todos os Produtos com Breakdown de Estoque

```sql
SELECT
  p.name as produto,
  p.code as codigo,

  -- Produção
  COALESCE(prod_stock.qty_stock, 0) as prod_estoque,
  COALESCE(prod_order.qty_order, 0) as prod_ordem,
  COALESCE(prod_total.qty_total, 0) as prod_total,

  -- Entregas
  COALESCE(deliv.qty_delivered, 0) as entregue,

  -- Estoque
  COALESCE(psv.available_stock, 0) as disponivel

FROM products p

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_stock
  FROM production WHERE production_type = 'stock'
  GROUP BY product_id
) prod_stock ON prod_stock.product_id = p.id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_order
  FROM production WHERE production_type = 'order'
  GROUP BY product_id
) prod_order ON prod_order.product_id = p.id

LEFT JOIN (
  SELECT product_id, SUM(quantity) as qty_total
  FROM production
  GROUP BY product_id
) prod_total ON prod_total.product_id = p.id

LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as qty_delivered
  FROM delivery_items di
  INNER JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')
  GROUP BY di.product_id
) deliv ON deliv.product_id = p.id

LEFT JOIN product_stock_view psv ON psv.product_id = p.id

WHERE prod_total.qty_total > 0
ORDER BY p.name;
```

### 3. Ver Produções que Mudaram de Tipo

```sql
-- Ver produções vinculadas a ordens (production_type='order')
SELECT
  pr.id,
  p.name as produto,
  p.code as codigo,
  pr.quantity,
  pr.production_type,
  pr.production_order_id,
  po.order_number as numero_ordem,
  pr.production_date,
  pr.created_at as registrado_em,
  pr.updated_at as atualizado_em,
  CASE
    WHEN pr.created_at != pr.updated_at
    THEN '⚠️ ALTERADO'
    ELSE 'Original'
  END as status
FROM production pr
JOIN products p ON p.id = pr.product_id
LEFT JOIN production_orders po ON po.id = pr.production_order_id
WHERE pr.production_type = 'order'
ORDER BY pr.updated_at DESC
LIMIT 50;
```

### 4. Comparar Estoque Antes/Depois de Alterar

**Antes de alterar** uma produção de 'stock' para 'order':

```sql
-- 1. Anotar estoque atual
SELECT
  p.name,
  psv.available_stock as estoque_antes
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.id = 'ID-DO-PRODUTO';
```

**Alterar** a produção (exemplo):

```sql
UPDATE production
SET
  production_type = 'order',
  production_order_id = 'ID-DA-ORDEM',
  updated_at = now()
WHERE id = 'ID-DA-PRODUCAO';
```

**Depois de alterar**:

```sql
-- 2. Ver novo estoque (deve ter diminuído pela quantidade alterada)
SELECT
  p.name,
  psv.available_stock as estoque_depois,
  pr.quantity as quantidade_alterada
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
JOIN production pr ON pr.product_id = p.id
WHERE p.id = 'ID-DO-PRODUTO'
  AND pr.id = 'ID-DA-PRODUCAO';
```

**Resultado Esperado**:
```
estoque_depois = estoque_antes - quantidade_alterada
```

## Situações Comuns

### Caso 1: Alterei de 'stock' para 'order' mas estoque não mudou

**Diagnóstico**:
1. Verifique se a alteração foi realmente salva:
   ```sql
   SELECT production_type, updated_at
   FROM production
   WHERE id = 'ID-DA-PRODUCAO';
   ```

2. Limpe cache do navegador (Ctrl+F5)

3. Verifique se a view está atualizada:
   ```sql
   SELECT * FROM product_stock_view
   WHERE product_id = 'ID-DO-PRODUTO';
   ```

### Caso 2: Estoque negativo

**Não é erro!** Estoque negativo significa:
- Você entregou mais do que produziu para estoque
- Há entregas aguardando produção
- Você precisa produzir para cobrir o déficit

**Exemplo**:
- Produção para estoque: 63 un.
- Entregas ativas: 135 un.
- Estoque: -72 un. (faltam 72 para cobrir entregas)

### Caso 3: Preciso mover produção de ordem de volta para estoque

```sql
UPDATE production
SET
  production_type = 'stock',
  production_order_id = NULL,
  updated_at = now()
WHERE id = 'ID-DA-PRODUCAO';
```

O estoque aumentará automaticamente pela quantidade dessa produção.

## Teste Passo a Passo

### Cenário de Teste

Vamos testar com um produto real:

**1. Ver estoque atual**
```sql
SELECT
  p.name,
  psv.available_stock,
  psv.total_produced,
  psv.total_delivered
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.name ILIKE '%poste%'  -- exemplo
LIMIT 1;
```

**2. Criar uma produção para estoque**
```sql
INSERT INTO production (
  product_id,
  quantity,
  production_type,
  production_date
) VALUES (
  'ID-DO-PRODUTO',
  10,
  'stock',
  CURRENT_DATE
) RETURNING id, quantity;
```

**3. Verificar que estoque aumentou em 10**
```sql
SELECT available_stock
FROM product_stock_view
WHERE product_id = 'ID-DO-PRODUTO';
```

**4. Alterar para ordem**
```sql
UPDATE production
SET
  production_type = 'order',
  production_order_id = (SELECT id FROM production_orders LIMIT 1)
WHERE id = 'ID-DA-PRODUCAO-CRIADA';
```

**5. Verificar que estoque diminuiu em 10**
```sql
SELECT available_stock
FROM product_stock_view
WHERE product_id = 'ID-DO-PRODUTO';
```

**Resultado Esperado**:
- Após passo 2: Estoque = estoque_inicial + 10
- Após passo 4: Estoque = estoque_inicial (voltou ao valor original)

## Resumo Final

✅ **Sistema está funcionando corretamente**

Quando você altera production_type:
- `'stock'` → `'order'`: Produto SAI do estoque automaticamente
- `'order'` → `'stock'`: Produto ENTRA no estoque automaticamente

Não há necessidade de ajustes manuais. A view `product_stock_view` calcula tudo automaticamente baseada no campo `production_type`.

## Queries Salvas para Uso Diário

### Ver estoque geral
```sql
SELECT
  p.name,
  p.code,
  psv.total_produced,
  psv.total_delivered,
  psv.available_stock
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE psv.available_stock != 0 OR psv.total_produced > 0
ORDER BY p.name;
```

### Ver produtos com estoque negativo (precisam produção)
```sql
SELECT
  p.name,
  p.code,
  psv.available_stock,
  psv.total_produced,
  psv.total_delivered,
  (psv.total_delivered - psv.total_produced) as faltando
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE psv.available_stock < 0
ORDER BY psv.available_stock;
```

### Ver produções de hoje
```sql
SELECT
  p.name as produto,
  pr.quantity,
  pr.production_type,
  CASE pr.production_type
    WHEN 'stock' THEN '📦 Para Estoque'
    WHEN 'order' THEN '🔨 Para Ordem'
  END as tipo,
  po.order_number as ordem,
  pr.production_date
FROM production pr
JOIN products p ON p.id = pr.product_id
LEFT JOIN production_orders po ON po.id = pr.production_order_id
WHERE pr.production_date = CURRENT_DATE
ORDER BY pr.created_at DESC;
```

## Suporte

Se ainda encontrar alguma divergência após verificar com as queries acima, documente:

1. ID do produto
2. Estoque esperado vs estoque real (da view)
3. Lista de todas as produções desse produto (com tipo)
4. Lista de todas as entregas desse produto

E compartilhe para análise detalhada.
