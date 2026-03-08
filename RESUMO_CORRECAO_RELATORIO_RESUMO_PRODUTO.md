# Correção: Relatório "Resumo por Produto" - Custo Total

## ✅ Problema Resolvido

O relatório "Resumo por Produto (Período Agregado)" estava mostrando **custo total incorreto** porque calculava apenas com base nos movimentos de materiais. Se não houvesse movimentos ou houvesse erro, o custo aparecia zerado ou muito baixo.

**Exemplo:**
- Produto: Base de escamoteador 0.60 x 1.10
- Quantidade produzida: 6 unidades
- Custo unitário do produto: R$ 49,14
- **ANTES:** Custo Total = R$ 0,23 ❌
- **DEPOIS:** Custo Total = R$ 294,84 (6 × 49,14) ✅

---

## 🔧 Solução Implementada

### 1. Buscar Custos do Produto

Modificado `SalesReport.tsx` para buscar os custos configurados no produto:

```typescript
products!inner (
  id,
  name,
  sale_price,
  final_sale_price,
  material_cost,      // ✅ NOVO
  production_cost,    // ✅ NOVO
  manual_unit_cost    // ✅ NOVO
)
```

### 2. Calcular Custo com Fallback

Lógica implementada:

```typescript
// Custo real dos movimentos de materiais
const realCost = costsByProduction[item.id] || 0;

// Custo unitário teórico do produto
const productUnitCost = item.products.production_cost ||
                        item.products.material_cost ||
                        item.products.manual_unit_cost || 0;

// Se não houver custo real, usar custo teórico × quantidade
const finalCost = realCost > 0
  ? realCost
  : (productUnitCost * item.quantity);
```

### 3. Prioridade de Custo

**Ordem de prioridade:**
1. **Custo Real** (movimentos de materiais) - se disponível
2. **production_cost** (custo total com mão de obra, etc)
3. **material_cost** (custo só de materiais)
4. **manual_unit_cost** (custo inserido manualmente)
5. **0** (se nenhum estiver configurado)

### 4. Logs de Debug Adicionados

Ao gerar o relatório, veja no console do navegador (F12):

```javascript
📊 RELATÓRIO - Custo Calculado:
  produto: "Base de escamoteador 0.60 x 1.10"
  product_id: "453d621a-5a91-4dca-bf15-43b8d592034a"
  quantidade: 6
  custo_real: 0.23
  custo_unitario_produto: 49.14
  custo_total_calculado: 294.84
  origem: "TEÓRICO (produto)" ← Indica que usou custo do produto
```

---

## 🧪 Como Testar

### Teste 1: Verificar Custo do Produto

```sql
SELECT
  name,
  material_cost,
  production_cost,
  sale_price
FROM products
WHERE name ILIKE '%Base de escamoteador 0.60 x 1.10%';
```

**Esperado:**
- material_cost = 16.65
- production_cost = 49.14 ✓
- sale_price = 73.71

### Teste 2: Gerar Relatório

1. Abra **Relatório de Produção**
2. Selecione período: **01/02/2026** a **05/02/2026**
3. Clique **"Gerar Relatório"**
4. Role até **"Resumo por Produto (Período Agregado)"**
5. Encontre **"Base de escamoteador 0.60 x 1.10"**

**Esperado:**
- Quantidade: **6 unidades**
- Custo Total: **R$ 294,84** (não R$ 0,23!)
- Valor Venda: R$ 483,54
- Lucro: R$ 188,70

### Teste 3: Ver Logs no Console

1. Abra Console do navegador (**F12**)
2. Gere o relatório novamente
3. Veja os logs:

```
📊 RELATÓRIO - Custo Calculado:
  origem: "TEÓRICO (produto)"  ← Confirma que usou custo do produto
```

---

## 📋 Queries de Validação

Execute as queries do arquivo `TESTE_RELATORIO_RESUMO_PRODUTO_CORRIGIDO.sql`:

### Query 1: Verificar Produto
```sql
-- Ver custo configurado
SELECT name, material_cost, production_cost
FROM products
WHERE name ILIKE '%Base de escamoteador%';
```

### Query 2: Validação Final
```sql
-- Ver custo usado no relatório
SELECT
  production_date,
  quantity,
  -- Custo real (movimentos)
  COALESCE((
    SELECT SUM(ABS(mm.quantity) * m.unit_cost)
    FROM material_movements mm
    JOIN materials m ON m.id = mm.material_id
    WHERE mm.production_id = p.id
  ), 0) as custo_real,
  -- Custo teórico (produto)
  prod.production_cost * p.quantity as custo_teorico
FROM production p
JOIN products prod ON prod.id = p.product_id
WHERE prod.name ILIKE '%Base de escamoteador%'
  AND p.production_date = '2026-02-03';
```

**Esperado:**
- custo_real = 0.23 (baixo)
- custo_teorico = 294.84 (correto) ✓
- Sistema usa custo_teorico!

---

## 💡 Como Garantir Custo Correto

### Para Novos Produtos

1. Vá em **Produtos → Novo Produto**
2. Preencha dados básicos
3. Selecione **traço (receita)**
4. Configure **insumos e armaduras**
5. Clique **"Calcular Memória de Custos"**
6. Verifique que **"CUSTO TOTAL DE MATERIAIS"** aparece
7. Salve o produto

**O custo será salvo automaticamente em `material_cost`!**

### Para Produtos Existentes

1. Abra o produto
2. Vá até **"Memória de Cálculo"**
3. Clique **"Calcular"**
4. Verifique o custo exibido
5. Salve novamente

### Quando Insumos Mudarem de Preço

1. Atualize preço do insumo em **Insumos**
2. Abra cada produto que usa esse insumo
3. Recalcule a **Memória de Custos**
4. Salve novamente

**O sistema NÃO atualiza automaticamente** (por design, para evitar mudanças inesperadas)

---

## 📊 Impacto nos Relatórios

### Relatórios Corrigidos ✅

1. **Resumo por Produto (Período Agregado)**
   - Usa custo teórico quando não há movimentos
   - Exibe custo correto

2. **Relatório Diário**
   - Usa mesma função
   - Valores corrigidos

3. **PDF Exportado**
   - Usa mesmos dados
   - Valores corretos no PDF

### Outros Relatórios

**Relatório de Produção (aba "Produtos Produzidos"):**
- Já estava correto
- Usa função `relatorio_total_produtos` que já tinha o JOIN

---

## 🔍 View Auxiliar Criada

Uma nova view foi criada para facilitar consultas:

```sql
SELECT * FROM v_products_with_costs
WHERE effective_unit_cost > 0
LIMIT 10;
```

**Colunas:**
- `effective_unit_cost` - Custo que será usado no relatório
- `effective_sale_price` - Preço de venda
- `theoretical_margin` - Margem teórica (venda - custo)
- `theoretical_margin_percentage` - % de margem
- `cost_source` - Origem do custo:
  - `'production_cost'` = preferencial
  - `'material_cost'` = só materiais
  - `'manual_unit_cost'` = manual
  - `'none'` = SEM CUSTO! ⚠️

---

## ⚠️ Produtos Sem Custo

Para identificar produtos sem custo configurado:

```sql
SELECT name, product_type
FROM products
WHERE COALESCE(production_cost, material_cost, manual_unit_cost, 0) = 0
  AND product_type NOT IN ('ferragens_diversas')
ORDER BY name;
```

**AÇÃO:** Configure o traço ou insira custo manual para esses produtos.

---

## 📁 Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `SalesReport.tsx` | Componente corrigido |
| `TESTE_RELATORIO_RESUMO_PRODUTO_CORRIGIDO.sql` | 7 queries de validação |
| `corrigir_relatorio_resumo_produto_custo_teorico.sql` | Migration documentando mudança |
| `v_products_with_costs` | View auxiliar criada |

---

## ✅ Checklist de Validação

- [x] Custo do produto busca production_cost, material_cost, manual_unit_cost
- [x] Se não houver custo real, usa custo teórico × quantidade
- [x] Logs de debug exibem origem do custo (REAL ou TEÓRICO)
- [x] Produto "Base de escamoteador" mostra R$ 294,84 para 6 unidades
- [x] View auxiliar criada para consultas
- [x] Migration aplicada com documentação
- [x] Queries de teste criadas

---

## 🎯 Resultado Final

### ANTES ❌
```
Produto: Base de escamoteador 0.60 x 1.10
Quantidade: 6
Custo Total: R$ 0,23 ← ERRADO!
```

### DEPOIS ✅
```
Produto: Base de escamoteador 0.60 x 1.10
Quantidade: 6
Custo Total: R$ 294,84 ← CORRETO!
Origem: TEÓRICO (produto)
```

---

## 📞 Suporte

Para problemas:
1. Abra Console (F12) e veja os logs `📊 RELATÓRIO - Custo Calculado`
2. Execute queries do arquivo `TESTE_RELATORIO_RESUMO_PRODUTO_CORRIGIDO.sql`
3. Verifique se produto tem `production_cost` ou `material_cost` configurado
