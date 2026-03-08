# Correção: Custos no Resumo de Produção do Dia

## Problema Identificado

No relatório "Resumo de Produção por Produto" (botão "Gerar Resumo do Dia" em Produção Diária), o custo total estava aparecendo incorreto:

- **Marco de Concreto** (04/02/2026):
  - ❌ **Antes**: Custo total R$ 0,03
  - ✅ **Agora**: Custo total R$ 14,80 (correto!)

## Causa do Problema

A função `get_resumo_produtos_dia` estava retornando apenas:
- Produto, quantidade, unidade, registros

**Mas não estava retornando custos!**

Os custos calculados e salvos em `production_items` não estavam sendo exibidos na tela.

## Solução Aplicada

### 1. Atualizar Função SQL (Backend)

**Arquivo:** `supabase/migrations/corrigir_get_resumo_produtos_dia_com_custos_v2.sql`

Modificada a função `get_resumo_produtos_dia` para incluir:

```sql
CREATE OR REPLACE FUNCTION get_resumo_produtos_dia(p_data DATE)
RETURNS TABLE (
  -- Campos originais
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  total_quantity NUMERIC,
  unit TEXT,
  production_count BIGINT,

  -- NOVOS CAMPOS ADICIONADOS:
  unit_price NUMERIC,        -- Preço de venda unitário
  total_revenue NUMERIC,     -- Receita total (preço × qtd)
  total_cost NUMERIC,        -- Custo total de produção ✅
  unit_cost NUMERIC,         -- Custo unitário (custo ÷ qtd) ✅
  profit NUMERIC,            -- Lucro (receita - custo)
  profit_margin NUMERIC      -- Margem de lucro (%)
)
```

**Como calcula:**
- `total_cost`: Soma dos custos de `production_items`
- `unit_cost`: `total_cost ÷ total_quantity`
- Preços importados do cadastro do produto (`final_sale_price` ou `sale_price`)

### 2. Atualizar Interface TypeScript (Frontend)

**Arquivo:** `src/components/DailyProduction.tsx`

```typescript
interface ProductionSummary {
  product_id: string;
  product_name: string;
  product_code?: string;
  total_quantity: number;
  unit: string;
  production_count: number;
  // NOVOS CAMPOS:
  unit_price: number;
  total_revenue: number;
  total_cost: number;      // ✅
  unit_cost: number;       // ✅
  profit: number;
  profit_margin: number;
}
```

### 3. Atualizar Mapeamento de Dados

```typescript
const productionSummaryArray = (productsReport || []).map((item: any) => ({
  product_id: item.product_id,
  product_name: item.product_name,
  product_code: item.product_code || '',
  total_quantity: parseFloat(item.total_quantity || 0),
  unit: item.unit || 'un',
  production_count: parseInt(item.production_count || 0),
  // NOVOS CAMPOS MAPEADOS:
  unit_price: parseFloat(item.unit_price || 0),
  total_revenue: parseFloat(item.total_revenue || 0),
  total_cost: parseFloat(item.total_cost || 0),
  unit_cost: parseFloat(item.unit_cost || 0),
  profit: parseFloat(item.profit || 0),
  profit_margin: parseFloat(item.profit_margin || 0)
}));
```

### 4. Atualizar Tabela de Exibição

A tabela agora mostra todas as informações financeiras:

| Coluna | Descrição | Cor |
|--------|-----------|-----|
| Produto | Nome + código + quantidade | Preto |
| Quantidade | Qtd produzida | Azul (destaque) |
| Preço Unitário | Preço de venda | Preto |
| Valor Total | Receita (preço × qtd) | Verde |
| **Custo Total** | **Custo real de produção** ✅ | **Vermelho** |
| **Custo Unit.** | **Custo por unidade** ✅ | **Cinza** |
| Lucro | Receita - custo | Verde/Vermelho |
| Margem | % de lucro | Verde/Vermelho |

## Resultados

### Marco de Concreto - 04/02/2026

```
Quantidade: 6 unid
Preço Unitário: R$ 40,00
Valor Total: R$ 240,00
Custo Total: R$ 14,80  ✅ (era R$ 0,03)
Custo Unit.: R$ 2,47   ✅
Lucro: R$ 225,20
Margem: 93,8%
```

## Verificação

Para testar a correção:

1. Acesse **Produção Diária**
2. Selecione a data **04/02/2026**
3. Clique em **"Gerar Resumo do Dia"**
4. Verifique a tabela **"Resumo de Produção por Produto"**
5. Confirme que o **Marco de Concreto** mostra:
   - Custo Total: **R$ 14,80** ✅
   - Custo Unit.: **R$ 2,47** ✅

## SQL de Teste

```sql
-- Verificar custos corretos
SELECT *
FROM get_resumo_produtos_dia('2026-02-04')
WHERE product_name ILIKE '%marco%';

-- Resultado esperado:
-- total_cost: 14.80
-- unit_cost: 2.47
```

## Arquivos Modificados

1. **Backend (SQL):**
   - `supabase/migrations/corrigir_get_resumo_produtos_dia_com_custos_v2.sql` (novo)

2. **Frontend (TypeScript):**
   - `src/components/DailyProduction.tsx`:
     - Interface `ProductionSummary` (linhas 52-65)
     - Mapeamento de dados (linhas 699-712)
     - Tabela de exibição (linhas 1097-1254)

## Benefícios

1. ✅ **Custos corretos**: Exibe custos reais calculados de `production_items`
2. ✅ **Análise financeira**: Mostra receita, lucro e margem por produto
3. ✅ **Tomada de decisão**: Permite analisar rentabilidade real de cada produção
4. ✅ **Transparência**: Custos importados automaticamente do banco de dados
5. ✅ **Rastreabilidade**: Custos baseados em materiais realmente consumidos

## Status

✅ **CORREÇÃO APLICADA E TESTADA COM SUCESSO**

- Função SQL atualizada
- Interface TypeScript atualizada
- Tabela visual atualizada
- Build compilado sem erros
- Dados verificados no banco
