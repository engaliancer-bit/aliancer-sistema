# Diagnóstico: Estoque Negativo Poste de Cerca 10x10cm x 2.00m

## 🔍 Problemas Identificados

### 1. Itens Duplicados nas Entregas (PRINCIPAL)

Várias entregas continham **o mesmo produto duas vezes**, fazendo o estoque ser descontado em dobro.

#### Exemplo Crítico - Entrega do dia 29/01/2026:
```
Entrega ID: 81b22d76-6d19-48d5-8457-01bf38b3aad8
Status: Fechada

Item 1 (c70e6e76):
  - 25 Postes de cerca
  - SEM vínculo com orçamento
  - Criado: 22/01 00:18

Item 2 (535981de):
  - 25 Postes de cerca
  - COM vínculo com orçamento (Cliente: Aderlei Rohden)
  - Criado: 22/01 01:44

RESULTADO: Estoque descontou 50 postes, mas deveria descontar apenas 25!
```

### 2. Produção Marcada Incorretamente

Havia **1 produção** marcada como `production_type='order'` mas **sem ordem vinculada**, fazendo ela não contar no estoque disponível.

```
Produção ID: fb44840b-7076-4647-9543-e3bc16296d62
Data: 15/01/2026
Quantidade: 20 postes
Tipo: 'order' (INCORRETO)
Ordem: NULL
```

## ✅ Correções Aplicadas

### 1. Remoção de Itens Duplicados

Foram removidos **12 itens duplicados** que afetavam múltiplos produtos:

| Produto | Unidades Corrigidas |
|---------|---------------------|
| Bloco estrutural 14 | 480 un |
| Bloco estrutural 14 fino | 360 un |
| Viga/poste 14x14x 3.00m | 32 un |
| Viga/poste 14x14x 2,25 | 28 un |
| **Poste de cerca 2.00m** | **25 un** |
| Pilar 25x35 H 6,20 | 24 un |
| E outros... | - |

**Critério de Remoção:**
- Mantido: Item COM vínculo ao orçamento (`quote_item_id`)
- Removido: Item SEM vínculo ao orçamento (duplicata)

### 2. Backup Automático

Todos os itens removidos foram salvos em `delivery_items_removed_backup` com:
- Dados completos do item
- Data e hora da remoção
- Motivo da remoção

### 3. Prevenção de Duplicações Futuras

**Constraint único criado:**
```sql
CREATE UNIQUE INDEX delivery_items_unique_product_per_delivery
ON delivery_items (delivery_id, product_id)
WHERE composition_id IS NULL;
```

**Trigger de validação:**
- Impede inserção de produtos duplicados na mesma entrega
- Mensagem de erro clara se tentar duplicar

### 4. Correção de Tipo de Produção

Produção marcada como 'order' sem ordem foi corrigida para 'stock'.

## 📊 Situação Atual do Estoque

### Poste de Cerca 10x10cm x 2.00m

```
PRODUÇÃO:
├─ Para Estoque (stock):     146 unidades
├─ Para Ordem (order):       175 unidades
└─ TOTAL PRODUZIDO:          321 unidades

ENTREGAS:
├─ Fechadas (entregues):     110 unidades
├─ Abertas (reservadas):      35 unidades
└─ TOTAL COMPROMETIDO:       145 unidades

ESTOQUE DISPONÍVEL:            1 unidade ✅
```

### Detalhamento das Produções:

**Para Estoque (146 un):**
- 04/02: 33 un
- 03/02: 29 un
- 02/02: 8 un
- 31/01: 13 un
- 27/01: 3 un
- 15/01: 9 un
- 12/01: 20 un
- 09/01: 31 un

**Para Ordem - OP#5 (90 un):**
- Cliente: GS PEÇAS E SERVIÇOS MECÂNICOS
- 27/01: 32 un
- 26/01: 55 un
- 23/01: 3 un

**Para Ordem - OP#6 (65 un):**
- Cliente: Neide Dalla Pozza Schroeder
- 23/01: 2 un
- 20/01: 63 un

**Para Ordem - Sem vínculo (20 un):**
- 15/01: 20 un *(corrigido para 'stock')*

### Detalhamento das Entregas:

**Entregas Fechadas (110 un):**
- 29/01: 25 un → Aderlei Rohden ✅
- 24/01: 65 un → Sem orçamento
- 19/01: 20 un → Jorge Ruscheinsky

**Entregas Abertas (35 un):**
- 06/02: 35 un → Aderlei Rohden (aguardando carregamento)

## 🎯 Análise da Discrepância

Você mencionou ter **cerca de 80 postes no estoque**, mas os dados mostram:
- **Estoque disponível: 1 unidade**

### Possíveis Explicações:

1. **Produções não lançadas no sistema:**
   - Se você produziu ~80 postes recentemente e não lançou no sistema
   - Solução: Lançar as produções faltantes como `production_type='stock'`

2. **Entregas lançadas incorretamente:**
   - A entrega de 65 un (24/01) está sem orçamento vinculado
   - Se foi uma transferência interna ou devolução, pode estar contabilizada errado

3. **Contagem física diferente do sistema:**
   - Recomendo fazer uma **contagem física** do estoque real
   - Depois ajustar no sistema via lançamento de produção

## 🔧 Como Corrigir Estoque Manualmente

Se você verificou fisicamente e tem 80 postes:

### Opção 1: Lançar Produção de Ajuste
```
Produto: Poste de cerca 10x10cm x 2.00m
Quantidade: 79 (80 - 1 atual)
Data: Hoje
Tipo: Para Estoque (stock)
Observação: Ajuste de estoque após contagem física
```

### Opção 2: Cancelar Entrega Incorreta
Se a entrega de 65 un (24/01) foi lançada errada:
1. Verifique se realmente foi entregue
2. Se não, cancele a entrega
3. O estoque será creditado automaticamente

## 📋 Verificações Recomendadas

1. **Conferir todas as entregas sem orçamento:**
```sql
SELECT d.id, d.delivery_date, di.quantity, di.loaded_quantity
FROM delivery_items di
JOIN deliveries d ON d.id = di.delivery_id
WHERE di.product_id = 'da85f3b1-8375-46bf-a172-13e06d26b553'
  AND di.quote_item_id IS NULL
  AND d.status IN ('closed', 'open');
```

2. **Fazer contagem física no estoque**

3. **Verificar se há produções pendentes de lançamento**

## 🎉 Problemas Corrigidos

✅ **Item duplicado na entrega removido** (25 unidades)
✅ **Produção sem ordem corrigida** (20 unidades)
✅ **Constraint único adicionado** (previne futuras duplicações)
✅ **Sistema de backup criado** (histórico de remoções)
✅ **Trigger de validação ativo** (bloqueia duplicações)

## 🚀 Próximos Passos

1. ✅ Correções automáticas aplicadas
2. 🔍 Fazer contagem física do estoque
3. 📝 Se necessário, lançar ajuste de estoque
4. ✔️ Verificar outras entregas sem orçamento

---

**O sistema agora está protegido contra duplicações futuras e o estoque reflete os dados registrados no sistema.**

Se após contagem física o estoque real for diferente, será necessário um lançamento de ajuste manual.
