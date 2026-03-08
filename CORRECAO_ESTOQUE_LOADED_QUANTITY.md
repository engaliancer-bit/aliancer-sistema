# Correção do Cálculo de Estoque - Uso de loaded_quantity

## Problema Identificado

O sistema estava calculando o estoque incorretamente porque usava `quantity` (quantidade do pedido) ao invés de `loaded_quantity` (quantidade efetivamente carregada) para determinar quantos itens foram entregues.

### Exemplo do Problema

**Cenário:** Entrega de 5 postes para Luis Baumgratz

```
Antes da correção:
- 22 postes produzidos
- Entrega criada: 5 postes (quantity = 5)
- Itens NÃO marcados como carregados (loaded_quantity = 0)
- Entrega fechada manualmente (status = 'closed')
- Sistema contava: 5 postes entregues (usando quantity)
- Estoque = 22 - 5 = 17 ❌ ERRADO!

Depois da correção:
- 22 postes produzidos
- Entrega criada: 5 postes (quantity = 5)
- Itens NÃO marcados como carregados (loaded_quantity = 0)
- Entrega fechada manualmente (status = 'closed')
- Sistema conta: 0 postes entregues (usando loaded_quantity)
- Estoque = 22 - 0 = 22 ✅ CORRETO!
```

---

## O Que Foi Corrigido

### 1. View `product_stock_view`

**Antes:**
```sql
SELECT di.product_id, SUM(di.quantity) as total_delivered
FROM delivery_items di
INNER JOIN deliveries d ON d.id = di.delivery_id
WHERE d.status = 'closed'
GROUP BY di.product_id
```

**Depois:**
```sql
SELECT di.product_id, SUM(di.loaded_quantity) as total_delivered
FROM delivery_items di
INNER JOIN deliveries d ON d.id = di.delivery_id
WHERE d.status = 'closed'
GROUP BY di.product_id
```

### 2. Função `get_product_stock()`

**Antes:**
```sql
SELECT COALESCE(SUM(di.quantity), 0)
FROM delivery_items di
INNER JOIN deliveries d ON d.id = di.delivery_id
WHERE di.product_id = p_product_id AND d.status = 'closed'
```

**Depois:**
```sql
SELECT COALESCE(SUM(di.loaded_quantity), 0)
FROM delivery_items di
INNER JOIN deliveries d ON d.id = di.delivery_id
WHERE di.product_id = p_product_id AND d.status = 'closed'
```

### 3. Função `get_product_available_stock()`

Agora usa a view corrigida `product_stock_view` que já considera `loaded_quantity`.

---

## Entregas Antigas com Loaded_Quantity = 0

### Problema

Entregas que foram fechadas antes da implementação do controle de `loaded_quantity`, ou que foram fechadas manualmente sem marcar os itens como carregados, têm `loaded_quantity = 0`.

**Consequência:** O sistema não conta esses itens como entregues, mantendo-os no estoque.

### Verificar Entregas Afetadas

Use esta query para encontrar entregas fechadas com itens não marcados como carregados:

```sql
SELECT
  d.id as delivery_id,
  d.delivery_date,
  c.name as cliente,
  p.name as produto,
  di.quantity as qtd_pedido,
  di.loaded_quantity as qtd_carregada,
  (di.quantity - di.loaded_quantity) as diferenca
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
JOIN delivery_items di ON di.delivery_id = d.id
LEFT JOIN products p ON p.id = di.product_id
WHERE d.status = 'closed'
  AND di.loaded_quantity < di.quantity
ORDER BY d.delivery_date DESC;
```

---

## Como Corrigir Entregas Antigas

Se uma entrega foi REALMENTE realizada (os itens foram fisicamente entregues), mas não foram marcados como carregados no sistema, você precisa atualizar o `loaded_quantity`.

### Opção 1: Corrigir Entrega Específica (Luis Baumgratz)

Se os 5 postes FORAM REALMENTE ENTREGUES ao Luis Baumgratz, execute:

```sql
-- Atualizar loaded_quantity para refletir a realidade
UPDATE delivery_items
SET
  loaded_quantity = quantity,
  loaded_at = NOW()
WHERE delivery_id = '27ccbacd-0047-48d4-b242-b153a79c0f7e'
  AND loaded_quantity = 0;
```

**Resultado:**
- Os 5 postes serão contados como entregues
- Estoque será reduzido de 22 para 17 (ou 12 se foram 10 postes)

### Opção 2: Corrigir TODAS as Entregas Antigas Fechadas

Se você quer marcar TODAS as entregas fechadas como entregues (assumindo que se foram fechadas, foram entregues):

```sql
-- CUIDADO: Isso afeta TODAS as entregas fechadas com loaded_quantity = 0
UPDATE delivery_items di
SET
  loaded_quantity = di.quantity,
  loaded_at = NOW()
FROM deliveries d
WHERE di.delivery_id = d.id
  AND d.status = 'closed'
  AND di.loaded_quantity = 0;
```

**⚠️ ATENÇÃO:** Só faça isso se tiver certeza que TODAS as entregas fechadas foram realmente entregues!

### Opção 3: Corrigir Apenas Entregas Antigas (Antes de Determinada Data)

Para corrigir apenas entregas antigas, antes da implementação do controle de loaded_quantity:

```sql
-- Corrigir apenas entregas fechadas antes de 26/01/2026
UPDATE delivery_items di
SET
  loaded_quantity = di.quantity,
  loaded_at = d.delivery_date
FROM deliveries d
WHERE di.delivery_id = d.id
  AND d.status = 'closed'
  AND di.loaded_quantity = 0
  AND d.delivery_date < '2026-01-26';
```

---

## Verificar Estoque Após Correção

Depois de corrigir as entregas antigas, verifique o estoque:

```sql
-- Ver estoque atualizado de todos os produtos
SELECT
  p.name as produto,
  p.code as codigo,
  psv.total_produced as produzido,
  psv.total_delivered as entregue,
  psv.available_stock as estoque_disponivel
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE psv.total_produced > 0
ORDER BY p.name;
```

### Verificar Estoque dos Postes Especificamente

```sql
SELECT
  p.name as produto,
  psv.total_produced as produzido,
  psv.total_delivered as entregue,
  psv.available_stock as estoque_disponivel
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.name ILIKE '%poste%10x10%2.50%'
   OR p.name ILIKE '%poste%10x10%2,50%';
```

---

## Fluxo Correto Daqui Para Frente

### 1. Criar Entrega
- Status: `open`
- Itens criados com `loaded_quantity = 0`

### 2. Carregar Itens
- Marque cada item como carregado na interface
- `loaded_quantity` é atualizado conforme você marca
- Pode carregar parcialmente (loaded_quantity < quantity)

### 3. Salvar Progresso
- **Opção A:** "Salvar e Continuar Depois"
  - Mantém entrega aberta
  - Você pode voltar e carregar mais itens depois

- **Opção B:** "Finalizar Entrega Agora"
  - Fecha a entrega definitivamente
  - Mesmo com loaded_quantity < quantity

### 4. Estoque é Atualizado Automaticamente
- Sistema conta apenas itens com `loaded_quantity > 0` em entregas fechadas
- Itens não carregados permanecem no estoque

---

## Exemplo Completo

### Situação Inicial
- Produto: Poste 10x10x2.50m
- Estoque: 22 unidades

### Criar Pedido e Entrega
1. Cliente pede 5 postes
2. Sistema cria entrega com 5 postes (quantity = 5, loaded_quantity = 0)
3. Estoque ainda em 22 (porque loaded_quantity = 0)

### Carregar na Interface
1. Você marca 3 postes como carregados → loaded_quantity = 3
2. Estoque continua em 22 (entrega ainda `open` ou `in_progress`)

### Salvar Progresso
**Opção A:** "Salvar e Continuar"
- Entrega fica `in_progress`
- Estoque continua em 22 (porque status != 'closed')

**Opção B:** "Finalizar Agora"
- Entrega vai para `closed`
- Estoque vai para 22 - 3 = 19 (conta apenas loaded_quantity)
- 2 postes permanecem disponíveis (não foram carregados)

### Carregar o Restante (Se salvou e continuou)
1. Depois você volta e marca mais 2 postes → loaded_quantity = 5
2. Status automaticamente muda para `closed` (trigger)
3. Estoque vai para 22 - 5 = 17

---

## Verificar Integridade do Sistema

Use estas queries para verificar se está tudo correto:

### 1. Entregas Fechadas com Itens Não Carregados

```sql
-- Entregas fechadas mas com itens não carregados
-- (podem indicar entregas antigas ou erro)
SELECT
  d.id,
  d.delivery_date,
  c.name,
  COUNT(*) as itens_nao_carregados
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
JOIN delivery_items di ON di.delivery_id = d.id
WHERE d.status = 'closed'
  AND di.loaded_quantity = 0
GROUP BY d.id, d.delivery_date, c.name
ORDER BY d.delivery_date DESC;
```

### 2. Comparar Estoque Antes e Depois da Correção

```sql
-- Comparação: Se estivesse usando quantity vs usando loaded_quantity
SELECT
  p.name as produto,
  SUM(prod.quantity) as total_produzido,
  SUM(di_quantity.entregue_quantity) as entregue_usando_quantity,
  SUM(di_loaded.entregue_loaded) as entregue_usando_loaded_quantity,
  SUM(prod.quantity) - SUM(di_quantity.entregue_quantity) as estoque_antigo_ERRADO,
  SUM(prod.quantity) - SUM(di_loaded.entregue_loaded) as estoque_novo_CORRETO,
  (SUM(prod.quantity) - SUM(di_loaded.entregue_loaded)) -
  (SUM(prod.quantity) - SUM(di_quantity.entregue_quantity)) as diferenca
FROM products p
LEFT JOIN production prod ON prod.product_id = p.id
LEFT JOIN (
  SELECT di.product_id, SUM(di.quantity) as entregue_quantity
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
  GROUP BY di.product_id
) di_quantity ON di_quantity.product_id = p.id
LEFT JOIN (
  SELECT di.product_id, SUM(di.loaded_quantity) as entregue_loaded
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
  GROUP BY di.product_id
) di_loaded ON di_loaded.product_id = p.id
WHERE SUM(prod.quantity) > 0
GROUP BY p.name
HAVING (SUM(prod.quantity) - SUM(di_loaded.entregue_loaded)) !=
       (SUM(prod.quantity) - SUM(di_quantity.entregue_quantity))
ORDER BY diferenca DESC;
```

---

## Resumo

### ✅ O Que Mudou
- Sistema agora usa `loaded_quantity` (carregado) ao invés de `quantity` (pedido)
- Estoque reflete apenas itens REALMENTE entregues
- Suporte correto para entregas parciais

### ⚠️ Ação Necessária
- Verificar entregas antigas com `loaded_quantity = 0`
- Corrigir manualmente se os itens foram realmente entregues
- Usar a interface corretamente daqui para frente

### 📊 Caso da Entrega do Luis Baumgratz
- **Situação Atual:** 5 postes fechados mas não marcados como carregados
- **Estoque Mostra:** 22 postes (correto se não foram entregues)
- **Se foram entregues:** Execute a query de correção específica
- **Resultado:** Estoque será ajustado para 17 postes

---

## Queries de Correção Rápida

### Para o Caso Específico (Luis Baumgratz - Postes 10x10x2.50m)

```sql
-- Se os postes FORAM REALMENTE ENTREGUES:
UPDATE delivery_items
SET
  loaded_quantity = quantity,
  loaded_at = NOW()
WHERE delivery_id = '27ccbacd-0047-48d4-b242-b153a79c0f7e';

-- Verificar resultado:
SELECT
  p.name,
  psv.available_stock as estoque_disponivel
FROM products p
JOIN product_stock_view psv ON psv.product_id = p.id
WHERE p.name ILIKE '%poste%10x10%2.50%';
```

**Resultado esperado após correção:**
- Se 5 postes foram entregues: estoque = 17
- Se 10 postes foram entregues (2 itens): estoque = 12

---

## Status da Correção

- ✅ View `product_stock_view` corrigida
- ✅ Função `get_product_stock()` corrigida
- ✅ Função `get_product_available_stock()` corrigida
- ✅ Sistema passa a usar `loaded_quantity` corretamente
- ⏳ Entregas antigas precisam ser corrigidas manualmente (se aplicável)
- ✅ Pronto para uso em produção
