# Teste: Ordens Automáticas no Módulo Indústria

## Teste Rápido (5 minutos)

### Pré-requisitos
- ✅ Ter pelo menos 1 cliente cadastrado
- ✅ Ter pelo menos 2 produtos cadastrados
- ✅ Produtos devem ter estoque baixo ou zero

---

## Teste 1: Ordem Automática com Estoque Zero

### Objetivo
Verificar que ordem é criada quando produto não tem estoque

### Passos

**1. Preparar Produto (zerar estoque se necessário)**
```
1. Vá em: Produção → Estoque
2. Encontre um produto (ex: "Vigota 3m")
3. Anote a quantidade atual
4. Se houver estoque, ajuste para 0 (ou anote para cálculo)
```

**2. Criar Orçamento**
```
1. Vá em: Vendas → Orçamentos
2. Clique em: "Novo Orçamento"
3. Preencha:
   - Cliente: Selecione qualquer um
   - Tipo: Complete Construction (ou outro)
   - Prazo de entrega: Hoje + 10 dias
4. Clique em: "Próximo: Adicionar Itens"
```

**3. Adicionar Produto**
```
1. Tipo de Item: Produto
2. Produto: Selecione o que zerou estoque
3. Quantidade: 50
4. Preço: 100.00
5. Clique em: "Adicionar Item"
```

**4. APROVAR Orçamento**
```
1. Status: APROVADO ⭐ (importante!)
2. Clique em: "Salvar Orçamento"
3. Aguarde confirmação
```

**5. Verificar Ordem Criada**
```
1. Vá em: Produção → Ordens de Produção
2. ✅ Deve aparecer uma nova ordem:
   - Número: OP-XXX
   - Produto: Vigota 3m (o que você escolheu)
   - Quantidade: 50 (ou 50 - estoque atual)
   - Status: Aberta
   - Prioridade: Alta (prazo < 15 dias)
   - Observações: "Ordem automática - Orçamento aprovado"
```

### Resultado Esperado
- ✅ Ordem criada automaticamente
- ✅ Quantidade = Necessário - Estoque
- ✅ Prioridade definida corretamente
- ✅ Observações incluem cliente e produto

### Se NÃO Funcionar
```
1. Vá em: Supabase Dashboard → Logs → Functions
2. Procure por: "CRIAÇÃO AUTOMÁTICA DE ORDENS"
3. Veja se há erro nos logs
4. Copie o erro e reporte
```

---

## Teste 2: Ordem Automática com Estoque Parcial

### Objetivo
Verificar que ordem é criada APENAS para quantidade faltante

### Passos

**1. Preparar Produto (estoque parcial)**
```
1. Vá em: Produção → Estoque
2. Encontre um produto
3. Ajuste estoque para: 30 unidades
4. Anote: Produto tem 30 em estoque
```

**2. Criar e Aprovar Orçamento**
```
1. Vendas → Orçamentos → Novo
2. Cliente: Qualquer
3. Adicionar item:
   - Produto: O que tem 30 em estoque
   - Quantidade: 100
4. Status: APROVADO
5. Salvar
```

**3. Verificar Ordem Criada**
```
1. Produção → Ordens de Produção
2. ✅ Nova ordem deve ter:
   - Quantidade: 70 (100 - 30 do estoque)
```

**4. Verificar Entrega Criada**
```
1. Vendas → Entregas
2. ✅ Deve ter entrega com:
   - Produto: O escolhido
   - Quantidade: 30 (o que tinha em estoque)
   - Status: Aguardando
```

### Resultado Esperado
- ✅ Ordem: 70 unidades (faltante)
- ✅ Entrega: 30 unidades (disponível)
- ✅ Total: 100 unidades (correto!)

---

## Teste 3: SEM Ordem (Estoque Suficiente)

### Objetivo
Verificar que ordem NÃO é criada quando há estoque

### Passos

**1. Preparar Produto (estoque abundante)**
```
1. Produção → Estoque
2. Ajuste produto para: 200 unidades
```

**2. Criar e Aprovar Orçamento**
```
1. Vendas → Orçamentos → Novo
2. Adicionar item:
   - Produto: O que tem 200 em estoque
   - Quantidade: 50
3. Status: APROVADO
4. Salvar
```

**3. Verificar Ordens**
```
1. Produção → Ordens de Produção
2. ❌ NÃO deve ter nova ordem para este produto
3. ℹ️ É esperado! Há estoque suficiente
```

**4. Verificar Entrega**
```
1. Vendas → Entregas
2. ✅ Deve ter entrega com:
   - Produto: O escolhido
   - Quantidade: 50
   - Status: Aguardando
```

### Resultado Esperado
- ❌ Nenhuma ordem criada
- ✅ Entrega criada (50 un.)
- ℹ️ Sistema inteligente: só produz se necessário

---

## Teste 4: Múltiplos Produtos

### Objetivo
Verificar que ordens são criadas para TODOS os produtos sem estoque

### Passos

**1. Preparar Múltiplos Produtos**
```
Produto A: estoque = 0
Produto B: estoque = 20
Produto C: estoque = 100
```

**2. Criar Orçamento com Múltiplos Items**
```
1. Vendas → Orçamentos → Novo
2. Adicionar items:
   - Produto A: 50 un.
   - Produto B: 50 un.
   - Produto C: 50 un.
3. Status: APROVADO
4. Salvar
```

**3. Verificar Ordens Criadas**
```
1. Produção → Ordens de Produção
2. ✅ Deve ter 2 novas ordens:
   - OP-XXX: Produto A (50 un.)
   - OP-YYY: Produto B (30 un.)
3. ❌ NÃO deve ter ordem para Produto C
```

**4. Verificar Entregas**
```
1. Vendas → Entregas
2. ✅ Deve ter entrega com:
   - Produto B: 20 un. (estoque disponível)
   - Produto C: 50 un. (estoque disponível)
```

### Resultado Esperado
- ✅ 2 ordens criadas (A e B)
- ✅ 1 entrega criada (B e C)
- ✅ Sistema processa cada produto corretamente

---

## Teste 5: Prioridade Baseada em Prazo

### Objetivo
Verificar priorização automática

### Teste 5A: Prazo Curto (Prioridade Alta)
```
1. Criar orçamento
2. Prazo de entrega: HOJE + 5 dias
3. Aprovar
4. ✅ Ordem criada com: Prioridade ALTA
```

### Teste 5B: Prazo Longo (Prioridade Normal)
```
1. Criar orçamento
2. Prazo de entrega: HOJE + 30 dias
3. Aprovar
4. ✅ Ordem criada com: Prioridade NORMAL
```

### Resultado Esperado
- ✅ Prazo < 15 dias → Alta
- ✅ Prazo ≥ 15 dias → Normal
- ✅ Sem prazo → Normal

---

## Teste 6: Composições (NOVO!)

### Objetivo
Verificar que sistema abre composições e cria ordens para produtos internos

### Passos

**1. Criar Composição de Teste**
```
1. Produção → Composições → Nova Composição
2. Nome: "Teste Laje Automática"
3. Descrição: "Teste de ordens automáticas"
4. Salvar composição
```

**2. Adicionar Produtos na Composição**
```
1. Na composição criada, adicionar itens:
   - Item 1:
     * Tipo: Produto
     * Produto: Escolha um produto qualquer
     * Quantidade: 3
   - Item 2:
     * Tipo: Produto
     * Produto: Escolha outro produto
     * Quantidade: 5
2. Salvar items
```

**3. Zerar Estoque dos Produtos**
```
1. Produção → Estoque
2. Ajuste os 2 produtos para quantidade: 0
```

**4. Criar Orçamento com a Composição**
```
1. Vendas → Orçamentos → Novo
2. Cliente: Qualquer
3. Adicionar item:
   - Tipo de Item: Composição
   - Composição: "Teste Laje Automática"
   - Quantidade: 10
   - Preço: 1000.00
4. Status: APROVADO
5. Salvar
```

**5. Verificar Ordens Criadas**
```
1. Produção → Ordens de Produção
2. ✅ Deve ter 2 novas ordens:
   - OP-XXX: Produto 1 (30 un.) = 10 × 3
   - OP-YYY: Produto 2 (50 un.) = 10 × 5
3. Observações devem conter:
   - "Ordem automática - Composição"
   - Nome da composição
   - Nome do cliente
   - Nome do produto
```

**6. Verificar Cálculos**
```
✅ Quantidade Produto 1: 10 (composições) × 3 (por composição) = 30
✅ Quantidade Produto 2: 10 (composições) × 5 (por composição) = 50
```

### Resultado Esperado
- ✅ Sistema detectou composição
- ✅ Abriu composição automaticamente
- ✅ Identificou 2 produtos
- ✅ Calculou quantidades corretamente
- ✅ Criou 2 ordens distintas
- ✅ Observações mencionam "Composição"

### Se NÃO Funcionar
```
1. Supabase → Logs → Functions
2. Procure por: "ABRINDO COMPOSIÇÃO"
3. Veja detalhes do processamento
4. Copie o erro e reporte
```

---

## Teste 7: Composição com Estoque Parcial

### Objetivo
Verificar que sistema calcula corretamente com estoque parcial

### Passos

**1. Usar Composição do Teste 6**
```
Composição: "Teste Laje Automática"
- Produto 1: 3 un. por composição
- Produto 2: 5 un. por composição
```

**2. Ajustar Estoque Parcial**
```
1. Produção → Estoque
2. Produto 1: 10 unidades
3. Produto 2: 30 unidades
```

**3. Criar Novo Orçamento**
```
1. Vendas → Orçamentos → Novo
2. Composição: "Teste Laje Automática"
3. Quantidade: 20
4. Status: APROVADO
5. Salvar
```

**4. Verificar Cálculos**
```
Produto 1:
- Necessário: 20 × 3 = 60 un.
- Estoque: 10 un.
- Ordem: 60 - 10 = 50 un. ✅

Produto 2:
- Necessário: 20 × 5 = 100 un.
- Estoque: 30 un.
- Ordem: 100 - 30 = 70 un. ✅
```

**5. Verificar Ordens**
```
1. Produção → Ordens de Produção
2. ✅ Ordem 1: Produto 1 (50 un.)
3. ✅ Ordem 2: Produto 2 (70 un.)
```

### Resultado Esperado
- ✅ Cálculos corretos
- ✅ Considera estoque existente
- ✅ Cria ordem apenas para faltante

---

## Teste 8: Composição com Materiais

### Objetivo
Verificar que sistema ignora materiais na composição

### Passos

**1. Criar Nova Composição**
```
1. Produção → Composições → Nova
2. Nome: "Teste Materiais"
3. Adicionar items:
   - Item 1: Produto → Qualquer → 2 un.
   - Item 2: Material → Qualquer → 5 kg
   - Item 3: Produto → Outro → 3 un.
4. Salvar
```

**2. Criar Orçamento**
```
1. Vendas → Orçamentos → Novo
2. Composição: "Teste Materiais"
3. Quantidade: 10
4. Status: APROVADO
5. Salvar
```

**3. Verificar Ordens**
```
1. Produção → Ordens de Produção
2. ✅ Deve ter 2 ordens (só produtos):
   - Produto do Item 1: 20 un. (10 × 2)
   - Produto do Item 3: 30 un. (10 × 3)
3. ❌ NÃO deve ter ordem para material
```

### Resultado Esperado
- ✅ Ordens criadas apenas para produtos
- ❌ Material ignorado corretamente
- ℹ️ Materiais não geram ordens de produção

---

## Teste 9: Verificar Logs (Importante!)

### Objetivo
Confirmar que trigger está executando corretamente

### Passos

**1. Abrir Supabase Logs**
```
1. Navegador → https://supabase.com/dashboard
2. Login (se necessário)
3. Selecione seu projeto
4. Menu lateral: Logs → Functions
```

**2. Criar e Aprovar Orçamento**
```
1. Vendas → Orçamentos → Novo
2. Adicione produto sem estoque
3. Aprove
4. Aguarde 5 segundos
```

**3. Verificar Logs em Tempo Real**
```
1. Volte para Supabase Logs
2. Clique em "Refresh" ou aguarde atualização
3. ✅ Deve aparecer:
   - "🔄 CRIAÇÃO AUTOMÁTICA DE ORDENS"
   - "PROCESSANDO ITEM DO ORÇAMENTO"
   - "NECESSÁRIO PRODUZIR: X unidades"
   - "CRIANDO ORDEM: OP-XXX"
   - "📊 RESUMO FINAL"
   - "Total de ordens criadas: X"
```

**4. Para Composições, Verificar Logs Específicos**
```
✅ Deve aparecer:
   - "Tipo: COMPOSIÇÃO"
   - "🔍 ABRINDO COMPOSIÇÃO..."
   - "PRODUTO NA COMPOSIÇÃO"
   - "Por unidade: X un."
   - "Total necessário: Y un. (Z × W)"
   - "Estoque atual: A un."
   - "Origem: Composição 'Nome'"
```

### Exemplo de Log Esperado
```
2026-01-22 10:30:45 | INFO | === CRIAÇÃO AUTOMÁTICA DE ORDENS ===
2026-01-22 10:30:45 | INFO | Orçamento aprovado: 123e4567-...
2026-01-22 10:30:45 | INFO | Verificando produto: Vigota 3m (Qtd necessária: 50)
2026-01-22 10:30:45 | INFO | Estoque disponível: 0
2026-01-22 10:30:45 | INFO | NECESSÁRIO PRODUZIR: 50 unidades
2026-01-22 10:30:45 | INFO | CRIANDO ORDEM: OP-123 | Produto: Vigota 3m | Quantidade: 50 | Prioridade: high
2026-01-22 10:30:45 | INFO | ORDEM CRIADA COM SUCESSO: OP-123
2026-01-22 10:30:45 | INFO | === RESUMO ===
2026-01-22 10:30:45 | INFO | Total de ordens criadas: 1
2026-01-22 10:30:45 | INFO | ✅ Ordens de produção criadas automaticamente!
```

### Se Logs Não Aparecem
```
❌ Problema: Trigger não está executando
✅ Verificar:
   1. Orçamento foi realmente aprovado?
   2. Status mudou de "Pendente" para "Aprovado"?
   3. Há produtos no orçamento?
   4. Produtos são do tipo "Produto" (não material)?
```

---

## Checklist Final

Após executar os testes, confirme:

- [ ] Teste 1: Ordem criada para produto sem estoque ✅
- [ ] Teste 2: Ordem criada apenas para quantidade faltante ✅
- [ ] Teste 3: Ordem NÃO criada quando há estoque ✅
- [ ] Teste 4: Ordens criadas para múltiplos produtos ✅
- [ ] Teste 5: Prioridade definida corretamente ✅
- [ ] Teste 6: Composições processadas corretamente ✅
- [ ] Teste 7: Composições com estoque parcial ✅
- [ ] Teste 8: Materiais ignorados em composições ✅
- [ ] Teste 9: Logs aparecem no Supabase ✅

Se TODOS os itens acima estão marcados: **Sistema funcionando perfeitamente!** ✅

---

## Problemas Comuns e Soluções

### ❌ Ordem não foi criada

**Causas possíveis:**
1. Orçamento não foi aprovado (status diferente de "Aprovado")
2. Item adicionado é "Material" (não "Produto")
3. Já existe ordem para este produto neste orçamento
4. Produto tem estoque suficiente

**Como verificar:**
```sql
-- Ver se orçamento está aprovado
SELECT id, status FROM quotes
WHERE id = 'UUID_DO_ORCAMENTO';

-- Ver produtos do orçamento
SELECT * FROM quote_items
WHERE quote_id = 'UUID_DO_ORCAMENTO';

-- Ver estoque dos produtos
SELECT p.name, i.quantity as estoque
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
WHERE p.id IN (
  SELECT product_id FROM quote_items
  WHERE quote_id = 'UUID_DO_ORCAMENTO'
);
```

### ❌ Ordem criada com quantidade errada

**Causa:** Estoque foi atualizado entre criação do orçamento e aprovação

**Solução:**
1. Edite a ordem manualmente
2. Ou cancele e crie nova ordem com quantidade correta

### ❌ Logs não aparecem

**Causa:** Trigger pode ter falhado silenciosamente

**Verificar:**
```sql
-- Ver erros recentes
SELECT * FROM pg_stat_statements
WHERE query LIKE '%auto_create_production_orders%'
ORDER BY last_call DESC;
```

---

## Queries Úteis para Debug

### Ver ordens criadas hoje
```sql
SELECT
  po.order_number,
  p.name as produto,
  po.quantity,
  po.priority,
  po.created_at,
  q.id as orcamento_id
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN quotes q ON q.id = po.quote_id
WHERE DATE(po.created_at) = CURRENT_DATE
ORDER BY po.created_at DESC;
```

### Ver orçamentos aprovados hoje
```sql
SELECT
  q.id,
  c.name as cliente,
  q.status,
  q.created_at,
  COUNT(qi.id) as total_items
FROM quotes q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN quote_items qi ON qi.quote_id = q.id
WHERE DATE(q.updated_at) = CURRENT_DATE
  AND q.status = 'approved'
GROUP BY q.id, c.name, q.status, q.created_at
ORDER BY q.updated_at DESC;
```

### Ver orçamentos aprovados SEM ordens (problema!)
```sql
SELECT
  q.id,
  c.name as cliente,
  q.created_at,
  COUNT(qi.id) as produtos_no_orcamento,
  COUNT(po.id) as ordens_criadas
FROM quotes q
JOIN customers c ON c.id = q.customer_id
JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN production_orders po ON po.quote_id = q.id
WHERE q.status = 'approved'
  AND qi.item_type = 'product'
GROUP BY q.id, c.name, q.created_at
HAVING COUNT(po.id) = 0
ORDER BY q.created_at DESC;
```

---

## Resumo Executivo dos Testes

| Teste | Objetivo | Status |
|-------|----------|--------|
| 1 | Ordem com estoque zero | ⬜ |
| 2 | Ordem com estoque parcial | ⬜ |
| 3 | Sem ordem (estoque suficiente) | ⬜ |
| 4 | Múltiplos produtos | ⬜ |
| 5 | Priorização automática | ⬜ |
| 6 | Composições | ⬜ |
| 7 | Composições com estoque parcial | ⬜ |
| 8 | Composições com materiais | ⬜ |
| 9 | Verificar logs | ⬜ |

**Legenda:**
- ⬜ Não testado
- ✅ Passou
- ❌ Falhou

---

## Próximos Passos

Após todos os testes passarem:

1. ✅ **Sistema está pronto para uso**
2. ✅ **Aprove orçamentos normalmente**
3. ✅ **Ordens serão criadas automaticamente**
4. ✅ **Foque em produzir e entregar**

**Documentação completa:** `ORDENS_AUTOMATICAS_INDUSTRIA.md`

---

Bons testes! 🚀
