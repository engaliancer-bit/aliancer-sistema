# Correção: Progresso das Ordens de Produção

## Problema Identificado

Quando você vinculava produções a uma ordem de produção:
- A barra de progresso não avançava
- O contador de unidades produzidas não atualizava
- O status da ordem não mudava automaticamente

**Exemplo Prático**: Ordem #26 do cliente Sidinei Strack
- Total: 6 pilares
- Produzido: 6 pilares (em 3 produções vinculadas)
- Mas o sistema mostrava: 0 produzidos, 0% de progresso

## Causa do Problema

O campo `produced_quantity` na tabela `production_orders` não estava sendo atualizado automaticamente quando uma produção era vinculada via `production_order_id`.

## Solução Implementada

Criei um **trigger automático** que:

1. Monitora mudanças na tabela `production`
2. Quando uma produção é vinculada/desvinculada de uma ordem:
   - Recalcula `produced_quantity` somando todas as produções vinculadas
   - Atualiza `remaining_quantity` (total - produzido)
   - Ajusta o `status` automaticamente:
     - `open` → `in_progress` quando começar a produzir
     - `in_progress` → `completed` quando finalizar (remaining = 0)

3. **Atualizou TODOS os dados existentes** para corrigir ordens antigas

## Verificação da Correção

### Ordem #26 - Sidinei Strack (ANTES x DEPOIS)

| Campo | ANTES | DEPOIS | Status |
|-------|-------|--------|--------|
| Total | 6 un. | 6 un. | - |
| Produzido | **0 un.** ❌ | **6 un.** ✅ | Corrigido |
| Restante | **6 un.** ❌ | **0 un.** ✅ | Corrigido |
| Status | **open** ❌ | **completed** ✅ | Corrigido |
| Progresso | **0%** ❌ | **100%** ✅ | Corrigido |

### Produções Vinculadas à Ordem #26

| Data | Quantidade | Status |
|------|-----------|--------|
| 27/01/2026 | 2 pilares | ✅ Contabilizado |
| 26/01/2026 | 2 pilares | ✅ Contabilizado |
| 23/01/2026 | 2 pilares | ✅ Contabilizado |
| **TOTAL** | **6 pilares** | ✅ **100% completo** |

## Como Testar

### Teste 1: Verificar Ordem Específica

```sql
SELECT
  po.order_number as "Nº Ordem",
  c.name as "Cliente",
  p.name as "Produto",
  po.total_quantity as "Total",
  po.produced_quantity as "Produzido",
  po.remaining_quantity as "Restante",
  po.status as "Status",
  ROUND((po.produced_quantity::numeric / NULLIF(po.total_quantity, 0)::numeric * 100), 0) || '%' as "Progresso"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.order_number = 26;  -- Altere o número da ordem
```

**Resultado Esperado para Ordem #26**:
```
Nº Ordem: 26
Cliente: Sidinei André Strack
Produto: Pilar pré moldado de 18x25 - H=4,50
Total: 6
Produzido: 6
Restante: 0
Status: completed
Progresso: 100%
```

### Teste 2: Ver Produções Vinculadas

```sql
SELECT
  pr.production_date as "Data",
  p.name as "Produto",
  pr.quantity as "Quantidade",
  po.order_number as "Nº Ordem",
  c.name as "Cliente"
FROM production pr
JOIN products p ON p.id = pr.product_id
JOIN production_orders po ON po.id = pr.production_order_id
LEFT JOIN customers c ON c.id = po.customer_id
WHERE po.order_number = 26  -- Altere o número da ordem
ORDER BY pr.production_date DESC;
```

### Teste 3: Simular Nova Produção (Teste Real do Trigger)

**IMPORTANTE**: Este teste é apenas para demonstração. Ajuste os IDs conforme sua necessidade.

```sql
-- Passo 1: Ver estado ANTES
SELECT
  order_number,
  produced_quantity,
  remaining_quantity,
  status
FROM production_orders
WHERE order_number = 23;  -- Ordem exemplo

-- Passo 2: Vincular uma produção à ordem
-- (Substitua os IDs pelos valores reais do seu sistema)
INSERT INTO production (
  product_id,
  quantity,
  production_type,
  production_order_id,
  production_date
) VALUES (
  'ID-DO-PRODUTO',
  2,
  'order',
  'ID-DA-ORDEM',
  CURRENT_DATE
) RETURNING id;

-- Passo 3: Ver estado DEPOIS (deve ter atualizado automaticamente!)
SELECT
  order_number,
  produced_quantity,  -- Deve ter aumentado em 2
  remaining_quantity, -- Deve ter diminuído em 2
  status              -- Deve ter mudado para 'in_progress'
FROM production_orders
WHERE order_number = 23;

-- Resultado esperado:
-- produced_quantity: aumentou
-- remaining_quantity: diminuiu
-- status: mudou para 'in_progress'
```

### Teste 4: Verificar Todas as Ordens com Progresso

```sql
SELECT
  po.order_number as "Ordem",
  c.name as "Cliente",
  SUBSTRING(p.name, 1, 30) as "Produto",
  po.total_quantity as "Total",
  po.produced_quantity as "Prod.",
  po.remaining_quantity as "Rest.",
  po.status as "Status",
  ROUND((po.produced_quantity::numeric / NULLIF(po.total_quantity, 0)::numeric * 100), 0) as "Prog%"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.produced_quantity > 0
ORDER BY po.order_number DESC;
```

## Comportamento Automático

### Quando Você Vincula uma Produção

**No componente de Produção Diária**, ao registrar uma produção e vincular a uma ordem:

1. Sistema registra a produção na tabela `production` com `production_order_id` preenchido
2. **TRIGGER AUTOMÁTICO**:
   - Calcula total produzido para aquela ordem
   - Atualiza `produced_quantity`
   - Atualiza `remaining_quantity`
   - Muda status para `in_progress` se necessário
3. Componente de Ordens de Produção mostra:
   - Barra de progresso atualizada ✅
   - Contador de unidades produzidas correto ✅
   - Status atualizado ✅

### Quando Você Altera uma Produção

**Cenário 1**: Altera a quantidade de uma produção vinculada
```sql
UPDATE production
SET quantity = 5  -- Era 2, agora é 5
WHERE id = 'ID-DA-PRODUCAO';

-- Resultado: Ordem atualiza automaticamente
-- produced_quantity aumenta em 3 (diferença)
```

**Cenário 2**: Desvincula uma produção de uma ordem
```sql
UPDATE production
SET production_order_id = NULL  -- Remove vinculação
WHERE id = 'ID-DA-PRODUCAO';

-- Resultado: Ordem atualiza automaticamente
-- produced_quantity diminui
-- remaining_quantity aumenta
```

**Cenário 3**: Vincula produção existente a uma ordem
```sql
UPDATE production
SET
  production_order_id = 'ID-DA-ORDEM',
  production_type = 'order'
WHERE id = 'ID-DA-PRODUCAO';

-- Resultado: Ordem atualiza automaticamente
-- produced_quantity aumenta
-- remaining_quantity diminui
```

### Quando Você Deleta uma Produção

```sql
DELETE FROM production
WHERE id = 'ID-DA-PRODUCAO';

-- Resultado: Ordem vinculada atualiza automaticamente
-- produced_quantity diminui
-- remaining_quantity aumenta
```

## Queries Úteis

### Ver Ordens por Status

```sql
-- Ordens completas (100%)
SELECT
  po.order_number,
  c.name,
  p.name,
  po.produced_quantity || '/' || po.total_quantity as "Progresso"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.status = 'completed'
ORDER BY po.order_number DESC
LIMIT 10;

-- Ordens em andamento
SELECT
  po.order_number,
  c.name,
  p.name,
  po.produced_quantity || '/' || po.total_quantity as "Progresso",
  ROUND((po.produced_quantity::numeric / po.total_quantity::numeric * 100), 0) || '%' as "Perc"
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.status = 'in_progress'
ORDER BY po.order_number;

-- Ordens abertas (sem produção)
SELECT
  po.order_number,
  c.name,
  p.name,
  po.total_quantity
FROM production_orders po
LEFT JOIN customers c ON c.id = po.customer_id
JOIN products p ON p.id = po.product_id
WHERE po.status = 'open'
ORDER BY po.order_number;
```

### Auditoria: Comparar Valores

```sql
-- Verificar se produced_quantity está correto
SELECT
  po.order_number,
  po.produced_quantity as "Sistema",
  COALESCE((
    SELECT SUM(quantity)
    FROM production
    WHERE production_order_id = po.id
  ), 0) as "Real",
  CASE
    WHEN po.produced_quantity = COALESCE((
      SELECT SUM(quantity)
      FROM production
      WHERE production_order_id = po.id
    ), 0) THEN '✅ OK'
    ELSE '❌ DIVERGÊNCIA'
  END as "Status"
FROM production_orders po
WHERE po.produced_quantity > 0
ORDER BY po.order_number;
```

## Resumo da Correção

| Item | Status |
|------|--------|
| Trigger criado | ✅ Ativo |
| Função de cálculo | ✅ Funcionando |
| Dados existentes | ✅ Corrigidos |
| Ordem #26 Sidinei | ✅ 100% correto |
| Teste realizado | ✅ Validado |
| Automação | ✅ Funcionando |

## O Que Mudou no Sistema

### ANTES (Comportamento Antigo)
1. Você registrava produção e vinculava a uma ordem
2. Campo `produced_quantity` ficava em 0
3. Barra de progresso não avançava
4. Você tinha que atualizar manualmente

### DEPOIS (Comportamento Atual)
1. Você registra produção e vincula a uma ordem
2. **Sistema atualiza automaticamente**:
   - `produced_quantity` aumenta
   - `remaining_quantity` diminui
   - Status muda automaticamente
   - Barra de progresso avança
3. **Nenhuma ação manual necessária!**

## Importante

- ✅ Todas as ordens antigas foram corrigidas automaticamente
- ✅ Novas produções vinculadas atualizam automaticamente
- ✅ Alterações em produções vinculadas atualizam automaticamente
- ✅ Deleção de produções vinculadas atualiza automaticamente
- ✅ Sistema totalmente automático, sem necessidade de intervenção manual

## Próximas Ações

1. Abra o componente "Ordens de Produção"
2. Verifique a ordem #26 do cliente Sidinei Strack
3. Confirme que mostra:
   - 6/6 unidades produzidas
   - Barra de progresso em 100%
   - Status "Concluída"
4. Teste registrar novas produções vinculadas a ordens
5. Verifique que o progresso atualiza automaticamente

**O problema foi completamente corrigido!** 🎉
