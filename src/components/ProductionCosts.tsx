import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, Package, Users } from 'lucide-react';
import { logger } from '../lib/logger';
import { recordMetric } from '../lib/performanceMonitor';
import { batchUpsertWithRetry, validateProductionCostsData, createGroupedMap } from '../lib/productionCostsOptimizer';
import ProductionCostsTable from './ProductionCostsTable';

interface Production {
  id: string;
  product_id: string;
  quantity: number;
  production_date: string;
  products: {
    name: string;
    sale_price: number;
  };
}

interface ProductionCostDetail {
  production_id: string;
  product_name: string;
  quantity: number;
  date: string;
  material_cost: number;
  labor_cost: number;
  indirect_cost: number;
  depreciation_cost: number;
  total_cost: number;
  cost_per_unit: number;
}

function ProductionCostsComponent() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [productions, setProductions] = useState<Production[]>([]);
  const [costDetails, setCostDetails] = useState<ProductionCostDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    loadProductionData();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedMonth]);


  const calculateMaterialCostBatch = useCallback(async (
    products: Array<{ product_id: string; quantity: number }>
  ): Promise<Record<string, number>> => {
    if (products.length === 0) return {};

    const productIds = [...new Set(products.map(p => p.product_id))];
    const { data: materialWeights, error } = await supabase
      .from('product_material_weights')
      .select('product_id,weight_per_unit,materials(unit_cost)')
      .in('product_id', productIds)
      .limit(1000);

    if (error || !materialWeights) {
      logger.error('ProductionCosts', 'calculateMaterialCostBatch', 'Failed to load material weights', error);
      return {};
    }

    const materialCostByProduct = new Map<string, number>();
    for (const item of materialWeights) {
      const weightPerUnit = parseFloat(item.weight_per_unit) || 0;
      const unitCost = parseFloat(item.materials.unit_cost) || 0;
      const currentCost = materialCostByProduct.get(item.product_id) || 0;
      materialCostByProduct.set(item.product_id, currentCost + (weightPerUnit * unitCost));
    }

    const result: Record<string, number> = {};
    for (const prod of products) {
      const unitCost = materialCostByProduct.get(prod.product_id) || 0;
      result[prod.product_id] = unitCost * prod.quantity;
    }

    return result;
  }, []);

  const calculateTotalLaborCostOptimized = useCallback((
    employees: any[],
    payrollCharges: any[],
    overtimeRecords: any[],
    monthlyExtraPayments: any[]
  ): number => {
    const overtimeByEmployeeMap = createGroupedMap(overtimeRecords, 'employee_id');
    const extraPaymentsByEmployeeMap = createGroupedMap(monthlyExtraPayments, 'employee_id');
    const chargesWithoutInss = payrollCharges.filter((charge: any) => charge.name !== 'INSS Empresa');

    let total = 0;

    for (const employee of employees) {
      const baseSalary = parseFloat(employee.base_salary) || 0;
      const benefits = parseFloat(employee.benefits) || 0;
      const inssPercentage = employee.employment_type === 'CLT' ? 11 : 20;

      const charges = chargesWithoutInss.reduce(
        (sum, charge) => sum + (baseSalary * (parseFloat(charge.percentage) || 0) / 100),
        0
      );

      const inssTotal = baseSalary * inssPercentage / 100;

      const employeeId = String(employee.id);
      const employeeOvertime = overtimeByEmployeeMap.get(employeeId) || [];
      const hourlyRate = baseSalary / 220;
      const overtimeCost = employeeOvertime.reduce(
        (sum, ot) => sum + (hourlyRate * (parseFloat(ot.hours) || 0) * (parseFloat(ot.rate_multiplier) || 1)),
        0
      );

      const employeeExtraPayments = extraPaymentsByEmployeeMap.get(employeeId) || [];
      const extraPayments = employeeExtraPayments.reduce(
        (sum, payment) => sum + (parseFloat(payment.amount) || 0),
        0
      );

      total += baseSalary + benefits + charges + inssTotal + overtimeCost + extraPayments;
    }

    return total;
  }, []);

  async function loadProductionData() {
    setLoading(true);
    const startDate = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    try {
      const { data: productionData, error } = await supabase
        .from('production')
        .select(`
          id,
          product_id,
          quantity,
          production_date,
          products (name, sale_price)
        `)
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .order('production_date', { ascending: false });

      if (error) {
        logger.error('ProductionCosts', 'loadProductionData', 'Failed to load production data', error);
        setLoading(false);
        return;
      }

      setProductions(productionData || []);
      await calculateCosts(productionData || []);
    } finally {
      setLoading(false);
    }
  }

  async function calculateCosts(productionData: Production[]) {
    if (productionData.length === 0) {
      setCostDetails([]);
      return;
    }

    const startTime = performance.now();

    const [empRes, payRes, indRes, depRes, otRes, extRes] = await Promise.all([
      supabase.from('employees').select('id,name,base_salary,benefits,employment_type').eq('active', true).limit(100),
      supabase.from('payroll_charges').select('id,name,percentage').eq('active', true).limit(50),
      supabase.from('indirect_costs').select('id,name,amount').eq('active', true).limit(100),
      supabase.from('depreciation_assets').select('id,name,purchase_value,residual_value,useful_life_years').eq('active', true).limit(100),
      supabase.from('overtime_records').select('id,employee_id,date,hours,rate_multiplier').gte('date', `${selectedMonth}-01`).lte('date', `${selectedMonth}-31`).limit(300),
      supabase.from('monthly_extra_payments').select('id,employee_id,month,amount').eq('month', selectedMonth).limit(100),
    ]);

    const employees = empRes.data || [];
    const payrollCharges = payRes.data || [];
    const indirectCosts = indRes.data || [];
    const depreciationAssets = depRes.data || [];
    const overtimeRecords = otRes.data || [];
    const monthlyExtraPayments = extRes.data || [];

    const totalMonthlyLaborCost = calculateTotalLaborCostOptimized(
      employees || [],
      payrollCharges || [],
      overtimeRecords || [],
      monthlyExtraPayments || []
    );

    const totalMonthlyIndirectCost = (indirectCosts || []).reduce(
      (sum, cost) => sum + (parseFloat(cost.amount) || 0),
      0
    );

    const totalMonthlyDepreciation = (depreciationAssets || []).reduce(
      (sum, asset) => {
        const purchase = parseFloat(asset.purchase_value) || 0;
        const residual = parseFloat(asset.residual_value) || 0;
        const life = parseFloat(asset.useful_life_years) || 1;
        const depreciableValue = purchase - residual;
        return sum + (depreciableValue / (life * 12));
      },
      0
    );

    const totalFinancialVolume = productionData.reduce((sum, prod) => {
      const salePrice = prod.products.sale_price || 0;
      return sum + (prod.quantity * salePrice);
    }, 0);

    const materialCosts = await calculateMaterialCostBatch(
      productionData.map(p => ({ product_id: p.product_id, quantity: p.quantity }))
    );

    const costs: ProductionCostDetail[] = [];
    const upsertPayloads: any[] = [];

    for (const production of productionData) {
      const materialCost = materialCosts[production.product_id] || 0;
      const salePrice = production.products.sale_price || 0;
      const productionFinancialVolume = production.quantity * salePrice;
      const financialShare = totalFinancialVolume > 0 ? productionFinancialVolume / totalFinancialVolume : 0;

      const laborCost = totalMonthlyLaborCost * financialShare;
      const indirectCost = totalMonthlyIndirectCost * financialShare;
      const depreciationCost = totalMonthlyDepreciation * financialShare;
      const totalCost = materialCost + laborCost + indirectCost + depreciationCost;
      const costPerUnit = production.quantity > 0 ? totalCost / production.quantity : 0;

      costs.push({
        production_id: production.id,
        product_name: production.products.name,
        quantity: production.quantity,
        date: production.production_date,
        material_cost: materialCost,
        labor_cost: laborCost,
        indirect_cost: indirectCost,
        depreciation_cost: depreciationCost,
        total_cost: totalCost,
        cost_per_unit: costPerUnit,
      });

      upsertPayloads.push({
        production_id: production.id,
        material_cost: materialCost,
        labor_cost: laborCost,
        indirect_cost: indirectCost,
        depreciation_cost: depreciationCost,
        total_cost: totalCost,
        cost_per_unit: costPerUnit,
      });
    }

    setCostDetails(costs);

    if (upsertPayloads.length > 0) {
      const validation = await validateProductionCostsData(upsertPayloads);
      if (!validation.valid) {
        logger.warn('ProductionCosts', 'calculateCosts', 'Validation failed', {
          invalidCount: validation.invalidCount,
          errors: validation.errors.slice(0, 5)
        });
      }

      const upsertResult = await batchUpsertWithRetry(upsertPayloads);
      if (!upsertResult.success) {
        logger.error('ProductionCosts', 'calculateCosts', 'Batch upsert failed', {
          processedRecords: upsertResult.processedRecords,
          failedRecords: upsertResult.failedRecords,
          error: upsertResult.error
        });
      }
    }

    const duration = performance.now() - startTime;
    recordMetric('production_costs_calculation', duration, 'ms', {
      productionCount: String(productionData.length),
      costCount: String(costs.length)
    });

    logger.info('ProductionCosts', 'calculateCosts', 'Calculation completed', {
      productionCount: productionData.length,
      duration: `${duration.toFixed(2)}ms`,
    });
  }

  const totalMaterialCost = useMemo(
    () => costDetails.reduce((sum, detail) => sum + detail.material_cost, 0),
    [costDetails]
  );

  const totalLaborCost = useMemo(
    () => costDetails.reduce((sum, detail) => sum + detail.labor_cost, 0),
    [costDetails]
  );

  const totalIndirectCost = useMemo(
    () => costDetails.reduce((sum, detail) => sum + detail.indirect_cost, 0),
    [costDetails]
  );

  const totalDepreciationCost = useMemo(
    () => costDetails.reduce((sum, detail) => sum + detail.depreciation_cost, 0),
    [costDetails]
  );

  const grandTotal = useMemo(
    () => costDetails.reduce((sum, detail) => sum + detail.total_cost, 0),
    [costDetails]
  );

  const averageCostPerUnit = useMemo(() => {
    const totalUnits = costDetails.reduce((sum, detail) => sum + detail.quantity, 0);
    return totalUnits > 0 ? grandTotal / totalUnits : 0;
  }, [costDetails, grandTotal]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Custos de Produção</h2>
          <p className="text-gray-600">Análise completa dos custos de produção</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-blue-600" />
            <div className="text-sm text-gray-600">Custo de Materiais</div>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            R$ {totalMaterialCost.toFixed(2)}
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-green-600" />
            <div className="text-sm text-gray-600">Custo de Mão de Obra</div>
          </div>
          <div className="text-2xl font-bold text-green-600">
            R$ {totalLaborCost.toFixed(2)}
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-orange-600" />
            <div className="text-sm text-gray-600">Custos Indiretos</div>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            R$ {totalIndirectCost.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8" />
            <div className="text-sm">Depreciação</div>
          </div>
          <div className="text-2xl font-bold">
            R$ {totalDepreciationCost.toFixed(2)}
          </div>
        </div>

        <div className="bg-blue-900 rounded-lg p-4 text-white">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8" />
            <div className="text-sm">Custo Total</div>
          </div>
          <div className="text-2xl font-bold">
            R$ {grandTotal.toFixed(2)}
          </div>
        </div>

        <div className="bg-emerald-600 rounded-lg p-4 text-white shadow-md">
          <div className="text-sm mb-2">Custo Médio por Unidade</div>
          <div className="text-2xl font-bold">
            R$ {averageCostPerUnit.toFixed(4)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-gray-500">Calculando custos...</div>
        </div>
      ) : (
        <ProductionCostsTable
          costDetails={costDetails}
          totalMaterialCost={totalMaterialCost}
          totalLaborCost={totalLaborCost}
          totalIndirectCost={totalIndirectCost}
          totalDepreciationCost={totalDepreciationCost}
          grandTotal={grandTotal}
          averageCostPerUnit={averageCostPerUnit}
        />
      )}

      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Distribuição de Custos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {grandTotal > 0
                ? ((totalMaterialCost / grandTotal) * 100).toFixed(1)
                : 0}%
            </div>
            <div className="text-sm text-gray-600">Materiais</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {grandTotal > 0
                ? ((totalLaborCost / grandTotal) * 100).toFixed(1)
                : 0}%
            </div>
            <div className="text-sm text-gray-600">Mão de Obra</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {grandTotal > 0
                ? ((totalIndirectCost / grandTotal) * 100).toFixed(1)
                : 0}%
            </div>
            <div className="text-sm text-gray-600">Indiretos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-600">
              {grandTotal > 0
                ? ((totalDepreciationCost / grandTotal) * 100).toFixed(1)
                : 0}%
            </div>
            <div className="text-sm text-gray-600">Depreciação</div>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">Como os custos são calculados</h4>
        <div className="space-y-2 text-sm text-green-800">
          <div>
            <strong>Custo de Materiais:</strong> Calculado por produto com base nos insumos necessários.
            <br />
            <span className="text-xs">Exemplo: Se um bloco usa 5kg de cimento a R$ 0,50/kg = R$ 2,50 de custo de material por bloco</span>
          </div>

          <div className="pt-2 border-t border-green-300">
            <strong>Custos Indiretos (Mão de Obra, Custos Indiretos, Depreciação):</strong> Rateados proporcionalmente ao volume financeiro produzido no mês.
            <br />
            <span className="text-xs">
              Exemplo: Se o custo com colaboradores é R$ 35.000,00/mês e o volume financeiro produzido é R$ 100.000,00,
              então cada produto recebe 35% do seu valor de venda como custo de mão de obra.
            </span>
            <br />
            <span className="text-xs mt-1 block">
              Se você produziu R$ 60.000 em blocos e R$ 40.000 em lajes, os blocos receberão 60% dos custos indiretos
              e as lajes receberão 40% dos custos indiretos.
            </span>
          </div>

          <div className="pt-2 border-t border-green-300">
            <strong>Volume Financeiro:</strong> Quantidade produzida × Preço de venda cadastrado
            <br />
            <span className="text-xs">Exemplo: 1.000 blocos × R$ 3,90 = R$ 3.900,00 de volume financeiro</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductionCostsComponent);
