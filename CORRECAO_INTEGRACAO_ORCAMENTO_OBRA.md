# Correção: Integração Orçamento-Obra - Criação Automática de Ordens

## Problema Identificado

Ao vincular um orçamento à obra, os itens sem estoque das composições **não criavam ordens de produção automaticamente**.

### Causa Raiz

A função `check_composition_stock` e `process_quote_approval_for_construction` estavam referenciando a tabela **`composition_products`**, mas a tabela correta no banco de dados é **`composition_items`**.

## Correções Implementadas

### 1. Função `check_composition_stock` ✅

**Antes:**
```sql
FROM composition_products cp  -- ❌ Tabela errada
JOIN products p ON p.id = cp.product_id
```

**Depois:**
```sql
FROM composition_items ci  -- ✅ Tabela correta
JOIN products p ON p.id = ci.product_id
WHERE ci.item_type = 'product'  -- ✅ Filtra apenas produtos
AND ci.product_id IS NOT NULL  -- ✅ Garante que tem produto vinculado
```

### 2. Função `process_quote_approval_for_construction` ✅

Adicionadas várias melhorias:

1. **Validação de Composições com Produtos**
```sql
SELECT EXISTS(
  SELECT 1 FROM composition_items
  WHERE composition_id = v_quote_item.composition_id
  AND item_type = 'product'
  AND product_id IS NOT NULL
) INTO v_has_products;
```

2. **Logs Detalhados (RAISE NOTICE)**
```sql
RAISE NOTICE 'Processando composição % com quantidade %',
  v_quote_item.composition_id, v_quote_item.quantity;

RAISE NOTICE 'Produto %: necessário=%, estoque=%, produzir=%',
  v_stock_info.product_name,
  v_stock_info.quantity_required,
  v_stock_info.quantity_in_stock,
  v_stock_info.quantity_to_produce;

RAISE NOTICE 'Criando ordem %: % x %.0f un',
  v_order_number, v_stock_info.product_name, v_stock_info.quantity_to_produce;
```

3. **Tratamento de Erros Melhorado**
```sql
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro ao processar orçamento: % - %', SQLSTATE, SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
```

### 3. Nova Ferramenta de Debug ✅

Criado componente **`ConstructionQuoteDebug`** que permite:

- ✅ Verificar se o orçamento existe
- ✅ Listar todos os items do orçamento
- ✅ Verificar quais items têm composições
- ✅ Verificar se as composições têm produtos cadastrados
- ✅ Calcular estoque disponível vs necessário
- ✅ Identificar quais produtos precisam de produção
- ✅ Executar o processamento e mostrar resultado
- ✅ Listar ordens de produção criadas

## Como Testar Agora

### Método 1: Usando a Interface Normal

1. **Acesse:** Construtora → Acompanhamento
2. **Selecione** uma obra
3. **Cole o ID** do orçamento
4. **Selecione** o tipo (Padrão ou Laje Treliçada)
5. **Clique** em "Vincular e Processar"
6. **Observe** a mensagem de retorno:
   - ✅ Quantas composições foram analisadas
   - ✅ Quantos produtos foram registrados
   - ✅ **Quantas ordens de produção foram criadas**

### Método 2: Usando o Debug (RECOMENDADO)

1. **Acesse:** Construtora → Acompanhamento
2. **Selecione** uma obra
3. **Clique** no botão **"Debug"** (roxo, no canto superior direito)
4. **Preencha:**
   - Tipo de Orçamento
   - ID do Orçamento (UUID completo)
   - ID da Obra (já vem preenchido)
5. **Clique** em "Executar Debug Completo"
6. **Analise os resultados** passo a passo:

**O Debug mostra:**

```
✅ 1. Verificando orçamento
   → Orçamento encontrado

✅ 2. Buscando items
   → 3 items encontrados

✅ 3. Verificando composições
   → 2 items com composição

⚠️ 4. Produtos na composição
   → Composição X não tem produtos cadastrados

✅ 4. Produtos na composição
   → 3 produto(s) encontrado(s) na composição

⚠️ 5. Verificando estoque
   → Vigota 3m: Estoque=0, Necessário=20 → PRECISA PRODUZIR

✅ 5. Verificando estoque
   → Tavela: Estoque=50, Necessário=30 → OK

✅ 6. Verificando obra
   → Obra encontrada

✅ 7. Processando vinculação
   → 2 composições analisadas | 3 produtos registrados | 1 ordens de produção criadas

✅ 8. Ordens de produção
   → Últimas ordens criadas
```

### Método 3: Verificando no Banco de Dados

```sql
-- Ver últimas ordens criadas
SELECT
  po.order_number,
  po.status,
  p.name as product_name,
  po.quantity,
  po.notes,
  po.created_at
FROM production_orders po
JOIN products p ON p.id = po.product_id
ORDER BY po.created_at DESC
LIMIT 10;

-- Ver items vinculados à obra
SELECT
  cqi.status,
  p.name as product_name,
  cqi.quantity_required,
  cqi.quantity_in_stock,
  cqi.quantity_to_produce,
  po.order_number,
  cqi.notes
FROM construction_quote_items cqi
JOIN products p ON p.id = cqi.product_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
WHERE cqi.construction_project_id = 'SEU_ID_DA_OBRA'
ORDER BY cqi.created_at DESC;
```

## Checklist de Verificação

Antes de vincular um orçamento, certifique-se:

### ✅ Orçamento
- [ ] Orçamento está aprovado
- [ ] Orçamento tem items cadastrados
- [ ] Items têm composições vinculadas

### ✅ Composições
- [ ] Composição existe no sistema
- [ ] Composição tem **produtos** cadastrados (não apenas materiais)
- [ ] Produtos da composição estão ativos
- [ ] Quantidades estão corretas

### ✅ Produtos
- [ ] Produtos existem e estão cadastrados
- [ ] Produtos têm unidade de medida definida
- [ ] Produtos podem ser produzidos

### ✅ Obra
- [ ] Obra existe
- [ ] Obra tem cliente vinculado
- [ ] Obra não tem o mesmo orçamento já vinculado

## Possíveis Cenários

### Cenário 1: Composição Sem Produtos
**Sintoma:** Debug mostra "Composição não tem produtos cadastrados"

**Causa:** A composição só tem materiais, não tem produtos

**Solução:**
1. Acesse "Composições"
2. Edite a composição
3. Adicione os produtos necessários
4. Tente vincular novamente

### Cenário 2: Nenhuma Ordem Criada
**Sintoma:** "0 ordens de produção criadas"

**Possíveis causas:**
1. **Todos os produtos têm estoque suficiente** ✅ (Normal!)
2. **Composições não têm produtos** ❌ (Ver Cenário 1)
3. **Produtos não encontrados no banco** ❌ (Verificar IDs)

**Use o Debug** para identificar qual é o caso!

### Cenário 3: Algumas Ordens Criadas, Outras Não
**Sintoma:** Esperava 5 ordens, foram criadas apenas 2

**Causa:** Alguns produtos já tinham estoque

**Solução:** Isso é normal! O sistema só cria ordens para produtos **sem estoque** ou **com estoque insuficiente**.

## Logs do Sistema

Agora o sistema gera logs detalhados. Para vê-los:

### No Supabase Dashboard

1. Acesse seu projeto no Supabase
2. Vá em "Database" → "Query Editor"
3. Execute:

```sql
-- Ver logs da última execução
SELECT * FROM pg_stat_statements
WHERE query LIKE '%process_quote_approval%'
ORDER BY calls DESC
LIMIT 5;
```

### Nos Logs da Função

Os logs RAISE NOTICE aparecem durante a execução e mostram:
- Qual composição está sendo processada
- Quantos produtos foram encontrados
- Estoque vs Necessário de cada produto
- Ordens sendo criadas em tempo real
- Erros se houver

## Status dos Produtos

Após o processamento, cada produto terá um dos seguintes status:

| Status | Significado | Ordem Criada? |
|--------|-------------|---------------|
| **Disponível para Entrega** | Estoque completo | ❌ Não precisa |
| **Parcialmente Disponível** | Estoque parcial | ✅ Sim, para o restante |
| **Em Produção** | Sem estoque | ✅ Sim, para quantidade total |
| **Entregue** | Já foi entregue | ❌ Concluído |

## Próximos Passos

Depois de vincular o orçamento com sucesso:

1. **Verifique as Ordens Criadas**
   - Menu → Produção → Ordens de Produção
   - Filtre por status "Aberta"
   - Priorize ordens com nota "Ordem para obra"

2. **Acompanhe a Produção**
   - Registre produções nas ordens
   - O status dos itens da obra atualiza automaticamente

3. **Quando Produtos Ficarem Prontos**
   - Vá em Acompanhamento da Obra
   - Clique em "Atualizar Status"
   - Produtos prontos aparecem como "Disponível para Entrega"

4. **Faça as Entregas**
   - Use o módulo de Entregas
   - Vincule à obra
   - Produtos entregues são marcados automaticamente

## Suporte

### Problema: Debug não mostra nada
**Solução:** Verifique se preencheu todos os campos (ID do orçamento e ID da obra)

### Problema: Erro "relation composition_products does not exist"
**Solução:** Execute a migração `fix_composition_items_integration` novamente

### Problema: Função não encontrada
**Solução:** Verifique se a migração foi aplicada com sucesso no Supabase

---

**Sistema corrigido e testado!** 🎉

Agora as ordens de produção são criadas automaticamente quando necessário.
