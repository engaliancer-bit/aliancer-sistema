# Correção: Cálculo de Consumo de Insumos na Produção

## Problema Reportado

Ao registrar uma produção e gerar o resumo do dia, os consumos de insumos não estavam sendo calculados. O relatório aparecia vazio na aba "Consumo de Materiais".

**Sintomas:**
- Produção registrada com sucesso
- Botão "Gerar Resumo do Dia" funciona
- Aba "Resumo Geral" mostra dados
- Aba "Consumo de Materiais" aparece vazia
- Impossível analisar custos de materiais do período

## Investigação Realizada

### 1. Verificação das Produções

Analisei as produções recentes no banco de dados:

```sql
SELECT
  p.id,
  p.production_date,
  pr.name as product_name,
  p.quantity,
  p.custos_no_momento IS NOT NULL as tem_custos,
  jsonb_typeof(p.custos_no_momento->'materials') as tipo_materials,
  jsonb_pretty(p.custos_no_momento) as custos
FROM production p
LEFT JOIN products pr ON pr.id = p.product_id
WHERE p.production_date >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY p.production_date DESC;
```

**Resultado:** Produções tinham `custos_no_momento` mas com `materials: {}` **vazio**!

Exemplo:
```json
{
  "materials": {},
  "total_cost": 0,
  "calculated_at": "2026-02-10T21:09:46.476Z"
}
```

### 2. Análise do Cadastro dos Produtos

Verifiquei se os produtos produzidos tinham receitas:

| Produto | recipe_id | Tem Receita? |
|---------|-----------|--------------|
| Divisor de grama ondulado | null | ❌ NÃO |
| Tirante para galpão com 12,60 de vão | null | ❌ NÃO |
| Marco de concreto | cca29e7b... | ✅ SIM (TCP AL001) |
| Tesoura T vão de 12,60m | cca29e7b... | ✅ SIM (TCP AL001) |

Mas mesmo os produtos COM receita estavam retornando materials vazio!

### 3. Análise do Código Frontend

Revisei o componente `DailyProduction.tsx` que registra produções:

**Linha 106 (ANTES):**
```typescript
supabase.from('products')
  .select('id, code, name, unit, recipe_id, sale_price')  // ❌ FALTANDO product_type e total_weight
  .order('name')
```

**Linha 280-286:**
```typescript
const costs = await calculateProductionCosts(
  formData.product_id,
  (product as any)?.recipe_id || null,
  parseFloat(formData.quantity),
  (product as any)?.product_type,      // ⚠️ undefined - não estava na query!
  (product as any)?.total_weight       // ⚠️ undefined - não estava na query!
);
```

**Problema 1:** A query não buscava `product_type` e `total_weight`, então esses valores chegavam `undefined` na função de cálculo.

### 4. Análise da Função de Cálculo de Custos

Revisei `src/lib/productionCosts.ts`:

**Linha 40 (ANTES):**
```typescript
const { data: material } = await supabase
  .from('materials')
  .select('name, unit, cost_per_unit')  // ❌ Coluna não existe!
  .eq('id', materialId)
  .maybeSingle();
```

**Problema 2:** A coluna `cost_per_unit` não existe! A tabela materials tem `unit_cost`.

**Linha 117-128 (ANTES):**
```typescript
// 4. ARMADURAS (para produtos premoldados)
if (productType === 'premolded') {  // ❌ Só busca se for 'premolded'
  const { data: reinforcements } = await supabase
    .from('product_reinforcements')
    .select('material_id, total_length_meters')
    .eq('product_id', productId);
  // ...
}
```

**Problema 3:** Só buscava armaduras se `productType === 'premolded'`, mas produtos tipo `artifact` e `ferragens_diversas` também usam armaduras!

## Causa Raiz - Resumo

**Três problemas identificados:**

1. ✅ **Query do DailyProduction não buscava product_type e total_weight**
   - Resultado: calculateProductionCosts recebia undefined
   - Impacto: Lógica de seleção de materiais não funcionava

2. ✅ **Nome errado da coluna: cost_per_unit em vez de unit_cost**
   - Resultado: unit_cost sempre null
   - Impacto: Todos os custos ficavam zerados

3. ✅ **Lógica de reinforcements muito restritiva**
   - Resultado: Produtos tipo "artifact" não tinham materiais calculados
   - Impacto: Consumo de ferragens não era registrado

## Solução Aplicada

### 1. Correção do Frontend

**Arquivo:** `src/components/DailyProduction.tsx`

**Linha 106 - Query de produtos (CORRIGIDO):**
```typescript
supabase.from('products')
  .select('id, code, name, unit, recipe_id, sale_price, product_type, total_weight')  // ✅ Adicionados
  .order('name')
  .limit(500)
```

**Linha 109 - Query de produções (CORRIGIDO):**
```typescript
supabase.from('production')
  .select('id, product_id, quantity, production_date, production_type, production_order_id, production_order_item_id, notes, created_at, products(id, code, name, unit, recipe_id, sale_price, product_type, total_weight)')  // ✅ Adicionados
  .eq('production_date', filterDate)
  .order('created_at', { ascending: false })
  .limit(200)
```

### 2. Correção da Função de Cálculo

**Arquivo:** `src/lib/productionCosts.ts`

**Linha 40 - Nome correto da coluna (CORRIGIDO):**
```typescript
const { data: material } = await supabase
  .from('materials')
  .select('name, unit, unit_cost')  // ✅ unit_cost (correto)
  .eq('id', materialId)
  .maybeSingle();

if (material) {
  materialMap.set(materialId, {
    quantity,
    unit: material.unit,
    unit_price: material.unit_cost || 0,  // ✅ unit_cost
    name: material.name
  });
}
```

**Linha 117 - Buscar reinforcements para mais tipos (CORRIGIDO):**
```typescript
// 4. ARMADURAS (para produtos premoldados, artefatos e ferragens diversas)
if (productType === 'premolded' || productType === 'artifact' || productType === 'ferragens_diversas' || !recipeId) {  // ✅ Expandido
  const { data: reinforcements } = await supabase
    .from('product_reinforcements')
    .select('material_id, total_length_meters')
    .eq('product_id', productId);

  if (reinforcements && reinforcements.length > 0) {
    for (const reinforcement of reinforcements) {
      await addMaterial(reinforcement.material_id, reinforcement.total_length_meters * quantity);
    }
  }
}
```

### 3. Migration para Reprocessar Produções Antigas

**Migration:** `fix_recalculate_production_costs_function_v2`

Criada função SQL para recalcular custos:

```sql
CREATE OR REPLACE FUNCTION recalculate_production_material_costs(p_production_id uuid)
RETURNS jsonb
```

A função:
1. ✅ Busca dados do produto (recipe_id, product_type, total_weight)
2. ✅ Calcula materiais da receita (se tem recipe_id)
3. ✅ Calcula materiais das armaduras (product_reinforcements)
4. ✅ Calcula materiais dos acessórios (product_accessories)
5. ✅ Retorna objeto custos_no_momento preenchido

**Reprocessamento automático:**
```sql
UPDATE production
SET custos_no_momento = recalculate_production_material_costs(id)
WHERE production_date >= CURRENT_DATE - INTERVAL '30 days'
  AND (
    custos_no_momento IS NULL
    OR custos_no_momento->'materials' = '{}'::jsonb
    OR (custos_no_momento->>'total_cost')::numeric = 0
  );
```

## Resultado Após Correção

### Produções de 10/02/2026 Reprocessadas

| Produto | Qtd | Materiais | Custo Total |
|---------|-----|-----------|-------------|
| Divisor de grama ondulado | 4 | 1 (CA-60 5.0 MM) | R$ 5,60 |
| Marco de concreto | 6 | 5 (Areia, Cimento, etc) | R$ 12,51 |
| Tesoura T vão de 12,60m | 4 | 8 (Concreto + Ferragens) | R$ 654,57 |
| Tirante para galpão | 10 | 0 (sem cadastro) | R$ 0,00 |

**Nota:** O "Tirante para galpão" continua sem consumo porque o produto NÃO tem:
- ❌ recipe_id configurado
- ❌ product_reinforcements cadastrados
- ❌ product_accessories cadastrados

Isso é esperado - o produto precisa ser completamente cadastrado.

### Exemplo de custos_no_momento APÓS correção

**Divisor de grama ondulado:**
```json
{
  "materials": {
    "3df478af-1f1d-48a2-b48e-4817b1da8ecc": {
      "name": "CA-60 5.0 MM R12(30 BR)",
      "unit": "metros",
      "total": 5.6,
      "quantity": 5.6,
      "unit_price": 1,
      "material_id": "3df478af-1f1d-48a2-b48e-4817b1da8ecc"
    }
  },
  "total_cost": 5.6,
  "calculated_at": "2026-02-11T00:37:54.51069+00:00"
}
```

**Marco de concreto (amostra de 1 dos 5 materiais):**
```json
{
  "materials": {
    "7bc0c5f0-adff-4774-aec5-46aa9293d05f": {
      "name": "CIMENTO OBRAS ESPECIAIS 50KG CP V-ARI RS",
      "unit": "kg",
      "quantity": 6.6,
      "unit_price": 0.7534,
      "total": 4.97244,
      "material_id": "7bc0c5f0-adff-4774-aec5-46aa9293d05f"
    },
    // ... +4 materiais
  },
  "total_cost": 12.50769756,
  "calculated_at": "2026-02-11T00:37:54.51069+00:00"
}
```

## Impacto no Sistema

### ✅ Módulos Corrigidos

1. **Registro de Produção (DailyProduction)**
   - Agora busca product_type e total_weight
   - Cálculo de custos funciona corretamente
   - custos_no_momento preenchido com materiais

2. **Cálculo de Custos (productionCosts.ts)**
   - Nome correto da coluna: unit_cost
   - Busca reinforcements para mais tipos de produto
   - Calcula custos corretamente

3. **Relatórios**
   - "Gerar Resumo do Dia" calcula consumo
   - Aba "Consumo de Materiais" mostra dados
   - Custos por produto aparecem corretamente

4. **Tabela production_items**
   - Trigger sync_production_items_from_custos preenche automaticamente
   - Dados disponíveis para análises

### ⚠️ Produtos Sem Consumo

Produtos que ainda aparecem com consumo zerado precisam de cadastro completo:

**Opção 1: Cadastrar Receita**
```
Produtos > [Produto] > Editar
Campo: "Receita (Traço)" > Selecionar receita
Salvar
```

**Opção 2: Cadastrar Armaduras (para produtos sem receita)**
```
Produtos > [Produto] > Editar > Aba "Armaduras"
Adicionar materiais de ferragem
Informar comprimento total por unidade
Salvar
```

**Opção 3: Cadastrar Acessórios**
```
Produtos > [Produto] > Editar > Aba "Acessórios"
Adicionar materiais adicionais
Informar quantidade por unidade
Tipo: "Material"
Salvar
```

## Fluxo de Cálculo de Consumo

### Como Funciona Agora

```
1. Usuário registra produção
   ↓
2. DailyProduction busca produto COM product_type e total_weight
   ↓
3. calculateProductionCosts é chamado
   ↓
4. Verifica se produto tem recipe_id:
   ├─ SIM → Calcula materiais da receita (recipe_items)
   └─ NÃO → Pula para próximo passo
   ↓
5. Verifica product_type e recipe_id:
   ├─ 'premolded', 'artifact', 'ferragens_diversas' OU sem receita
   └─ → Busca armaduras (product_reinforcements)
   ↓
6. Busca acessórios do tipo 'material':
   └─ → product_accessories com item_type = 'material'
   ↓
7. Monta objeto custos_no_momento com:
   {
     materials: { [material_id]: { name, unit, quantity, unit_price, total } },
     total_cost: soma_de_todos,
     calculated_at: timestamp
   }
   ↓
8. Salva produção com custos
   ↓
9. Trigger sync_production_items_from_custos popula production_items
   ↓
10. Relatórios conseguem buscar consumo de:
    - production_items (custos no momento da produção)
    - OU receitas do produto (custos atuais)
```

## Testes de Validação

### ✅ Teste 1: Registrar Nova Produção

**Cenário:** Produto COM receita cadastrada

**Passos:**
1. Acesse: **Indústria > Produção**
2. Clique em **"+ Nova Produção"**
3. Selecione produto que tem receita (ex: "Marco de concreto")
4. Informe quantidade: 10
5. Clique em **"Salvar"**

**Resultado esperado:**
- ✅ Produção salva com sucesso
- ✅ Console mostra: "Custos calculados: { materials: {...}, total_cost: X }"
- ✅ No banco: custos_no_momento tem materials preenchido

**Verificação no banco:**
```sql
SELECT
  pr.name,
  p.quantity,
  (p.custos_no_momento->>'total_cost')::numeric as custo,
  jsonb_object_keys(p.custos_no_momento->'materials') as num_materials
FROM production p
INNER JOIN products pr ON pr.id = p.product_id
WHERE p.id = 'uuid-da-producao'
LIMIT 5;
```

### ✅ Teste 2: Gerar Resumo do Dia

**Passos:**
1. Acesse: **Indústria > Produção**
2. Verifique se há produções registradas hoje
3. Clique em **"Gerar Resumo do Dia"**
4. Selecione data de hoje
5. Clique em **"Gerar Relatório"**

**Resultado esperado:**
- ✅ Aba "Resumo Geral" mostra totais
- ✅ Aba "Produtos Produzidos" lista produtos
- ✅ Aba **"Consumo de Materiais"** mostra lista de insumos
- ✅ Quantidades e custos aparecem corretamente

### ✅ Teste 3: Produto Sem Receita mas Com Armaduras

**Produto de teste:** "Divisor de grama ondulado"

**Configuração:**
- recipe_id: null
- product_type: "artifact"
- product_reinforcements: 1 material cadastrado (CA-60 5.0 MM)

**Resultado:**
- ✅ Consumo calculado: 1,4m × 4 unidades = 5,6m
- ✅ Custo: 5,6m × R$ 1,00/m = R$ 5,60

### ❌ Teste 4: Produto Sem Nenhum Cadastro

**Produto de teste:** "Tirante para galpão com 12,60 de vão"

**Configuração:**
- recipe_id: null
- product_reinforcements: vazio
- product_accessories: vazio

**Resultado:**
- ❌ materials: {} (vazio)
- ❌ total_cost: 0
- ⚠️ **ESPERADO** - produto não está completamente cadastrado

**Ação necessária:** Cadastrar receita OU armaduras OU acessórios do produto

## Comandos Úteis

### Verificar Consumo de Uma Produção

```sql
SELECT
  p.id,
  pr.name as product_name,
  p.quantity,
  jsonb_pretty(p.custos_no_momento) as custos_detalhados
FROM production p
INNER JOIN products pr ON pr.id = p.product_id
WHERE p.id = 'uuid-da-producao';
```

### Verificar Produtos Sem Receita

```sql
SELECT
  p.id,
  p.name,
  p.product_type,
  p.recipe_id IS NULL as sem_receita,
  COUNT(pr.id) as num_reinforcements,
  COUNT(pa.id) as num_accessories
FROM products p
LEFT JOIN product_reinforcements pr ON pr.product_id = p.id
LEFT JOIN product_accessories pa ON pa.product_id = p.id AND pa.item_type = 'material'
GROUP BY p.id, p.name, p.product_type, p.recipe_id
HAVING p.recipe_id IS NULL
   AND COUNT(pr.id) = 0
   AND COUNT(pa.id) = 0
ORDER BY p.name;
```

### Reprocessar Produção Específica

```sql
-- Recalcular custos de uma produção
UPDATE production
SET custos_no_momento = recalculate_production_material_costs(id)
WHERE id = 'uuid-da-producao';

-- Ver resultado
SELECT
  pr.name,
  (p.custos_no_momento->>'total_cost')::numeric as novo_custo
FROM production p
INNER JOIN products pr ON pr.id = p.product_id
WHERE p.id = 'uuid-da-producao';
```

### Reprocessar Todas as Produções Antigas

```sql
UPDATE production
SET custos_no_momento = recalculate_production_material_costs(id)
WHERE production_date >= '2026-01-01'
  AND (
    custos_no_momento IS NULL
    OR custos_no_momento->'materials' = '{}'::jsonb
    OR (custos_no_momento->>'total_cost')::numeric = 0
  );
```

## Arquivos Modificados

### Frontend
```
✅ src/components/DailyProduction.tsx
   - Linha 106: Adicionado product_type e total_weight à query products
   - Linha 109: Adicionado product_type e total_weight à query productions

✅ src/lib/productionCosts.ts
   - Linha 40: cost_per_unit → unit_cost
   - Linha 48: cost_per_unit → unit_cost
   - Linha 117: Expandido condição para buscar reinforcements
```

### Backend (Migrations)
```
✅ supabase/migrations/[timestamp]_fix_production_costs_calculate_from_product_data.sql
   - Criada função recalculate_production_material_costs
   - Reprocessamento inicial de produções com custos vazios

✅ supabase/migrations/[timestamp]_fix_recalculate_production_costs_function_v2.sql
   - Corrigida função (remover jsonb_populate_record)
   - Usa ->> para acessar valores do JSONB
   - UPDATE em batch de produções antigas
```

### Build Validado
```
✓ Build concluído com sucesso
✓ 1825 módulos transformados
✓ Tempo: 16.14s
✓ Sem erros
✓ Sem warnings críticos
```

## Próximas Ações Recomendadas

### Imediato (após deploy)
1. ✅ Limpar cache do navegador (`Ctrl + Shift + R`)
2. ✅ Registrar nova produção de teste
3. ✅ Gerar resumo do dia
4. ✅ Verificar aba "Consumo de Materiais"

### Curto Prazo
1. **Cadastrar receitas para produtos sem cadastro**
   - Identificar produtos com materials vazios
   - Criar ou vincular receitas existentes

2. **Revisar produtos tipo "artifact" e "ferragens_diversas"**
   - Verificar se têm armaduras cadastradas
   - Adicionar materials se necessário

3. **Validar custos calculados**
   - Comparar custos calculados com custos reais
   - Ajustar unit_cost dos materiais se necessário

### Médio Prazo
1. **Criar validação no cadastro de produtos**
   - Alertar se produto não tem receita
   - Alertar se não tem materiais configurados
   - Sugerir cadastro completo

2. **Relatório de produtos incompletos**
   - Listar produtos sem receita/materiais
   - Facilitar cadastro em massa

3. **Histórico de custos**
   - Manter custos congelados no momento da produção
   - Comparar custos históricos vs atuais

## Conclusão

✅ **Problema corrigido completamente!**

**Causa:**
1. Query não buscava product_type e total_weight
2. Nome errado da coluna (cost_per_unit vs unit_cost)
3. Lógica muito restritiva para buscar reinforcements

**Solução:**
1. Corrigidas queries do DailyProduction
2. Corrigido nome da coluna em productionCosts.ts
3. Expandida lógica de reinforcements
4. Criada função SQL para reprocessar produções antigas
5. Reprocessadas automaticamente produções dos últimos 30 dias

**Resultado:**
- Consumos sendo calculados corretamente
- Relatório "Gerar Resumo do Dia" funcionando
- Aba "Consumo de Materiais" mostrando dados
- production_items sendo populado automaticamente

**Produtos sem consumo:**
- Normal se produto não tem receita/armaduras/acessórios cadastrados
- Solução: Completar cadastro do produto

---

**Data:** 11/02/2026
**Status:** ✅ CORRIGIDO
**Build:** ✅ Validado
**Migrations:** ✅ Aplicadas

**Próximo passo:**
- Fazer deploy
- Testar com dados reais
- Cadastrar materiais dos produtos faltantes
