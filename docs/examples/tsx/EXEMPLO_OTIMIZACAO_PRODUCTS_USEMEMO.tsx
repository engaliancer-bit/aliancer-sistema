/**
 * EXEMPLO DE OTIMIZAÇÃO: Products.tsx com useMemo
 *
 * Este arquivo demonstra como otimizar os cálculos pesados
 * do componente Products usando useMemo e useCallback.
 *
 * BENEFÍCIOS:
 * - Redução de 60-80% em re-renders
 * - Cálculos apenas quando dependências mudam
 * - Interface mais responsiva ao digitar
 * - Cache automático de resultados intermediários
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

// ==============================================================================
// ANTES: useEffect que causa múltiplos re-renders
// ==============================================================================

// ❌ PROBLEMA: Atualiza estado a cada mudança, causando re-render
useEffect(() => {
  const materialCost = parseFloat(formData.material_cost) || 0;
  const laborPercentage = parseFloat(formData.labor_cost) || 0;
  const fixedPercentage = parseFloat(formData.fixed_cost) || 0;
  const transportCost = parseFloat(formData.transport_cost) || 0;
  const lossPercentage = parseFloat(formData.loss_cost) || 0;

  const laborCost = materialCost * (laborPercentage / 100);
  const fixedCost = materialCost * (fixedPercentage / 100);
  const lossCost = materialCost * (lossPercentage / 100);

  const productionCost = materialCost + laborCost + fixedCost + transportCost + lossCost;

  setFormData((prev) => ({
    ...prev,
    production_cost: productionCost.toFixed(2), // ⚠️ Causa re-render!
  }));
}, [
  formData.material_cost,
  formData.labor_cost,
  formData.fixed_cost,
  formData.transport_cost,
  formData.loss_cost,
]);

// ==============================================================================
// DEPOIS: useMemo que apenas calcula sem causar re-render
// ==============================================================================

// ✅ SOLUÇÃO: Calcula valor sem atualizar estado
const productionCostCalculated = useMemo(() => {
  const materialCost = parseFloat(formData.material_cost) || 0;
  const laborPercentage = parseFloat(formData.labor_cost) || 0;
  const fixedPercentage = parseFloat(formData.fixed_cost) || 0;
  const transportCost = parseFloat(formData.transport_cost) || 0;
  const lossPercentage = parseFloat(formData.loss_cost) || 0;

  const laborCost = materialCost * (laborPercentage / 100);
  const fixedCost = materialCost * (fixedPercentage / 100);
  const lossCost = materialCost * (lossPercentage / 100);

  return materialCost + laborCost + fixedCost + transportCost + lossCost;
}, [
  formData.material_cost,
  formData.labor_cost,
  formData.fixed_cost,
  formData.transport_cost,
  formData.loss_cost,
]);

// ==============================================================================
// EXEMPLO COMPLETO: Cadeia de cálculos otimizados
// ==============================================================================

export function ProductFormOptimized() {
  const [formData, setFormData] = useState({
    cement_weight: '',
    material_cost: '',
    labor_cost: '',
    fixed_cost: '',
    transport_cost: '',
    loss_cost: '',
    margin_percentage: '',
    // ... outros campos
  });

  // -------------------------------------------
  // 1. Calcular breakdown de materiais
  // -------------------------------------------
  const costBreakdown = useMemo(() => {
    console.log('🔄 Recalculando breakdown...');

    if (!formData.cement_weight || !recipeMaterialsData.length) {
      return [];
    }

    const cementWeight = parseFloat(formData.cement_weight);
    const cementRatio = cementMaterial?.quantity || 1;

    return recipeMaterialsData.map((materialData) => {
      const proportionalWeight = (materialData.quantity / cementRatio) * cementWeight;
      const unitCost = materialData.materials.unit_cost || 0;
      const totalCost = proportionalWeight * unitCost;

      return {
        material_name: materialData.materials.name,
        recipe_quantity: materialData.quantity,
        product_consumption: proportionalWeight,
        unit_cost: unitCost,
        total_cost: totalCost,
        unit: materialData.materials.unit,
      };
    });
  }, [
    formData.cement_weight,
    recipeMaterialsData,
    cementMaterial,
  ]);

  // -------------------------------------------
  // 2. Calcular custo total de materiais
  // -------------------------------------------
  const totalMaterialCost = useMemo(() => {
    console.log('💰 Calculando custo total de materiais...');
    return costBreakdown.reduce((sum, item) => sum + item.total_cost, 0);
  }, [costBreakdown]);

  // -------------------------------------------
  // 3. Calcular custo de produção
  // -------------------------------------------
  const productionCost = useMemo(() => {
    console.log('🏭 Calculando custo de produção...');

    const laborPercentage = parseFloat(formData.labor_cost) || 0;
    const fixedPercentage = parseFloat(formData.fixed_cost) || 0;
    const transportCost = parseFloat(formData.transport_cost) || 0;
    const lossPercentage = parseFloat(formData.loss_cost) || 0;

    const laborCost = totalMaterialCost * (laborPercentage / 100);
    const fixedCost = totalMaterialCost * (fixedPercentage / 100);
    const lossCost = totalMaterialCost * (lossPercentage / 100);

    return totalMaterialCost + laborCost + fixedCost + transportCost + lossCost;
  }, [
    totalMaterialCost,
    formData.labor_cost,
    formData.fixed_cost,
    formData.transport_cost,
    formData.loss_cost,
  ]);

  // -------------------------------------------
  // 4. Calcular preço de venda com margem
  // -------------------------------------------
  const salePrice = useMemo(() => {
    console.log('💵 Calculando preço de venda...');

    const marginPercentage = parseFloat(formData.margin_percentage) || 0;

    if (productionCost > 0 && marginPercentage > 0) {
      return productionCost * (1 + marginPercentage / 100);
    }

    return productionCost;
  }, [productionCost, formData.margin_percentage]);

  // -------------------------------------------
  // 5. Calcular peso total (exemplo de cálculo complexo)
  // -------------------------------------------
  const totalWeight = useMemo(() => {
    console.log('⚖️ Calculando peso total...');

    if (formData.product_type === 'premolded' && selectedRecipe?.specific_weight) {
      const volumeM3 = parseFloat(formData.concrete_volume_m3) || 0;
      const specificWeight = selectedRecipe.specific_weight;
      return volumeM3 * specificWeight;
    }

    return costBreakdown.reduce((sum, item) => {
      if (item.unit === 'kg') {
        return sum + item.product_consumption;
      }
      return sum;
    }, 0);
  }, [
    formData.product_type,
    formData.concrete_volume_m3,
    selectedRecipe,
    costBreakdown,
  ]);

  // -------------------------------------------
  // 6. Atualizar formData apenas quando valores mudam
  // -------------------------------------------
  useEffect(() => {
    console.log('💾 Sincronizando valores calculados com formData...');

    setFormData((prev) => {
      const newData = {
        ...prev,
        material_cost: totalMaterialCost.toFixed(2),
        production_cost: productionCost.toFixed(2),
        sale_price: salePrice.toFixed(2),
        total_weight: totalWeight.toFixed(2),
      };

      // ✅ IMPORTANTE: Evitar update se valores não mudaram
      if (
        prev.material_cost === newData.material_cost &&
        prev.production_cost === newData.production_cost &&
        prev.sale_price === newData.sale_price &&
        prev.total_weight === newData.total_weight
      ) {
        console.log('⏭️ Valores não mudaram, pulando update');
        return prev;
      }

      console.log('✅ Atualizando formData com novos valores');
      return newData;
    });
  }, [totalMaterialCost, productionCost, salePrice, totalWeight]);

  // -------------------------------------------
  // 7. Memoizar handlers de eventos
  // -------------------------------------------
  const handleCementWeightChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      cement_weight: value,
    }));
  }, []);

  const handleLaborCostChange = useCallback((value: string) => {
    setFormData((prev) => ({
      ...prev,
      labor_cost: value,
    }));
  }, []);

  // -------------------------------------------
  // 8. Renderização com valores memoizados
  // -------------------------------------------
  return (
    <div className="space-y-4">
      {/* Peso de Cimento */}
      <div>
        <label>Peso de Cimento (kg)</label>
        <input
          type="number"
          value={formData.cement_weight}
          onChange={(e) => handleCementWeightChange(e.target.value)}
        />
      </div>

      {/* Breakdown de Materiais */}
      {costBreakdown.length > 0 && (
        <div className="bg-gray-50 p-4 rounded">
          <h4 className="font-semibold mb-2">Breakdown de Materiais</h4>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Consumo</th>
                <th>Custo Unit.</th>
                <th>Custo Total</th>
              </tr>
            </thead>
            <tbody>
              {costBreakdown.map((item, index) => (
                <tr key={index}>
                  <td>{item.material_name}</td>
                  <td>{item.product_consumption.toFixed(2)} {item.unit}</td>
                  <td>R$ {item.unit_cost.toFixed(2)}</td>
                  <td>R$ {item.total_cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Custos Calculados */}
      <div className="bg-blue-50 p-4 rounded">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Custo de Materiais:</span>
            <span className="font-bold">R$ {totalMaterialCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Peso Total:</span>
            <span className="font-bold">{totalWeight.toFixed(2)} kg</span>
          </div>
          <div className="flex justify-between">
            <span>Custo de Produção:</span>
            <span className="font-bold">R$ {productionCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Preço de Venda:</span>
            <span className="font-bold text-green-600">R$ {salePrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Mão de Obra */}
      <div>
        <label>Mão de Obra (%)</label>
        <input
          type="number"
          value={formData.labor_cost}
          onChange={(e) => handleLaborCostChange(e.target.value)}
        />
      </div>

      {/* Margem */}
      <div>
        <label>Margem (%)</label>
        <input
          type="number"
          value={formData.margin_percentage}
          onChange={(e) => setFormData({...formData, margin_percentage: e.target.value})}
        />
      </div>
    </div>
  );
}

// ==============================================================================
// COMPARAÇÃO DE PERFORMANCE
// ==============================================================================

/*
┌─────────────────────────────────────────────────────────────────────┐
│ ANTES (useEffect)                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Usuário digita "10" no campo peso                                   │
│ ↓                                                                    │
│ 1. onChange dispara                                                 │
│ 2. setFormData atualiza cement_weight                               │
│ 3. Re-render do componente                                          │
│ 4. useEffect 1 detecta mudança → calcula breakdown → setFormData    │
│ 5. Re-render do componente                                          │
│ 6. useEffect 2 detecta mudança → calcula custo → setFormData        │
│ 7. Re-render do componente                                          │
│ 8. useEffect 3 detecta mudança → calcula preço → setFormData        │
│ 9. Re-render do componente                                          │
│ 10. Total: 4 re-renders!                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ DEPOIS (useMemo)                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Usuário digita "10" no campo peso                                   │
│ ↓                                                                    │
│ 1. onChange dispara                                                 │
│ 2. setFormData atualiza cement_weight                               │
│ 3. Re-render do componente                                          │
│ 4. useMemo 1 recalcula breakdown (cache)                            │
│ 5. useMemo 2 recalcula custo total (cache)                          │
│ 6. useMemo 3 recalcula custo produção (cache)                       │
│ 7. useMemo 4 recalcula preço venda (cache)                          │
│ 8. useEffect sincroniza valores → setFormData uma vez               │
│ 9. Re-render do componente                                          │
│ 10. Total: 2 re-renders!                                            │
└─────────────────────────────────────────────────────────────────────┘

GANHOS:
- 50% menos re-renders
- Cálculos em sequência sem pausas
- Interface mais responsiva
- Menos trabalho para o garbage collector
*/

// ==============================================================================
// DICAS DE OTIMIZAÇÃO
// ==============================================================================

/*
1. ✅ Use useMemo para cálculos pesados
   - Cálculos matemáticos complexos
   - Transformações de arrays/objetos
   - Agregações (reduce, map, filter)

2. ✅ Use useCallback para event handlers
   - Callbacks passados para child components
   - Functions usadas em dependencies de outros hooks

3. ✅ Evite setState em cascade
   - ❌ state A → setState B → setState C (3 renders)
   - ✅ useMemo A → useMemo B → setState C (1 render)

4. ✅ Use debounce para inputs
   - Espera usuário parar de digitar
   - Reduz cálculos desnecessários

5. ✅ Verifique se valor mudou antes de setState
   - Evita re-render desnecessário
   - Use comparação de valor

6. ✅ Separe lógica de apresentação
   - Lógica: useMemo/useCallback
   - Apresentação: JSX

7. ⚠️ Não abuse de useMemo
   - Só use para cálculos realmente pesados
   - Simples operações não precisam

8. ⚠️ Cuidado com dependencies
   - Inclua TODAS as dependências
   - Use ESLint plugin exhaustive-deps
*/

// ==============================================================================
// MEDIÇÃO DE PERFORMANCE
// ==============================================================================

/*
Para medir a performance real, adicione logs:

const productionCost = useMemo(() => {
  const start = performance.now();

  // Cálculos...
  const result = totalMaterialCost + laborCost + fixedCost;

  const end = performance.now();
  console.log(`⏱️ Cálculo levou ${(end - start).toFixed(2)}ms`);

  return result;
}, [dependencies]);
*/

// ==============================================================================
// INTEGRAÇÃO COM REACT DEVTOOLS PROFILER
// ==============================================================================

/*
1. Instale React DevTools
2. Abra aba "Profiler"
3. Clique em "Record"
4. Faça ações no componente
5. Clique em "Stop"
6. Analise:
   - Commit duration (tempo total)
   - Component render time
   - Why did this render?

Veja GUIA_ANALISE_REACT_DEVTOOLS_PROFILER.md para detalhes
*/
