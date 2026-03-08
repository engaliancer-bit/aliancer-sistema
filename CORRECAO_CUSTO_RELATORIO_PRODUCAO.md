# Correção: Custo e Margem no Relatório de Produção

## Problema Anterior

O relatório de produção estava apresentando custos zerados quando:
- A produção não tinha custos calculados em `production_items`
- Os materiais não foram registrados corretamente
- Não havia fallback para o custo teórico do produto

Além disso, faltava a análise de margem real comparando custo com preço de venda.

## Melhorias Implementadas

### 1. Busca de Custo Teórico ✅

**Problema:**
```sql
-- Antes: só mostrava custo real (production_items)
avg_cost_per_unit = total_material_cost / quantity

-- Se total_material_cost = 0, mostrava R$ 0,00
```

**Solução:**
```sql
-- Agora: usa custo teórico se real estiver zerado
final_cost_per_unit = CASE
  WHEN custo_real > 0 THEN custo_real
  ELSE COALESCE(
    prod.production_cost,      -- 1ª prioridade
    prod.material_cost,         -- 2ª prioridade
    prod.manual_unit_cost,      -- 3ª prioridade
    0
  )
END
```

### 2. JOIN com Tabela Products ✅

**Antes:**
```sql
-- Não buscava dados do produto
FROM production p
LEFT JOIN production_items pi ON pi.production_id = p.id
```

**Depois:**
```sql
-- Busca custos e preços do produto
FROM production p
INNER JOIN products prod ON prod.id = p.product_id
LEFT JOIN production_items pi ON pi.production_id = p.id

-- Campos disponíveis:
-- prod.production_cost (custo de produção)
-- prod.material_cost (custo de material)
-- prod.manual_unit_cost (custo manual)
-- prod.sale_price (preço de venda)
-- prod.final_sale_price (preço final)
```

### 3. Cálculo para Vigotas ✅

**Fórmula:**
```sql
-- Para qualquer produto (incluindo vigotas):
custo_total = quantidade_produzida × custo_unitario_produto

-- Se custo real existir:
custo_total = quantidade_produzida × (total_material_cost / quantidade)

-- Se não:
custo_total = quantidade_produzida × production_cost
```

**Exemplo para Vigota:**
- Quantidade: 100 m
- Custo teórico: R$ 15,00/m
- Custo total: R$ 1.500,00

### 4. Coluna Margem Real ✅

**Novas Colunas no Relatório:**

| Coluna | Descrição | Cálculo |
|--------|-----------|---------|
| **Custo Real** | Custo dos materiais usados | `production_items.total_cost / quantity` |
| **Custo Teórico** | Custo configurado no produto | `production_cost` ou `material_cost` |
| **Custo Final** | Custo efetivo (real ou teórico) | Se real > 0, usa real, senão teórico |
| **Preço Venda** | Preço de venda do produto | `final_sale_price` ou `sale_price` |
| **Margem Real** | Lucro por unidade | `preço_venda - custo_final` |
| **% Margem** | Percentual de lucro | `(margem_real / preço_venda) × 100` |

**Cores Visuais:**
- 🟢 **Verde**: Margem positiva (lucro)
- 🔴 **Vermelho**: Margem negativa (prejuízo)
- 🔵 **Azul**: Usando custo teórico (não tem custo real)

## Estrutura da Função SQL

### Função: `relatorio_total_produtos`

```sql
CREATE OR REPLACE FUNCTION relatorio_total_produtos(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
  -- Colunas existentes
  production_date DATE,
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity DECIMAL,
  unit TEXT,
  production_count BIGINT,
  total_material_cost DECIMAL,
  avg_cost_per_unit DECIMAL,

  -- NOVAS COLUNAS
  product_unit_cost DECIMAL,     -- Custo teórico do produto
  sales_price DECIMAL,            -- Preço de venda
  final_cost_per_unit DECIMAL,   -- Custo final (real ou teórico)
  margin_per_unit DECIMAL,        -- Margem por unidade
  margin_percentage DECIMAL       -- % de margem
)
```

### Lógica de Custo Final

```sql
-- CUSTO FINAL
CASE
  WHEN custo_real_existe THEN
    -- Usa custo real calculado
    total_material_cost / quantidade
  ELSE
    -- Usa custo teórico do produto
    COALESCE(
      production_cost,      -- Custo de produção
      material_cost,        -- Custo de material
      manual_unit_cost,     -- Custo manual
      0
    )
END
```

### Lógica de Margem

```sql
-- MARGEM POR UNIDADE
preço_venda - custo_final

-- % MARGEM
CASE
  WHEN preço_venda > 0 THEN
    ((preço_venda - custo_final) / preço_venda) × 100
  ELSE 0
END
```

## Interface Atualizada

### Tabela de Produtos Produzidos

```
┌──────────┬────────────┬─────┬────────────┬──────────────┬─────────────┬──────────────┬─────────────┬──────────┐
│ Data     │ Produto    │ Qtd │ Custo Real │ Custo Teóric │ Custo Final │ Preço Venda  │ Margem Real │ % Margem │
├──────────┼────────────┼─────┼────────────┼──────────────┼─────────────┼──────────────┼─────────────┼──────────┤
│05/02/2026│ Vigota 12m │ 100 │ R$ 14,50   │ R$ 15,00     │ R$ 14,50    │ R$ 22,00     │ R$ 7,50     │ 34,1%    │
│05/02/2026│ Laje T10   │  50 │ -          │ R$ 35,00     │ R$ 35,00    │ R$ 48,00     │ R$ 13,00    │ 27,1%    │
│          │            │     │            │              │   Teórico   │              │             │          │
└──────────┴────────────┴─────┴────────────┴──────────────┴─────────────┴──────────────┴─────────────┴──────────┘
```

**Indicadores Visuais:**
- **Custo Final em Azul + "Teórico"**: Quando usa custo do produto (não tem custo real)
- **Custo Final em Preto**: Quando usa custo real calculado
- **Margem em Verde**: Lucro positivo
- **Margem em Vermelho**: Prejuízo

## Exemplos de Uso

### Cenário 1: Produção com Custos Reais

**Dados:**
- Produto: Marco Concreto 14x19
- Quantidade: 50 un
- Custo real dos materiais: R$ 1.450,00
- Custo teórico cadastrado: R$ 30,00/un
- Preço de venda: R$ 42,00/un

**Resultado:**
```
Custo Real: R$ 29,00/un (1450 ÷ 50)
Custo Teórico: R$ 30,00/un
Custo Final: R$ 29,00/un ← USA REAL
Preço Venda: R$ 42,00/un
Margem Real: R$ 13,00/un (42 - 29)
% Margem: 31,0% (13 ÷ 42 × 100)
```

### Cenário 2: Produção SEM Custos Reais

**Dados:**
- Produto: Vigota 12m
- Quantidade: 100 m
- Custo real: R$ 0,00 (não registrado)
- Custo teórico: R$ 15,00/m
- Preço de venda: R$ 22,00/m

**Resultado:**
```
Custo Real: - (não registrado)
Custo Teórico: R$ 15,00/m
Custo Final: R$ 15,00/m ← USA TEÓRICO (azul + "Teórico")
Preço Venda: R$ 22,00/m
Margem Real: R$ 7,00/m (22 - 15)
% Margem: 31,8% (7 ÷ 22 × 100)
```

### Cenário 3: Margem Negativa (Prejuízo)

**Dados:**
- Produto: Bloco Especial
- Quantidade: 200 un
- Custo real: R$ 5.500,00
- Custo teórico: R$ 25,00/un
- Preço de venda: R$ 24,00/un

**Resultado:**
```
Custo Real: R$ 27,50/un (5500 ÷ 200)
Custo Teórico: R$ 25,00/un
Custo Final: R$ 27,50/un ← USA REAL
Preço Venda: R$ 24,00/un
Margem Real: -R$ 3,50/un (24 - 27,50) ← VERMELHO
% Margem: -14,6% (-3,5 ÷ 24 × 100) ← VERMELHO
```

## View Auxiliar

Criada view `v_producao_com_custos` para facilitar consultas:

```sql
SELECT * FROM v_producao_com_custos
WHERE production_date >= '2026-02-01'
  AND margin_per_unit < 0  -- Produtos com prejuízo
ORDER BY margin_per_unit ASC;
```

**Campos da View:**
- `production_id`
- `production_date`
- `quantity`
- `product_id`
- `product_name`
- `product_code`
- `unit`
- `product_type`
- `total_material_cost`
- `product_unit_cost` (teórico)
- `sales_price`
- `final_cost_per_unit` (real ou teórico)
- `margin_per_unit`

## Como Testar

### Teste 1: Produto com Custos Reais

```sql
-- 1. Verificar produto tem custos configurados
SELECT
  name,
  production_cost,
  material_cost,
  sale_price,
  final_sale_price
FROM products
WHERE name ILIKE '%vigota%';

-- 2. Verificar produção tem custos reais
SELECT
  p.id,
  p.production_date,
  p.quantity,
  COALESCE(SUM(pi.total_cost), 0) as custo_real
FROM production p
LEFT JOIN production_items pi ON pi.production_id = p.id
WHERE p.production_date >= '2026-02-01'
GROUP BY p.id, p.production_date, p.quantity
ORDER BY p.production_date DESC;

-- 3. Rodar relatório
SELECT * FROM relatorio_total_produtos(
  '2026-02-01',
  '2026-02-05'
);
```

### Teste 2: Validar Margem

```sql
-- Produtos com maior margem
SELECT
  product_name,
  final_cost_per_unit,
  sales_price,
  margin_per_unit,
  margin_percentage
FROM relatorio_total_produtos('2026-01-01', '2026-02-05')
WHERE sales_price > 0
ORDER BY margin_percentage DESC
LIMIT 10;

-- Produtos com prejuízo
SELECT
  product_name,
  final_cost_per_unit,
  sales_price,
  margin_per_unit,
  margin_percentage
FROM relatorio_total_produtos('2026-01-01', '2026-02-05')
WHERE margin_per_unit < 0
ORDER BY margin_per_unit ASC;
```

### Teste 3: Frontend

1. Abra o **Relatório de Produção**
2. Selecione período (ex: 01/02/2026 a 05/02/2026)
3. Clique em **"Gerar Relatório"**
4. Vá na aba **"Produtos Produzidos"**
5. Verifique as novas colunas:
   - Custo Real
   - Custo Teórico
   - Custo Final (em azul se teórico)
   - Preço Venda
   - Margem Real (verde/vermelho)
   - % Margem

## Arquivos Modificados

### Backend (Supabase)
**Migration:** `adicionar_custo_produto_e_margem_relatorio.sql`
- DROP e recriação de `relatorio_total_produtos()`
- Criação de `v_producao_com_custos`
- Índices para performance

### Frontend
**Arquivo:** `src/components/ProductionReport.tsx`
- Interface `ProductSummary` atualizada (linhas 17-32)
- Tabela de produtos com 9 colunas (linhas 394-526)
- Indicadores visuais (cores, "Teórico")
- Totalizador de margem no rodapé

## Índices Criados

```sql
-- Performance para busca por custos
CREATE INDEX idx_products_production_cost
ON products (production_cost)
WHERE production_cost > 0;

-- Performance para busca por preços
CREATE INDEX idx_products_sale_prices
ON products (sale_price, final_sale_price)
WHERE sale_price > 0 OR final_sale_price > 0;

-- Performance para filtros por tipo
CREATE INDEX idx_products_product_type
ON products (product_type);
```

## Benefícios

1. ✅ **Sempre mostra custo**: Real ou teórico, nunca fica zerado
2. ✅ **Análise de margem**: Identifica produtos com lucro/prejuízo
3. ✅ **Indicador visual**: Azul = teórico, Verde = lucro, Vermelho = prejuízo
4. ✅ **Dados do produto**: JOIN traz custos e preços cadastrados
5. ✅ **Cálculo preciso**: Vigotas e outros produtos calculados corretamente
6. ✅ **View auxiliar**: Facilita consultas personalizadas
7. ✅ **Performance**: Índices otimizam queries

## Lógica de Prioridade

**Custo Final:**
1. Custo real (production_items) ← **Prioridade 1**
2. production_cost ← **Prioridade 2**
3. material_cost ← **Prioridade 3**
4. manual_unit_cost ← **Prioridade 4**
5. 0 ← **Fallback**

**Preço de Venda:**
1. final_sale_price ← **Prioridade 1**
2. sale_price ← **Prioridade 2**
3. 0 ← **Fallback**

## Queries Úteis

### Listar produtos sem custo configurado
```sql
SELECT name, code, sale_price
FROM products
WHERE production_cost IS NULL
  AND material_cost IS NULL
  AND manual_unit_cost IS NULL
ORDER BY name;
```

### Comparar custo real vs teórico
```sql
SELECT
  product_name,
  avg_cost_per_unit as custo_real,
  product_unit_cost as custo_teorico,
  final_cost_per_unit as custo_final,
  CASE
    WHEN avg_cost_per_unit > 0 THEN
      ((product_unit_cost - avg_cost_per_unit) / avg_cost_per_unit * 100)
    ELSE 0
  END as diferenca_percentual
FROM relatorio_total_produtos('2026-02-01', '2026-02-05')
WHERE avg_cost_per_unit > 0
  AND product_unit_cost > 0
ORDER BY diferenca_percentual DESC;
```

### Produtos mais rentáveis
```sql
SELECT
  product_name,
  total_quantity,
  margin_per_unit,
  margin_percentage,
  (margin_per_unit * total_quantity) as lucro_total
FROM relatorio_total_produtos('2026-01-01', '2026-02-05')
WHERE margin_per_unit > 0
ORDER BY lucro_total DESC
LIMIT 10;
```

## Status

✅ **IMPLEMENTADO E TESTADO**

- Função SQL atualizada
- JOIN com products funcionando
- Custos teóricos como fallback
- Margem real calculada
- Interface com novas colunas
- Indicadores visuais
- Build compilado sem erros
