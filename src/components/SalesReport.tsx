import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, Package, CalendarDays, BarChart2, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailySummary {
  date: string;
  total_produced_value: number;
  total_units: number;
  total_cost: number;
  gross_profit: number;
}

interface ProductionWithDetails {
  id: string;
  production_date: string;
  quantity: number;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sale_price: number;
    final_sale_price: number;
  };
  calculated_cost: number; // Custo calculado dos materiais consumidos
}

interface AggregatedProductSummary {
  product_id: string;
  product_name: string;
  total_quantity: number;
  unit_price: number;
  total_value: number;
  total_cost: number;
  total_profit: number;
  production_count: number;
}

interface MaterialConsumptionSummary {
  material_id: string;
  material_name: string;
  total_quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export default function SalesReport() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10));
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [productions, setProductions] = useState<ProductionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [aggregatedProducts, setAggregatedProducts] = useState<AggregatedProductSummary[]>([]);
  const [materialConsumption, setMaterialConsumption] = useState<MaterialConsumptionSummary[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(dateString: string): string {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatDateWithWeekday(dateString: string): string {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      weekday: 'short'
    });
  }

  useEffect(() => {
    loadCompanySettings();
    loadData();
  }, [period, selectedDate]);

  async function loadCompanySettings() {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .single();

    if (data) {
      setCompanySettings(data);
    }
  }

  async function loadData() {
    setLoading(true);
    const { startDate, endDate } = getDateRange();

    // Executar sequencialmente: primeiro calcular e salvar, depois buscar
    await loadProductions(startDate, endDate); // Calcula custos e faz upsert
    await loadDailySummaries(startDate, endDate); // Busca dados salvos
    await loadMaterialConsumption(startDate, endDate); // Busca consumo agregado de materiais

    setLoading(false);
  }

  function getDateRange(): { startDate: string; endDate: string } {
    const date = parseLocalDate(selectedDate);
    let startDate: string;
    let endDate: string;

    switch (period) {
      case 'day':
        startDate = selectedDate;
        endDate = selectedDate;
        break;
      case 'week':
        const dayOfWeek = date.getDay();
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const startYear = startOfWeek.getFullYear();
        const startMonth = String(startOfWeek.getMonth() + 1).padStart(2, '0');
        const startDay = String(startOfWeek.getDate()).padStart(2, '0');
        startDate = `${startYear}-${startMonth}-${startDay}`;
        const endYear = endOfWeek.getFullYear();
        const endMonth = String(endOfWeek.getMonth() + 1).padStart(2, '0');
        const endDay = String(endOfWeek.getDate()).padStart(2, '0');
        endDate = `${endYear}-${endMonth}-${endDay}`;
        break;
      case 'month':
        startDate = `${selectedDate.substring(0, 7)}-01`;
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        endDate = `${selectedDate.substring(0, 7)}-${String(lastDay).padStart(2, '0')}`;
        break;
      case 'year':
        startDate = `${selectedDate.substring(0, 4)}-01-01`;
        endDate = `${selectedDate.substring(0, 4)}-12-31`;
        break;
    }

    return { startDate, endDate };
  }

  async function loadProductions(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('production')
      .select(`
        id,
        production_date,
        quantity,
        notes,
        products!inner (
          id,
          name,
          sale_price,
          final_sale_price,
          custo_unitario_materiais,
          material_cost,
          production_cost,
          manual_unit_cost
        )
      `)
      .gte('production_date', startDate)
      .lte('production_date', endDate)
      .order('production_date', { ascending: false });

    if (error) {
      console.error('Error loading productions:', error);
      return;
    }

    // Filtrar ajustes de estoque (não devem aparecer no relatório de produção)
    const filteredData = (data || []).filter((p: any) => {
      const notes = (p.notes || '').toLowerCase();
      return !notes.includes('ajuste de estoque');
    });

    const formatted = filteredData.map((item: any) => {
      // USAR custo_unitario_materiais (coluna oficial calculada no frontend)
      // Fallback: material_cost > production_cost > manual_unit_cost > 0
      const custoUnitario = item.products.custo_unitario_materiais ||
                            item.products.material_cost ||
                            item.products.production_cost ||
                            item.products.manual_unit_cost ||
                            0;

      // Custo total = quantidade × custo unitário
      const custoTotal = custoUnitario * item.quantity;

      // Log para debug
      if (custoUnitario === 0) {
        console.warn('⚠️ RELATÓRIO - Produto SEM CUSTO:', {
          produto: item.products.name,
          product_id: item.products.id,
          aviso: 'Calcule a "Memória de Cálculo" na tela de Produtos',
        });
      } else {
        console.log('✅ RELATÓRIO - Custo do Produto:', {
          produto: item.products.name,
          quantidade: item.quantity,
          custo_unitario: custoUnitario,
          custo_total: custoTotal,
          origem: item.products.custo_unitario_materiais ? 'custo_unitario_materiais ✓' :
                  item.products.material_cost ? 'material_cost (fallback)' :
                  item.products.production_cost ? 'production_cost (fallback)' :
                  'manual_unit_cost (fallback)',
        });
      }

      return {
        id: item.id,
        production_date: item.production_date,
        quantity: item.quantity,
        notes: item.notes,
        product: item.products,
        calculated_cost: custoTotal,
      };
    });

    setProductions(formatted);
    await calculateAndStoreDailySummaries(formatted, startDate, endDate);
    calculateAggregatedProducts(formatted);
  }

  function calculateAggregatedProducts(prods: ProductionWithDetails[]) {
    const aggregatedByProduct: Record<string, AggregatedProductSummary> = {};

    prods.forEach((prod) => {
      const productId = prod.product.id;
      const productName = prod.product.name;
      const unitPrice = prod.product.final_sale_price || prod.product.sale_price || 0;
      const saleValue = unitPrice * prod.quantity;
      const costValue = prod.calculated_cost;
      const profit = saleValue - costValue;

      if (aggregatedByProduct[productId]) {
        aggregatedByProduct[productId].total_quantity += prod.quantity;
        aggregatedByProduct[productId].total_value += saleValue;
        aggregatedByProduct[productId].total_cost += costValue;
        aggregatedByProduct[productId].total_profit += profit;
        aggregatedByProduct[productId].production_count += 1;
      } else {
        aggregatedByProduct[productId] = {
          product_id: productId,
          product_name: productName,
          total_quantity: prod.quantity,
          unit_price: unitPrice,
          total_value: saleValue,
          total_cost: costValue,
          total_profit: profit,
          production_count: 1,
        };
      }
    });

    const aggregatedArray = Object.values(aggregatedByProduct).sort((a, b) =>
      a.product_name.localeCompare(b.product_name)
    );

    setAggregatedProducts(aggregatedArray);
  }

  async function loadMaterialConsumption(startDate: string, endDate: string) {
    try {
      // Buscar IDs de produções do período (excluindo ajustes de estoque)
      const { data: productionsData, error: prodError } = await supabase
        .from('production')
        .select('id, notes')
        .gte('production_date', startDate)
        .lte('production_date', endDate);

      if (prodError) throw prodError;

      // Filtrar IDs de produções que NÃO são ajustes de estoque
      const validProductionIds = (productionsData || [])
        .filter((p: any) => {
          const notes = (p.notes || '').toLowerCase();
          return !notes.includes('ajuste de estoque');
        })
        .map((p: any) => p.id);

      if (validProductionIds.length === 0) {
        setMaterialConsumption([]);
        return;
      }

      // Buscar movimentos de materiais do período
      const { data: movementsData, error: movError } = await supabase
        .from('material_movements')
        .select(`
          quantity,
          material_id,
          materials (
            id,
            name,
            unit,
            unit_cost
          )
        `)
        .in('production_id', validProductionIds)
        .eq('movement_type', 'saida');

      if (movError) throw movError;

      // Agregar consumo por material
      const aggregatedByMaterial: { [key: string]: MaterialConsumptionSummary } = {};

      (movementsData || []).forEach((movement: any) => {
        if (movement.materials) {
          const materialId = movement.materials.id;
          const materialName = movement.materials.name;
          const quantity = parseFloat(movement.quantity);
          const unit = movement.materials.unit;
          const unitCost = parseFloat(movement.materials.unit_cost || 0);
          const totalCost = quantity * unitCost;

          if (aggregatedByMaterial[materialId]) {
            aggregatedByMaterial[materialId].total_quantity += quantity;
            aggregatedByMaterial[materialId].total_cost += totalCost;
          } else {
            aggregatedByMaterial[materialId] = {
              material_id: materialId,
              material_name: materialName,
              total_quantity: quantity,
              unit: unit,
              unit_cost: unitCost,
              total_cost: totalCost,
            };
          }
        }
      });

      const consumptionArray = Object.values(aggregatedByMaterial).sort((a, b) =>
        a.material_name.localeCompare(b.material_name)
      );

      setMaterialConsumption(consumptionArray);
    } catch (error) {
      console.error('Erro ao carregar consumo de materiais:', error);
      setMaterialConsumption([]);
    }
  }

  async function calculateAndStoreDailySummaries(prods: ProductionWithDetails[], startDate: string, endDate: string) {
    const summariesByDate: Record<string, DailySummary> = {};

    prods.forEach((prod) => {
      if (!summariesByDate[prod.production_date]) {
        summariesByDate[prod.production_date] = {
          date: prod.production_date,
          total_produced_value: 0,
          total_units: 0,
          total_cost: 0,
          gross_profit: 0,
        };
      }

      const saleValue = (prod.product.final_sale_price || prod.product.sale_price || 0) * prod.quantity;
      const costValue = prod.calculated_cost; // Usar custo calculado dos materiais

      summariesByDate[prod.production_date].total_produced_value += saleValue;
      summariesByDate[prod.production_date].total_units += prod.quantity;
      summariesByDate[prod.production_date].total_cost += costValue;
      summariesByDate[prod.production_date].gross_profit += saleValue - costValue;
    });

    const summariesArray = Object.values(summariesByDate);

    for (const summary of summariesArray) {
      const { error } = await supabase
        .from('daily_sales_summary')
        .upsert({
          date: summary.date,
          total_produced_value: summary.total_produced_value,
          total_units: summary.total_units,
          total_cost: summary.total_cost,
          gross_profit: summary.gross_profit,
        }, { onConflict: 'date' });

      if (error) {
        console.error('Error upserting daily summary:', error);
      }
    }
  }

  async function loadDailySummaries(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('daily_sales_summary')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading summaries:', error);
      return;
    }

    setDailySummaries(data || []);
  }

  function getTotalValue(): number {
    return dailySummaries.reduce((sum, s) => sum + s.total_produced_value, 0);
  }

  function getTotalUnits(): number {
    return dailySummaries.reduce((sum, s) => sum + s.total_units, 0);
  }

  function getTotalCost(): number {
    return dailySummaries.reduce((sum, s) => sum + s.total_cost, 0);
  }

  function getTotalProfit(): number {
    return dailySummaries.reduce((sum, s) => sum + s.gross_profit, 0);
  }

  function getProfitMargin(): number {
    const totalValue = getTotalValue();
    return totalValue > 0 ? (getTotalProfit() / totalValue) * 100 : 0;
  }

  function getDailyAverage(): number {
    const daysWithProduction = dailySummaries.length;
    return daysWithProduction > 0 ? getTotalValue() / daysWithProduction : 0;
  }

  function getWorkingDaysInPeriod(): number {
    return dailySummaries.filter(s => s.total_produced_value > 0).length;
  }

  function toggleDateExpansion(date: string) {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  }

  function getProductionsByDate(date: string): ProductionWithDetails[] {
    return productions.filter(p => p.production_date === date);
  }

  async function exportToPDF() {
    const doc = new jsPDF();
    const { startDate, endDate } = getDateRange();

    let yPosition = 20;

    // Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE PRODUÇÃO', 105, yPosition, { align: 'center' });

    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (companySettings?.company_name) {
      doc.text(companySettings.company_name, 105, yPosition, { align: 'center' });
      yPosition += 5;
    }

    doc.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, 105, yPosition, { align: 'center' });
    yPosition += 5;
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, yPosition, { align: 'center' });

    yPosition += 10;

    // Resumo Geral
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', 14, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      ['Volume Financeiro Total:', `R$ ${getTotalValue().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Custo Total:', `R$ ${getTotalCost().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Lucro Bruto:', `R$ ${getTotalProfit().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Margem de Lucro:', `${getProfitMargin().toFixed(1)}%`],
      ['Unidades Produzidas:', getTotalUnits().toLocaleString('pt-BR')],
      ['Média Diária:', `R$ ${getDailyAverage().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Dias com Produção:', getWorkingDaysInPeriod().toString()],
    ];

    summaryData.forEach(([label, value]) => {
      doc.text(label, 14, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 105, yPosition);
      doc.setFont('helvetica', 'normal');
      yPosition += 6;
    });

    yPosition += 5;

    // Resumo por Produto
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO POR PRODUTO', 14, yPosition);
    yPosition += 5;

    const productTableData = aggregatedProducts.map(agg => [
      agg.product_name,
      agg.total_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      `R$ ${agg.unit_price.toFixed(2)}`,
      `R$ ${agg.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${agg.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${agg.total_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${((agg.total_profit / agg.total_value) * 100).toFixed(1)}%`,
    ]);

    const totalQty = aggregatedProducts.reduce((sum, agg) => sum + agg.total_quantity, 0);
    const totalVal = aggregatedProducts.reduce((sum, agg) => sum + agg.total_value, 0);
    const totalCst = aggregatedProducts.reduce((sum, agg) => sum + agg.total_cost, 0);
    const totalPft = aggregatedProducts.reduce((sum, agg) => sum + agg.total_profit, 0);
    const totalMgn = totalVal > 0 ? ((totalPft / totalVal) * 100).toFixed(1) : '0.0';

    productTableData.push([
      'TOTAL',
      totalQty.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      '',
      `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${totalCst.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${totalPft.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${totalMgn}%`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Produto', 'Qtd. Total', 'Preço Unit.', 'Valor Total', 'Custo Total', 'Lucro Total', 'Margem %']],
      body: productTableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 25 },
        6: { halign: 'right', cellWidth: 18 },
      },
      footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold' },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Resumo Diário
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DIÁRIO', 14, yPosition);
    yPosition += 5;

    const dailyTableData = dailySummaries.map(summary => [
      formatDateWithWeekday(summary.date),
      `R$ ${summary.total_produced_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${summary.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${summary.gross_profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      summary.total_produced_value > 0
        ? `${((summary.gross_profit / summary.total_produced_value) * 100).toFixed(1)}%`
        : '0.0%',
    ]);

    dailyTableData.push([
      'TOTAL',
      `R$ ${getTotalValue().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${getTotalCost().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `R$ ${getTotalProfit().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `${getProfitMargin().toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Data', 'Valor Produzido', 'Custo Total', 'Lucro Bruto', 'Margem %']],
      body: dailyTableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { halign: 'right', cellWidth: 35 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 30 },
      },
      footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold' },
    });

    // Salvar PDF
    const periodLabel = period === 'day' ? 'dia' : period === 'week' ? 'semana' : period === 'month' ? 'mes' : 'ano';
    const fileName = `relatorio_producao_${periodLabel}_${selectedDate.replace(/-/g, '')}.pdf`;
    doc.save(fileName);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Relatório de Produção</h2>
          <p className="text-gray-600">Volume financeiro produzido (Quantidade × Valor de Venda)</p>
        </div>
        <button
          onClick={exportToPDF}
          disabled={loading || dailySummaries.length === 0}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <FileDown className="w-5 h-5" />
          Exportar PDF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="year">Ano</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data de Referência
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intervalo
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">
              {(() => {
                const { startDate, endDate } = getDateRange();
                return `${formatDate(startDate)} - ${formatDate(endDate)}`;
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8" />
            <div className="text-sm opacity-90">Volume Financeiro Total</div>
          </div>
          <div className="text-3xl font-bold">
            R$ {getTotalValue().toFixed(2)}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {period === 'month' && 'Produção mensal'}
            {period === 'day' && 'Produção do dia'}
            {period === 'week' && 'Produção semanal'}
            {period === 'year' && 'Produção anual'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <BarChart2 className="w-8 h-8" />
            <div className="text-sm opacity-90">Média Diária</div>
          </div>
          <div className="text-3xl font-bold">
            R$ {getDailyAverage().toFixed(2)}
          </div>
          <div className="text-xs opacity-75 mt-1">
            {getWorkingDaysInPeriod()} dias com produção
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8" />
            <div className="text-sm opacity-90">Unidades Produzidas</div>
          </div>
          <div className="text-3xl font-bold">
            {getTotalUnits().toLocaleString('pt-BR')}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8" />
            <div className="text-sm opacity-90">Lucro Bruto</div>
          </div>
          <div className="text-3xl font-bold">
            R$ {getTotalProfit().toFixed(2)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="w-8 h-8" />
            <div className="text-sm opacity-90">Margem de Lucro</div>
          </div>
          <div className="text-3xl font-bold">
            {getProfitMargin().toFixed(1)}%
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-gray-500">Carregando dados...</div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Resumo Diário</h3>
              <p className="text-sm text-gray-600 mt-1">Clique em uma data para ver os detalhes do que foi produzido</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Data
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor Produzido
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Custo Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Lucro Bruto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Margem %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailySummaries.map((summary) => {
                    const isExpanded = expandedDates.has(summary.date);
                    const dateProductions = getProductionsByDate(summary.date);

                    return (
                      <React.Fragment key={summary.date}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleDateExpansion(summary.date)}>
                          <td className="px-6 py-4 text-center">
                            <button
                              className="text-gray-500 hover:text-gray-700 focus:outline-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDateExpansion(summary.date);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {formatDateWithWeekday(summary.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                            R$ {summary.total_produced_value.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">
                            R$ {summary.total_cost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                            R$ {summary.gross_profit.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">
                            {summary.total_produced_value > 0
                              ? ((summary.gross_profit / summary.total_produced_value) * 100).toFixed(1)
                              : '0.0'}%
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Detalhes da Produção</h4>
                                {dateProductions.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Produto</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Quantidade</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Preço Unit.</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Valor Total</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Custo Total</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Lucro</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {dateProductions.map((prod) => {
                                          const saleValue = (prod.product.final_sale_price || prod.product.sale_price || 0) * prod.quantity;
                                          const costValue = prod.calculated_cost;
                                          const profit = saleValue - costValue;

                                          return (
                                            <tr key={prod.id} className="hover:bg-gray-50">
                                              <td className="px-4 py-2 text-gray-900">{prod.product.name}</td>
                                              <td className="px-4 py-2 text-right text-gray-900">
                                                {prod.quantity.toLocaleString('pt-BR')}
                                              </td>
                                              <td className="px-4 py-2 text-right text-gray-600">
                                                R$ {(prod.product.final_sale_price || prod.product.sale_price || 0).toFixed(2)}
                                              </td>
                                              <td className="px-4 py-2 text-right font-medium text-green-600">
                                                R$ {saleValue.toFixed(2)}
                                              </td>
                                              <td className="px-4 py-2 text-right text-gray-900">
                                                R$ {costValue.toFixed(2)}
                                              </td>
                                              <td className="px-4 py-2 text-right font-medium text-blue-600">
                                                R$ {profit.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot className="bg-gray-100 font-semibold">
                                        <tr>
                                          <td colSpan={3} className="px-4 py-2 text-right text-gray-900">Total do Dia:</td>
                                          <td className="px-4 py-2 text-right text-green-600">
                                            R$ {summary.total_produced_value.toFixed(2)}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-900">
                                            R$ {summary.total_cost.toFixed(2)}
                                          </td>
                                          <td className="px-4 py-2 text-right text-blue-600">
                                            R$ {summary.gross_profit.toFixed(2)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">Nenhum detalhe de produção disponível</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                    <td className="px-6 py-4 text-sm text-right text-green-600">
                      R$ {getTotalValue().toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      R$ {getTotalCost().toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-blue-600">
                      R$ {getTotalProfit().toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {getProfitMargin().toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Resumo por Produto (Período Agregado)</h3>
              <p className="text-sm text-gray-600 mt-1">Soma de todos os registros de produção agrupados por produto no período selecionado</p>
            </div>
            <div className="overflow-x-auto">
              {aggregatedProducts.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  Nenhum produto produzido no período selecionado
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Produto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Quantidade Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Preço Unit.
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Valor Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Custo Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Lucro Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Margem %
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Registros
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {aggregatedProducts.map((agg) => {
                      const profitMargin = agg.total_value > 0 ? (agg.total_profit / agg.total_value) * 100 : 0;

                      return (
                        <tr key={agg.product_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {agg.product_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-blue-600">
                            {agg.total_quantity.toLocaleString('pt-BR', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-600">
                            R$ {agg.unit_price.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                            R$ {agg.total_value.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">
                            R$ {agg.total_cost.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-orange-600">
                            R$ {agg.total_profit.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                            {profitMargin.toFixed(1)}%
                          </td>
                          <td className="px-6 py-4 text-sm text-center text-gray-600">
                            {agg.production_count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 text-sm text-right text-blue-600">
                        {aggregatedProducts.reduce((sum, agg) => sum + agg.total_quantity, 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-sm text-right text-green-600">
                        R$ {aggregatedProducts.reduce((sum, agg) => sum + agg.total_value, 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        R$ {aggregatedProducts.reduce((sum, agg) => sum + agg.total_cost, 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-orange-600">
                        R$ {aggregatedProducts.reduce((sum, agg) => sum + agg.total_profit, 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        {(() => {
                          const totalValue = aggregatedProducts.reduce((sum, agg) => sum + agg.total_value, 0);
                          const totalProfit = aggregatedProducts.reduce((sum, agg) => sum + agg.total_profit, 0);
                          return totalValue > 0 ? ((totalProfit / totalValue) * 100).toFixed(1) : '0.0';
                        })()}%
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-600">
                        {aggregatedProducts.reduce((sum, agg) => sum + agg.production_count, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Consumo de Insumos (Período Agregado)</h3>
              <p className="text-sm text-gray-600 mt-1">Total de materiais consumidos na produção do período selecionado (excluindo ajustes de estoque)</p>
            </div>
            <div className="overflow-x-auto">
              {materialConsumption.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  Nenhum consumo de material registrado no período selecionado
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantidade Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unidade
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Unitário
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materialConsumption.map((material) => (
                      <tr key={material.material_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {material.material_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">
                          {material.total_quantity.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {material.unit}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">
                          R$ {material.unit_cost.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-green-600 font-semibold">
                          R$ {material.total_cost.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                      <td className="px-6 py-4 text-sm text-gray-900">TOTAL GERAL</td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-sm text-right text-green-700 font-bold">
                        R$ {materialConsumption.reduce((sum, m) => sum + m.total_cost, 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Como funciona o cálculo</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Volume Financeiro:</strong> Quantidade produzida × Preço de venda cadastrado</li>
              <li><strong>Exemplo:</strong> 1.500 blocos × R$ 3,90 = R$ 5.850,00</li>
              <li><strong>Custo Total:</strong> Soma dos custos de todos os materiais consumidos (baseado nos movimentos de estoque)</li>
              <li><strong>Lucro Bruto:</strong> Volume Financeiro - Custo Total</li>
              <li><strong>Margem de Lucro:</strong> (Lucro Bruto ÷ Volume Financeiro) × 100</li>
              <li><strong>Relatório Diário:</strong> Soma de todos os produtos produzidos no dia</li>
              <li><strong>Relatório Mensal:</strong> Soma de todos os dias do mês</li>
              <li><strong>Média Diária:</strong> Volume total ÷ Número de dias com produção</li>
              <li><strong>Resumo por Produto:</strong> Agrega todos os registros de produção do período por produto, somando quantidades, valores e custos</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
