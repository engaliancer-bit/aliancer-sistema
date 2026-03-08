import { useState } from 'react';
import { Calendar, FileText, TrendingUp, Package, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MaterialConsumption {
  material_id: string;
  material_name: string;
  total_quantity: number;
  unit: string;
  avg_unit_cost: number;
  total_cost: number;
  usage_count: number;
  first_usage: string;
  last_usage: string;
}

interface MaterialConsumptionComparative {
  material_id: string;
  material_name: string;
  unit: string;
  total_quantity_theoretical: number;
  total_quantity_real: number;
  variance_quantity: number;
  variance_percentage: number;
  avg_unit_cost: number;
  total_cost_theoretical: number;
  total_cost_real: number;
  usage_count: number;
  first_usage: string;
  last_usage: string;
}

interface ProductSummary {
  production_date: string;
  product_id: string;
  product_name: string;
  product_code: string;
  total_quantity: number;
  unit: string;
  production_count: number;
  total_material_cost: number;
  avg_cost_per_unit: number;
  product_unit_cost: number;
  sales_price: number;
  price_source: 'final_sale_price' | 'sale_price' | 'sem_preco';
  final_cost_per_unit: number;
  margin_per_unit: number;
  margin_percentage: number;
  total_sales_value: number;
}

interface ProductionSummary {
  total_productions: number;
  total_products_quantity: number;
  total_material_cost: number;
  total_products: number;
  unique_materials: number;
  avg_cost_per_production: number;
  date_range_days: number;
}

export default function ProductionReport() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'materials' | 'products' | 'summary'>('summary');
  const [comparisonMode, setComparisonMode] = useState<'teorico' | 'real' | 'ambos'>('ambos');

  const [materialConsumption, setMaterialConsumption] = useState<MaterialConsumption[]>([]);
  const [materialConsumptionComparative, setMaterialConsumptionComparative] = useState<MaterialConsumptionComparative[]>([]);
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [generalSummary, setGeneralSummary] = useState<ProductionSummary | null>(null);

  const generateReport = async () => {
    setLoading(true);
    try {
      console.log('Gerando relatório de produção otimizado...');

      const summaryPromise = supabase.rpc('relatorio_producao_completo', {
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

      const materialsPromise = supabase.rpc('relatorio_consumo_insumos', {
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

      const materialsComparativePromise = supabase.rpc('relatorio_consumo_insumos_v2', {
        p_data_inicio: startDate,
        p_data_fim: endDate,
        p_comparison_mode: comparisonMode
      });

      const productsPromise = supabase.rpc('relatorio_total_produtos', {
        p_data_inicio: startDate,
        p_data_fim: endDate
      });

      const [summaryResult, materialsResult, materialsComparativeResult, productsResult] = await Promise.all([
        summaryPromise,
        materialsPromise,
        materialsComparativePromise,
        productsPromise
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (materialsResult.error) throw materialsResult.error;
      if (materialsComparativeResult.error) throw materialsComparativeResult.error;
      if (productsResult.error) throw productsResult.error;

      console.log('Relatório gerado com sucesso!', {
        resumo: summaryResult.data,
        materiais: materialsResult.data?.length,
        materiaisComparativo: materialsComparativeResult.data?.length,
        produtos: productsResult.data?.length
      });

      setGeneralSummary(summaryResult.data?.[0] || null);
      setMaterialConsumption(materialsResult.data || []);
      setMaterialConsumptionComparative(materialsComparativeResult.data || []);
      setProductSummary(productsResult.data || []);

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório de produção');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Relatório de Produção</h2>
              <p className="text-sm text-gray-600">Análise consolidada com agregações no banco</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-5 w-5" />
                  <span>Gerar Relatório</span>
                </>
              )}
            </button>
          </div>
        </div>

        {generalSummary && (
          <>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Resumo Geral do Periodo
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Producoes</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {generalSummary.total_productions}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <Package className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-600">Quantidade Total</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatNumber(generalSummary.total_products_quantity, 0)}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-medium text-gray-600">Custo Total Insumos</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(generalSummary.total_material_cost)}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Custo Medio</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(generalSummary.avg_cost_per_production)}
                  </p>
                </div>
              </div>

              {productSummary.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-gray-600">Valor Produzido Total</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(productSummary.reduce((sum, item) => sum + (item.total_sales_value || 0), 0))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Preco de venda x quantidade</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-gray-600">Custo Total Insumos</span>
                    </div>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(productSummary.reduce((sum, item) => sum + item.total_material_cost, 0))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Custo historico no momento da producao</p>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-600">Margem Bruta Total</span>
                    </div>
                    {(() => {
                      const totalSales = productSummary.reduce((sum, item) => sum + (item.total_sales_value || 0), 0);
                      const totalCost = productSummary.reduce((sum, item) => sum + item.total_material_cost, 0);
                      const grossMargin = totalSales - totalCost;
                      const marginPercentage = totalSales > 0 ? (grossMargin / totalSales) * 100 : 0;
                      return (
                        <>
                          <p className={`text-2xl font-bold ${grossMargin >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                            {formatCurrency(grossMargin)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatNumber(marginPercentage, 1)}% de margem
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Produtos diferentes:</span>
                  <span className="font-semibold text-gray-800">
                    {generalSummary.total_products}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Materiais utilizados:</span>
                  <span className="font-semibold text-gray-800">
                    {generalSummary.unique_materials}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'summary'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Resumo Geral
                </button>
                <button
                  onClick={() => setActiveTab('materials')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'materials'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Consumo de Materiais ({materialConsumption.length})
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'products'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Produtos Produzidos ({productSummary.length})
                </button>
              </div>
            </div>

            {activeTab === 'summary' && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  Análise do Período
                </h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Período analisado</span>
                      <span className="font-semibold">
                        {generalSummary.date_range_days + 1} dia(s)
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Média de produções por dia</span>
                      <span className="font-semibold">
                        {formatNumber(
                          generalSummary.total_productions / (generalSummary.date_range_days + 1),
                          1
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Custo médio por unidade produzida</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          generalSummary.total_products_quantity > 0
                            ? generalSummary.total_material_cost /
                              generalSummary.total_products_quantity
                            : 0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Quantidade média por produção</span>
                      <span className="font-semibold">
                        {formatNumber(
                          generalSummary.total_productions > 0
                            ? generalSummary.total_products_quantity /
                              generalSummary.total_productions
                            : 0,
                          1
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'materials' && (
              <div>
                <div className="mb-4 flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium text-gray-600 mr-1">Visualizar:</span>
                  <button
                    onClick={() => {
                      setComparisonMode('ambos');
                      generateReport();
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      comparisonMode === 'ambos'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Teorico x Real
                  </button>
                  <button
                    onClick={() => {
                      setComparisonMode('teorico');
                      generateReport();
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      comparisonMode === 'teorico'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Apenas Teorico
                  </button>
                  <button
                    onClick={() => {
                      setComparisonMode('real');
                      generateReport();
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      comparisonMode === 'real'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Apenas Real
                  </button>
                  <span className="ml-2 text-xs text-gray-500">
                    {comparisonMode === 'ambos' && 'Linhas amarelas indicam variacao acima de 10%'}
                    {comparisonMode === 'teorico' && 'Consumo calculado com base nas receitas cadastradas'}
                    {comparisonMode === 'real' && 'Consumo registrado no momento da producao'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Material
                        </th>
                        {comparisonMode === 'ambos' ? (
                          <>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Teórico
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Real
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Variação
                            </th>
                          </>
                        ) : (
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantidade
                          </th>
                        )}
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Custo Médio
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Custo Total
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Usos
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {materialConsumptionComparative.map((item, index) => {
                        const hasVariance = Math.abs(item.variance_percentage) > 10;
                        const displayQty = comparisonMode === 'teorico'
                          ? item.total_quantity_theoretical
                          : comparisonMode === 'real'
                          ? item.total_quantity_real
                          : item.total_quantity_real;

                        return (
                          <tr
                            key={index}
                            className={`hover:bg-gray-50 ${
                              hasVariance && comparisonMode === 'ambos' ? 'bg-yellow-50' : ''
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.material_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.first_usage && item.last_usage && (
                                  <>
                                    {new Date(item.first_usage).toLocaleDateString('pt-BR')} a{' '}
                                    {new Date(item.last_usage).toLocaleDateString('pt-BR')}
                                  </>
                                )}
                              </div>
                            </td>
                            {comparisonMode === 'ambos' ? (
                              <>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-900">
                                    {formatNumber(item.total_quantity_theoretical, 1)} {item.unit}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-900">
                                    {formatNumber(item.total_quantity_real, 1)} {item.unit}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div
                                    className={`text-sm font-semibold ${
                                      item.variance_percentage > 0
                                        ? 'text-red-600'
                                        : item.variance_percentage < 0
                                        ? 'text-green-600'
                                        : 'text-gray-600'
                                    }`}
                                  >
                                    {formatNumber(item.variance_percentage, 1)}%
                                    {hasVariance && (
                                      <div className="text-xs text-red-500">Acima do esperado</div>
                                    )}
                                  </div>
                                </td>
                              </>
                            ) : (
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="text-sm text-gray-900">
                                  {formatNumber(displayQty, 1)} {item.unit}
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                              {formatCurrency(item.avg_unit_cost)}/{item.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {formatCurrency(
                                  comparisonMode === 'teorico'
                                    ? item.total_cost_theoretical
                                    : comparisonMode === 'real'
                                    ? item.total_cost_real
                                    : item.total_cost_real
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                              {item.usage_count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td className="px-6 py-4 font-bold text-gray-900">TOTAL</td>
                        {comparisonMode === 'ambos' ? (
                          <>
                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                              {formatCurrency(
                                materialConsumptionComparative.reduce((sum, item) => sum + item.total_cost_theoretical, 0)
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                              {formatCurrency(
                                materialConsumptionComparative.reduce((sum, item) => sum + item.total_cost_real, 0)
                              )}
                            </td>
                            <td className="px-6 py-4"></td>
                          </>
                        ) : (
                          <td className="px-6 py-4"></td>
                        )}
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(
                            materialConsumptionComparative.reduce(
                              (sum, item) =>
                                sum +
                                (comparisonMode === 'teorico'
                                  ? item.total_cost_theoretical
                                  : comparisonMode === 'real'
                                  ? item.total_cost_real
                                  : item.total_cost_real),
                              0
                            )
                          )}
                        </td>
                        <td className="px-6 py-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div>
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                <span className="font-medium text-gray-600">Legenda:</span>
                <span><span className="text-blue-600 font-semibold">Custo Teorico</span> = sem historico de custos, usa cadastro do produto</span>
                <span><span className="text-blue-500">Preco final</span> = usa o campo "Preco Final" do cadastro do produto</span>
                <span><span className="text-gray-500">Preco venda</span> = usa o campo "Preco de Venda" padrao</span>
                <span><span className="text-orange-600 font-semibold">N/C</span> = preco nao configurado no produto</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produto
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtd
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Unit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">
                        Custo Total
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preco Venda
                        <div className="text-xs font-normal text-gray-400 normal-case">fonte do preco</div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                        Valor Produzido
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Margem Unit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % Margem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productSummary.map((item, index) => {
                      const usedTheoretical = item.total_material_cost === 0 || item.avg_cost_per_unit === 0;
                      const marginColor = item.margin_per_unit >= 0 ? 'text-green-600' : 'text-red-600';
                      const priceUnconfigured = item.price_source === 'sem_preco' || item.sales_price === 0;

                      const priceSourceBadge = !priceUnconfigured && (
                        item.price_source === 'final_sale_price'
                          ? <div className="text-xs text-blue-500 mt-0.5">Preco final</div>
                          : <div className="text-xs text-gray-400 mt-0.5">Preco venda</div>
                      );

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(item.production_date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {item.product_name}
                            </div>
                            {item.product_code && (
                              <div className="text-xs text-gray-500">{item.product_code}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-900">
                              {formatNumber(item.total_quantity, 0)} {item.unit}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.production_count}x
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                            <div className={`${usedTheoretical ? 'text-blue-600' : 'text-gray-900'}`}>
                              {formatCurrency(item.final_cost_per_unit)}
                            </div>
                            {usedTheoretical && (
                              <div className="text-xs text-blue-500">Teorico</div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm bg-red-50">
                            <div className="font-semibold text-red-700">
                              {formatCurrency(item.total_material_cost)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                            {priceUnconfigured ? (
                              <div>
                                <div className="text-orange-600 font-semibold">N/C</div>
                                <div className="text-xs text-orange-400">Nao configurado</div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-gray-900">{formatCurrency(item.sales_price)}</div>
                                {priceSourceBadge}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm bg-green-50">
                            <div className="font-semibold text-green-700">
                              {formatCurrency(item.total_sales_value || 0)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                            <div className={`font-semibold ${marginColor}`}>
                              {formatCurrency(item.margin_per_unit)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                            <div className={`font-semibold ${marginColor}`}>
                              {formatNumber(item.margin_percentage, 1)}%
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td className="px-4 py-4 font-bold text-gray-900" colSpan={2}>
                        TOTAL
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">
                        {formatNumber(
                          productSummary.reduce((sum, item) => sum + item.total_quantity, 0),
                          0
                        )}
                      </td>
                      <td className="px-4 py-4"></td>
                      <td className="px-4 py-4 text-right font-bold text-red-700 bg-red-50">
                        {formatCurrency(
                          productSummary.reduce((sum, item) => sum + item.total_material_cost, 0)
                        )}
                      </td>
                      <td className="px-4 py-4"></td>
                      <td className="px-4 py-4 text-right font-bold text-green-700 bg-green-50">
                        {formatCurrency(
                          productSummary.reduce((sum, item) => sum + (item.total_sales_value || 0), 0)
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">
                        {formatCurrency(
                          productSummary.reduce((sum, item) => sum + item.margin_per_unit * item.total_quantity, 0)
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">
                        {(() => {
                          const totalSales = productSummary.reduce((sum, item) => sum + (item.total_sales_value || 0), 0);
                          const totalCost = productSummary.reduce((sum, item) => sum + item.total_material_cost, 0);
                          return totalSales > 0 ? formatNumber(((totalSales - totalCost) / totalSales) * 100, 1) + '%' : '-';
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              </div>
            )}
          </>
        )}

        {!generalSummary && !loading && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Selecione o período e clique em Gerar Relatório</p>
            <p className="text-sm mt-2">Os dados serão processados instantaneamente no banco de dados</p>
          </div>
        )}
      </div>
    </div>
  );
}
