# ✅ Ordens Automáticas para COMPOSIÇÕES

## 🎯 Novidade: Suporte Total a Composições!

O sistema agora **abre automaticamente as composições** e cria ordens de produção para os produtos dentro delas.

---

## Como Funciona

### Antes (Produtos Diretos)

```
Orçamento:
├─ Item: Vigota 3m (produto)
├─ Quantidade: 50 un.
└─ Sistema: Cria ordem OP-123 (50 un.)
```

### Agora (Composições)

```
Orçamento:
├─ Item: Laje Treliçada 4m (composição)
├─ Quantidade: 20 un.
└─ Sistema:
    ├─ 🔍 ABRE a composição "Laje Treliçada 4m"
    ├─ Verifica produtos dentro:
    │   ├─ Vigota 4m: 4 un. por laje → Total: 80 un.
    │   ├─ Tavela: 12 un. por laje → Total: 240 un.
    │   └─ Ferro 8mm: 3 kg (material, ignora)
    └─ ✅ Cria ordens:
        ├─ OP-124: Vigota 4m (80 un. - estoque)
        └─ OP-125: Tavela (240 un. - estoque)
```

---

## Exemplo Detalhado

### Situação

**Composição Cadastrada: "Laje Pré-Moldada 5m"**

| Produto | Qtd por Laje | Unidade |
|---------|--------------|---------|
| Vigota 5m | 5 un. | UN |
| Tavela Cerâmica | 15 un. | UN |
| Bloco EPS | 8 un. | UN |
| Ferro 6mm | 4 kg | KG (material) |
| Arame | 0.5 kg | KG (material) |

**Estoque Atual:**
- Vigota 5m: 30 un.
- Tavela Cerâmica: 0 un.
- Bloco EPS: 100 un.

### Orçamento Criado

```
Cliente: João da Silva Construções
Item: Laje Pré-Moldada 5m (composição)
Quantidade: 25 lajes
Prazo: 10 dias
```

### Ao Aprovar o Orçamento

**Sistema processa automaticamente:**

```
🔄 CRIAÇÃO AUTOMÁTICA DE ORDENS
════════════════════════════════════════════════

Cliente: João da Silva Construções

📦 PROCESSANDO ITEM DO ORÇAMENTO
   Tipo: composition
   Nome: Laje Pré-Moldada 5m
   Qtd: 25

   ├─ Tipo: COMPOSIÇÃO
   ├─ 🔍 ABRINDO COMPOSIÇÃO...

   ├─ 📦 PRODUTO NA COMPOSIÇÃO: Vigota 5m
   │  ├─ Por unidade: 5 un.
   │  ├─ Qtd composição: 25
   │  ├─ Total necessário: 125 un. (25 × 5)
   │  ├─ Estoque atual: 30 un.
   │  ├─ ⚠️  FALTA ESTOQUE: 95 un.
   │  └─ ✅ CRIANDO ORDEM: OP-201
   │     ├─ Produto: Vigota 5m
   │     ├─ Quantidade: 95 un.
   │     ├─ Prioridade: alta
   │     └─ Origem: Composição "Laje Pré-Moldada 5m"

   ├─ 📦 PRODUTO NA COMPOSIÇÃO: Tavela Cerâmica
   │  ├─ Por unidade: 15 un.
   │  ├─ Qtd composição: 25
   │  ├─ Total necessário: 375 un. (25 × 15)
   │  ├─ Estoque atual: 0 un.
   │  ├─ ⚠️  FALTA ESTOQUE: 375 un.
   │  └─ ✅ CRIANDO ORDEM: OP-202
   │     ├─ Produto: Tavela Cerâmica
   │     ├─ Quantidade: 375 un.
   │     ├─ Prioridade: alta
   │     └─ Origem: Composição "Laje Pré-Moldada 5m"

   ├─ 📦 PRODUTO NA COMPOSIÇÃO: Bloco EPS
   │  ├─ Por unidade: 8 un.
   │  ├─ Qtd composição: 25
   │  ├─ Total necessário: 200 un. (25 × 8)
   │  ├─ Estoque atual: 100 un.
   │  ├─ ⚠️  FALTA ESTOQUE: 100 un.
   │  └─ ✅ CRIANDO ORDEM: OP-203
   │     ├─ Produto: Bloco EPS
   │     ├─ Quantidade: 100 un.
   │     ├─ Prioridade: alta
   │     └─ Origem: Composição "Laje Pré-Moldada 5m"

   └─ ✅ Composição processada

════════════════════════════════════════════════
📊 RESUMO FINAL
════════════════════════════════════════════════
Total de ordens criadas: 3
✅ Ordens de produção criadas com sucesso!
════════════════════════════════════════════════
```

### Resultado Final

**3 Ordens Criadas:**

| Ordem | Produto | Qtd | Observações |
|-------|---------|-----|-------------|
| OP-201 | Vigota 5m | 95 un. | Ordem automática - Composição \| Cliente: João da Silva \| Composição: Laje Pré-Moldada 5m |
| OP-202 | Tavela Cerâmica | 375 un. | Ordem automática - Composição \| Cliente: João da Silva \| Composição: Laje Pré-Moldada 5m |
| OP-203 | Bloco EPS | 100 un. | Ordem automática - Composição \| Cliente: João da Silva \| Composição: Laje Pré-Moldada 5m |

**Materiais (Ferro, Arame):**
- ❌ Não geram ordens (são materiais, não produtos)
- ℹ️ Devem ser retirados do estoque de materiais

---

## Como Usar

### 1. Cadastrar Composição

```
Produção → Composições → Nova Composição
├─ Nome: Laje Treliçada 3m
├─ Descrição: Laje pré-moldada completa
└─ Adicionar itens:
    ├─ Produto: Vigota 3m (4 un.)
    ├─ Produto: Tavela (12 un.)
    ├─ Material: Ferro 8mm (3 kg)
    └─ Material: Arame (0.5 kg)
```

### 2. Criar Orçamento com Composição

```
Vendas → Orçamentos → Novo Orçamento
├─ Cliente: Selecione
├─ Tipo de Item: Composição
├─ Composição: Laje Treliçada 3m
├─ Quantidade: 30
└─ Prazo: 15 dias
```

### 3. Aprovar Orçamento

```
Status: APROVADO → Salvar
```

### 4. Sistema Processa Automaticamente

```
✨ Automático:
├─ Abre composição
├─ Identifica produtos (Vigota, Tavela)
├─ Calcula quantidades (30 × qtd_na_composição)
├─ Verifica estoque de cada produto
├─ Cria ordens para produtos sem estoque
└─ Logs detalhados no Supabase
```

### 5. Verificar Ordens Criadas

```
Produção → Ordens de Produção
└─ Verá ordens:
    ├─ OP-XXX: Vigota 3m (Origem: Composição)
    └─ OP-YYY: Tavela (Origem: Composição)
```

---

## Cálculo de Quantidades

### Fórmula

```
Quantidade_Ordem = (Qtd_Composição × Qtd_Item_Composição) - Estoque_Atual
```

### Exemplos

**Exemplo 1:**
```
Orçamento: 10 lajes
Composição: 3 vigotas por laje
Estoque: 5 vigotas

Cálculo:
- Necessário: 10 × 3 = 30 vigotas
- Estoque: 5 vigotas
- Ordem: 30 - 5 = 25 vigotas ✅
```

**Exemplo 2:**
```
Orçamento: 50 lajes
Composição: 12 tavelas por laje
Estoque: 0 tavelas

Cálculo:
- Necessário: 50 × 12 = 600 tavelas
- Estoque: 0 tavelas
- Ordem: 600 - 0 = 600 tavelas ✅
```

**Exemplo 3:**
```
Orçamento: 15 lajes
Composição: 5 vigotas por laje
Estoque: 100 vigotas

Cálculo:
- Necessário: 15 × 5 = 75 vigotas
- Estoque: 100 vigotas
- Ordem: 75 - 100 = -25 (negativo)
- Resultado: NÃO cria ordem (estoque suficiente) ✅
```

---

## Tipos de Items Processados

| Tipo Item | Sistema Processa? | Cria Ordem? |
|-----------|-------------------|-------------|
| **Produto** | ✅ Sim | ✅ Se faltar estoque |
| **Composição** | ✅ Sim (abre e verifica) | ✅ Para produtos internos sem estoque |
| **Material** | ℹ️ Ignora | ❌ Não (materiais não são produzidos) |

---

## Logs Detalhados

### Onde Ver

```
Supabase Dashboard → Logs → Functions
Procure por: "CRIAÇÃO AUTOMÁTICA DE ORDENS"
```

### O Que os Logs Mostram

Para **Composições**, os logs são super detalhados:

```
✅ Item do orçamento (tipo: composition)
✅ Nome da composição
✅ Quantidade da composição
✅ "ABRINDO COMPOSIÇÃO..."
✅ Para cada produto dentro:
   ├─ Nome do produto
   ├─ Quantidade por unidade
   ├─ Cálculo do total
   ├─ Estoque atual
   ├─ Quantidade faltante
   └─ Ordem criada (se necessário)
✅ Resumo final
```

### Exemplo de Log Real

```
2026-01-22 14:30:00 | INFO | ════════════════════════════════════════════════════════
2026-01-22 14:30:00 | INFO | 🔄 CRIAÇÃO AUTOMÁTICA DE ORDENS DE PRODUÇÃO
2026-01-22 14:30:00 | INFO | ════════════════════════════════════════════════════════
2026-01-22 14:30:00 | INFO | Orçamento aprovado: abc123...
2026-01-22 14:30:00 | INFO | Cliente: João da Silva
2026-01-22 14:30:00 | INFO | ────────────────────────────────────────────────────────
2026-01-22 14:30:00 | INFO |
2026-01-22 14:30:00 | INFO | 📦 PROCESSANDO ITEM DO ORÇAMENTO
2026-01-22 14:30:00 | INFO |    Tipo: composition | Nome: Laje 4m | Qtd: 20
2026-01-22 14:30:00 | INFO |    ├─ Tipo: COMPOSIÇÃO
2026-01-22 14:30:00 | INFO |    ├─ Nome: Laje Treliçada 4m
2026-01-22 14:30:00 | INFO |    ├─ 🔍 ABRINDO COMPOSIÇÃO PARA VERIFICAR PRODUTOS...
2026-01-22 14:30:00 | INFO |    │
2026-01-22 14:30:00 | INFO |    ├─ 📦 PRODUTO NA COMPOSIÇÃO
2026-01-22 14:30:00 | INFO |    │  ├─ Nome: Vigota 4m (VIG-004)
2026-01-22 14:30:00 | INFO |    │  ├─ Por unidade: 4 un.
2026-01-22 14:30:00 | INFO |    │  ├─ Qtd composição: 20
2026-01-22 14:30:00 | INFO |    │  ├─ Total necessário: 80 un. (20 × 4)
2026-01-22 14:30:00 | INFO |    │  ├─ Estoque atual: 30 un.
2026-01-22 14:30:00 | INFO |    │  ├─ ⚠️  FALTA ESTOQUE: 50 un.
2026-01-22 14:30:00 | INFO |    │  └─ ✅ CRIANDO ORDEM: OP-301
2026-01-22 14:30:00 | INFO |    │     ├─ Produto: Vigota 4m
2026-01-22 14:30:00 | INFO |    │     ├─ Quantidade: 50 un.
2026-01-22 14:30:00 | INFO |    │     ├─ Prioridade: high
2026-01-22 14:30:00 | INFO |    │     └─ Origem: Composição "Laje Treliçada 4m"
2026-01-22 14:30:01 | INFO |    └─ ✅ Composição processada
2026-01-22 14:30:01 | INFO |
2026-01-22 14:30:01 | INFO | ════════════════════════════════════════════════════════
2026-01-22 14:30:01 | INFO | 📊 RESUMO FINAL
2026-01-22 14:30:01 | INFO | ════════════════════════════════════════════════════════
2026-01-22 14:30:01 | INFO | Total de ordens criadas: 1
2026-01-22 14:30:01 | INFO | ✅ Ordens de produção criadas com sucesso!
2026-01-22 14:30:01 | INFO | ════════════════════════════════════════════════════════
```

---

## Teste Rápido

### Teste Completo com Composição

**1. Criar Composição de Teste**
```
1. Produção → Composições → Nova
2. Nome: "Teste Laje Simples"
3. Adicionar itens:
   - Tipo: Produto → Selecione qualquer produto → Qtd: 3
   - Tipo: Produto → Selecione outro produto → Qtd: 5
4. Salvar
```

**2. Zerar/Ajustar Estoque**
```
1. Produção → Estoque
2. Ajuste os produtos da composição:
   - Produto 1: 0 unidades
   - Produto 2: 0 unidades
```

**3. Criar Orçamento com Composição**
```
1. Vendas → Orçamentos → Novo
2. Cliente: Qualquer
3. Adicionar item:
   - Tipo: Composição
   - Composição: "Teste Laje Simples"
   - Quantidade: 10
4. Status: APROVADO
5. Salvar
```

**4. Verificar Resultado**
```
1. Produção → Ordens de Produção
2. ✅ Deve ter 2 ordens:
   - OP-XXX: Produto 1 (30 un.) = 10 × 3
   - OP-YYY: Produto 2 (50 un.) = 10 × 5
3. Observações devem mencionar: "Composição"
```

**5. Ver Logs**
```
1. Supabase → Logs
2. ✅ Deve mostrar:
   - "ABRINDO COMPOSIÇÃO..."
   - Detalhes de cada produto
   - Cálculos de quantidade
   - Ordens criadas
```

---

## Perguntas Frequentes

### 1. O sistema abre automaticamente a composição?

**R:** Sim! Totalmente automático.
- Você só precisa aprovar o orçamento
- Sistema detecta que é composição
- Abre e verifica TODOS os produtos
- Cria ordens conforme necessário

### 2. Como sei quais produtos estão na composição?

**R:** Veja em: Produção → Composições
- Clique na composição
- Verá todos os items (produtos e materiais)

### 3. E os materiais da composição?

**R:** Materiais são ignorados.
- Sistema SÓ cria ordens para PRODUTOS
- Materiais devem ser retirados do estoque manualmente

### 4. Posso ter composição dentro de composição?

**R:** Atualmente NÃO.
- Sistema processa 1 nível apenas
- Composição → Produtos diretos

### 5. Como rastrear qual ordem veio de qual composição?

**R:** Pelas observações da ordem:
```
"Ordem automática - Composição | Cliente: XXX | Composição: Nome da Composição | Produto: YYY"
```

### 6. Posso misturar produtos e composições no mesmo orçamento?

**R:** Sim! Perfeitamente possível.
```
Orçamento:
├─ Item 1: Produto A (direto)
├─ Item 2: Composição X
└─ Item 3: Produto B (direto)

Sistema cria ordens para:
- Produto A (se necessário)
- Produtos dentro de Composição X (se necessário)
- Produto B (se necessário)
```

### 7. E se a composição estiver vazia?

**R:** Sistema ignora silenciosamente.
- Não cria ordens
- Não gera erro
- Log menciona: "Composição processada"

---

## Vantagens do Sistema

### ✅ Automação Total

```
Antes (Manual):
1. Aprovar orçamento
2. Abrir composição manualmente
3. Ver produtos
4. Calcular quantidades de cada produto
5. Verificar estoque de cada um
6. Criar ordem para Produto A
7. Criar ordem para Produto B
8. Criar ordem para Produto C
...

Agora (Automático):
1. Aprovar orçamento ✅
```

### ✅ Precisão 100%

- Cálculo matemático correto
- Considera estoque atual
- Não esquece nenhum produto
- Evita erros humanos

### ✅ Rastreabilidade

- Logs detalhados
- Observações completas
- Fácil auditar
- Identifica origem da ordem

### ✅ Flexibilidade

- Funciona com produtos diretos
- Funciona com composições
- Funciona com ambos misturados
- Processa múltiplas composições

---

## Queries de Verificação

### Ver ordens criadas de composições

```sql
SELECT
  po.order_number,
  p.name as produto,
  po.quantity,
  po.notes,
  po.created_at
FROM production_orders po
JOIN products p ON p.id = po.product_id
WHERE po.notes LIKE '%Composição%'
  AND po.quote_id IS NOT NULL
ORDER BY po.created_at DESC;
```

### Ver composição e seus produtos

```sql
SELECT
  c.name as composicao,
  ci.item_type,
  COALESCE(p.name, ci.item_name) as item,
  ci.quantity as qtd_por_unidade,
  ci.unit
FROM compositions c
JOIN composition_items ci ON ci.composition_id = c.id
LEFT JOIN products p ON p.id = ci.product_id
WHERE c.id = 'UUID_DA_COMPOSICAO'
ORDER BY ci.item_type, ci.item_name;
```

### Ver orçamento com composições e ordens geradas

```sql
SELECT
  'ORÇAMENTO' as tipo,
  q.id::text as id,
  c.name as nome,
  NULL::numeric as quantidade,
  NULL::text as status
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE q.id = 'UUID_DO_ORCAMENTO'

UNION ALL

SELECT
  'ITEM - ' || qi.item_type as tipo,
  qi.id::text,
  qi.item_name,
  qi.quantity,
  NULL::text
FROM quote_items qi
WHERE qi.quote_id = 'UUID_DO_ORCAMENTO'

UNION ALL

SELECT
  'ORDEM' as tipo,
  po.id::text,
  po.order_number || ' - ' || p.name,
  po.quantity,
  po.status
FROM production_orders po
JOIN products p ON p.id = po.product_id
WHERE po.quote_id = 'UUID_DO_ORCAMENTO'
ORDER BY tipo, nome;
```

---

## Resumo Executivo

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| **Produtos Diretos** | ✅ Funciona | Cria ordem se faltar estoque |
| **Composições** | ✅ Funciona | Abre e verifica produtos internos |
| **Cálculo Automático** | ✅ Funciona | Qtd_composição × Qtd_item |
| **Verificação Estoque** | ✅ Funciona | Para cada produto |
| **Criação Ordens** | ✅ Funciona | Automática para faltantes |
| **Logs Detalhados** | ✅ Funciona | Rastreamento completo |
| **Materiais** | ℹ️ Ignora | Correto (não produz materiais) |

---

## Documentação Relacionada

📄 **LEIA_MUDANCA_ORDENS.md**
   └─ Visão geral das ordens automáticas

📄 **ORDENS_AUTOMATICAS_INDUSTRIA.md**
   └─ Guia completo do sistema

📄 **ORDENS_AUTOMATICAS_COMPOSICOES.md** (este arquivo)
   └─ Específico para composições

📄 **TESTE_ORDENS_AUTOMATICAS.md**
   └─ Testes passo a passo

---

**Sistema completamente implementado e testado!** ✅

Agora você pode usar composições nos orçamentos e o sistema criará automaticamente as ordens para TODOS os produtos necessários, calculando as quantidades corretamente e verificando o estoque de cada um. Simples, automático e confiável! 🎉
