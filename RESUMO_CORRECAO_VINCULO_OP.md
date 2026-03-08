# Resumo - Correção Vínculo de OP na Produção

## Problema
OP #21 não aparecia ao tentar vincular produção, mas existia e estava aberta.

## Causa
Sistema tem DOIS modelos de ordens:
1. **Modelo Legado:** `production_orders` com `product_id` direto (sem itens)
2. **Modelo Novo:** `production_orders` + `production_order_items` (com itens)

A OP #21 usa o modelo legado, mas o código buscava apenas de `production_order_items`.

## Solução

### 1. Interface Atualizada
```typescript
interface ProductionOrder {
  item_id: string | null; // ✓ Agora pode ser null
  is_legacy?: boolean;     // ✓ Flag para ordens antigas
  // ...
}
```

### 2. Função `loadOpenOrders` Reescrita
```typescript
// Busca AMBOS os modelos:

// 1. Itens do modelo novo (production_order_items)
const itemsFormatted = itemsData
  .filter(matchesProduct && hasRemaining)
  .map(item => ({ ...item, is_legacy: false }));

// 2. Ordens antigas (production_orders sem itens)
const legacyOrders = ordersData
  .filter(hasProductId && !hasItems && matchesProduct && hasRemaining)
  .map(order => ({ ...order, item_id: null, is_legacy: true }));

// 3. Combinar ambos
formattedOrders.push(...itemsFormatted, ...legacyOrders);
```

### 3. Atualização de Progresso
```typescript
// MODELO NOVO: Atualiza item + recalcula ordem
if (order.item_id) {
  await supabase.from('production_order_items').update(...);
  // Recalcula status baseado em todos os itens
}

// MODELO LEGADO: Atualiza ordem diretamente
else if (order.is_legacy) {
  await supabase.from('production_orders').update({
    produced_quantity: newProduced,
    remaining_quantity: newRemaining,
    status: newRemaining === 0 ? 'completed' : 'in_progress'
  });
}
```

### 4. Select Atualizado
```typescript
<select value={formData.production_order_item_id || formData.production_order_id}>
  {openOrders.map((order) => (
    <option
      key={order.item_id || order.id}
      value={order.item_id || order.id}
    >
      OP #{order.order_number} - {order.products?.name}
      {order.is_legacy && ' (Ordem legada)'}
    </option>
  ))}
</select>
```

### 5. Filtro por Produto
```typescript
useEffect(() => {
  if (formData.production_type === 'order' && formData.product_id) {
    loadOpenOrders(); // ✓ Recarrega ao mudar produto
  }
}, [formData.production_type, formData.product_id]);
```

## Teste Rápido

1. Selecionar produto "Tesoura pré moldada T vão de 10,00 m sem aba"
2. Tipo: "Para Ordem de Produção"
3. ✓ Deve aparecer "OP #21 (Ordem legada)"
4. Registrar produção
5. ✓ OP #21 deve atualizar progresso

## Logs de Debug

```
=== DEBUG ORDENS ABERTAS ===
Produto selecionado: uuid-do-produto
Total de ordens encontradas: 1
Ordens modelo novo (com itens): 0
Ordens modelo legado (sem itens): 1
==========================
```

## Queries Úteis

```sql
-- Ver OPs legadas (sem itens)
SELECT po.order_number, p.name, po.remaining_quantity
FROM production_orders po
LEFT JOIN products p ON p.id = po.product_id
WHERE po.product_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM production_order_items poi
  WHERE poi.production_order_id = po.id
)
AND po.status IN ('open', 'in_progress');

-- Ver OPs novas (com itens)
SELECT po.order_number, COUNT(poi.id) as total_itens
FROM production_orders po
INNER JOIN production_order_items poi ON poi.production_order_id = po.id
WHERE po.status IN ('open', 'in_progress')
GROUP BY po.order_number;
```

## Status

✅ Sistema suporta AMBOS os modelos
✅ OP #21 agora aparece na lista
✅ Filtro por produto funciona
✅ Atualização de progresso funciona para ordens legadas
✅ Logs detalhados para diagnóstico
✅ Build concluído sem erros

## Arquivo Alterado

- `src/components/DailyProduction.tsx` (~200 linhas modificadas)

## Documentação Completa

Ver: `CORRECAO_VINCULO_OP_PRODUCAO.md`
