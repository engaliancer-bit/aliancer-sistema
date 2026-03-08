# Correção: Produtos de Composições Agora Descontam do Estoque

## Problema Identificado

Ao aprovar um orçamento contendo **composições**, os produtos dessas composições **NÃO eram incluídos nas entregas**, resultando em:

❌ **Estoque não era descontado** para produtos de composições
❌ **Sistema permitia vender o mesmo estoque múltiplas vezes**
❌ **Controle de estoque impreciso e arriscado**

### Cenário Real

**Orçamento aprovado:**
- 10x "Kit Laje Nervurada 10m²" (composição)
  - Cada kit contém:
    - 50x Vigotas Pré-Moldadas
    - 25x Blocos de Enchimento
    - 10m³ Concreto

**ANTES (comportamento incorreto):**

1. **Ordens de Produção:** ✅ Criadas corretamente
   - 500 vigotas (10 kits × 50)
   - 250 blocos (10 kits × 25)
   - 100m³ concreto (10 kits × 10)

2. **Entregas:** ❌ Criadas VAZIAS
   - Nenhum produto incluído na entrega
   - Estoque NÃO descontado

3. **Resultado:** 🔴 PROBLEMA CRÍTICO
   - Estoque mostra 500 vigotas disponíveis
   - Mas na verdade, 500 vigotas estão comprometidas!
   - Sistema permite vender 500 vigotas novamente
   - **Dupla venda do mesmo estoque!**

**DEPOIS (comportamento correto):**

1. **Ordens de Produção:** ✅ Criadas corretamente (sem mudanças)
   - 500 vigotas
   - 250 blocos
   - 100m³ concreto

2. **Entregas:** ✅ Criadas com TODOS os produtos
   - 500x Vigotas (da composição)
   - 250x Blocos (da composição)
   - 100m³ Concreto (da composição)
   - Cada item marcado com:
     - `is_from_composition = true`
     - `parent_composition_id` e `parent_composition_name`

3. **Resultado:** ✅ CONTROLE CORRETO
   - Estoque mostra 0 vigotas disponíveis (se só tiver 500)
   - Produtos corretamente reservados
   - **Impossível dupla venda!**

## Lógica Atual do Sistema

### Fluxo Completo ao Aprovar Orçamento

```
1. Usuário aprova orçamento
   └─ Orçamento.status: 'pending' → 'approved'

2. Trigger: auto_create_production_orders_on_quote_approval
   └─ Verifica estoque disponível para:
      ├─ Produtos diretos
      └─ Produtos dentro de composições (expandindo)

   └─ Se ESTOQUE INSUFICIENTE:
      ├─ Marca: awaiting_production = true
      ├─ Cria Ordens de Produção para itens faltantes
      └─ Entrega NÃO é criada ainda

   └─ Se ESTOQUE OK:
      ├─ Marca: awaiting_production = false
      └─ Chama: create_delivery_from_quote()

3. Função: create_delivery_from_quote (CORRIGIDA! ✨)
   ├─ Cria entrega (status='open')
   ├─ Adiciona produtos DIRETOS do orçamento
   ├─ EXPANDE composições e adiciona TODOS os produtos componentes
   └─ Estoque descontado IMEDIATAMENTE!

4. View: product_stock_view
   └─ Calcula: Produção Para Estoque - Entregas Ativas
   └─ Resultado: Estoque disponível PRECISO
```

## O Que Foi Corrigido

### Arquivo de Migration

**Nome:** `fix_delivery_creation_expand_compositions.sql`

**Data:** 28/01/2026

### Mudanças na Função `create_delivery_from_quote()`

#### 1. Verificação de Estoque Expandida

**ANTES:**
```sql
-- Verificava apenas produtos diretos
FOR v_item IN
  SELECT qi.* FROM quote_items qi
  WHERE qi.item_type = 'product'
```

**DEPOIS:**
```sql
-- Verifica produtos diretos
FOR v_item IN
  SELECT qi.* FROM quote_items qi
  WHERE qi.item_type = 'product'

-- NOVO: Verifica produtos dentro de composições
FOR v_item IN
  SELECT qi.* FROM quote_items qi
  WHERE qi.item_type = 'composition'
  LOOP
    -- Para cada produto da composição
    FOR v_composition_item IN
      SELECT ci.product_id, ci.quantity
      FROM composition_items ci
      WHERE ci.item_type = 'product'
```

#### 2. Criação de Itens de Entrega Expandida

**ANTES:**
```sql
-- Adicionava apenas produtos diretos
INSERT INTO delivery_items (...)
SELECT ... FROM quote_items qi
WHERE qi.item_type = 'product'
```

**DEPOIS:**
```sql
-- Adiciona produtos diretos
INSERT INTO delivery_items (...)
SELECT ... FROM quote_items qi
WHERE qi.item_type = 'product'

-- NOVO: Expande e adiciona produtos de composições
FOR v_item IN (composições) LOOP
  INSERT INTO delivery_items (
    delivery_id,
    product_id,
    quantity,
    is_from_composition,        -- true
    parent_composition_id,       -- ID da composição
    parent_composition_name,     -- Nome da composição
    notes                        -- 'Produto da composição "X"'
  )
  SELECT ... FROM composition_items ci
  WHERE ci.composition_id = v_item.composition_id
    AND ci.item_type = 'product'
END LOOP
```

#### 3. Campos Adicionados aos Itens de Entrega

Produtos de composições agora são marcados com:

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `is_from_composition` | `true` | Indica que veio de composição |
| `parent_composition_id` | UUID | ID da composição pai |
| `parent_composition_name` | TEXT | Nome da composição para exibição |
| `notes` | TEXT | Detalhes da composição e quantidades |

## Como Funciona Agora

### Exemplo Prático: Orçamento com Composição

**Configuração:**

1. **Produto:** Vigota Pré-Moldada
   - Estoque atual: 1000 unidades

2. **Composição:** Kit Laje 10m²
   - Contém: 50 vigotas por kit

3. **Orçamento:** Cliente solicita 10 kits
   - Necessário: 10 × 50 = 500 vigotas

### Passo a Passo

#### Momento 1: Aprovação do Orçamento

```sql
-- Sistema verifica estoque
Estoque disponível: 1000 vigotas
Necessário: 500 vigotas (10 kits × 50)
Resultado: ✅ Estoque suficiente!

-- Sistema cria entrega
INSERT INTO deliveries (status='open') → delivery_id = 'abc-123'

-- Sistema EXPANDE composição e adiciona produtos
INSERT INTO delivery_items (
  delivery_id = 'abc-123',
  product_id = 'vigota-001',
  quantity = 500,
  loaded_quantity = 0,
  is_from_composition = true,
  parent_composition_id = 'kit-laje-001',
  parent_composition_name = 'Kit Laje Nervurada 10m²',
  notes = 'Produto da composição "Kit Laje..." (50 por kit × 10 kits)'
)
```

#### Momento 2: Após Criação da Entrega

```sql
-- View de estoque calcula automaticamente
SELECT * FROM product_stock_view WHERE product_id = 'vigota-001';

Resultado:
  total_produced: 1000
  total_delivered: 500   ← Contabiliza entrega (mesmo com loaded=0)
  available_stock: 500   ← 1000 - 500 = 500 disponíveis
```

#### Momento 3: Tentativa de Nova Venda

```
Novo cliente solicita 600 vigotas
Sistema verifica estoque: 500 disponíveis
Necessário: 600
Resultado: ❌ Estoque insuficiente!
✅ IMPEDIU DUPLA VENDA!
```

## Comparação Lado a Lado

| Aspecto | ANTES (Incorreto) | DEPOIS (Correto) |
|---------|-------------------|------------------|
| **Produtos diretos** | ✅ Incluídos na entrega | ✅ Incluídos na entrega |
| **Produtos de composições** | ❌ NÃO incluídos | ✅ Incluídos (expandidos) |
| **Estoque descontado** | ❌ Só produtos diretos | ✅ Todos os produtos |
| **Dupla venda possível?** | 🔴 SIM (problema!) | ✅ NÃO (corrigido!) |
| **Controle preciso** | ❌ Impreciso | ✅ Preciso |
| **Rastreabilidade** | ❌ Limitada | ✅ Completa com flags |

## Verificação da Correção

### Query 1: Ver Entregas com Produtos de Composições

```sql
SELECT
  d.id as delivery_id,
  c.name as customer_name,
  di.quantity,
  p.name as product_name,
  di.is_from_composition,
  di.parent_composition_name,
  di.notes
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
JOIN delivery_items di ON di.delivery_id = d.id
JOIN products p ON p.id = di.product_id
WHERE d.auto_created = true
ORDER BY d.created_at DESC, di.is_from_composition DESC;
```

**Resultado esperado:**
- Entregas mostram TANTO produtos diretos quanto de composições
- Produtos de composições têm `is_from_composition = true`
- Campo `parent_composition_name` preenchido

### Query 2: Ver Estoque Detalhado

```sql
SELECT
  p.name as product_name,
  psv.total_produced,
  psv.total_delivered,
  psv.available_stock,
  -- Detalhamento
  psdv.total_in_open_deliveries,
  psdv.total_in_progress_deliveries,
  psdv.total_in_closed_deliveries
FROM products p
LEFT JOIN product_stock_view psv ON psv.product_id = p.id
LEFT JOIN product_stock_detailed_view psdv ON psdv.product_id = p.id
WHERE p.name ILIKE '%vigota%'
ORDER BY p.name;
```

**Resultado esperado:**
- `total_delivered` inclui produtos de composições
- `available_stock` reflete reservas de composições
- Números fazem sentido com vendas reais

### Query 3: Auditoria de Composições em Entregas

```sql
SELECT
  q.id as quote_id,
  q.created_at::date as quote_date,
  qi.item_type,
  COALESCE(p.name, c.name) as item_name,
  qi.quantity as quote_qty,
  -- Produtos na entrega
  (
    SELECT COUNT(DISTINCT di.id)
    FROM deliveries del
    JOIN delivery_items di ON di.delivery_id = del.id
    WHERE del.quote_id = q.id
      AND (di.quote_item_id = qi.id OR di.parent_composition_id = qi.composition_id)
  ) as delivery_items_count
FROM quotes q
JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN products p ON p.id = qi.product_id
LEFT JOIN compositions c ON c.id = qi.composition_id
WHERE q.status = 'approved'
ORDER BY q.created_at DESC;
```

**Resultado esperado:**
- Itens tipo 'composition' têm `delivery_items_count > 0`
- Significa que composições foram expandidas

## Testes Recomendados

### Teste 1: Orçamento com Composição Simples

1. **Criar composição:**
   - Nome: "Kit Teste"
   - Adicionar: 10x Produto A

2. **Criar orçamento:**
   - Cliente: Teste
   - Item: 5x "Kit Teste"

3. **Verificar estoque ANTES:**
   - Produto A disponível: 100 unidades

4. **Aprovar orçamento**

5. **Verificar estoque DEPOIS:**
   - Produto A disponível: 50 unidades (100 - 50)
   - ✅ Descontou corretamente: 5 kits × 10 produtos = 50

6. **Verificar entrega:**
   - Deve ter 1 item: 50x Produto A
   - `is_from_composition = true`
   - `parent_composition_name = 'Kit Teste'`

### Teste 2: Orçamento Misto (Produtos + Composições)

1. **Criar orçamento:**
   - 20x Produto B (direto)
   - 3x "Kit Teste" (composição com 10x Produto A)

2. **Aprovar orçamento**

3. **Verificar entrega:**
   - Item 1: 20x Produto B (is_from_composition=false)
   - Item 2: 30x Produto A (is_from_composition=true)

4. **Verificar estoques:**
   - Produto B: descontou 20
   - Produto A: descontou 30

### Teste 3: Estoque Insuficiente com Composição

1. **Configurar:**
   - Produto C estoque: 10 unidades
   - Composição "Kit Grande": contém 15x Produto C

2. **Criar orçamento:**
   - 1x "Kit Grande"

3. **Aprovar orçamento**

4. **Resultado esperado:**
   - ❌ Entrega NÃO criada (estoque insuficiente)
   - ✅ `awaiting_production = true`
   - ✅ Ordem de produção criada: 5 unidades de Produto C

## Impacto no Sistema

### Módulos Afetados

| Módulo | Impacto | Status |
|--------|---------|--------|
| **Orçamentos** | Nenhum | ✅ Compatível |
| **Composições** | Expansão automática | ✅ Funcionando |
| **Entregas** | Itens expandidos | ✅ Corrigido |
| **Estoque** | Cálculo preciso | ✅ Preciso |
| **Ordens de Produção** | Nenhum | ✅ Compatível |

### Retrocompatibilidade

✅ **Entregas antigas:** Não são afetadas (mantém estrutura existente)

✅ **Orçamentos antigos:** Funcionam normalmente

✅ **Novos orçamentos:** Usam nova lógica automaticamente

## Monitoramento

### Indicadores de Saúde

Execute periodicamente para garantir que está funcionando:

```sql
-- Verificar se composições estão sendo expandidas
SELECT
  COUNT(*) FILTER (WHERE is_from_composition = false) as produtos_diretos,
  COUNT(*) FILTER (WHERE is_from_composition = true) as produtos_composicoes,
  COUNT(DISTINCT parent_composition_id) as composicoes_expandidas
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
WHERE d.created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND d.auto_created = true;
```

**Resultado esperado:**
- `produtos_composicoes > 0` se houver orçamentos com composições
- `composicoes_expandidas > 0` confirma expansão funcionando

## Status Final

| Item | Status |
|------|--------|
| Problema identificado | ✅ Sim |
| Causa raiz encontrada | ✅ Função não expandia composições |
| Solução implementada | ✅ Migration aplicada |
| Testes recomendados | ✅ Documentados |
| Retrocompatibilidade | ✅ Mantida |
| Estoque preciso | ✅ Corrigido |
| Dupla venda impedida | ✅ Corrigido |

## Resumo Executivo

✅ **CORRIGIDO:** Produtos de composições agora são incluídos automaticamente nas entregas

✅ **ESTOQUE:** Descontado corretamente para todos os produtos (diretos + composições)

✅ **SEGURANÇA:** Impossível vender o mesmo estoque duas vezes

✅ **RASTREABILIDADE:** Produtos de composições marcados com flags para identificação

✅ **COMPATÍVEL:** Não afeta entregas ou orçamentos existentes

O sistema agora oferece controle de estoque preciso e confiável, mesmo com composições complexas!
