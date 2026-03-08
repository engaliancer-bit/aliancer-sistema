# Correções na Aba Entregas - Mobile

## Problemas Corrigidos

### 1. Erro ao Carregar Itens da Entrega

**Problema:**
```
Could not embed because more than one relationship was found for 'delivery_items' and 'compositions'
```

**Causa:**
A tabela `delivery_items` possui duas foreign keys apontando para `compositions`:
- `composition_id` - composição direta do item
- `parent_composition_id` - composição pai quando o item vem expandido de uma composição

Quando fazíamos `.select('*, compositions (name)')`, o Supabase não sabia qual relacionamento usar, gerando erro.

**Solução:**
- Removemos o embed `compositions (name)` da query
- Usamos o campo `item_name` que já está armazenado na tabela
- Quando necessário, buscamos o nome da composição através de query separada

**Código Alterado:**
```typescript
// ANTES (causava erro)
const { data: deliveryItemsData, error: deliveryItemsError } = await supabase
  .from('delivery_items')
  .select(`
    *,
    products (name, code),
    materials (name, unit),
    compositions (name)  // ❌ Ambíguo - múltiplos FK
  `)
  .eq('delivery_id', deliveryId);

// DEPOIS (funciona corretamente)
const { data: deliveryItemsData, error: deliveryItemsError } = await supabase
  .from('delivery_items')
  .select(`
    *,
    products (name, code),
    materials (name, unit)
  `)
  .eq('delivery_id', deliveryId);

// Nome vem do campo item_name ou dos relacionamentos específicos
const itemName = item.products?.name || item.materials?.name || item.item_name || 'Item';
```

### 2. Página Não Rola no Mobile

**Problema:**
No celular, a página ficava travada e não era possível rolar para ver todas as entregas.

**Causa:**
Faltava `overflow-y-auto` no container principal.

**Solução:**
Adicionamos rolagem vertical com altura máxima e padding inferior para evitar que o conteúdo fique escondido atrás de elementos fixos.

**Código Alterado:**
```typescript
// ANTES
<div className="space-y-6">

// DEPOIS
<div className="space-y-6 overflow-y-auto max-h-screen pb-20">
```

### 3. Seta de Expansão Não Visível no Mobile

**Problema:**
A seta para expandir e ver os itens da entrega era muito pequena no mobile (h-4 w-4), dificultando o clique.

**Causa:**
Ícone com tamanho pequeno e botão com padding reduzido.

**Solução:**
- Aumentamos o ícone de `h-4 w-4` para `h-6 w-6`
- Aumentamos o padding do botão de `p-2` para `p-3`
- Adicionamos classe `touch-manipulation` para melhorar a interação touch no mobile

**Código Alterado:**
```typescript
// ANTES
<button
  onClick={() => toggleDeliveryExpansion(delivery.id)}
  className="p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
>
  {expandedDeliveries.has(delivery.id) ? (
    <ChevronDown className="h-4 w-4" />
  ) : (
    <ChevronRight className="h-4 w-4" />
  )}
</button>

// DEPOIS
<button
  onClick={() => toggleDeliveryExpansion(delivery.id)}
  className="p-3 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors touch-manipulation"
>
  {expandedDeliveries.has(delivery.id) ? (
    <ChevronDown className="h-6 w-6" />
  ) : (
    <ChevronRight className="h-6 w-6" />
  )}
</button>
```

## Resultado

Agora a aba Entregas funciona perfeitamente no mobile:
- ✅ A página rola normalmente
- ✅ A seta de expansão é facilmente visível e clicável
- ✅ Não há mais erro ao carregar itens
- ✅ Melhor experiência de toque com `touch-manipulation`

## Arquivos Modificados

- `src/components/Deliveries.tsx`
  - Linha 815-820: Removido embed ambíguo de compositions
  - Linha 450: Atualizado fallback para usar item_name
  - Linha 1144: Adicionado overflow-y-auto e max-h-screen
  - Linhas 1824-1834: Aumentado tamanho da seta e botão
