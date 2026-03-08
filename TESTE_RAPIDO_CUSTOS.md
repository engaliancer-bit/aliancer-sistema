# Teste Rápido - Custos Corrigidos

## Teste 1: Marco de Concreto (04/02/2026)

### No Sistema
1. Ir em **Relatórios → Relatório de Produção**
2. Data Início: **04/02/2026**
3. Data Fim: **04/02/2026**
4. Clicar **"Gerar Relatório"**
5. Ir na aba **"Produtos"**
6. Procurar **"Marco de concreto"**

**✓ Resultado Esperado:**
- Quantidade: 6 unidades
- Custo unitário: **R$ 2,47** (não R$ 0,03)
- Custo total: **R$ 14,80**

### Na Aba "Materiais"
Deve mostrar consumo agregado de TODOS os produtos do dia:

**✓ Resultado Esperado:**
- Cimento: ~1.385 kg
- Areia média: ~5.812 kg
- Pedrisco: ~4.264 kg
- Ferro CA-60: ~304 m
- Etc.

---

## Teste 2: Resumo do Dia

1. Ir em **Produção Diária**
2. Selecionar data com produções (ex: 04/02/2026)
3. Clicar **"Gerar Resumo do Dia"**

**✓ Resultado Esperado:**
- ✓ Tabela de produtos produzidos
- ✓ Tabela de consumo de insumos
- ✓ Resumo financeiro com custos corretos

---

## Teste SQL Direto

Execute no **Supabase SQL Editor**:

```sql
-- Verificar Marco de Concreto
SELECT
  prod.name as produto,
  p.quantity as qtd_produzida,
  (p.custos_no_momento->>'total_cost')::decimal as custo_total,
  (SELECT COUNT(*) FROM production_items pi WHERE pi.production_id = p.id) as materiais_registrados
FROM production p
INNER JOIN products prod ON prod.id = p.product_id
WHERE p.production_date = '2026-02-04'
  AND prod.name ILIKE '%marco%';
```

**✓ Resultado Esperado:**
- produto: Marco de concreto
- qtd_produzida: 6
- custo_total: **14.79** (não 0)
- materiais_registrados: **5** (não 0)

---

## Se Ainda Mostrar R$ 0,03

Execute:
```sql
-- Ver custos_no_momento
SELECT jsonb_pretty(custos_no_momento)
FROM production
WHERE product_id IN (SELECT id FROM products WHERE name ILIKE '%marco%')
  AND production_date = '2026-02-04';
```

**Se mostrar `"materials": {}`:**
- Produto não tinha materiais cadastrados quando produziu
- OU frontend não calculou custos

**Solução:**
1. Editar produto e garantir que tem receita/armaduras
2. Fazer nova produção de teste
3. Verificar se custos_no_momento é preenchido

---

## Status: CORRIGIDO ✓

Todas as produções com custos vazios foram recalculadas usando os materiais cadastrados nos produtos.
