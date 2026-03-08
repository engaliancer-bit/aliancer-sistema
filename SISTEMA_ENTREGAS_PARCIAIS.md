# Sistema de Entregas Parciais Automáticas

## Resumo Executivo

Implementado sistema de entregas parciais que permite dividir automaticamente uma entrega quando o caminhão não consegue transportar todos os itens de uma só vez. O sistema fecha a entrega atual com os itens carregados e cria automaticamente uma nova entrega com os itens restantes.

---

## Problema Resolvido

### Cenário Real

Um cliente aprovou um orçamento de **1500 blocos**, mas o caminhão só consegue carregar **1200 blocos** por viagem. O que fazer com os **300 blocos restantes**?

**ANTES (Problema):**
- ❌ Teria que finalizar a entrega manualmente
- ❌ Perderia controle dos 300 blocos restantes
- ❌ Precisaria criar manualmente uma nova entrega
- ❌ Risco de esquecer ou duplicar itens

**AGORA (Solução):**
- ✅ Edita a quantidade carregada para 1200 blocos
- ✅ Clica em "Confirmar Carregamento Parcial"
- ✅ Sistema fecha a entrega automaticamente com 1200 blocos
- ✅ Sistema cria nova entrega automaticamente com 300 blocos
- ✅ Controle total e histórico completo

---

## Como Funciona

### Fluxo Completo

```
┌─────────────────────────────────────────────┐
│  1. ORÇAMENTO APROVADO: 1500 blocos         │
│     └─ Entrega criada automaticamente       │
│        quantity = 1500, loaded_quantity = 0 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  2. CARREGAMENTO DO CAMINHÃO                │
│     └─ Operador marca: loaded_quantity = 1200│
│     └─ Faltam: 300 blocos                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  3. CONFIRMAR CARREGAMENTO PARCIAL          │
│     └─ Operador clica no botão roxo         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  4. SISTEMA AUTOMATICAMENTE:                │
│     ├─ Fecha Entrega #1:                    │
│     │  └─ Status: closed                    │
│     │  └─ Itens: 1200 blocos entregues      │
│     │                                        │
│     └─ Cria Entrega #2:                     │
│        └─ Status: open                      │
│        └─ Itens: 300 blocos pendentes       │
│        └─ Referência à entrega original     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  5. PRÓXIMO CARREGAMENTO                    │
│     └─ Operador carrega os 300 blocos       │
│     └─ Finaliza normalmente                 │
└─────────────────────────────────────────────┘
```

---

## Interface do Usuário

### Tela de Carregamento

Quando você está carregando uma entrega, a interface mostra:

1. **Lista de Itens com Controle de Quantidade:**
   ```
   ┌─────────────────────────────────────────┐
   │ Bloco de Vedação 14 com Encaixe        │
   │                                         │
   │ Quantidade Pedida: 1500                 │
   │ Carregado: [____1200____] 🔄           │
   │                                         │
   │ [Marcar Carregado] [Editar Quantidade] │
   └─────────────────────────────────────────┘
   ```

2. **Botão de Carregamento Parcial (Roxo):**
   ```
   ┌─────────────────────────────────────────┐
   │ 🚚 Confirmar Carregamento Parcial       │
   │                                         │
   │ ⚡ O que acontecerá:                    │
   │ • Fecha esta entrega com itens carregados│
   │ • Cria automaticamente nova entrega     │
   │   com os itens restantes                │
   │ • Ideal quando caminhão não comporta    │
   │   todos os itens                        │
   └─────────────────────────────────────────┘
   ```

3. **Outras Opções:**
   - **Salvar e Continuar Depois:** Mantém entrega aberta
   - **Finalizar Entrega Agora:** Fecha sem criar nova entrega

---

## Exemplo Prático - Teste Real

### Cenário: Orçamento GS PEÇAS

**Orçamento Aprovado:**
- 1000x Blocos de Vedação 14
- 16x Postes 10x10 dobra
- 90x Postes 10x10 normais

### Passo 1: Carregamento Parcial

**Operador decidiu carregar apenas os blocos:**
```sql
-- Marcou 600 blocos como carregados
UPDATE delivery_items
SET loaded_quantity = 600
WHERE product_id = 'bloco_vedacao' AND delivery_id = 'entrega_1';

-- Postes não foram carregados (loaded_quantity = 0)
```

### Passo 2: Confirmação

**Chamou a função:**
```sql
SELECT confirm_partial_delivery('entrega_1');
-- Retorno: 'nova_entrega_id' = entrega_2
```

### Passo 3: Resultado

**Entrega Original (#1) - FECHADA:**
```
Status: closed
Itens:
  ✅ 600x Blocos de Vedação (quantity=600, loaded=600)
  ✅ 0x Postes dobra (quantity=0, loaded=0) [transferido]
  ✅ 0x Postes normais (quantity=0, loaded=0) [transferido]

Notes: "ENTREGA PARCIAL. Restante transferido para entrega_2"
```

**Nova Entrega (#2) - ABERTA:**
```
Status: open
Parent: entrega_1
Itens:
  📦 400x Blocos de Vedação (quantity=400, loaded=0)
  📦 16x Postes dobra (quantity=16, loaded=0)
  📦 90x Postes normais (quantity=90, loaded=0)

Notes: "Entrega parcial criada automaticamente. Restante da entrega_1"
```

### Passo 4: Estoque Permanece Correto

**Antes e Depois:**
```
Estoque de Blocos:
├─ Produzido: 8595
├─ Reservado: 7900 (não mudou!)
└─ Disponível: 695 (não mudou!)

Porque:
- Estoque já estava reservado ao aprovar orçamento
- Dividir a entrega não afeta o estoque
- O total reservado continua o mesmo (1000 blocos)
```

---

## Função PostgreSQL

### `confirm_partial_delivery(p_delivery_id uuid)`

**Parâmetros:**
- `p_delivery_id`: ID da entrega a ser confirmada parcialmente

**Retorno:**
- UUID da nova entrega criada
- NULL se não houver itens pendentes (entrega completa)

**Lógica:**

1. **Validação:**
   - Verifica se entrega existe
   - Verifica se está aberta (open/in_progress)
   - Identifica itens pendentes (loaded_quantity < quantity)

2. **Se NÃO há itens pendentes:**
   - Fecha a entrega normalmente
   - Retorna NULL

3. **Se HÁ itens pendentes:**
   - Cria nova entrega:
     * Mesmo cliente
     * Mesmo orçamento
     * Status: open
     * auto_created: true
     * parent_delivery_id: entrega original

   - Para cada item pendente:
     * Calcula quantidade restante
     * Cria item na nova entrega
     * Ajusta item original para refletir apenas o carregado
     * Adiciona notas explicativas

   - Fecha entrega original
   - Retorna ID da nova entrega

---

## Campos do Banco de Dados

### Tabela: deliveries

**Novo Campo Adicionado:**

```sql
parent_delivery_id uuid REFERENCES deliveries(id)
```

**Propósito:**
- Rastreia entregas que foram divididas
- Permite ver histórico de entregas parciais
- Cria cadeia de referências entre entregas relacionadas

**Exemplo:**
```
Entrega Original (parent_delivery_id = NULL)
    └─> Entrega Parcial #1 (parent_delivery_id = original)
            └─> Entrega Parcial #2 (parent_delivery_id = parcial_1)
```

### Tabela: delivery_items

**Campos Relevantes:**

```sql
quantity          -- Quantidade total do item nesta entrega
loaded_quantity   -- Quantidade carregada/entregue
notes            -- Observações (inclui info de transferência)
```

---

## View Auxiliar

### `delivery_summary_view`

Mostra resumo de cada entrega:

```sql
SELECT
  delivery_id,
  customer_name,
  status,

  -- Contadores
  total_items,                  -- Total de itens
  items_fully_loaded,           -- Itens completamente carregados
  items_partially_loaded,       -- Itens parcialmente carregados
  items_not_loaded,             -- Itens não carregados

  -- Quantidades
  total_quantity,               -- Quantidade total pedida
  total_loaded,                 -- Quantidade carregada
  total_pending,                -- Quantidade pendente

  -- Status
  percent_loaded,               -- % carregado
  loading_status,               -- empty/not_loaded/partially_loaded/fully_loaded
  can_confirm_partial,          -- Pode confirmar parcial?

  -- Referências
  parent_delivery_id            -- Entrega original (se for parcial)

FROM delivery_summary_view;
```

**Uso:**
```sql
-- Ver entregas que podem ser confirmadas parcialmente
SELECT *
FROM delivery_summary_view
WHERE can_confirm_partial = true;

-- Ver histórico de entregas divididas
SELECT *
FROM delivery_summary_view
WHERE parent_delivery_id IS NOT NULL
ORDER BY parent_delivery_id, created_at;
```

---

## Casos de Uso

### Caso 1: Caminhão Pequeno

**Situação:**
- Orçamento: 2000 blocos
- Capacidade do caminhão: 1200 blocos

**Solução:**
1. Primeira viagem: 1200 blocos → Carregamento parcial
2. Segunda viagem: 800 blocos → Finalizar normalmente

### Caso 2: Produto Faltante

**Situação:**
- Orçamento: 500 blocos + 20 pilares
- Problema: Pilares não estão prontos

**Solução:**
1. Carrega apenas 500 blocos (loaded_quantity dos pilares = 0)
2. Carregamento parcial
3. Nova entrega criada só com os 20 pilares
4. Quando pilares ficarem prontos, carregar e entregar

### Caso 3: Cliente Urgente

**Situação:**
- Cliente precisa urgente de parte do pedido
- Resto pode esperar

**Solução:**
1. Carrega itens urgentes
2. Carregamento parcial
3. Nova entrega com resto fica programada

### Caso 4: Múltiplas Viagens

**Situação:**
- Pedido muito grande: 5000 blocos
- Caminhão: 1500 blocos por viagem

**Solução:**
```
Entrega #1: 1500 blocos → Parcial → Nova entrega com 3500
Entrega #2: 1500 blocos → Parcial → Nova entrega com 2000
Entrega #3: 1500 blocos → Parcial → Nova entrega com 500
Entrega #4: 500 blocos → Finalizar
```

---

## Interface: Como Usar

### Passo a Passo no Sistema

#### 1. Abrir Entrega

Na aba **Entregas**, clique no botão verde (caminhão) da entrega pendente:
```
┌──────────────────────────────────────┐
│ Status: Aguardando    [🚚 Iniciar]  │
└──────────────────────────────────────┘
```

#### 2. Carregar Itens

Para cada item, você pode:

**Opção A: Marcar como totalmente carregado**
```
[✅ Marcar Carregado] ← Marca quantity = loaded_quantity
```

**Opção B: Editar quantidade manualmente**
```
[✏️ Editar Quantidade]
↓
Digite a quantidade carregada: [____1200____]
[Salvar]
```

#### 3. Confirmar Carregamento

Quando terminar de carregar, clique em um dos botões:

```
┌─────────────────────────────────────────────────┐
│ 🚚 Confirmar Carregamento Parcial (ROXO)       │
│ ↓                                               │
│ Fecha esta entrega + Cria nova com o restante  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 💾 Salvar e Continuar Depois (AZUL)            │
│ ↓                                               │
│ Mantém entrega aberta para carregar mais tarde │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ✅ Finalizar Entrega Agora (VERDE)              │
│ ↓                                               │
│ Fecha entrega SEM criar nova (perde restante)  │
└─────────────────────────────────────────────────┘
```

#### 4. Verificar Resultado

Após confirmar carregamento parcial:

```
┌─────────────────────────────────────────────────┐
│ ✅ Carregamento parcial confirmado!             │
│                                                 │
│ Nova entrega criada para os itens restantes    │
│ ID da nova entrega: abc-123-def                │
└─────────────────────────────────────────────────┘
```

A nova entrega aparecerá na aba **Pendentes**.

---

## Queries Úteis

### Ver Entregas Parciais

```sql
-- Entregas que foram divididas
SELECT
  d1.id as entrega_original,
  d1.status as status_original,
  d2.id as entrega_parcial,
  d2.status as status_parcial,
  c.name as cliente
FROM deliveries d1
JOIN deliveries d2 ON d2.parent_delivery_id = d1.id
JOIN customers c ON c.id = d1.customer_id
ORDER BY d1.created_at DESC;
```

### Histórico Completo de Uma Entrega

```sql
-- Ver todas as entregas relacionadas
WITH RECURSIVE delivery_chain AS (
  -- Entrega inicial
  SELECT id, parent_delivery_id, status, 1 as level
  FROM deliveries
  WHERE id = 'entrega_id'

  UNION ALL

  -- Entregas filhas
  SELECT d.id, d.parent_delivery_id, d.status, dc.level + 1
  FROM deliveries d
  JOIN delivery_chain dc ON d.parent_delivery_id = dc.id
)
SELECT * FROM delivery_chain ORDER BY level;
```

### Ver Itens Transferidos

```sql
-- Itens que foram transferidos entre entregas
SELECT
  di.id,
  p.name as produto,
  di.quantity,
  di.loaded_quantity,
  di.notes
FROM delivery_items di
JOIN products p ON p.id = di.product_id
WHERE di.notes ILIKE '%transferido%'
ORDER BY di.created_at DESC;
```

### Resumo de Carregamento

```sql
-- Status de carregamento de todas as entregas abertas
SELECT
  customer_name as cliente,
  loading_status,
  total_quantity as total,
  total_loaded as carregado,
  total_pending as pendente,
  percent_loaded as percentual,
  can_confirm_partial as pode_confirmar_parcial
FROM delivery_summary_view
WHERE status IN ('open', 'in_progress')
ORDER BY delivery_date;
```

---

## Integração com Estoque

### Importante: Estoque NÃO Muda!

O carregamento parcial **NÃO afeta o estoque** porque:

1. **Estoque já foi reservado** ao aprovar o orçamento
2. **Dividir a entrega** apenas reorganiza a logística
3. **Total reservado permanece o mesmo**

### Exemplo:

```
Orçamento aprovado: 1500 blocos
├─ Estoque reservado: -1500 ✅

Carregamento parcial:
├─ Entrega #1: 1200 blocos
├─ Entrega #2: 300 blocos
└─ Estoque reservado: -1500 ✅ (não mudou!)

Motivo:
- Ambas entregas juntas totalizam 1500 blocos
- Sistema apenas dividiu o carregamento
- Reserva total permanece a mesma
```

---

## Vantagens do Sistema

### ✅ Controle Total
- Histórico completo de todas as entregas
- Rastreamento de entregas divididas
- Notas automáticas explicativas

### ✅ Automatização
- Cria nova entrega automaticamente
- Ajusta quantidades automaticamente
- Mantém todas as referências

### ✅ Flexibilidade
- Suporta múltiplas divisões
- Funciona com qualquer tipo de item
- Adaptável a diferentes capacidades de transporte

### ✅ Segurança
- Não perde itens no processo
- Mantém integridade do estoque
- Garante que tudo seja entregue

### ✅ Usabilidade
- Interface clara e intuitiva
- Botão destacado (roxo) para função especial
- Confirmação antes de executar

---

## Diferenças Entre as Opções

### 🟣 Carregamento Parcial (Recomendado)

**Quando usar:**
- Caminhão não comporta todos os itens
- Precisa dividir entrega em múltiplas viagens
- Quer manter controle sobre o que falta

**O que faz:**
- ✅ Fecha entrega atual
- ✅ Cria nova entrega com restante
- ✅ Mantém histórico completo
- ✅ Não perde nenhum item

### 🔵 Salvar e Continuar Depois

**Quando usar:**
- Precisa parar o carregamento temporariamente
- Vai voltar para carregar mais tarde
- Ainda não sabe quantas viagens serão necessárias

**O que faz:**
- ✅ Salva progresso
- ✅ Mantém entrega aberta
- ❌ Não cria nova entrega
- ⏸️ Aguarda você voltar

### 🟢 Finalizar Entrega Agora

**Quando usar:**
- Decidiu não entregar os itens restantes
- Cliente cancelou parte do pedido
- Quer fechar definitivamente

**O que faz:**
- ✅ Fecha entrega imediatamente
- ❌ NÃO cria nova entrega
- ⚠️ Itens não carregados são perdidos
- ⚠️ Use com cuidado!

---

## Logs e Debug

### Mensagens da Função

A função `confirm_partial_delivery()` emite várias mensagens NOTICE úteis para debug:

```sql
NOTICE: Processando confirmação de entrega parcial para delivery abc-123
NOTICE: Itens pendentes detectados. Criando nova entrega para o restante...
NOTICE: Nova entrega xyz-789 criada
NOTICE:   → Transferindo 400.0000 x produto_id para nova entrega
NOTICE: Entrega abc-123 fechada parcialmente. Nova entrega xyz-789 criada
```

### Como Ver Logs no psql

```sql
-- Ativar exibição de NOTICEs
\set VERBOSITY verbose

-- Executar função
SELECT confirm_partial_delivery('delivery_id');

-- Ver todos os logs
```

---

## Migração Aplicada

**Arquivo:** `create_partial_delivery_system.sql`

**Mudanças:**

1. ✅ Adiciona campo `parent_delivery_id` em `deliveries`
2. ✅ Cria função `confirm_partial_delivery(uuid)`
3. ✅ Cria view `delivery_summary_view`
4. ✅ Adiciona índices para performance
5. ✅ Adiciona comentários explicativos

---

## Status da Implementação

- ✅ Função PostgreSQL criada e testada
- ✅ Campo `parent_delivery_id` adicionado
- ✅ View de resumo implementada
- ✅ Interface atualizada com botão roxo
- ✅ Integração frontend-backend completa
- ✅ Testado com dados reais
- ✅ Documentação completa
- ✅ Pronto para uso em produção

---

## Próximos Passos Possíveis (Futuro)

### Melhorias Opcionais

1. **Impressão de Romaneio:**
   - Imprimir lista de itens por entrega
   - Útil para conferência no carregamento

2. **Notificações:**
   - Avisar cliente quando nova entrega for criada
   - WhatsApp ou e-mail automático

3. **Sugestão Inteligente:**
   - Sistema sugere como dividir baseado na capacidade
   - "Seu caminhão comporta X, sugerimos carregar Y"

4. **Relatórios:**
   - Quantas entregas foram divididas no mês
   - Tempo médio entre entregas parciais
   - Produtos que mais geram entregas divididas

---

**Data da Implementação:** 26 de Janeiro de 2026
**Status:** ✅ Implementado, Testado e Pronto para Uso
**Versão:** 1.0
