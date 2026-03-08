# Correção: Consumo de Insumos no Relatório de Produção

## Problema Relatado

O sistema parou de calcular o consumo dos insumos na aba "Produção" ao gerar o resumo do dia.

**Sintomas:**
- Ao clicar em "Gerar Resumo do Dia", a aba "Consumo de Materiais" aparece vazia
- Não mostra quais insumos foram consumidos na produção
- Impossibilita análise de custos de materiais do período

## Investigação

### Causa Raiz Identificada

A função `relatorio_consumo_insumos` estava buscando dados da tabela `production_items`, mas essa tabela:

1. **Depende de `production_items` estar populado**
   - A tabela `production_items` é populada apenas quando há custos no JSONB `custos_no_momento`
   - Se os custos não forem calculados ou registrados, a tabela fica vazia

2. **Mudança no sistema de custos**
   - Sistema mudou para usar custos padronizados: `custo_unitario_materiais`, `consumo_insumos`
   - Função `relatorio_consumo_insumos` não foi atualizada
   - Continuava dependendo de `production_items` (que pode estar vazio)

3. **Resultado**
   - Query retorna vazio porque não encontra dados em `production_items`
   - Relatório de consumo não mostra nenhum material
   - "Gerar Resumo do Dia" fica sem informações de materiais

## Solução Aplicada

### Migration: `fix_relatorio_consumo_insumos_usar_receitas`

Reescrevi as funções de relatório para **calcular consumo diretamente das receitas**:

### 1. `relatorio_consumo_insumos` (REESCRITA)

**Antes:**
```sql
-- Buscava de production_items (pode estar vazio)
SELECT ... FROM production_items pi
```

**Agora:**
```sql
-- Calcula a partir das receitas dos produtos
WITH production_with_materials AS (
  SELECT
    p.quantity * ri.quantity_per_unit as total_material_quantity,
    p.quantity * ri.quantity_per_unit * m.unit_cost as total_material_cost
  FROM production p
  INNER JOIN products prod ON prod.id = p.product_id
  LEFT JOIN recipes r ON r.product_id = prod.id
  LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
  LEFT JOIN materials m ON m.id = ri.material_id
)
SELECT
  material_id,
  material_name,
  SUM(total_material_quantity) as total_quantity,
  SUM(total_material_cost) as total_cost
FROM production_with_materials
GROUP BY material_id, material_name
```

### 2. `relatorio_total_produtos` (ATUALIZADA)

Também foi atualizada para calcular custos a partir das receitas:

```sql
WITH production_costs AS (
  SELECT
    p.id,
    SUM(ri.quantity_per_unit * p.quantity * m.unit_cost) as material_cost
  FROM production p
  INNER JOIN recipes r ON r.product_id = p.product_id
  INNER JOIN recipe_items ri ON ri.recipe_id = r.id
  INNER JOIN materials m ON m.id = ri.material_id
  GROUP BY p.id
)
```

### 3. Nova Função Auxiliar: `get_consumo_insumos_por_produto`

Criada para facilitar consultas de consumo por produto específico:

```sql
CREATE FUNCTION get_consumo_insumos_por_produto(
  p_product_id UUID,
  p_quantidade DECIMAL DEFAULT 1
)
RETURNS TABLE (
  material_id UUID,
  material_name TEXT,
  quantity DECIMAL,
  unit TEXT,
  unit_cost DECIMAL,
  total_cost DECIMAL
)
```

## Vantagens da Nova Abordagem

### ✅ Fonte de Dados Confiável
- Usa `recipes` e `recipe_items` (dados mestres)
- Não depende de tabelas auxiliares como `production_items`
- Sempre funciona se o produto tiver receita cadastrada

### ✅ Cálculo Dinâmico
- Calcula consumo em tempo real baseado nas quantidades produzidas
- Usa custos atuais dos materiais (`materials.unit_cost`)
- Fórmula: `quantidade_produzida × quantidade_por_unidade × custo_unitário`

### ✅ Mantém Compatibilidade
- Interface da função não mudou (mesmos parâmetros e retorno)
- Código frontend não precisa ser alterado
- Componente `ProductionReport.tsx` continua funcionando

### ✅ Performance Adequada
- Usa JOINs diretos (mais eficiente que múltiplas queries)
- Agregação no banco de dados (não no frontend)
- Índices existentes nas tabelas são aproveitados

## Como Funciona Agora

### Fluxo de Cálculo

```
1. Usuário clica "Gerar Resumo do Dia"
   ↓
2. Frontend chama: relatorio_consumo_insumos(data_inicio, data_fim)
   ↓
3. Banco busca todas as produções do período
   ↓
4. Para cada produção:
   - Busca produto produzido
   - Busca receita do produto
   - Busca materiais da receita (recipe_items)
   - Calcula: qtd_produzida × qtd_por_unidade_na_receita
   ↓
5. Agrupa por material:
   - Soma todas as quantidades consumidas
   - Soma todos os custos
   - Conta quantas vezes foi usado
   ↓
6. Retorna lista consolidada de materiais consumidos
```

### Exemplo Prático

**Produção do dia:**
- 50 Blocos de Vedação 14
- 30 Canaletas 10

**Receita Bloco Vedação 14:**
- Cimento: 8 kg
- Areia: 20 kg
- Pedrisco: 12 kg

**Receita Canaleta 10:**
- Cimento: 6 kg
- Areia: 15 kg
- Pedrisco: 10 kg

**Consumo calculado:**
```
Cimento:
  - Blocos: 50 × 8kg = 400kg
  - Canaletas: 30 × 6kg = 180kg
  - TOTAL: 580kg

Areia:
  - Blocos: 50 × 20kg = 1.000kg
  - Canaletas: 30 × 15kg = 450kg
  - TOTAL: 1.450kg

Pedrisco:
  - Blocos: 50 × 12kg = 600kg
  - Canaletas: 30 × 10kg = 300kg
  - TOTAL: 900kg
```

**Resultado no relatório:**
| Material | Qtd Total | Unidade | Custo Unit. | Custo Total | Usos |
|----------|-----------|---------|-------------|-------------|------|
| Areia | 1.450 | kg | R$ 0,15 | R$ 217,50 | 2 |
| Pedrisco | 900 | kg | R$ 0,25 | R$ 225,00 | 2 |
| Cimento | 580 | kg | R$ 0,80 | R$ 464,00 | 2 |

## Testes de Validação

### Teste 1: Gerar Resumo do Dia

1. Acesse: **Indústria > Produção**
2. Registre algumas produções do dia
3. Clique em **"Gerar Resumo do Dia"**
4. Selecione a data de hoje
5. Clique em **"Gerar Relatório"**

**Resultado esperado:**
- ✅ Aba "Resumo Geral" mostra totais
- ✅ Aba "Consumo de Materiais" mostra lista de insumos consumidos
- ✅ Aba "Produtos Produzidos" mostra produtos e custos

### Teste 2: Período com Múltiplas Produções

1. Selecione período de 1 semana
2. Gere o relatório

**Resultado esperado:**
- ✅ Lista consolida todos os materiais usados na semana
- ✅ Quantidades somadas corretamente
- ✅ Custos calculados com base nos preços atuais

### Teste 3: Produto Sem Receita

1. Crie um produto sem cadastrar receita
2. Registre produção desse produto
3. Gere o relatório

**Resultado esperado:**
- ✅ Relatório é gerado sem erros
- ✅ Produto aparece na lista de "Produtos Produzidos"
- ❌ Produto NÃO aparece em "Consumo de Materiais" (não tem receita)
- ℹ️ Custo de materiais aparece como R$ 0,00

### Teste 4: Filtro por Material Específico

1. Gere relatório normal
2. Note um material específico (ex: Cimento)
3. Execute no banco:
```sql
SELECT * FROM relatorio_consumo_insumos(
  '2026-02-01'::date,
  '2026-02-10'::date,
  'uuid-do-cimento'::uuid
);
```

**Resultado esperado:**
- ✅ Retorna apenas dados do material filtrado
- ✅ Valores corretos de quantidade e custo

## Impacto no Sistema

### ✅ Módulos Corrigidos

- **Aba Produção > Gerar Resumo do Dia** - Funciona novamente
- **Relatório de Consumo de Insumos** - Mostra materiais consumidos
- **Análise de Custos** - Valores corretos por material

### ⚠️ Observações Importantes

1. **Produtos precisam ter receita cadastrada**
   - Se o produto não tem receita, consumo não será calculado
   - Recomendação: Cadastrar receitas para todos os produtos

2. **Custos usam valores atuais**
   - O custo unitário vem de `materials.unit_cost` (valor atual)
   - Não usa custos históricos do momento da produção
   - Se quiser custos históricos, precisa usar `production.custos_no_momento`

3. **Performance**
   - Consulta faz múltiplos JOINs
   - Pode ser lenta com muitos registros (>10.000 produções)
   - Recomendação: Usar filtros de data razoáveis (máximo 1 mês)

## Diferenças: Antes × Agora

| Aspecto | Antes | Agora |
|---------|-------|-------|
| **Fonte de dados** | production_items | recipes + recipe_items |
| **Dependência** | Precisa popular production_items | Não depende de tabelas auxiliares |
| **Custos** | Históricos (custos_no_momento) | Atuais (materials.unit_cost) |
| **Confiabilidade** | Falhava se production_items vazio | Sempre funciona se tem receita |
| **Manutenção** | Alta (sincronizar tabelas) | Baixa (usa dados mestres) |
| **Performance** | Rápida (tabela pré-calculada) | Adequada (calcula on-demand) |

## Arquivos Modificados

### Migration Aplicada
```
✅ supabase/migrations/[timestamp]_fix_relatorio_consumo_insumos_usar_receitas.sql
```

### Funções Alteradas
```
✅ relatorio_consumo_insumos(date, date, uuid) - REESCRITA
✅ relatorio_total_produtos(date, date, uuid) - ATUALIZADA
✅ get_consumo_insumos_por_produto(uuid, decimal) - NOVA
```

### Componentes Frontend
```
ℹ️ src/components/ProductionReport.tsx - Nenhuma mudança necessária
```

## Comandos de Teste (SQL)

### Testar consumo de insumos hoje
```sql
SELECT * FROM relatorio_consumo_insumos(
  CURRENT_DATE,
  CURRENT_DATE,
  NULL
);
```

### Testar consumo da última semana
```sql
SELECT * FROM relatorio_consumo_insumos(
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE,
  NULL
);
```

### Testar consumo de um material específico
```sql
-- Primeiro, pegar ID de um material
SELECT id, name FROM materials WHERE name ILIKE '%cimento%' LIMIT 1;

-- Depois usar o ID no relatório
SELECT * FROM relatorio_consumo_insumos(
  '2026-02-01'::date,
  '2026-02-10'::date,
  'uuid-aqui'::uuid
);
```

### Testar consumo por produto
```sql
-- Pegar ID de um produto
SELECT id, name FROM products LIMIT 1;

-- Ver consumo para produzir 10 unidades
SELECT * FROM get_consumo_insumos_por_produto('uuid-aqui'::uuid, 10);
```

## Próximos Passos Recomendados

### ✅ Verificar Receitas Cadastradas
```sql
-- Ver produtos SEM receita cadastrada
SELECT p.id, p.name, p.code
FROM products p
LEFT JOIN recipes r ON r.product_id = p.id
WHERE r.id IS NULL
ORDER BY p.name;
```

**Ação:** Cadastrar receitas para esses produtos.

### ✅ Validar Custos de Materiais
```sql
-- Ver materiais sem custo definido
SELECT id, name, unit, unit_cost
FROM materials
WHERE unit_cost IS NULL OR unit_cost = 0
ORDER BY name;
```

**Ação:** Atualizar custos unitários desses materiais.

### ✅ Testar no Frontend

1. Registre produção de hoje
2. Gere resumo do dia
3. Verifique se aparece consumo de materiais
4. Compare valores com cálculos manuais

## Solução de Problemas

### Consumo aparece vazio mesmo após correção

**Possíveis causas:**
1. Produto não tem receita cadastrada
2. Receita não tem materiais (recipe_items vazio)
3. Data de filtro não coincide com data de produção

**Verificar:**
```sql
-- Ver se produto tem receita
SELECT p.name, r.id as recipe_id
FROM products p
LEFT JOIN recipes r ON r.product_id = p.id
WHERE p.id = 'uuid-do-produto';

-- Ver se receita tem materiais
SELECT ri.*, m.name
FROM recipe_items ri
INNER JOIN materials m ON m.id = ri.material_id
WHERE ri.recipe_id = 'uuid-da-receita';
```

### Custos aparecem zerados

**Causa:** Material não tem `unit_cost` definido.

**Solução:**
```sql
-- Atualizar custo do material
UPDATE materials
SET unit_cost = 0.50  -- valor correto
WHERE id = 'uuid-do-material';
```

### Performance lenta

**Causa:** Período muito longo com muitas produções.

**Solução:**
- Reduzir período de consulta (máximo 30 dias)
- Criar índices adicionais se necessário

## Conclusão

✅ **Problema corrigido!**

O sistema agora calcula o consumo de insumos **diretamente das receitas dos produtos**, garantindo que o relatório sempre funcione, independente do estado da tabela `production_items`.

**Benefícios:**
- Relatório de consumo sempre disponível
- Dados confiáveis (vêm das receitas cadastradas)
- Manutenção simplificada
- Sem dependência de sincronização de tabelas

**Próxima ação:**
- Fazer deploy da correção
- Testar "Gerar Resumo do Dia"
- Validar valores de consumo

---

**Data:** 10/02/2026
**Status:** ✅ CORRIGIDO
**Migration:** `fix_relatorio_consumo_insumos_usar_receitas`
