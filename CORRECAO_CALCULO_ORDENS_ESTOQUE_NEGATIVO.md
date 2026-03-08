# Correção do Cálculo de Ordens de Produção com Estoque Negativo

**Data:** 29 de Janeiro de 2026  
**Status:** ✅ CORRIGIDO  
**Impacto:** Crítico - Afetava quantidade de produção

---

## 🐛 PROBLEMA REPORTADO

### Situação
Cliente: **Antônio Nilo Henn**  
Orçamento: **6 unidades** da composição "Pórtico pré moldado vão de 12m x 4,00m"  
Composição contém: **1 Tirante** por unidade  

**Esperado:** Ordem de produção de 6 Tirantes  
**Aconteceu:** Ordem de produção de **14 Tirantes** ❌

### Detalhes do Bug
```
Composição: Pórtico pré moldado vão de 12m x 4,00m
├─ Quantidade do orçamento: 6 unidades
├─ Tirante na composição: 1 unidade por pórtico
├─ Total necessário: 6 × 1 = 6 Tirantes
│
└─ Ordem criada: 14 Tirantes ❌ (deveria ser 6)
```

---

## 🔍 DIAGNÓSTICO

### Causa Raiz

O problema estava na **lógica de cálculo** da função que cria ordens automáticas.

#### Estado do Estoque
```sql
-- Produto: Tirante para galpão com 12,60 de vão
Total produzido: 0 unidades
Total entregue (reservado): 8 unidades
Estoque disponível: -8 unidades
```

O estoque está **negativo** porque:
- Já existem entregas abertas que reservaram 8 unidades
- Mas essas 8 unidades ainda não foram produzidas

#### Cálculo Incorreto (ANTES)
```javascript
v_quantity_to_produce = quantidade_necessaria - estoque;
v_quantity_to_produce = 6 - (-8);
v_quantity_to_produce = 14; // ❌ ERRADO
```

Ao subtrair um número negativo, o sistema estava **somando**:
- 6 necessário + 8 em falta = 14 total

#### Cálculo Correto (DEPOIS)
```javascript
v_quantity_to_produce = quantidade_necessaria - MAX(estoque, 0);
v_quantity_to_produce = 6 - MAX(-8, 0);
v_quantity_to_produce = 6 - 0;
v_quantity_to_produce = 6; // ✅ CORRETO
```

Agora consideramos estoque negativo como **zero**:
- Se estoque < 0: considerar como 0
- Se estoque >= 0: usar valor real

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Correção da Lógica no Trigger

**Arquivo:** `supabase/migrations/fix_production_order_negative_stock_calculation.sql`

**Mudança realizada:**

```sql
-- ANTES (ERRADO)
v_quantity_to_produce := v_quantity_required - COALESCE(v_inventory_stock, 0);

-- DEPOIS (CORRETO)
v_quantity_to_produce := v_quantity_required - GREATEST(COALESCE(v_inventory_stock, 0), 0);
```

A função `GREATEST(valor, 0)` garante que:
- Se `valor >= 0`: retorna o valor
- Se `valor < 0`: retorna 0

### 2. Correção das Ordens Já Criadas

As ordens do orçamento do Antônio Nilo Henn foram corrigidas:

| Ordem | Produto | Quantidade ANTES | Quantidade DEPOIS | Status |
|-------|---------|------------------|-------------------|--------|
| #29 | Tirante para galpão | **14** ❌ | **6** ✅ | Corrigido |
| #30 | Arruela de ferro | **28** ❌ | **12** ✅ | Corrigido |
| #31 | Tesoura pré moldada | 12 | 12 | OK (estoque era 0) |
| #32 | Pilar pré moldado | 12 | 12 | OK (estoque era 0) |

### Explicação das Correções

#### Ordem #29 - Tirante
```
Composição: 6 pórticos
Tirante por pórtico: 1 unidade
Total necessário: 6 × 1 = 6 unidades

Estoque: -8 unidades (reservado em outras entregas)
Estoque efetivo: 0 (negativo = zero)
A produzir: 6 - 0 = 6 unidades ✅
```

#### Ordem #30 - Arruela
```
Composição: 6 pórticos
Arruela por pórtico: 2 unidades
Total necessário: 6 × 2 = 12 unidades

Estoque: -16 unidades (reservado em outras entregas)
Estoque efetivo: 0 (negativo = zero)
A produzir: 12 - 0 = 12 unidades ✅
```

#### Ordens #31 e #32
```
Estoque: 0 unidades
Não foram afetadas pelo bug
Quantidades já estavam corretas
```

---

## 📊 IMPACTO

### Antes da Correção
```
❌ Ordens de produção com quantidades EXAGERADAS
❌ Desperdício de recursos de produção
❌ Confusão no planejamento de fábrica
❌ Estoque futuro inflado incorretamente
```

### Depois da Correção
```
✅ Ordens com quantidades CORRETAS
✅ Produção otimizada
✅ Planejamento preciso
✅ Estoque controlado adequadamente
```

### Situações Afetadas

Este bug afetava especificamente quando:
1. Produto já tinha entregas reservadas (estoque negativo)
2. Novo orçamento era aprovado com esse produto
3. Sistema calculava produção necessária

**Produtos comumente afetados:**
- Tirantes
- Arruelas
- Produtos frequentemente vendidos antes de serem produzidos

---

## 🎓 LIÇÕES APRENDIDAS

### 1. Estoque Negativo é Normal
```
Estoque negativo NÃO é um erro!
É uma situação de negócio válida:
  - Cliente comprou produto
  - Entrega foi agendada (reservou estoque)
  - Produto ainda não foi produzido
  - Estoque fica negativo até produção
```

### 2. Cuidado com Operações Matemáticas
```
Subtrair número negativo = SOMA
6 - (-8) = 6 + 8 = 14

Sempre usar MAX ou GREATEST quando:
  - Estoque pode ser negativo
  - Não queremos valores negativos no cálculo
```

### 3. Validar Casos Extremos
```
Sempre testar com:
  ✓ Estoque positivo
  ✓ Estoque zero
  ✓ Estoque negativo
  ✓ Estoque NULL
```

### 4. Logs São Essenciais
```
O sistema de logs (production_order_creation_logs)
foi FUNDAMENTAL para diagnosticar o problema:
  - Mostrou o estoque = -8
  - Mostrou o cálculo = 14
  - Permitiu entender a causa raiz
```

---

## 🧪 COMO TESTAR

### Cenário 1: Estoque Positivo
```sql
-- Produto com estoque positivo
Necessário: 10 unidades
Estoque: 3 unidades
Esperado: 10 - 3 = 7 unidades a produzir ✓
```

### Cenário 2: Estoque Zero
```sql
-- Produto com estoque zero
Necessário: 10 unidades
Estoque: 0 unidades
Esperado: 10 - 0 = 10 unidades a produzir ✓
```

### Cenário 3: Estoque Negativo (Caso corrigido)
```sql
-- Produto com estoque negativo
Necessário: 10 unidades
Estoque: -5 unidades
Esperado: 10 - MAX(-5, 0) = 10 - 0 = 10 unidades a produzir ✓
```

### Query de Verificação
```sql
-- Verificar produtos com estoque negativo
SELECT 
  product_id,
  product_name,
  total_produced,
  total_delivered,
  available_stock
FROM product_stock_view
WHERE available_stock < 0
ORDER BY available_stock;
```

---

## 🔧 VERIFICAÇÃO PÓS-CORREÇÃO

### Verificar Ordens Corrigidas
```sql
-- Ver ordens do orçamento do Antônio Nilo Henn
SELECT 
  po.order_number,
  po.total_quantity as quantidade,
  p.name as produto,
  po.status
FROM production_orders po
JOIN products p ON p.id = po.product_id
JOIN quotes q ON q.id = po.quote_id
JOIN customers c ON c.id = q.customer_id
WHERE c.name ILIKE '%Antônio Nilo Henn%'
ORDER BY po.order_number;
```

**Resultado Esperado:**
```
Ordem #29: 6 Tirantes ✅
Ordem #30: 12 Arruelas ✅
Ordem #31: 12 Tesouras ✅
Ordem #32: 12 Pilares ✅
```

### Testar Novo Orçamento
1. Criar orçamento com composição contendo produtos com estoque negativo
2. Aprovar orçamento
3. Verificar ordens criadas
4. Confirmar que quantidades estão corretas

---

## 📝 MUDANÇAS NO CÓDIGO

### Função Modificada
```
auto_create_production_orders_on_quote_approval()
```

### Linhas Alteradas

**Para produtos diretos (linha ~162):**
```sql
-- ANTES
v_quantity_to_produce := v_quote_item.quantity - COALESCE(v_inventory_stock, 0);

-- DEPOIS
v_quantity_to_produce := v_quote_item.quantity - GREATEST(COALESCE(v_inventory_stock, 0), 0);
```

**Para produtos em composições (linha ~282):**
```sql
-- ANTES
v_quantity_to_produce := v_quantity_required - COALESCE(v_inventory_stock, 0);

-- DEPOIS
v_quantity_to_produce := v_quantity_required - GREATEST(COALESCE(v_inventory_stock, 0), 0);
```

### Logging Melhorado
Agora os logs mostram:
- `in_stock_raw`: Valor real do estoque (pode ser negativo)
- `in_stock_effective`: Valor usado no cálculo (nunca negativo)
- `to_produce`: Quantidade calculada

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [✅] Trigger corrigido com GREATEST()
- [✅] Ordem #29 ajustada de 14 para 6
- [✅] Ordem #30 ajustada de 28 para 12
- [✅] Logs verificados e confirmados
- [✅] Migration aplicada com sucesso
- [✅] Documentação criada
- [✅] Lógica testada com estoque negativo
- [✅] Lógica testada com estoque zero
- [✅] Lógica testada com estoque positivo

---

## 🎯 RESUMO

**Problema:** Ordens de produção com quantidades exageradas quando estoque negativo  
**Causa:** Subtração de número negativo resultava em soma  
**Solução:** Usar GREATEST(estoque, 0) para considerar negativo como zero  
**Impacto:** 100% das ordens agora calculam quantidade correta  

**Status:** ✅ **RESOLVIDO E TESTADO**

---

**Arquivo de migração:** `fix_production_order_negative_stock_calculation.sql`  
**Ordens corrigidas:** #29 e #30 do orçamento do Antônio Nilo Henn  
**Data da correção:** 29 de Janeiro de 2026
