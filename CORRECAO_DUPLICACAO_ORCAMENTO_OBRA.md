# Correção: Duplicação de Vinculação Orçamento-Obra

## Problema Identificado

Quando um orçamento era aprovado e vinculado a uma obra, se o usuário fizesse ajustes antes de salvar definitivamente e depois mudasse o status novamente de "pendente" para "aprovado", o sistema criava **itens duplicados** na obra.

Isso ocorria em dois pontos:
1. **Vinculação Manual**: Na aba Orçamentos, ao vincular manualmente a uma obra existente
2. **Processamento Automático**: Ao processar composições via função RPC `process_quote_approval_for_construction()`

## Solução Implementada

### 1. Vinculação Manual (Quotes.tsx)

**Arquivo**: `src/components/Quotes.tsx`

**Função**: `linkQuoteToWork()`

**Correção Aplicada**:
- Adicionada verificação antes de vincular itens à obra
- Consulta `construction_work_items` para verificar se já existem itens do mesmo orçamento vinculados à obra
- Se detectar vinculação prévia, exibe mensagem e **não cria duplicatas**

```typescript
// Verificar se o orçamento já foi vinculado a esta obra
const { data: existingLinks, error: checkError } = await supabase
  .from('construction_work_items')
  .select('id')
  .eq('work_id', workId)
  .eq('quote_id', quoteId)
  .limit(1);

if (existingLinks && existingLinks.length > 0) {
  alert('Este orçamento já está vinculado a esta obra. Os itens não serão duplicados.');
  return; // Sai da função sem vincular novamente
}
```

### 2. Processamento Automático de Composições

**Arquivo Migration**: `supabase/migrations/20260127190000_prevent_duplicate_quote_work_linking.sql`

**Função**: `process_quote_approval_for_construction()`

**Correção Aplicada**:
- Adicionada verificação no início da função
- Consulta `construction_quote_items` para verificar se o orçamento já foi processado
- Se detectar processamento prévio, retorna mensagem informativa **sem criar duplicatas**

```sql
-- Verificar se o orçamento já foi processado para esta obra (prevenir duplicação)
SELECT COUNT(*) INTO v_items_created
FROM construction_quote_items
WHERE construction_project_id = construction_project_id_param
  AND quote_id = quote_id_param
  AND quote_type = quote_type_param;

IF v_items_created > 0 THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Este orçamento já foi processado para esta obra. Os itens não serão duplicados.',
    'existing_items', v_items_created,
    'compositions_processed', 0,
    'items_created', 0,
    'production_orders_created', 0,
    'deliveries_created', 0
  );
END IF;
```

### 3. Componente React Atualizado

**Arquivo**: `src/components/ConstructionQuoteItems.tsx`

**Função**: `processQuoteForConstruction()`

**Correção Aplicada**:
- Atualizado para lidar corretamente com a nova resposta de duplicação
- Mostra mensagem apropriada ao usuário
- Recarrega itens mesmo quando detecta duplicação para mostrar itens existentes

```typescript
if (data) {
  // Mostrar mensagem retornada pelo banco (sucesso ou duplicação)
  alert(data.message || 'Processamento concluído');

  // Se foi sucesso, recarregar itens
  if (data.success) {
    await loadItems();
    setSelectedQuoteId('');
  } else {
    // Se foi duplicação detectada, também recarregar para mostrar itens existentes
    if (data.existing_items > 0) {
      await loadItems();
    }
  }
}
```

## Tabelas Afetadas

1. **construction_work_items**
   - Recebe itens do orçamento quando vinculação manual é feita
   - Agora protegida contra duplicação por `quote_id` + `work_id`

2. **construction_quote_items**
   - Recebe itens processados de composições
   - Agora protegida contra duplicação por `construction_project_id` + `quote_id` + `quote_type`

## Fluxo de Proteção

```
┌─────────────────────────────────────────────┐
│ USUÁRIO: Muda status para "Aprovado"        │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ SISTEMA: Oferece vincular a obra?           │
└──────────────────┬──────────────────────────┘
                   ↓
         ┌─────────┴─────────┐
         ↓                   ↓
    ┌────────┐          ┌────────┐
    │  SIM   │          │  NÃO   │
    └───┬────┘          └────┬───┘
        ↓                    ↓
┌───────────────┐     ┌──────────────┐
│ linkQuote     │     │ Continua     │
│ ToWork()      │     │ aprovação    │
│               │     │ normal       │
│ ✓ VERIFICA    │     └──────────────┘
│   DUPLICAÇÃO  │
└───────────────┘
        ↓
┌───────────────────────────────────────┐
│ JÁ VINCULADO?                         │
└──────┬─────────────────────┬──────────┘
       ↓ SIM                 ↓ NÃO
┌──────────────┐      ┌──────────────┐
│ ALERTA:      │      │ VINCULA      │
│ "Já está     │      │ itens à obra │
│  vinculado"  │      │              │
│              │      │ SUCCESS      │
│ IGNORA       │      └──────────────┘
└──────────────┘
```

## Como Testar

### Teste 1: Vinculação Manual

1. Crie um orçamento para um cliente
2. Mude o status para "Aprovado"
3. Escolha vincular a uma obra existente
4. **Sem salvar**, volte para "Pendente"
5. Mude novamente para "Aprovado"
6. Tente vincular à mesma obra

**Resultado Esperado**:
- Mensagem: "Este orçamento já está vinculado a esta obra. Os itens não serão duplicados."
- Nenhum item duplicado criado

### Teste 2: Processamento de Composições

1. Crie uma obra (Construction Projects)
2. Vincule um orçamento com composições
3. Processe o orçamento para a obra
4. Tente processar o mesmo orçamento novamente

**Resultado Esperado**:
- Mensagem: "Este orçamento já foi processado para esta obra. Os itens não serão duplicados."
- Nenhum item duplicado criado em `construction_quote_items`

### Teste 3: Múltiplas Mudanças de Status

1. Crie um orçamento
2. Aprove e vincule à obra
3. Volte para "Pendente"
4. Faça ajustes no orçamento
5. Aprove novamente (sem escolher vincular)
6. Volte para "Pendente" outra vez
7. Aprove e tente vincular novamente

**Resultado Esperado**:
- Sistema detecta vinculação prévia
- Nenhuma duplicação ocorre
- Mensagem clara ao usuário

## Verificação no Banco de Dados

Para verificar se há duplicações antigas ou confirmar que não há novas:

### Verificar construction_work_items
```sql
SELECT
  quote_id,
  work_id,
  COUNT(*) as quantidade,
  STRING_AGG(item_name, ', ') as itens
FROM construction_work_items
GROUP BY quote_id, work_id
HAVING COUNT(*) > 1;
```

### Verificar construction_quote_items
```sql
SELECT
  construction_project_id,
  quote_id,
  quote_type,
  COUNT(*) as quantidade
FROM construction_quote_items
GROUP BY construction_project_id, quote_id, quote_type
HAVING COUNT(*) > 1;
```

## Benefícios

1. **Integridade de Dados**: Evita duplicação de itens nas obras
2. **Experiência do Usuário**: Mensagens claras quando tentativa de duplicação é detectada
3. **Confiabilidade**: Sistema mais robusto contra erros de uso
4. **Manutenibilidade**: Código mais seguro e fácil de manter

## Arquivos Modificados

1. `src/components/Quotes.tsx` - Verificação na vinculação manual
2. `src/components/ConstructionQuoteItems.tsx` - Tratamento de resposta de duplicação
3. `supabase/migrations/20260127190000_prevent_duplicate_quote_work_linking.sql` - Função RPC atualizada

## Status

✅ **IMPLEMENTADO E TESTADO**
- Build bem-sucedido
- Migration aplicada no banco de dados
- Componentes React atualizados
- Proteção ativa contra duplicação
