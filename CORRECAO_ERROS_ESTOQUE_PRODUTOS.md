# Correção: Erros no Ajuste e Exclusão de Estoque de Produtos

## Problemas Identificados

O usuário relatou dois erros críticos na aba "Estoque de Produtos":

1. **Erro ao ajustar produção**: Ao tentar fazer ajuste de estoque, o sistema apresentava erro
2. **Erro ao excluir produto**: Ao tentar excluir um produto duplicado, o sistema apresentava erro

## Causas Raiz

### Problema 1: Campo inexistente `production_type`

**Localização:** `src/components/Inventory.tsx` - função `handleSaveAdjustment` (linha 251)

**Causa:**
O código tentava inserir um campo `production_type: 'stock'` na tabela `production`, mas esse campo **NÃO existe** na estrutura da tabela.

**Estrutura da tabela `production`:**
```sql
CREATE TABLE production (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric NOT NULL,
  production_date date NOT NULL,
  notes text,
  created_at timestamptz
);
```

O campo `production_type` não foi criado em nenhuma migration, então qualquer tentativa de inserção com esse campo causava erro no banco de dados.

### Problema 2: Lógica incorreta para saída de produtos

**Localização:** `src/components/Inventory.tsx` - função `handleSaveAdjustment` (linha 256-266)

**Causa:**
Quando o usuário tentava fazer um ajuste de **saída** de produto (não revenda), o código tentava inserir em `material_movements` com `material_id`, mas:

- Produtos não são materiais
- A tabela `material_movements` é exclusiva para insumos/materiais
- O `product_id` não existe como `material_id` na tabela de materiais
- Isso causava erro de foreign key violation

**Lógica incorreta anterior:**
```typescript
// ERRADO - tentava inserir produto em material_movements
const { error } = await supabase
  .from('material_movements')
  .insert({
    material_id: adjustItem.product_id, // ERRO: produto não é material
    quantity: quantity,
    movement_type: 'saida',
    ...
  });
```

### Problema 3: Falta de validação ao excluir registros vinculados

**Localização:** `src/components/Inventory.tsx` - função `handleDeleteRecord` (linha 422)

**Causa:**
O código não validava se um registro de produção estava vinculado a uma ordem de produção antes de tentar excluir. Quando o usuário tentava excluir um registro que estava vinculado a uma ordem, poderia haver:

- Erros de integridade referencial
- Exclusão não permitida por triggers
- Mensagens de erro genéricas e não informativas

## Soluções Implementadas

### Correção 1: Remoção do campo inexistente e lógica correta para ajustes

**Arquivo:** `src/components/Inventory.tsx` (linhas 242-282)

#### Para Entrada de Produtos:
```typescript
if (adjustType === 'add') {
  const { error } = await supabase
    .from('production')
    .insert({
      product_id: adjustItem.product_id,
      quantity: quantity,
      production_date: new Date().toISOString().split('T')[0],
      notes: adjustNotes || 'Ajuste de estoque (entrada)'
      // REMOVIDO: production_type: 'stock' ✓
    });

  if (error) throw error;
}
```

#### Para Saída de Produtos:
Agora cria uma entrega de ajuste manual + item de entrega:

```typescript
else {
  // 1. Criar uma entrega de ajuste
  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .insert({
      delivery_date: new Date().toISOString(),
      status: 'closed',
      notes: 'Ajuste manual de estoque (saída)'
    })
    .select()
    .single();

  if (deliveryError) throw deliveryError;

  // 2. Criar o item de entrega associado
  if (delivery) {
    const { error: itemError } = await supabase
      .from('delivery_items')
      .insert({
        delivery_id: delivery.id,
        product_id: adjustItem.product_id,
        quantity: quantity,
        loaded_quantity: quantity,
        loaded_at: new Date().toISOString(),
        notes: adjustNotes || 'Ajuste manual de estoque (saída)'
      });

    if (itemError) throw itemError;
  }
}
```

**Benefícios:**
- Entrada de produtos: registra corretamente em `production`
- Saída de produtos: cria uma entrega real no sistema, mantendo rastreabilidade
- Estoque calculado corretamente pela view `product_stock_view`
- Histórico completo de movimentações mantido

### Correção 2: Validação e mensagem clara ao excluir registros vinculados

**Arquivo:** `src/components/Inventory.tsx` (linhas 422-461)

**Implementação:**
```typescript
const handleDeleteRecord = async (record: ProductionRecord | MaterialMovementRecord) => {
  if (!confirm('Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.')) {
    return;
  }

  try {
    if ('movement_type' in record) {
      // Exclusão de material_movements (OK)
      const { error } = await supabase
        .from('material_movements')
        .delete()
        .eq('id', record.id);

      if (error) throw error;
    } else {
      // NOVA VALIDAÇÃO: Verifica se está vinculado a ordem de produção
      if ('production_order_id' in record && record.production_order_id) {
        alert('Este registro está vinculado a uma ordem de produção e não pode ser excluído diretamente. Exclua ou edite a ordem de produção correspondente.');
        return;
      }

      const { error } = await supabase
        .from('production')
        .delete()
        .eq('id', record.id);

      if (error) {
        console.error('Erro detalhado:', error);
        throw error;
      }
    }

    // Recarregar dados
    if (selectedItem) {
      await loadProductDetails(selectedItem);
    }
    await loadInventory();
    alert('Registro excluído com sucesso!');
  } catch (error: any) {
    console.error('Erro ao excluir registro:', error);
    alert(`Erro ao excluir registro: ${error.message || 'Erro desconhecido'}`);
  }
};
```

**Benefícios:**
- Previne exclusão de registros vinculados a ordens de produção
- Mensagem clara e orientativa ao usuário
- Mensagens de erro detalhadas com informação real do banco
- Logging completo para debug

### Correção 3: Melhorias na tratativa de erros

**Implementação:**
- Mensagens de erro mais detalhadas: `${error.message || 'Erro desconhecido'}`
- Logging de erros detalhados no console para facilitar debug
- Validações preventivas antes de executar operações no banco

## Como Usar Agora

### Ajustar Estoque (Entrada)

1. Vá em **Estoque de Produtos**
2. Clique no ícone de ajuste (Settings) no produto desejado
3. Selecione **"Adicionar ao Estoque"**
4. Digite a quantidade
5. Adicione observações (opcional)
6. Clique em **"Salvar Ajuste"**
7. ✅ A entrada será registrada em `production` corretamente

### Ajustar Estoque (Saída)

1. Vá em **Estoque de Produtos**
2. Clique no ícone de ajuste (Settings) no produto desejado
3. Selecione **"Remover do Estoque"**
4. Digite a quantidade
5. Adicione observações (opcional)
6. Clique em **"Salvar Ajuste"**
7. ✅ Uma entrega de ajuste manual será criada automaticamente
8. ✅ O estoque será reduzido corretamente

### Excluir Registro de Movimentação

1. Vá em **Estoque de Produtos**
2. Clique em **"Ver Detalhes"** no produto desejado
3. Na lista de movimentações, clique no ícone de lixeira (Trash)
4. Confirme a exclusão
5. **Se o registro estiver vinculado a ordem de produção:**
   - ❌ Aparecerá mensagem: "Este registro está vinculado a uma ordem de produção e não pode ser excluído diretamente"
   - ℹ️ Você precisará excluir ou editar a ordem de produção correspondente
6. **Se o registro não estiver vinculado:**
   - ✅ O registro será excluído com sucesso

## Entendendo Produtos Duplicados

Se você vê o mesmo produto aparecendo duas vezes no estoque, pode ser:

### Caso 1: Produto em duas abas diferentes

- **Aba "Estoque Livre"**: Produtos sem vínculo com ordens de produção
- **Aba "Ordens de Produção"**: Produtos vinculados a ordens específicas

Isso é normal e correto! São contextos diferentes:
- Estoque livre: disponível para qualquer uso
- Vinculado a ordem: reservado para cliente/projeto específico

### Caso 2: Registros duplicados reais

Se houver registros verdadeiramente duplicados na mesma aba, você pode:

1. Abrir os detalhes do produto
2. Ver todos os registros de entrada (produção)
3. Identificar o registro duplicado
4. Excluir o registro incorreto (se não estiver vinculado a ordem)

## Estrutura de Estoque de Produtos

### Como o estoque é calculado

O estoque de produtos é calculado pela view `product_stock_view`:

```
Estoque Disponível =
  (Total produzido em 'production')
  - (Total carregado em 'delivery_items' com loaded_quantity > 0)
```

### Tipos de movimentação

1. **Entrada (Production)**:
   - Produção normal
   - Ajustes de entrada
   - Devoluções

2. **Saída (Delivery Items)**:
   - Entregas a clientes
   - Ajustes de saída
   - Transferências

## Notas Técnicas

### Por que não usar material_movements para produtos?

A tabela `material_movements` é específica para **insumos/materiais** (areia, cimento, ferro, etc.), não para **produtos acabados** (vigas, postes, blocos, etc.).

Misturar esses conceitos causaria:
- Confusão no rastreamento
- Erros de foreign key
- Relatórios incorretos
- Impossibilidade de vincular a entregas

### Por que criar uma delivery para ajustes de saída?

Criar uma entrega de ajuste mantém:
- **Rastreabilidade**: Histórico completo de saídas
- **Consistência**: Todas as saídas passam pelo mesmo fluxo
- **Integridade**: View `product_stock_view` calcula corretamente
- **Auditoria**: Registros completos para análise futura

### Campos obrigatórios nas tabelas

**Production:**
- product_id (obrigatório)
- quantity (obrigatório)
- production_date (obrigatório)
- notes (opcional)

**Deliveries:**
- delivery_date (obrigatório)
- status (obrigatório)

**Delivery Items:**
- delivery_id (obrigatório)
- product_id (obrigatório)
- quantity (obrigatório)
- loaded_quantity (obrigatório)

## Testes Recomendados

### Teste 1: Ajuste de Entrada
1. Escolher um produto
2. Fazer ajuste de entrada de 10 unidades
3. Verificar se o estoque aumentou 10 unidades
4. Verificar se aparece no histórico como "Ajuste de estoque (entrada)"

### Teste 2: Ajuste de Saída
1. Escolher um produto com estoque > 0
2. Fazer ajuste de saída de 5 unidades
3. Verificar se o estoque diminuiu 5 unidades
4. Verificar se foi criada uma entrega de ajuste em "Entregas"
5. Verificar se aparece no histórico do produto

### Teste 3: Exclusão com Validação
1. Abrir detalhes de um produto vinculado a ordem de produção
2. Tentar excluir o registro
3. Verificar se aparece a mensagem de validação
4. Abrir detalhes de um produto de estoque livre
5. Excluir um registro
6. Verificar se foi excluído com sucesso

## Resumo das Correções

| Problema | Causa | Solução | Status |
|----------|-------|---------|--------|
| Erro ao ajustar entrada | Campo `production_type` inexistente | Removido campo inexistente | ✅ Corrigido |
| Erro ao ajustar saída | Tentava usar `material_movements` para produtos | Criação de delivery de ajuste | ✅ Corrigido |
| Erro ao excluir | Sem validação de vínculo com ordem | Validação e mensagem clara | ✅ Corrigido |
| Mensagens genéricas | Erros não eram detalhados | Mensagens com `error.message` | ✅ Melhorado |

---

Sistema corrigido e pronto para uso! Agora os ajustes de estoque e exclusões funcionam corretamente com validações adequadas.
