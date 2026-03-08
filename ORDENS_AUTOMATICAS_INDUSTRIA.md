# Sistema de Ordens de Produção Automáticas

## ✅ IMPLEMENTADO: Criação Automática no Módulo Indústria

A partir de agora, **ordens de produção são criadas AUTOMATICAMENTE** quando um orçamento é aprovado no **módulo de Indústria de Artefatos**.

---

## Como Funciona

### Fluxo Automático Completo

```
MÓDULO: INDÚSTRIA DE ARTEFATOS
│
├─ Vendas → Orçamentos
│   │
│   ├─ 1. Criar orçamento
│   │   ├─ Adicionar produtos OU composições
│   │   ├─ Definir quantidades
│   │   └─ Prazo de entrega
│   │
│   └─ 2. Aprovar orçamento (Status: Aprovado)
│       │
│       └─ ✨ TRIGGER AUTOMÁTICO ✨
│           │
│           ├─ Para PRODUTOS diretos:
│           │   └─ Verifica estoque e cria ordem se necessário
│           │
│           ├─ Para COMPOSIÇÕES:
│           │   ├─ 🔍 Abre a composição automaticamente
│           │   ├─ Identifica TODOS os produtos dentro
│           │   ├─ Calcula: Qtd_composição × Qtd_item
│           │   ├─ Verifica estoque de cada produto
│           │   └─ Cria ordem para produtos sem estoque
│           │
│           ├─ Para produtos SEM estoque suficiente:
│           │   ├─ Cria ordem de produção automaticamente
│           │   ├─ Quantidade = Necessário - Estoque Atual
│           │   ├─ Prioridade = Alta (se prazo < 15 dias)
│           │   └─ Vincula ao orçamento
│           │
│           └─ Para produtos COM estoque:
│               └─ Cria entrega automática
│
├─ Produção → Ordens de Produção
│   │
│   └─ ✅ Ordens aparecem automaticamente
│       ├─ Status: Aberta
│       ├─ Prioridade definida
│       └─ Observações: cliente, orçamento, produto
│
└─ Vendas → Entregas
    │
    └─ ✅ Entregas criadas quando há estoque
```

---

## ✨ NOVO: Suporte a Composições

### Sistema Abre Composições Automaticamente!

**Quando você adiciona uma COMPOSIÇÃO ao orçamento:**

```
Orçamento:
└─ Item: Laje Treliçada 4m (composição) - 20 un.

Sistema automaticamente:
├─ 🔍 Detecta que é composição
├─ 🔓 Abre a composição
├─ 📋 Lista produtos:
│   ├─ Vigota 4m: 4 un. por laje
│   ├─ Tavela: 12 un. por laje
│   └─ Ferro: 3 kg (material, ignora)
├─ 🧮 Calcula quantidades:
│   ├─ Vigota: 20 × 4 = 80 un.
│   └─ Tavela: 20 × 12 = 240 un.
├─ 📦 Verifica estoque:
│   ├─ Vigota: tem 30, falta 50
│   └─ Tavela: tem 0, falta 240
└─ ✅ Cria ordens:
    ├─ OP-101: Vigota 4m (50 un.)
    └─ OP-102: Tavela (240 un.)
```

**📚 Documentação completa:** `ORDENS_AUTOMATICAS_COMPOSICOES.md`

---

## Detalhes Técnicos

### Quando Ordens São Criadas

**Trigger Automático:** `trigger_auto_create_production_orders`

**Dispara quando:**
- Status do orçamento muda para `'approved'`

**Para cada produto do orçamento:**
1. Verifica estoque atual
2. Calcula: `quantidade_a_produzir = quantidade_necessária - estoque_atual`
3. Se `quantidade_a_produzir > 0`:
   - ✅ Cria ordem de produção automaticamente
4. Se `quantidade_a_produzir ≤ 0`:
   - ℹ️ Não cria ordem (estoque suficiente)

### Campos da Ordem Automática

| Campo | Valor | Origem |
|-------|-------|--------|
| **order_number** | OP-XXX | Sequencial automático |
| **quote_id** | UUID | Orçamento que originou |
| **product_id** | UUID | Produto a produzir |
| **quantity** | Decimal | Necessário - Estoque |
| **priority** | high/normal | Prazo < 15 dias = high |
| **status** | open | Sempre "open" ao criar |
| **deadline** | Data | Prazo de entrega do orçamento |
| **notes** | Texto | Cliente, orçamento, produto |

### Exemplo de Observações

```
Ordem automática - Orçamento aprovado
Cliente: João Silva Construções
Produto: Vigota 3m (VIG-003)
```

---

## Como Usar

### No Módulo Indústria de Artefatos

#### 1. Criar e Aprovar Orçamento

```
1. Vá em: Vendas → Orçamentos
2. Clique em: "Novo Orçamento"
3. Selecione o cliente
4. Adicione produtos:
   - Produto A: 50 unidades
   - Produto B: 100 unidades
   - Produto C: 25 unidades
5. Defina prazo de entrega: 10/02/2026
6. Status: Aprovado
7. Clique em "Salvar"
```

**✨ Sistema automaticamente:**
- Verifica estoque de A, B e C
- Cria ordem para produtos sem estoque
- Cria entrega para produtos com estoque
- Define prioridade baseada no prazo

#### 2. Verificar Ordens Criadas

```
1. Vá em: Produção → Ordens de Produção
2. Veja as ordens criadas automaticamente:
   - OP-123: Produto A (30 un.) - Prioridade Alta
   - OP-124: Produto B (100 un.) - Prioridade Alta
   - OP-125: Produto C (10 un.) - Prioridade Alta
```

**Observações incluem:**
- Nome do cliente
- Código do produto
- Referência ao orçamento

#### 3. Acompanhar Produção

```
1. Clique na ordem para abrir detalhes
2. Registre produções conforme fabricar
3. Quando total produzido ≥ quantidade:
   - Marque como "Concluída"
   - Sistema atualiza estoque automaticamente
   - Entrega automática pode ser criada
```

---

## No Módulo Construtora (Opcional)

### Vinculação Manual à Obra

Se você quiser vincular o orçamento a uma obra específica:

```
1. Vá em: Construtora → Obras
2. Selecione a obra
3. Aba "Acompanhamento"
4. Vincular orçamento à obra
```

**O que acontece:**
- ✅ Cria registros de items da obra
- ✅ Cria entrega se houver estoque
- ❌ NÃO cria ordens de produção
- ℹ️ Ordens já foram criadas automaticamente ao aprovar

---

## Exemplos Práticos

### Exemplo 1: Todos os Produtos Sem Estoque

**Situação:**
- Orçamento: 3 produtos (A, B, C)
- Estoque: A=0, B=0, C=0
- Prazo: 5 dias

**Resultado:**
```
✅ 3 ordens criadas (todas prioridade ALTA)
   ├─ OP-101: Produto A
   ├─ OP-102: Produto B
   └─ OP-103: Produto C

❌ Nenhuma entrega criada (sem estoque)
```

### Exemplo 2: Alguns Produtos Com Estoque

**Situação:**
- Orçamento: 3 produtos
  - A: 50 necessário (estoque: 30)
  - B: 100 necessário (estoque: 100)
  - C: 25 necessário (estoque: 0)
- Prazo: 20 dias

**Resultado:**
```
✅ 2 ordens criadas
   ├─ OP-104: Produto A (20 un.) - Prioridade Normal
   └─ OP-105: Produto C (25 un.) - Prioridade Normal

✅ 1 entrega criada automaticamente
   └─ ENT-50: Produto B (100 un.)
```

### Exemplo 3: Todos os Produtos Com Estoque

**Situação:**
- Orçamento: 2 produtos
  - A: 10 necessário (estoque: 50)
  - B: 20 necessário (estoque: 100)

**Resultado:**
```
❌ Nenhuma ordem criada (estoque suficiente)

✅ 1 entrega criada automaticamente
   ├─ Produto A: 10 un.
   └─ Produto B: 20 un.
```

---

## Verificação e Debug

### Ver Logs do Sistema

**No Supabase Dashboard:**
```
1. Abra: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral: Logs → Functions
4. Procure por:
   - "CRIAÇÃO AUTOMÁTICA DE ORDENS"
   - "ORDEM CRIADA COM SUCESSO"
   - "RESUMO"
```

**Exemplo de Log:**
```
=== CRIAÇÃO AUTOMÁTICA DE ORDENS ===
Orçamento aprovado: 123e4567-e89b-12d3-a456-426614174000
Verificando produto: Vigota 3m (Qtd necessária: 50)
Estoque disponível: 20
NECESSÁRIO PRODUZIR: 30 unidades
CRIANDO ORDEM: OP-123 | Produto: Vigota 3m | Quantidade: 30 | Prioridade: high
ORDEM CRIADA COM SUCESSO: OP-123
=== RESUMO ===
Total de ordens criadas: 1
✅ Ordens de produção criadas automaticamente!
```

### Queries de Verificação

**Ver ordens criadas automaticamente hoje:**
```sql
SELECT
  po.order_number,
  p.name as produto,
  po.quantity,
  po.priority,
  po.status,
  q.id as orcamento_id,
  c.name as cliente
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN quotes q ON q.id = po.quote_id
LEFT JOIN customers c ON c.id = q.customer_id
WHERE DATE(po.created_at) = CURRENT_DATE
  AND po.quote_id IS NOT NULL
ORDER BY po.created_at DESC;
```

**Ver orçamentos aprovados sem ordens (indica problema):**
```sql
SELECT
  q.id,
  c.name as cliente,
  q.created_at,
  COUNT(qi.id) as total_produtos
FROM quotes q
JOIN customers c ON c.id = q.customer_id
JOIN quote_items qi ON qi.quote_id = q.id
WHERE q.status = 'approved'
  AND qi.item_type = 'product'
  AND NOT EXISTS (
    SELECT 1 FROM production_orders po
    WHERE po.quote_id = q.id
  )
GROUP BY q.id, c.name, q.created_at
ORDER BY q.created_at DESC;
```

---

## Perguntas Frequentes

### 1. E se eu aprovar um orçamento por engano?

**R:** Você pode:
- Cancelar as ordens criadas manualmente
- Mudar status do orçamento para "Pendente" ou "Rejeitado"
- Ordens já criadas não serão removidas automaticamente

### 2. Posso editar a quantidade da ordem criada?

**R:** Sim! A ordem é criada automaticamente, mas você pode:
- Editar a quantidade
- Mudar a prioridade
- Alterar o prazo
- Cancelar a ordem

### 3. O que acontece se eu alterar o orçamento depois de aprovado?

**R:**
- Ordens já criadas permanecem inalteradas
- Você pode criar ordens manualmente se necessário
- Recomenda-se criar novo orçamento para mudanças grandes

### 4. Como funciona a prioridade automática?

**R:**
- **Prioridade Alta:** Prazo ≤ 15 dias
- **Prioridade Normal:** Prazo > 15 dias
- **Sem prazo:** Prioridade Normal

### 5. E se eu não quiser ordens automáticas?

**R:** Não é possível desabilitar, mas você pode:
- Não aprovar o orçamento até estar pronto para produzir
- Cancelar ordens criadas automaticamente
- Manter orçamentos como "Pendente" até decisão final

### 6. Posso vincular orçamento à obra antes de aprovar?

**R:** Sim! A vinculação à obra é independente:
- Vinculação: Registra items na obra
- Aprovação: Cria ordens de produção
- São processos separados

---

## Vantagens do Sistema Automático

### ✅ Benefícios

1. **Zero esquecimentos**
   - Nunca mais esquecer de criar ordem de produção
   - Sistema garante 100% de cobertura

2. **Agilidade**
   - Ordens criadas instantaneamente
   - Não precisa criar manualmente

3. **Precisão**
   - Quantidade exata necessária
   - Considera estoque atual

4. **Priorização inteligente**
   - Prazo curto = prioridade alta
   - Organiza produção automaticamente

5. **Rastreabilidade**
   - Ordem vinculada ao orçamento
   - Fácil rastrear origem

6. **Menos trabalho manual**
   - Foco em aprovar orçamento
   - Sistema cuida do resto

---

## Fluxo Completo: Do Orçamento à Entrega

```
1️⃣ CRIAR ORÇAMENTO
   ├─ Vendas → Orçamentos → Novo
   ├─ Adicionar cliente
   ├─ Adicionar produtos
   └─ Definir prazo

2️⃣ APROVAR ORÇAMENTO
   ├─ Status → Aprovado
   └─ ✨ TRIGGER AUTOMÁTICO
       ├─ Verifica estoque
       ├─ Cria ordens para produtos sem estoque
       └─ Cria entrega para produtos com estoque

3️⃣ PRODUZIR
   ├─ Produção → Ordens de Produção
   ├─ Visualizar ordens automáticas
   ├─ Registrar produção
   └─ Concluir ordem

4️⃣ ENTREGAR
   ├─ Vendas → Entregas
   ├─ Iniciar carregamento
   ├─ Confirmar items
   └─ Finalizar entrega

5️⃣ FATURAR
   ├─ Financeiro → Contas a Receber
   └─ Registrar pagamentos
```

---

## Resumo Executivo

| Item | Antes | Agora |
|------|-------|-------|
| **Criação de Ordens** | Manual | ✅ Automática |
| **Local de Criação** | Módulo Construtora | ✅ Módulo Indústria |
| **Momento** | Ao vincular à obra | ✅ Ao aprovar orçamento |
| **Risco de Esquecer** | Alto | ✅ Zero |
| **Trabalho Manual** | Alto | ✅ Mínimo |
| **Precisão** | Depende do usuário | ✅ 100% |

---

## Suporte

**Problemas comuns e soluções:**

| Problema | Solução |
|----------|---------|
| Ordem não foi criada | Verifique logs no Supabase |
| Ordem com quantidade errada | Edite a ordem manualmente |
| Muitas ordens criadas | Verifique se aprovou orçamento duplicado |
| Ordem não aparece | Recarregue a página (Ctrl+F5) |

**Contato:**
- Verifique logs: Supabase → Logs → Functions
- Execute query de verificação (acima)
- Reporte com: ID do orçamento + print dos logs

---

**Sistema implementado e testado!** ✅

Ordens de produção agora são criadas **automaticamente** no módulo de Indústria de Artefatos quando você aprova um orçamento. Simples, rápido e confiável!
