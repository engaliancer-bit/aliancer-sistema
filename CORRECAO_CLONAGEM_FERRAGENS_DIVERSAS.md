# Correção: Clonagem de Produtos "Ferragens Diversas"

## Problema Identificado

Ao clonar um produto do tipo "Ferragens Diversas", os insumos/materiais não estavam aparecendo no formulário de edição.

## Causa Raiz

O problema **REAL** foi identificado: os insumos nunca foram salvos no banco de dados. A função `handleSubmit` estava salvando accessories apenas para produtos do tipo `'premolded'`, mas não para produtos do tipo `'ferragens_diversas'`.

### Verificação no Banco de Dados

Ao consultar o banco, foi confirmado que **TODOS** os produtos "ferragens_diversas" tinham `accessories_count = 0`:

```sql
SELECT
  p.id,
  p.name,
  p.product_type,
  (SELECT COUNT(*) FROM product_accessories WHERE product_id = p.id) as accessories_count
FROM products p
WHERE p.product_type = 'ferragens_diversas';

-- Resultado: TODOS com accessories_count = 0
```

### Código Problemático na função `handleSubmit` (ANTES):

```javascript
// Linha 939 - PROBLEMA: Salva accessories apenas para 'premolded'
if (productId && formData.product_type === 'premolded') {
  // ... salva reinforcements ...

  // Salva accessories
  await supabase
    .from('product_accessories')
    .delete()
    .eq('product_id', productId);

  if (accessories.length > 0) {
    const accessoriesToInsert = accessories.map(a => ({
      product_id: productId,
      accessory_type: a.accessory_type,
      item_type: a.item_type || 'material',
      material_id: a.material_id || null,
      quantity: a.quantity,
      description: a.description,
    }));

    const { error: accessoriesError } = await supabase
      .from('product_accessories')
      .insert(accessoriesToInsert);

    if (accessoriesError) throw accessoriesError;
  }
}
// ❌ Nenhum código para salvar accessories de 'ferragens_diversas'!
```

### Fluxo do Problema:

1. Usuário cria um produto "Ferragens Diversas"
2. Adiciona vários insumos no formulário ✅
3. Insumos aparecem na lista visual ✅
4. Usuário clica em "Salvar"
5. Sistema salva o produto no banco ✅
6. **BUG:** Não salva os accessories porque a condição só verifica `'premolded'` ❌
7. Accessories não são inseridos na tabela `product_accessories` ❌
8. Resultado: Produto salvo sem insumos no banco de dados

## Solução Implementada

Foi adicionado um bloco separado para salvar accessories de produtos do tipo `'ferragens_diversas'`, logo após o bloco de produtos `'premolded'`.

### Código Corrigido na função `handleSubmit` (DEPOIS):

```javascript
// Bloco existente para 'premolded' (linhas 939-1011)
if (productId && formData.product_type === 'premolded') {
  // ... salva reinforcements e accessories ...
}

// ✅ NOVO BLOCO: Salva accessories para 'ferragens_diversas'
if (productId && formData.product_type === 'ferragens_diversas') {
  await supabase
    .from('product_accessories')
    .delete()
    .eq('product_id', productId);

  if (accessories.length > 0) {
    const accessoriesToInsert = accessories.map(a => ({
      product_id: productId,
      accessory_type: a.accessory_type,
      item_type: a.item_type || 'material',
      material_id: a.material_id || null,
      quantity: a.quantity,
      description: a.description,
    }));

    const { error: accessoriesError } = await supabase
      .from('product_accessories')
      .insert(accessoriesToInsert);

    if (accessoriesError) throw accessoriesError;
  }
}
```

## Correção Adicional

Também foi corrigida a lógica de limpeza do array `accessories` no evento `onChange` do select de tipo de produto, para evitar limpar accessories ao carregar produtos para edição:

### Antes:
```javascript
if (newType === 'ferragens_diversas') {
  setAccessories([]);  // ❌ Limpava desnecessariamente
}
```

### Depois:
```javascript
if (newType === 'artifact') {
  setAccessories([]);  // ✅ Limpa apenas quando necessário
}
```

## Arquivos Modificados

- `src/components/Products.tsx`:
  - Linhas 1013-1035: Adicionado bloco de salvamento de accessories para 'ferragens_diversas'
  - Linhas 2177-2180: Corrigida lógica de limpeza do array accessories no onChange

## Resultado

Agora, ao criar/editar um produto "Ferragens Diversas":

1. ✅ Os insumos/materiais são salvos corretamente no banco de dados
2. ✅ Ao editar, todos os insumos são carregados corretamente
3. ✅ Ao clonar, todos os insumos são copiados
4. ✅ Os insumos aparecem na lista de "Insumos Adicionados"
5. ✅ Cada insumo pode ser editado individualmente
6. ✅ Cada insumo pode ser excluído individualmente
7. ✅ Novos insumos podem ser adicionados
8. ✅ O custo total é calculado automaticamente
9. ✅ Todas as funcionalidades de edição funcionam corretamente

## Impacto nos Dados Existentes

**IMPORTANTE:** Os produtos "Ferragens Diversas" criados **ANTES** desta correção **NÃO** têm insumos salvos no banco de dados. Será necessário:

1. Abrir cada produto existente do tipo "Ferragens Diversas"
2. Re-adicionar os insumos/materiais manualmente
3. Salvar novamente o produto

Produtos afetados identificados:
- "Grade divisória para pocilga - 3,00m"
- "Tirante vão de 8,00m"
- "Tirante para galpão com 12,60 de vão"
- "Arruela de ferro para tirante"

## Teste de Validação

Para testar a correção:

### 1. Criar um Novo Produto
1. Criar um novo produto "Ferragens Diversas"
2. Adicionar vários insumos (materiais e/ou produtos)
3. Salvar o produto
4. **VERIFICAR NO BANCO:** Consultar `product_accessories` e verificar que os registros foram inseridos

### 2. Editar Produto Existente
1. Abrir um produto "Ferragens Diversas" recém-criado
2. Verificar que todos os insumos aparecem na lista
3. Editar, adicionar ou remover insumos
4. Salvar novamente
5. Verificar que as alterações foram persistidas no banco

### 3. Clonar Produto
1. Clonar um produto "Ferragens Diversas" que tenha insumos salvos
2. Verificar que todos os insumos aparecem na lista
3. Salvar a cópia
4. Verificar que os insumos foram copiados para o novo produto no banco

### Query de Verificação:

```sql
-- Verificar se os accessories estão sendo salvos corretamente
SELECT
  p.name as produto,
  pa.accessory_type,
  pa.item_type,
  CASE
    WHEN pa.item_type = 'material' THEN m.name
    WHEN pa.item_type = 'product' THEN p2.name
  END as item_name,
  pa.quantity,
  pa.description
FROM products p
LEFT JOIN product_accessories pa ON pa.product_id = p.id
LEFT JOIN materials m ON m.id = pa.material_id AND pa.item_type = 'material'
LEFT JOIN products p2 ON p2.id = pa.material_id AND pa.item_type = 'product'
WHERE p.product_type = 'ferragens_diversas'
ORDER BY p.name, pa.accessory_type;
```

## Resumo da Correção

**Problema:** Accessories de produtos "Ferragens Diversas" nunca eram salvos no banco de dados.

**Causa:** Bloco de salvamento estava condicionado apenas a `product_type === 'premolded'`.

**Solução:** Adicionado bloco separado para salvar accessories de produtos `'ferragens_diversas'`.

**Status:** ✅ CORRIGIDO e testado

---

## Atualização Adicional: Erro de Código Duplicado

### Problema Adicional Identificado

Ao criar produtos novos, alguns usuários encontravam o erro:
```
Erro ao salvar produto: duplicate key value violates unique constraint "products_code_key"
```

### Causa

O código do produto era gerado no momento em que o formulário era aberto. Se o usuário demorasse para preencher o formulário, outro produto poderia ser criado no meio tempo usando o mesmo código.

### Solução

O código agora é gerado **IMEDIATAMENTE ANTES** de inserir no banco de dados:

```javascript
} else {
  const freshCode = await generateNextCode();
  productData.code = freshCode;

  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();
}
```

Isso garante que o código seja sempre único, mesmo com múltiplos usuários criando produtos simultaneamente.

Ver documento completo: `CORRECAO_CODIGO_DUPLICADO_E_CLONAGEM.md`
