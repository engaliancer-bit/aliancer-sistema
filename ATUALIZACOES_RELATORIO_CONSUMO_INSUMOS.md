# Atualizações: Relatório de Consumo e Exclusão de Ajustes

## Alterações Implementadas

### 1. Exclusão de Ajustes de Estoque no Resumo do Dia

**Problema:** No resumo do dia, ajustes de estoque (como o ajuste de 13.916 peças do Paver retangular em 28/01) eram contabilizados no consumo de insumos, distorcendo o cálculo real de consumo de materiais.

**Solução Implementada:**

#### DailyProduction.tsx (Função `generateConsumptionSummary`)

```typescript
// Buscar IDs de produções que são ajustes de estoque
const productionIds = [...new Set(consumptionData?.map((m: any) => m.production_id).filter(Boolean))];
const { data: productionsWithNotes } = await supabase
  .from('production')
  .select('id, notes')
  .in('id', productionIds);

const adjustmentProductionIds = new Set(
  productionsWithNotes
    ?.filter((p: any) => p.notes && p.notes.toLowerCase().includes('ajuste de estoque'))
    .map((p: any) => p.id) || []
);

// Filtrar movimentos excluindo ajustes
(consumptionData || []).forEach((movement: any) => {
  if (adjustmentProductionIds.has(movement.production_id)) {
    console.log('Movimento excluído (ajuste de estoque):', movement);
    return; // Pular este movimento
  }
  // ... resto do código
});
```

**Como funciona:**
1. Busca todos os movimentos de materiais do dia
2. Identifica produções com notas contendo "ajuste de estoque"
3. Exclui movimentos relacionados a essas produções
4. Calcula consumo e custos apenas com produções reais

**Resultado:**
- Resumo do dia mostra apenas consumo de produções reais
- Ajustes de estoque não afetam mais o cálculo de custo de produção
- Margem de lucro calculada com precisão

---

### 2. Relatório de Consumo de Insumos por Período

**Nova Funcionalidade:** Adicionada seção "Consumo de Insumos (Período Agregado)" no Relatório de Produção.

#### SalesReport.tsx

**Interface criada:**
```typescript
interface MaterialConsumptionSummary {
  material_id: string;
  material_name: string;
  total_quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}
```

**Função implementada:**
```typescript
async function loadMaterialConsumption(startDate: string, endDate: string) {
  // 1. Buscar produções do período (excluindo ajustes)
  const validProductionIds = (productionsData || [])
    .filter((p: any) => {
      const notes = (p.notes || '').toLowerCase();
      return !notes.includes('ajuste de estoque');
    })
    .map((p: any) => p.id);

  // 2. Buscar movimentos de materiais
  const { data: movementsData } = await supabase
    .from('material_movements')
    .select('quantity, material_id, materials (id, name, unit, unit_cost)')
    .in('production_id', validProductionIds)
    .eq('movement_type', 'saida');

  // 3. Agregar por material
  const aggregatedByMaterial = {};
  movementsData.forEach(movement => {
    // Soma quantidade e custo total por material
  });

  return aggregatedByMaterial;
}
```

**Exibição na Interface:**

Nova seção após "Resumo por Produto" com tabela mostrando:

| Material | Quantidade Total | Unidade | Valor Unitário | Valor Total |
|----------|-----------------|---------|----------------|-------------|
| Areia média | 5.847,35 | kg | R$ 0,15 | R$ 877,10 |
| Pedrisco | 8.122,90 | kg | R$ 0,20 | R$ 1.624,58 |
| Cimento | 3.350,22 | kg | R$ 0,85 | R$ 2.847,69 |
| ... | ... | ... | ... | ... |
| **TOTAL GERAL** | | | | **R$ 15.234,87** |

**Recursos:**
- Agregação automática por material
- Soma de consumo de todos os produtos que usaram o mesmo material
- Cálculo de valor unitário e total
- Total geral de custos do período
- Exclusão automática de ajustes de estoque

---

## Regras de Negócio Aplicadas

### Identificação de Ajustes de Estoque

Um registro de produção é considerado "ajuste de estoque" quando:
- Campo `notes` contém texto "Ajuste de estoque" (case insensitive)
- Exemplo: "Ajuste de estoque (entrada)", "ajuste de estoque - balanço"

### Períodos Suportados no Relatório

- **Dia:** Consumo de um dia específico
- **Semana:** Consumo de domingo a sábado
- **Mês:** Consumo do mês inteiro
- **Ano:** Consumo anual completo

### Agregação de Materiais

**Exemplo Prático:**

Se no período foram produzidos:
- 100 Blocos de concreto (consome 150kg de cimento)
- 50 Pavers (consome 75kg de cimento)
- 30 Postes (consome 100kg de cimento)

**Relatório mostrará:**
- Cimento: 325kg total (150 + 75 + 100)
- Valor unitário: R$ 0,85/kg
- Valor total: R$ 276,25

---

## Arquivos Modificados

### 1. DailyProduction.tsx
**Linhas alteradas:** 615-731

**Alterações:**
- Adicionado filtro para excluir ajustes de estoque
- Modificada função `generateConsumptionSummary`
- Adicionado log de depuração para movimentos excluídos

### 2. SalesReport.tsx
**Linhas alteradas:** 40-47 (interfaces), 100-110 (loadData), 262-341 (loadMaterialConsumption), 1025-1101 (UI)

**Alterações:**
- Nova interface `MaterialConsumptionSummary`
- Novo estado `materialConsumption`
- Nova função `loadMaterialConsumption`
- Nova seção de UI com tabela de consumo agregado

---

## Como Testar

### Teste 1: Verificar Exclusão de Ajustes

1. Acesse **Produção**
2. Selecione a data **28/01/2026**
3. Clique em **"Gerar Resumo do Dia"**
4. **Verificar:** O produto "Paver retangular 10x20x06" (13.916 peças) NÃO deve aparecer no consumo de insumos
5. **Verificar:** No console do navegador, você verá logs: "Movimento excluído (ajuste de estoque)"

### Teste 2: Verificar Relatório de Consumo de Insumos

1. Acesse **Relatório de Produção**
2. Selecione período: **Mês**
3. Selecione data: **Janeiro/2026**
4. **Verificar:** Nova seção "Consumo de Insumos (Período Agregado)"
5. **Verificar:** Lista de materiais com:
   - Nome do material
   - Quantidade total consumida
   - Unidade
   - Valor unitário
   - Valor total
6. **Verificar:** Linha de total geral no final
7. **Verificar:** Materiais estão agregados (ex: todo consumo de "Areia média" somado)

### Teste 3: Comparação de Valores

1. No Relatório de Produção, anote o **"Custo Total"** da seção de resumo
2. Compare com o **"TOTAL GERAL"** da seção "Consumo de Insumos"
3. **Esperado:** Valores devem ser idênticos ou muito próximos

---

## Exemplo de Query SQL para Validação

```sql
-- Verificar consumo agregado de materiais em janeiro/2026
WITH producoes_validas AS (
  SELECT id
  FROM production
  WHERE production_date >= '2026-01-01'
    AND production_date <= '2026-01-31'
    AND (notes IS NULL OR notes NOT ILIKE '%ajuste de estoque%')
)
SELECT
  m.name as material,
  SUM(mm.quantity) as quantidade_total,
  m.unit as unidade,
  m.unit_cost as valor_unitario,
  SUM(mm.quantity * m.unit_cost) as valor_total
FROM material_movements mm
JOIN materials m ON mm.material_id = m.id
WHERE mm.production_id IN (SELECT id FROM producoes_validas)
  AND mm.movement_type = 'saida'
GROUP BY m.id, m.name, m.unit, m.unit_cost
ORDER BY m.name;
```

---

## Benefícios

1. **Precisão:** Cálculo de custos sem distorções de ajustes de estoque
2. **Visibilidade:** Relatório claro de consumo por material no período
3. **Gestão:** Fácil identificar quais materiais mais impactam o custo
4. **Planejamento:** Base para projeção de compras futuras
5. **Análise:** Comparação de consumo entre períodos

---

## Observações Importantes

1. **Ajustes de Estoque:** Sempre adicione a observação "Ajuste de estoque" em produções que são apenas correções de saldo
2. **Retroativo:** A exclusão funciona para todos os registros históricos que contêm "ajuste de estoque" nas notas
3. **Performance:** O sistema busca apenas produções do período selecionado
4. **Cache:** Não há cache, sempre busca dados atualizados do banco

---

## Data da Implementação

**Data:** 01/02/2026
**Build:** Compilado com sucesso em 1m 12s
**Status:** Pronto para produção
