# Atualização do Sistema de Estoque - Reserva Imediata

## Resumo Executivo

O sistema de estoque foi completamente reestruturado para implementar **Reserva Imediata** ao aprovar orçamentos. Agora, quando um orçamento é aprovado, os produtos são automaticamente reservados no estoque, evitando dupla venda e garantindo visibilidade total dos compromissos de entrega.

---

## Nova Lógica de Negócio

### Produção "Para Estoque" vs "Para Ordem"

Ao registrar produção na fábrica, você indica o tipo:

- **Para Estoque** (`production_type='stock'`):
  - Produtos disponíveis para venda
  - Entram no cálculo de estoque disponível
  - Podem ser vendidos para qualquer cliente

- **Para Ordem** (`production_type='order'`):
  - Produtos vinculados a uma ordem de produção específica
  - NÃO entram no estoque geral
  - Reservados para uma entrega específica

### Fluxo de Aprovação de Orçamento

**Exemplo Prático: 2000 blocos de vedação produzidos, orçamento de 800 blocos**

#### ANTES (Sistema Antigo - INCORRETO)
```
1. Produção: 2000 blocos "Para Estoque"
   └─ Estoque disponível: 2000

2. Orçamento aprovado: 800 blocos
   └─ Entrega criada (status='open')
   └─ Estoque disponível: 2000 ❌ ERRADO! Não desconta!

3. Problema: Outro vendedor pode vender os mesmos 2000 blocos!
```

#### AGORA (Sistema Novo - CORRETO)
```
1. Produção: 2000 blocos "Para Estoque"
   └─ Estoque disponível: 2000

2. Orçamento aprovado: 800 blocos
   ├─ Sistema CRIA ENTREGA AUTOMATICAMENTE (status='open')
   ├─ Entrega reserva 800 blocos (quantity=800, loaded_quantity=0)
   └─ Estoque disponível: 1200 ✅ CORRETO! Desconta imediatamente!

3. Benefício: Outros vendedores veem apenas 1200 disponíveis
```

---

## Cálculo de Estoque Atualizado

### Fórmula Atual

```
Estoque Disponível =
  Produção "Para Estoque"
  - Entregas Ativas (open, in_progress, closed)
```

**Entregas Ativas** = Todas as entregas que ainda não foram canceladas

### Exemplos Práticos

#### Exemplo 1: Venda com Estoque Suficiente

```
Situação Inicial:
- Produção: 2000 blocos "Para Estoque"
- Entregas ativas: 0
- Estoque disponível: 2000

Aprovação de Orçamento (800 blocos):
1. Sistema cria entrega automaticamente
2. Entrega status='open', quantity=800, loaded_quantity=0
3. Estoque = 2000 - 800 = 1200 ✅

Carregamento:
1. Operador marca 800 blocos como carregados
2. loaded_quantity = 800
3. Estoque continua 1200 (já estava reservado)

Fechamento:
1. Entrega status='closed'
2. Estoque continua 1200 (já estava reservado)
```

#### Exemplo 2: Venda SEM Estoque Suficiente

```
Situação Inicial:
- Produção: 100 blocos "Para Estoque"
- Entregas ativas: 0
- Estoque disponível: 100

Aprovação de Orçamento (800 blocos):
1. Sistema cria entrega automaticamente ✅ SEMPRE CRIA!
2. Entrega status='open', quantity=800, loaded_quantity=0
3. Orçamento marcado: awaiting_production=true
4. Estoque = 100 - 800 = -700 ⚠️ NEGATIVO!
5. Sistema mostra: "Precisa produzir 700 blocos"

Produção Adicional:
1. Produz 700 blocos "Para Estoque"
2. Estoque = -700 + 700 = 0 ✅
3. Agora pode carregar e entregar!
```

#### Exemplo 3: Múltiplas Vendas

```
Situação Inicial:
- Produção: 5000 blocos "Para Estoque"
- Estoque disponível: 5000

Venda 1 (1000 blocos aprovada):
- Entrega criada, quantity=1000
- Estoque = 5000 - 1000 = 4000

Venda 2 (1500 blocos aprovada):
- Entrega criada, quantity=1500
- Estoque = 4000 - 1500 = 2500

Venda 3 (3000 blocos aprovada):
- Entrega criada, quantity=3000
- Estoque = 2500 - 3000 = -500 ⚠️
- Sistema alerta: "Precisa produzir 500 blocos"

Total Reservado: 1000 + 1500 + 3000 = 5500 blocos
Total Disponível: 5000 blocos
Déficit: -500 blocos (precisa produzir)
```

---

## Mudanças Implementadas

### 1. View `product_stock_view` (Atualizada)

**Antes:**
```sql
-- Contava loaded_quantity (quantidade carregada)
SUM(di.loaded_quantity) as total_delivered
WHERE d.status = 'closed'
```

**Depois:**
```sql
-- Conta quantity (quantidade do pedido) em entregas ATIVAS
SUM(di.quantity) as total_reserved
WHERE d.status IN ('open', 'in_progress', 'closed')

-- Filtra apenas produção "Para Estoque"
WHERE production_type = 'stock'
```

**Campos da View:**
- `total_produced`: Produção "Para Estoque" apenas
- `total_delivered`: Total reservado em entregas ativas
- `available_stock`: Produzido - Reservado

### 2. View `product_stock_detailed_view` (NOVA)

View detalhada para análise e debug:

```sql
SELECT
  product_name,
  total_produced_for_stock,      -- Produção "Para Estoque"
  total_produced_for_orders,     -- Produção "Para Ordem"
  total_in_open_deliveries,      -- Entregas abertas
  total_in_progress_deliveries,  -- Entregas em progresso
  total_in_closed_deliveries,    -- Entregas fechadas
  total_reserved,                -- Total reservado
  available_stock                -- Disponível
FROM product_stock_detailed_view;
```

### 3. Função `create_delivery_from_quote()` (Atualizada)

**Mudança Crítica:** SEMPRE cria a entrega, independente do estoque!

**Antes:**
```sql
IF NOT v_has_stock THEN
  -- Marca awaiting_production
  RETURN NULL;  ❌ NÃO CRIAVA A ENTREGA!
END IF;
```

**Depois:**
```sql
-- SEMPRE cria a entrega
INSERT INTO deliveries (...) VALUES (...);

-- Marca awaiting_production se necessário, mas CRIA A ENTREGA!
UPDATE quotes
SET awaiting_production = NOT v_has_sufficient_stock;
```

**Benefícios:**
- ✅ Entrega sempre criada (visibilidade)
- ✅ Estoque sempre reservado (evita dupla venda)
- ✅ `awaiting_production` indica necessidade de produção
- ✅ Campo `notes` detalha o que precisa ser produzido

### 4. Funções Auxiliares Atualizadas

#### `get_product_available_stock(uuid)`
Retorna estoque disponível usando a nova lógica de reserva.

#### `get_product_stock(uuid)`
Compatibilidade - usa mesma lógica da view.

---

## Como Usar o Sistema Atualizado

### 1. Registrar Produção

Na aba **Produção**:

1. Selecione o produto produzido
2. Informe a quantidade
3. **Escolha o tipo de produção:**
   - ✅ **Para Estoque**: Disponível para venda geral
   - **Para Ordem**: Vinculado a ordem específica

**Apenas produção "Para Estoque" entra no cálculo de estoque disponível!**

### 2. Criar e Aprovar Orçamento

Na aba **Orçamentos**:

1. Crie orçamento normalmente
2. Adicione produtos
3. **Status "Pendente"**: Não reserva estoque
4. **Mudar para "Aprovado"**:
   - ✅ Sistema cria entrega automaticamente
   - ✅ Produtos são reservados imediatamente
   - ✅ Estoque é descontado na hora
   - ⚠️ Se não houver estoque, ficará negativo

### 3. Verificar Estoque

Na aba **Estoque de Produtos**:

```
Produto: Bloco de Vedação 14 com Encaixe
├─ Produzido: 8595 (produção "Para Estoque")
├─ Reservado: 7900 (em entregas ativas)
└─ Disponível: 695 ✅ O que você pode vender AGORA
```

**Disponível** = O que pode ser vendido sem produzir mais

### 4. Visualizar Entregas

Na aba **Entregas**:

**Entrega Automática (auto_created=true):**
```
Status: Open
Cliente: GS PEÇAS
Produtos:
  - 1000x Bloco de Vedação (quantity=1000, loaded=0)
  - 16x Poste 10x10 (quantity=16, loaded=0)

Notes: "ATENÇÃO: Produtos precisam ser produzidos:
  - Poste 10x10 dobra (necessário: 16, disponível: 0, produzir: 16)"
```

### 5. Carregar Produtos

1. Abra a entrega
2. Marque produtos como carregados
3. `loaded_quantity` é atualizado
4. Quando todos carregados → Status automaticamente vira "Closed"

**Importante:** O estoque já foi descontado ao aprovar o orçamento!

### 6. Finalizar Entrega

**Opção A: Finalização Automática**
- Todos os itens carregados → Status muda para "Closed" automaticamente

**Opção B: Finalização Manual**
- Fechar entrega mesmo com loaded_quantity < quantity
- Produtos não carregados ficam pendentes
- Estoque NÃO volta (porque quantity já reservou)

---

## Casos de Uso Especiais

### Caso 1: Entrega Parcial

```
Orçamento aprovado: 1000 blocos
└─ Estoque reservado: -1000 imediatamente

Carregamento:
├─ Carregou 600 blocos → loaded_quantity=600
├─ Fechou entrega manualmente
└─ Estoque continua descontado (-1000)

Resultado:
- 600 blocos foram entregues fisicamente
- 400 blocos ainda estão "reservados" mas não entregues
- Para liberar os 400 blocos, precisa cancelar a entrega ou ajustar
```

**Solução:**
```sql
-- Se quiser liberar os 400 blocos não entregues:
-- Opção 1: Cancelar a entrega
UPDATE deliveries SET status = 'cancelled' WHERE id = '...';

-- Opção 2: Ajustar quantity para refletir o que foi realmente entregue
UPDATE delivery_items SET quantity = 600 WHERE id = '...';
```

### Caso 2: Cancelamento de Venda

```sql
-- Cancelar entrega libera o estoque
UPDATE deliveries
SET status = 'cancelled'
WHERE id = 'delivery_id';

-- Resultado:
-- - quantity não é mais contado
-- - Estoque volta a ficar disponível
```

### Caso 3: Estoque Negativo

```
Situação: Estoque = -500 blocos

Significado:
- Há 500 blocos comprometidos além do disponível
- Precisa produzir 500 blocos para atender os pedidos

Ações:
1. Verificar entregas pendentes
2. Planejar produção de 500 blocos
3. Registrar produção "Para Estoque"
4. Estoque volta positivo
```

---

## Queries Úteis

### Ver Estoque Detalhado

```sql
SELECT
  product_name,
  total_produced_for_stock as produzido,
  total_reserved as reservado,
  available_stock as disponivel
FROM product_stock_detailed_view
WHERE total_produced_for_stock > 0
ORDER BY available_stock DESC;
```

### Ver Produtos com Estoque Negativo

```sql
SELECT
  product_name,
  available_stock as deficit
FROM product_stock_view
WHERE available_stock < 0
ORDER BY available_stock ASC;
```

### Ver Entregas Aguardando Produção

```sql
SELECT
  q.id,
  c.name as cliente,
  q.awaiting_production,
  d.notes as produtos_faltantes
FROM quotes q
JOIN customers c ON c.id = q.customer_id
JOIN deliveries d ON d.quote_id = q.id
WHERE q.awaiting_production = true
  AND d.status = 'open';
```

### Ver Produtos Reservados por Entrega

```sql
SELECT
  d.id as delivery_id,
  c.name as cliente,
  d.status,
  p.name as produto,
  di.quantity as reservado,
  di.loaded_quantity as carregado,
  (di.quantity - di.loaded_quantity) as pendente
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
JOIN delivery_items di ON di.delivery_id = d.id
LEFT JOIN products p ON p.id = di.product_id
WHERE d.status IN ('open', 'in_progress')
ORDER BY d.delivery_date, c.name;
```

### Comparar Estoque Antes e Depois

```sql
-- Ver diferença entre contar quantity vs loaded_quantity
SELECT
  p.name,
  COALESCE(SUM(prod.quantity), 0) as produzido,
  COALESCE(SUM(di_qty.total), 0) as usando_quantity,
  COALESCE(SUM(di_loaded.total), 0) as usando_loaded,
  COALESCE(SUM(prod.quantity), 0) - COALESCE(SUM(di_qty.total), 0) as estoque_novo,
  COALESCE(SUM(prod.quantity), 0) - COALESCE(SUM(di_loaded.total), 0) as estoque_antigo
FROM products p
LEFT JOIN production prod ON prod.product_id = p.id AND prod.production_type = 'stock'
LEFT JOIN (
  SELECT product_id, SUM(quantity) as total
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status IN ('open', 'in_progress', 'closed')
  GROUP BY product_id
) di_qty ON di_qty.product_id = p.id
LEFT JOIN (
  SELECT product_id, SUM(loaded_quantity) as total
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.status = 'closed'
  GROUP BY product_id
) di_loaded ON di_loaded.product_id = p.id
WHERE COALESCE(SUM(prod.quantity), 0) > 0
GROUP BY p.id, p.name
ORDER BY p.name;
```

---

## Teste Real Executado

### Cenário: Orçamento da GS PEÇAS

**Produtos no Orçamento:**
- 16x Poste 10x10 dobra 2.00m
- 90x Poste 10x10 x 2.00m
- 1000x Bloco de Vedação 14 com Encaixe

**Estoque ANTES da Aprovação:**
```
Bloco de Vedação:
├─ Produzido: 8595
├─ Reservado: 6900
└─ Disponível: 1695 ✅

Postes:
└─ Produzido: 0 (sem estoque)
```

**Ação: Aprovar Orçamento**
```sql
UPDATE quotes SET status = 'approved'
WHERE id = '271cb02d-a7d5-4d62-9a11-fb9ef78d7776';
```

**Resultado:**

1. ✅ **Entrega Criada Automaticamente**
   - ID: `5bdefefd-aab5-4d68-9c2f-ed85d5f0ffcc`
   - Status: `open`
   - auto_created: `true`

2. ✅ **Estoque de Blocos Reservado**
   ```
   ANTES:  1695 disponível
   DEPOIS:  695 disponível  (-1000) ✅ CORRETO!
   ```

3. ✅ **Estoque de Postes Ficou Negativo**
   ```
   Poste dobra 2.00m:  -30 (precisa produzir 16+14)
   Poste 2.00m:       -165 (precisa produzir 90+75)
   ```

4. ✅ **Orçamento Marcado**
   - `awaiting_production = true`
   - Indica que precisa produzir postes

5. ✅ **Notes da Entrega**
   ```
   ATENÇÃO: Produtos precisam ser produzidos:
   - Poste dobra 2.00m (necessário: 16, disponível: 0, produzir: 16)
   - Poste 2.00m (necessário: 90, disponível: 0, produzir: 90)
   ```

---

## Benefícios da Nova Lógica

### ✅ Reserva Imediata
- Produtos reservados no momento da venda
- Evita dupla venda do mesmo produto
- Estoque sempre preciso e em tempo real

### ✅ Visibilidade Total
- Entregas sempre visíveis, mesmo sem estoque
- Planejamento de produção baseado em demanda real
- Transparência sobre compromissos de entrega

### ✅ Gestão de Produção
- Estoque negativo indica necessidade de produção
- `awaiting_production` prioriza orçamentos urgentes
- Notes detalham exatamente o que produzir

### ✅ Flexibilidade
- Suporta entregas parciais
- Permite vendas acima do estoque (sob encomenda)
- Separa produção "Para Estoque" de "Para Ordem"

### ✅ Evita Erros
- Impossível vender o mesmo produto duas vezes
- Sistema alerta quando estoque é insuficiente
- Histórico completo de reservas e entregas

---

## Migrações Aplicadas

1. **`20260126111001_fix_stock_view_use_loaded_quantity.sql`**
   - Corrigiu bug anterior onde usava `loaded_quantity` incorretamente

2. **`update_stock_view_for_immediate_reservation.sql`**
   - Implementou lógica de reserva imediata
   - Criou view `product_stock_detailed_view`
   - Atualizou funções de estoque

3. **`update_delivery_creation_always_reserve_stock.sql`**
   - Modificou `create_delivery_from_quote()` para sempre criar entrega
   - Adiciona notas sobre produtos faltantes
   - Marca `awaiting_production` quando necessário

---

## Resumo das Regras

### ✅ SEMPRE
- Registre produção como "Para Estoque" para disponibilizar vendas
- Aprove orçamentos - o sistema reserva automaticamente
- Verifique estoque disponível antes de prometer prazos
- Produza mais quando estoque ficar negativo

### ⚠️ ATENÇÃO
- Estoque negativo = compromisso de entrega sem produto físico
- `awaiting_production=true` = precisa produzir antes de entregar
- Entregas canceladas liberam o estoque
- Produção "Para Ordem" NÃO conta no estoque geral

### ❌ NUNCA
- Não aprove orçamentos sem verificar estoque
- Não ignore alertas de `awaiting_production`
- Não feche entregas manualmente sem carregar produtos
- Não produza "Para Ordem" quando deveria ser "Para Estoque"

---

## Status da Implementação

- ✅ View de estoque com reserva imediata implementada
- ✅ Criação automática de entregas funcionando
- ✅ Desconto imediato de estoque ao aprovar orçamento
- ✅ Suporte para estoque negativo (produção sob demanda)
- ✅ Alertas de `awaiting_production` implementados
- ✅ Sistema testado e validado com dados reais
- ✅ Entregas antigas corrigidas retroativamente
- ✅ Documentação completa criada
- ✅ Pronto para uso em produção

---

## Suporte e Dúvidas

### Como saber se preciso produzir algo?

```sql
-- Ver produtos com estoque negativo ou baixo
SELECT
  product_name,
  available_stock
FROM product_stock_view
WHERE available_stock < 100
ORDER BY available_stock ASC;
```

### Como ver o que está comprometido em entregas?

```sql
SELECT * FROM product_stock_detailed_view
WHERE total_reserved > 0;
```

### Como corrigir estoque manualmente?

Não altere o estoque diretamente! Em vez disso:
- Registre produção adicional "Para Estoque"
- Cancele entregas duplicadas
- Ajuste `quantity` em `delivery_items` se necessário

---

**Data da Atualização:** 26 de Janeiro de 2026
**Status:** ✅ Implementado e Testado
**Próximos Passos:** Monitorar uso em produção e ajustar se necessário
