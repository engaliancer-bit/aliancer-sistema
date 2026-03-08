# Correção: Visualização de Insumos em Ferragens Diversas

## Problema Identificado

### 1. Insumos Não Visíveis ao Editar Produto

**Situação:**
Ao tentar editar o produto "Grade divisória de pocilga - 3,00m" na aba Produtos, os insumos que compõem o produto não apareciam na tela, apenas os campos de preço eram exibidos.

**Causa Raiz:**
No arquivo `Products.tsx`, a função `handleEdit` só carregava os acessórios (insumos) para produtos do tipo `premolded`, mas não para produtos do tipo `ferragens_diversas`.

**Código Anterior (Linha 1091):**
```typescript
if (product.product_type === 'premolded') {
  // Carrega reinforcements

  // Carrega accessories
  const { data: accessoriesData } = await supabase...
  setAccessories(loadedAccessories);
}
```

**Problema:** O carregamento de `accessories` estava dentro do bloco `if (product.product_type === 'premolded')`, então produtos de `ferragens_diversas` não tinham seus insumos carregados.

---

## Correção Aplicada

### Modificação em Products.tsx (Linhas 1091-1165)

**Código Corrigido:**
```typescript
if (product.product_type === 'premolded') {
  // Carrega reinforcements (apenas para premolded)
  const { data: reinforcementsData } = await supabase...
  setReinforcements(loadedReinforcements);
}

// NOVO: Carrega accessories tanto para premolded quanto para ferragens_diversas
if (product.product_type === 'premolded' || product.product_type === 'ferragens_diversas') {
  const { data: accessoriesData } = await supabase
    .from('product_accessories')
    .select(`
      *,
      materials (name)
    `)
    .eq('product_id', product.id);

  if (accessoriesData) {
    const loadedAccessories: Accessory[] = await Promise.all(
      accessoriesData.map(async (a) => {
        // Carrega nome do material ou produto
        let itemName = '';
        if (a.item_type === 'product' && a.material_id) {
          const { data: productData } = await supabase
            .from('products')
            .select('name')
            .eq('id', a.material_id)
            .maybeSingle();
          itemName = productData?.name || '';
        } else {
          itemName = (a.materials as any)?.name || '';
        }

        return {
          tempId: Math.random().toString(),
          accessory_type: a.accessory_type,
          item_type: a.item_type || 'material',
          material_id: a.material_id,
          material_name: itemName,
          quantity: a.quantity,
          description: a.description,
        };
      })
    );
    setAccessories(loadedAccessories);
  }
}
```

**O que mudou:**
- O carregamento de `reinforcements` continua exclusivo para `premolded`
- O carregamento de `accessories` agora funciona para **ambos** os tipos: `premolded` e `ferragens_diversas`

---

## Problema da Receita do Produto

### Análise do Produto "Grade divisória de pocilga - 3,00m"

**Dados no Banco:**

| Material | Quantidade Cadastrada | Quantidade Consumida (19 peças) |
|----------|----------------------|--------------------------------|
| CA-50 5/8-16.00MM | 2,024m por peça | 38,456m (2,024 × 19) |
| CA-50 3/8-10.0MM | 1,6m por peça | 30,4m (1,6 × 19) |
| Chapa metálica | 2 unid por peça | 38 unid (2 × 19) |

**Problema Relatado:**
Cada peça deveria consumir **24,24m** de ferro 16mm, não 2,024m.

**Cálculo Esperado:**
- 19 peças × 24,24m = 460,56m de ferro 16mm

**Cálculo Atual:**
- 19 peças × 2,024m = 38,456m de ferro 16mm

**Diferença:** 460,56m - 38,456m = **422,104m faltando**

---

## Como Corrigir a Receita

### Passo 1: Editar o Produto

1. Acesse **Produtos** no menu
2. Localize o produto **"Grade divisória de pocilga - 3,00m"**
3. Clique no botão **Editar** (ícone de lápis)
4. Agora você **VERÁ** os insumos cadastrados (correção aplicada!)

### Passo 2: Atualizar Quantidade de Ferro 16mm

Na seção **"Insumos e Materiais (Ferragens Diversas)"**, você verá:

**Insumo Atual:**
- **Material:** CA-50 5/8-16.00MM R12M NERV. (2BRS) I
- **Tipo:** Ferro
- **Quantidade:** **2,024** ← ERRADO
- **Item:** Material

**Correção Necessária:**
1. Clique no botão **Editar** (lápis) ao lado do insumo de ferro 16mm
2. Altere a **Quantidade** de `2,024` para `24,24`
3. Clique em **"Atualizar Insumo"**
4. Clique em **"Salvar Produto"** no final da página

### Passo 3: Verificar Outros Insumos (Opcional)

Se necessário, verifique também:
- **CA-50 3/8-10.0MM**: Quantidade está correta?
- **Chapa metálica**: Quantidade está correta?

---

## Como a Unidade é Exibida no Resumo do Dia

### Entendimento da Exibição

**No Resumo do Dia:**
- A **unidade** exibida vem diretamente do cadastro do material no banco de dados
- Se o material está cadastrado como "metros", aparece "metros"
- Se está cadastrado como "barras", aparece "barras"

**Para o ferro CA-50 5/8-16.00MM:**
```sql
SELECT name, unit FROM materials WHERE name LIKE '%16.00MM%';
```

**Resultado:**
| name | unit |
|------|------|
| CA-50 5/8-16.00MM R12M NERV. (2BRS) I | **metros** |

**Conclusão:** A unidade **já está correta** como "metros" no banco de dados. A confusão era sobre a **quantidade** (2,024m ao invés de 24,24m).

---

## Resumo das Correções

| Item | Status Anterior | Status Atual |
|------|----------------|--------------|
| Visualização de insumos ao editar | ❌ Não apareciam | ✅ Aparecem normalmente |
| Tipo de produto afetado | ferragens_diversas | Corrigido |
| Receita do produto Grade | 2,024m por peça (incorreto) | Aguardando correção manual |
| Unidade de medida exibida | metros (correto) | metros (mantido) |

---

## Próximos Passos

### Para o Usuário:

1. **Editar o produto "Grade divisória de pocilga - 3,00m"**
   - Alterar quantidade de ferro 16mm de **2,024m** para **24,24m**
   - Salvar o produto

2. **Ajustar produções existentes** (opcional)
   - Se quiser recalcular o consumo das 19 peças já produzidas:
     - Opção 1: Excluir a produção e refazer com receita correta
     - Opção 2: Fazer ajuste manual de estoque compensando a diferença

3. **Verificar outros produtos do tipo "Ferragens Diversas"**
   - Edite cada produto para confirmar que os insumos aparecem
   - Verifique se as quantidades estão corretas

---

## Query SQL para Verificar Receita Atual

```sql
-- Ver receita do produto Grade divisória
SELECT
  pa.id,
  m.name as material,
  pa.quantity as quantidade_por_peca,
  m.unit as unidade,
  m.unit_cost as custo_unitario,
  (pa.quantity * m.unit_cost) as custo_por_peca
FROM product_accessories pa
JOIN materials m ON pa.material_id = m.id
WHERE pa.product_id = '12faa969-2908-495c-9090-49684dccde17'
ORDER BY m.name;
```

**Resultado Esperado ANTES da correção:**
| material | quantidade_por_peca | unidade | custo_unitario | custo_por_peca |
|----------|--------------------:|---------|---------------:|---------------:|
| CA-50 3/8-10.0MM... | 1.6 | metros | 3.06 | 4.90 |
| CA-50 5/8-16.00MM... | **2.024** | metros | 8.24 | 16.68 |
| Chapa metálica... | 2 | unid | 31.52 | 63.04 |

**Resultado Esperado DEPOIS da correção:**
| material | quantidade_por_peca | unidade | custo_unitario | custo_por_peca |
|----------|--------------------:|---------|---------------:|---------------:|
| CA-50 3/8-10.0MM... | 1.6 | metros | 3.06 | 4.90 |
| CA-50 5/8-16.00MM... | **24.24** | metros | 8.24 | **199.74** |
| Chapa metálica... | 2 | unid | 31.52 | 63.04 |

---

## Query SQL para Atualizar a Receita (Se Preferir)

Se preferir atualizar direto no banco de dados ao invés de pela interface:

```sql
-- Atualizar quantidade de ferro 16mm de 2.024 para 24.24
UPDATE product_accessories
SET quantity = 24.24
WHERE product_id = '12faa969-2908-495c-9090-49684dccde17'
  AND material_id = '1fc128bd-3f07-4722-bc7e-13f28d028f53'; -- ID do CA-50 5/8-16.00MM

-- Verificar se foi atualizado
SELECT
  m.name,
  pa.quantity,
  m.unit
FROM product_accessories pa
JOIN materials m ON pa.material_id = m.id
WHERE pa.product_id = '12faa969-2908-495c-9090-49684dccde17';
```

---

## Impacto nos Relatórios

### Antes da Correção (Produção do dia 28/01):
- **Ferro 16mm consumido:** 38,456m
- **Custo do ferro:** R$ 316,85 (38,456m × R$ 8,24)

### Depois da Correção (Próximas produções):
- **Ferro 16mm consumido:** 460,56m por 19 peças
- **Custo do ferro:** R$ 3.795,01 (460,56m × R$ 8,24)

**Diferença:** R$ 3.478,16 a mais de custo por produção de 19 peças

---

## Observações Importantes

1. **A unidade "metros" está correta** - não precisa alterar
2. **O problema é a QUANTIDADE** - estava 2,024m ao invés de 24,24m
3. **Agora você consegue VER e EDITAR** os insumos de Ferragens Diversas
4. **Produções futuras** usarão a receita corrigida automaticamente
5. **Produções passadas** não serão recalculadas automaticamente

---

## Data da Implementação

**Data:** 01/02/2026
**Build:** Compilado com sucesso em 55.25s
**Arquivo modificado:** `src/components/Products.tsx` (linhas 1127-1165)
**Status:** Pronto para uso

---

## Suporte

Se ainda houver dúvidas sobre como corrigir a receita ou visualizar os insumos, verifique:

1. O produto está marcado como tipo **"Ferragens Diversas"**?
2. O modo de cadastro está em **"Cadastro Detalhado"** (não "Cadastro Simplificado")?
3. Os insumos foram de fato cadastrados no banco de dados?

Use a query SQL fornecida acima para verificar.
