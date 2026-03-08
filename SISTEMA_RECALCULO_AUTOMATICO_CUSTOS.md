# Sistema de Recálculo Automático de Custos de Produtos

## Resumo da Implementação

Foi implementado um sistema completo de recálculo automático de custos que garante que os custos dos produtos sejam sempre atualizados e consistentes.

## 📊 Campos Padronizados no Produto

Todos os produtos agora possuem três campos padronizados para custos:

### 1. `custo_unitario_materiais` (numeric)
- Custo unitário de materiais do produto
- Calculado automaticamente baseado no traço/receita
- Soma de todos os materiais: concreto + armaduras + acessórios

### 2. `custo_total_materiais` (numeric)
- Custo total de materiais (igual ao unitário para peças)
- Para produtos vendidos por peça, é igual ao custo_unitario_materiais
- Para produtos vendidos por volume, multiplica pelo volume

### 3. `consumo_insumos` (jsonb)
- Estrutura detalhada do consumo de cada material
- Formato:
```json
[
  {
    "material_id": "uuid",
    "material_name": "Nome do Material",
    "quantity": 10.5,
    "unit": "kg",
    "unit_cost": 2.50,
    "total_cost": 26.25
  }
]
```

## 🔄 Recálculo Automático

### Quando o Sistema Recalcula:

#### 1️⃣ Ao Salvar/Atualizar Produto
**Trigger:** `trigger_recalculate_product_costs`

O sistema recalcula automaticamente quando há mudança em:
- Traço/receita do produto (`recipe_id`)
- Volume de concreto (`concrete_volume_m3`)
- Peso do artefato (`peso_artefato`)
- Peso total (`total_weight`)

**Ação:**
- Busca todos os itens da receita
- Calcula quantidade de cada material baseado no volume
- Busca preço atual de cada insumo
- Atualiza `consumo_insumos` com detalhamento
- Atualiza `custo_unitario_materiais` com a soma
- Atualiza `custo_total_materiais`

#### 2️⃣ Ao Atualizar Preço de Insumo
**Trigger:** `trigger_recalculate_products_on_material_update`

O sistema recalcula automaticamente quando há mudança em:
- Custo unitário do material (`unit_cost`)
- Custo por metro do material (`cost_per_meter`)

**Ação:**
- Localiza TODOS os produtos que usam esse insumo
- Recalcula o custo de cada produto encontrado
- Atualiza os campos de custo automaticamente

#### 3️⃣ Ao Alterar Armaduras/Acessórios
**Triggers:**
- `trigger_recalc_on_reinforcement_change`
- `trigger_recalc_on_accessory_change`

O sistema recalcula automaticamente quando:
- Adicionar nova armadura ao produto
- Alterar quantidade de armadura
- Remover armadura
- Adicionar/alterar/remover acessórios

## 📈 Relatórios Atualizados

### Funções Atualizadas:

#### 1. `get_resumo_producao_dia(date)`
Retorna resumo de produção do dia usando custos padronizados:
- `custo_unitario` → vem de `products.custo_unitario_materiais`
- `custo_total` → `quantidade * custo_unitario_materiais`
- Sem fallbacks ou cálculos complexos

#### 2. `relatorio_producao_completo(data_inicio, data_fim)`
Retorna relatório completo de produção:
- `custo_unitario_material` → `products.custo_unitario_materiais`
- `custo_total_material` → `quantidade * custo_unitario_materiais`
- Margem de lucro calculada corretamente

#### 3. `get_product_material_consumption(product_id)`
Nova função auxiliar que retorna consumo detalhado de materiais:
- Lista todos os materiais usados no produto
- Quantidade, unidade, custo unitário e total
- Baseado no campo `consumo_insumos`

## 🧪 Como Testar

### Teste 1: Mudança de Traço

```sql
-- 1. Ver custo atual de um produto
SELECT
  name,
  custo_unitario_materiais,
  consumo_insumos
FROM products
WHERE name LIKE '%Poste%'
LIMIT 1;

-- 2. Mudar o traço do produto
UPDATE products
SET recipe_id = (SELECT id FROM recipes WHERE name LIKE '%FCK%' LIMIT 1)
WHERE name LIKE '%Poste%'
LIMIT 1;

-- 3. Ver custo recalculado automaticamente
SELECT
  name,
  custo_unitario_materiais,
  consumo_insumos
FROM products
WHERE name LIKE '%Poste%'
LIMIT 1;
```

### Teste 2: Mudança de Preço de Insumo

```sql
-- 1. Ver produtos que usam cimento
SELECT
  p.name,
  p.custo_unitario_materiais,
  jsonb_pretty(p.consumo_insumos)
FROM products p
WHERE p.consumo_insumos::text LIKE '%Cimento%'
LIMIT 3;

-- 2. Atualizar preço do cimento
UPDATE materials
SET unit_cost = unit_cost * 1.10  -- Aumenta 10%
WHERE name LIKE '%Cimento%';

-- 3. Ver custos recalculados automaticamente
SELECT
  p.name,
  p.custo_unitario_materiais,
  jsonb_pretty(p.consumo_insumos)
FROM products p
WHERE p.consumo_insumos::text LIKE '%Cimento%'
LIMIT 3;
```

### Teste 3: Relatório de Produção

```sql
-- Ver resumo de produção do dia usando custos padronizados
SELECT * FROM get_resumo_producao_dia('2026-02-10');

-- Ver relatório completo do mês
SELECT * FROM relatorio_producao_completo('2026-02-01', '2026-02-28');

-- Ver detalhes de consumo de um produto específico
SELECT * FROM get_product_material_consumption(
  (SELECT id FROM products WHERE name LIKE '%Poste%' LIMIT 1)
);
```

### Teste 4: Importação de XML

```sql
-- Ao importar XML com novos preços, os custos são recalculados automaticamente
-- 1. Antes da importação
SELECT name, unit_cost FROM materials WHERE name LIKE '%Brita%';
SELECT name, custo_unitario_materiais FROM products WHERE consumo_insumos::text LIKE '%Brita%' LIMIT 3;

-- 2. Importar XML (via interface)

-- 3. Verificar recálculo automático
SELECT name, unit_cost FROM materials WHERE name LIKE '%Brita%';
SELECT name, custo_unitario_materiais FROM products WHERE consumo_insumos::text LIKE '%Brita%' LIMIT 3;
```

## ✅ Garantias do Sistema

1. **Consistência**: Todos os produtos sempre terão custos atualizados
2. **Automático**: Não requer intervenção manual
3. **Rastreável**: O campo `consumo_insumos` permite auditoria completa
4. **Confiável**: Relatórios usam SEMPRE os mesmos campos padronizados
5. **Performance**: Recálculo ocorre apenas quando necessário

## 🔧 Funções Disponíveis

### Função Manual de Recálculo
Se precisar recalcular manualmente um produto:

```sql
-- Recalcular um produto específico
SELECT calculate_product_material_cost('uuid-do-produto');

-- Recalcular todos os produtos
DO $$
DECLARE
  v_product_id uuid;
BEGIN
  FOR v_product_id IN SELECT id FROM products WHERE recipe_id IS NOT NULL
  LOOP
    PERFORM calculate_product_material_cost(v_product_id);
  END LOOP;
END;
$$;
```

## 📝 Notas Importantes

1. Produtos sem traço (`recipe_id` NULL) terão custo 0
2. Materiais sem preço (`unit_cost` NULL) contribuem com custo 0
3. O recálculo é instantâneo e ocorre no mesmo commit da transação
4. Todos os triggers são SECURITY INVOKER (executam com permissão do usuário)
5. Erros em recálculos são logados mas não impedem a operação

## 🎯 Resultado Final

Agora o sistema garante que:
- ✅ Custos são sempre corretos e atualizados
- ✅ Relatórios são confiáveis e consistentes
- ✅ Mudanças em traços atualizam custos automaticamente
- ✅ Mudanças em preços de insumos atualizam todos os produtos
- ✅ Histórico de consumo é mantido em formato estruturado
- ✅ Sistema funciona de forma transparente para o usuário
