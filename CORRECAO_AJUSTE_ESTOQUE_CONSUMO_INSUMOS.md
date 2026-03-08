# Correção: Ajuste de Estoque NÃO Deve Consumir Insumos

## Problema Identificado

Quando era feito um ajuste de estoque de produtos na aba "Estoque" (entrada manual), o sistema criava movimentações de consumo de insumos como se fosse uma produção real.

Ao clicar no ícone do olho na aba "Insumos" para verificar as movimentações de um insumo (exemplo: areia industrial), apareciam consumos indevidos causados por ajustes de estoque.

### Por Que Isso É Um Problema?

- **Ajuste de estoque** é uma correção administrativa/contábil
- **NÃO é produção real**, portanto não consome insumos
- Distorce os dados de consumo de materiais
- Impossibilita análises corretas de custo e consumo

## Solução Implementada

### 1. Novo Tipo de Produção: 'adjustment'

Foi adicionado um novo valor para o campo `production_type`:

- **'stock'** - Produção normal para estoque (consome insumos)
- **'order'** - Produção para ordem específica (consome insumos)
- **'adjustment'** - Ajuste manual de estoque (NÃO consome insumos)

### 2. Função Modificada

A função `process_material_consumption()` foi modificada para ignorar ajustes:

```sql
IF NEW.production_type = 'adjustment' THEN
  RETURN NEW;  -- Sai sem processar consumo
END IF;
```

### 3. Registros Históricos Corrigidos

Todos os ajustes de estoque históricos foram:
- Identificados (pela palavra "ajuste" nas notas)
- Marcados como `production_type = 'adjustment'`
- Suas movimentações de insumos foram removidas

### 4. Frontend Atualizado

O componente `Inventory.tsx` foi atualizado para marcar novos ajustes corretamente:

```typescript
production_type: 'adjustment',  // NOVO: marca como ajuste
notes: adjustNotes || 'Ajuste de estoque (entrada)'
```

## Como Testar

### Teste 1: Verificar Ajustes Existentes

Execute esta query para ver os ajustes de estoque:

```sql
-- Ver ajustes de estoque já marcados
SELECT
  id,
  product_id,
  quantity,
  production_date,
  production_type,
  notes
FROM production
WHERE production_type = 'adjustment'
ORDER BY production_date DESC
LIMIT 10;
```

**Resultado esperado:** Todos os registros de ajustes devem ter `production_type = 'adjustment'`.

### Teste 2: Verificar Movimentações de Insumos

Execute esta query para confirmar que ajustes NÃO têm movimentações:

```sql
-- Verificar se ajustes têm movimentações de insumos (NÃO deveria ter)
SELECT
  p.id as production_id,
  p.production_type,
  p.notes as production_notes,
  COUNT(mm.id) as movimentacoes_insumos
FROM production p
LEFT JOIN material_movements mm ON mm.production_id = p.id
WHERE p.production_type = 'adjustment'
GROUP BY p.id, p.production_type, p.notes
HAVING COUNT(mm.id) > 0;
```

**Resultado esperado:** Nenhum registro (ajustes não devem ter movimentações).

### Teste 3: Criar Novo Ajuste

1. Acesse: **Indústria > Estoque**
2. Clique no ícone de ajuste (lápis) em qualquer produto
3. Selecione "Adicionar ao Estoque"
4. Digite quantidade: 10
5. Observações: "Teste de ajuste"
6. Clique em "Salvar Ajuste"
7. Acesse: **Indústria > Insumos**
8. Clique no ícone do olho em um insumo que faz parte do produto ajustado
9. **Resultado esperado:** NÃO deve aparecer nenhuma movimentação de consumo relacionada a este ajuste

### Teste 4: Verificar Novo Ajuste no Banco

```sql
-- Ver o ajuste que você acabou de criar
SELECT
  id,
  product_id,
  quantity,
  production_type,
  notes,
  created_at
FROM production
WHERE notes ILIKE '%teste de ajuste%'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado:** O campo `production_type` deve ser `'adjustment'`.

### Teste 5: Produção Real Deve Continuar Consumindo

1. Acesse: **Indústria > Produção do Dia**
2. Registre uma produção normal (não ajuste)
3. Salve a produção
4. Acesse: **Indústria > Insumos**
5. Clique no ícone do olho em um insumo usado na receita
6. **Resultado esperado:** DEVE aparecer a movimentação de consumo da produção

## Comparação: Antes vs Depois

### ANTES (Comportamento Errado)

```
Usuário faz ajuste de estoque: +10 blocos
  ↓
Sistema cria registro em 'production'
  ↓
Trigger 'process_material_consumption' é ativado
  ↓
Sistema calcula consumo de insumos (areia, cimento, etc.)
  ↓
Cria movimentações de SAÍDA de insumos
  ↓
❌ Estoque de insumos diminui SEM produção real
❌ Dados de consumo ficam distorcidos
```

### DEPOIS (Comportamento Correto)

```
Usuário faz ajuste de estoque: +10 blocos
  ↓
Sistema cria registro em 'production' com type='adjustment'
  ↓
Trigger 'process_material_consumption' é ativado
  ↓
Função verifica: é ajuste? SIM
  ↓
Função RETORNA sem processar consumo
  ↓
✅ Estoque de produto aumenta
✅ Estoque de insumos NÃO é afetado
✅ Dados de consumo permanecem corretos
```

## Arquivos Modificados

### Migration (Banco de Dados)
```
supabase/migrations/fix_material_consumption_ignore_stock_adjustments.sql
```

**Mudanças:**
- Adiciona 'adjustment' ao constraint de production_type
- Modifica função process_material_consumption()
- Atualiza registros históricos
- Remove movimentações indevidas

### Frontend (Interface)
```
src/components/Inventory.tsx
```

**Mudança:**
- Linha 250: Adiciona `production_type: 'adjustment'` ao criar ajuste

## Verificações de Segurança

### 1. Produções Reais Não Foram Afetadas

```sql
-- Verificar que produções normais ainda têm movimentações
SELECT
  p.production_type,
  COUNT(DISTINCT p.id) as total_producoes,
  COUNT(mm.id) as total_movimentacoes,
  ROUND(COUNT(mm.id)::numeric / COUNT(DISTINCT p.id), 2) as media_movimentacoes_por_producao
FROM production p
LEFT JOIN material_movements mm ON mm.production_id = p.id AND mm.movement_type = 'saida'
WHERE p.production_type IN ('stock', 'order')
GROUP BY p.production_type;
```

**Resultado esperado:** Produções 'stock' e 'order' devem ter movimentações (média > 0).

### 2. Ajustes Não Têm Movimentações

```sql
-- Confirmar que ajustes não têm movimentações
SELECT
  COUNT(DISTINCT p.id) as total_ajustes,
  COUNT(mm.id) as total_movimentacoes
FROM production p
LEFT JOIN material_movements mm ON mm.production_id = p.id
WHERE p.production_type = 'adjustment';
```

**Resultado esperado:**
- `total_ajustes` > 0 (tem ajustes no sistema)
- `total_movimentacoes` = 0 (nenhuma movimentação de insumos)

## Exemplo Prático

### Cenário: Ajuste de Estoque de Blocos

**Situação:**
- Produto: Bloco de Vedação 14
- Receita usa: Areia Industrial, Cimento, Água
- Estoque atual: 100 blocos
- Inventário físico: 120 blocos (diferença de +20)

**Ação:** Fazer ajuste de +20 blocos

#### ANTES da Correção:

```sql
-- Produção criada
INSERT INTO production (
  product_id,
  quantity,
  production_type,  -- era 'stock'
  notes
) VALUES (
  'bloco-vedacao-14-id',
  20,
  'stock',  -- ❌ ERRADO: parecia produção
  'Ajuste de estoque (entrada)'
);

-- Trigger criava consumos indevidos:
INSERT INTO material_movements (
  material_id,        -- Areia Industrial
  quantity,           -- 1200 kg (fictício!)
  movement_type,      -- 'saida'
  notes               -- 'Consumo automático...'
);
-- Repetia para cada insumo da receita
```

**Resultado:** Estoque de insumos diminuía sem produção real!

#### DEPOIS da Correção:

```sql
-- Produção criada
INSERT INTO production (
  product_id,
  quantity,
  production_type,  -- agora é 'adjustment'
  notes
) VALUES (
  'bloco-vedacao-14-id',
  20,
  'adjustment',  -- ✅ CORRETO: marcado como ajuste
  'Ajuste de estoque (entrada)'
);

-- Trigger identifica que é ajuste e NÃO cria movimentações
-- Função retorna imediatamente sem processar consumo
```

**Resultado:** Apenas estoque de produto aumenta, insumos não são afetados!

## Impacto nos Relatórios

### Relatórios Corrigidos:

1. **Aba Insumos > Ícone do Olho (Movimentações)**
   - Antes: Mostrava consumos de ajustes (errado)
   - Depois: Mostra apenas consumos reais (correto)

2. **Relatório de Consumo de Insumos**
   - Antes: Incluía ajustes no consumo (errado)
   - Depois: Inclui apenas produções reais (correto)

3. **Análise de Custos**
   - Antes: Custos distorcidos por consumos fictícios
   - Depois: Custos corretos baseados em consumo real

4. **Estoque de Produtos**
   - Antes: Correto (não foi afetado)
   - Depois: Continua correto

5. **Estoque de Insumos**
   - Antes: Incorreto (reduzia em ajustes)
   - Depois: Correto (não afetado por ajustes)

## Dados Históricos

Os dados históricos foram automaticamente corrigidos pela migration:

1. ✅ Ajustes antigos foram identificados pelas notas
2. ✅ Marcados como `production_type = 'adjustment'`
3. ✅ Movimentações indevidas foram removidas
4. ✅ Estoque de insumos foi restaurado ao valor correto

## Fluxo Correto Agora

### Quando Fazer Ajuste de Estoque:

```
Inventário físico encontrou divergência
  ↓
Acessa: Indústria > Estoque
  ↓
Clica no ícone de ajuste (lápis)
  ↓
Define tipo: Adicionar ou Remover
  ↓
Informa quantidade e motivo
  ↓
Sistema cria production com type='adjustment'
  ↓
✅ Estoque de produto é ajustado
✅ Insumos NÃO são afetados
✅ Movimentação fica registrada para auditoria
```

### Quando Registrar Produção Real:

```
Produção física foi realizada
  ↓
Acessa: Indústria > Produção do Dia
  ↓
Preenche dados da produção
  ↓
Sistema cria production com type='stock' ou 'order'
  ↓
✅ Estoque de produto aumenta
✅ Insumos são consumidos (saída)
✅ Custos são calculados
✅ Relatórios são atualizados
```

## Suporte e Dúvidas

### Se Ainda Aparecerem Movimentações Indevidas:

1. Execute a query de verificação (Teste 2)
2. Se encontrar movimentações em ajustes, execute:

```sql
-- Remover movimentações indevidas de ajustes
DELETE FROM material_movements
WHERE production_id IN (
  SELECT id FROM production WHERE production_type = 'adjustment'
)
AND notes LIKE 'Consumo automático%';
```

3. Recarregue a aba de Insumos (F5)
4. Verifique novamente as movimentações

### Se Um Ajuste Não For Marcado Corretamente:

```sql
-- Corrigir manualmente um ajuste específico
UPDATE production
SET production_type = 'adjustment'
WHERE id = 'UUID-DO-AJUSTE-AQUI';

-- Remover suas movimentações indevidas
DELETE FROM material_movements
WHERE production_id = 'UUID-DO-AJUSTE-AQUI'
AND notes LIKE 'Consumo automático%';
```

## Conclusão

A correção garante que:

✅ **Ajustes de estoque** são puramente administrativos
✅ **Consumo de insumos** reflete apenas produção real
✅ **Dados históricos** foram corrigidos automaticamente
✅ **Novos ajustes** funcionam corretamente
✅ **Produções reais** continuam funcionando normalmente
✅ **Relatórios** exibem dados corretos

O sistema agora diferencia claramente entre:
- **Produção real** (consome insumos)
- **Ajuste de estoque** (não consome insumos)

---

**Data da Correção:** 10/02/2026
**Migration:** `fix_material_consumption_ignore_stock_adjustments.sql`
**Componente:** `src/components/Inventory.tsx`
