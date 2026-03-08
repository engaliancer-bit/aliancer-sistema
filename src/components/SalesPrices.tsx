import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, AlertCircle, FileText, Download, Filter, Search, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PriceItem {
  id: string;
  category: 'produto' | 'revenda';
  code: string;
  name: string;
  unit: string;
  unit_cost: number | null;
  tax_percentage: number | null;
  margin_percentage: number | null;
  suggested_price: number | null;
  profit: number | null;
  real_margin: number | null;
  max_discount: number | null;
  min_price: number | null;
  notes: string;
  updated_at: string | null;
  is_active: boolean;
}

type TableFormat = 'vendedor' | 'gerencial';
type CategoryFilter = 'todos' | 'produtos' | 'revenda';

export default function SalesPrices() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFormat, setTableFormat] = useState<TableFormat>('vendedor');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('todos');
  const [activeOnly, setActiveOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (categoryFilter !== 'todos') {
      filtered = filtered.filter(item => {
        if (categoryFilter === 'produtos') return item.category === 'produto';
        if (categoryFilter === 'revenda') return item.category === 'revenda';
        return true;
      });
    }

    if (activeOnly) {
      filtered = filtered.filter(item => item.is_active);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [items, categoryFilter, activeOnly, searchTerm]);

  const loadPriceData = useCallback(async () => {
    setLoading(true);
    try {
      const priceItems: PriceItem[] = [];

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, code, name, unit, custo_unitario_materiais, production_cost, sale_price, final_sale_price, margin_percentage, tax_percentage, minimum_price, maximum_discount_percent, created_at')
        .order('name');

      if (productsError) {
        console.error('Erro ao buscar produtos:', productsError);
        throw productsError;
      }

      (products || []).forEach(product => {
        const suggestedPrice = product.final_sale_price || product.sale_price || null;
        const unitCost = product.custo_unitario_materiais || product.production_cost || null;
        const profit = suggestedPrice && unitCost ? suggestedPrice - unitCost : null;
        const realMargin = suggestedPrice && unitCost && suggestedPrice > 0
          ? ((suggestedPrice - unitCost) / suggestedPrice) * 100
          : null;

        priceItems.push({
          id: product.id,
          category: 'produto',
          code: product.code || '-',
          name: product.name,
          unit: product.unit || 'unid',
          unit_cost: unitCost,
          tax_percentage: product.tax_percentage,
          margin_percentage: product.margin_percentage,
          suggested_price: suggestedPrice,
          profit: profit,
          real_margin: realMargin,
          max_discount: (product as any).maximum_discount_percent,
          min_price: (product as any).minimum_price,
          notes: '',
          updated_at: product.created_at,
          is_active: true
        });
      });

      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, unit, unit_cost, resale_enabled, resale_price, resale_margin_percentage, resale_tax_percentage, package_size, minimum_resale_price, maximum_discount_percent, created_at')
        .eq('resale_enabled', true)
        .order('name');

      if (materialsError) {
        console.error('Erro ao buscar materiais:', materialsError);
        throw materialsError;
      }

      (materials || []).forEach(material => {
        const suggestedPrice = material.resale_price || null;
        const unitCost = material.unit_cost || null;
        const profit = suggestedPrice && unitCost ? suggestedPrice - unitCost : null;
        const realMargin = suggestedPrice && unitCost && suggestedPrice > 0
          ? ((suggestedPrice - unitCost) / suggestedPrice) * 100
          : null;

        const notes = material.package_size
          ? `Embalagem: ${material.package_size}`
          : '';

        priceItems.push({
          id: material.id,
          category: 'revenda',
          code: material.id.substring(0, 8).toUpperCase(),
          name: material.name,
          unit: material.unit || 'unid',
          unit_cost: unitCost,
          tax_percentage: material.resale_tax_percentage,
          margin_percentage: material.resale_margin_percentage,
          suggested_price: suggestedPrice,
          profit: profit,
          real_margin: realMargin,
          max_discount: (material as any).maximum_discount_percent,
          min_price: (material as any).minimum_resale_price,
          notes: notes,
          updated_at: material.created_at,
          is_active: true
        });
      });

      setItems(priceItems);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar tabela de preços');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPriceData();

    const subscription = supabase
      .channel('price_table_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { loadPriceData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, () => { loadPriceData(); })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadPriceData]);

  function exportToCSV() {
    try {
      const headers = tableFormat === 'vendedor'
        ? ['Categoria', 'Código', 'Descrição', 'Unidade', 'Preço de Venda', 'Desconto Máx. (%)', 'Preço Mínimo', 'Observações']
        : ['Categoria', 'Código', 'Descrição', 'Unidade', 'Custo Unitário', 'Impostos (%)', 'Margem (%)', 'Preço Sugerido', 'Lucro Unit.', 'Margem Real (%)', 'Última Atualização'];

      const rows = filteredItems.map(item => {
        if (tableFormat === 'vendedor') {
          return [
            item.category === 'produto' ? 'Produto' : 'Revenda',
            item.code,
            item.name,
            item.unit,
            item.suggested_price ? `R$ ${item.suggested_price.toFixed(2)}` : 'Não calculado',
            item.max_discount ? `${item.max_discount.toFixed(1)}%` : '-',
            item.min_price ? `R$ ${item.min_price.toFixed(2)}` : '-',
            item.notes || '-'
          ];
        } else {
          return [
            item.category === 'produto' ? 'Produto' : 'Revenda',
            item.code,
            item.name,
            item.unit,
            item.unit_cost ? `R$ ${item.unit_cost.toFixed(2)}` : '-',
            item.tax_percentage ? `${item.tax_percentage.toFixed(1)}%` : '-',
            item.margin_percentage ? `${item.margin_percentage.toFixed(1)}%` : '-',
            item.suggested_price ? `R$ ${item.suggested_price.toFixed(2)}` : 'Não calculado',
            item.profit ? `R$ ${item.profit.toFixed(2)}` : '-',
            item.real_margin ? `${item.real_margin.toFixed(1)}%` : '-',
            item.updated_at ? new Date(item.updated_at).toLocaleDateString('pt-BR') : '-'
          ];
        }
      });

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tabela_precos_${tableFormat}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Arquivo CSV exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      alert('Erro ao exportar CSV');
    }
  }

  function exportToPDF() {
    try {
      const doc = new jsPDF({ orientation: tableFormat === 'gerencial' ? 'landscape' : 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 15;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const title = tableFormat === 'vendedor' ? 'TABELA DE PREÇOS - VENDEDOR' : 'TABELA DE PREÇOS - GERENCIAL';
      doc.text(title, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 3;
      doc.text(`Filtro: ${categoryFilter === 'todos' ? 'Todos' : categoryFilter === 'produtos' ? 'Produtos' : 'Revenda'}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      const headers = tableFormat === 'vendedor'
        ? [['Categoria', 'Código', 'Descrição', 'Un.', 'Preço Venda', 'Obs.']]
        : [['Cat.', 'Código', 'Descrição', 'Un.', 'Custo', 'Imp.%', 'Marg.%', 'Preço Sug.', 'Lucro', 'Marg.Real%']];

      const tableData = filteredItems.map(item => {
        if (tableFormat === 'vendedor') {
          return [
            item.category === 'produto' ? 'Prod.' : 'Rev.',
            item.code,
            item.name.length > 30 ? item.name.substring(0, 27) + '...' : item.name,
            item.unit,
            item.suggested_price ? `R$ ${item.suggested_price.toFixed(2)}` : 'N/C',
            item.notes ? (item.notes.length > 20 ? item.notes.substring(0, 17) + '...' : item.notes) : '-'
          ];
        } else {
          return [
            item.category === 'produto' ? 'P' : 'R',
            item.code,
            item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name,
            item.unit,
            item.unit_cost ? `R$ ${item.unit_cost.toFixed(2)}` : '-',
            item.tax_percentage ? `${item.tax_percentage.toFixed(1)}` : '-',
            item.margin_percentage ? `${item.margin_percentage.toFixed(1)}` : '-',
            item.suggested_price ? `R$ ${item.suggested_price.toFixed(2)}` : 'N/C',
            item.profit ? `R$ ${item.profit.toFixed(2)}` : '-',
            item.real_margin ? `${item.real_margin.toFixed(1)}` : '-'
          ];
        }
      });

      const columnStyles = tableFormat === 'vendedor'
        ? {
            0: { cellWidth: 20 },
            1: { cellWidth: 25 },
            2: { cellWidth: 60 },
            3: { cellWidth: 15 },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 40 }
          }
        : {
            0: { cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 50 },
            3: { cellWidth: 12 },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 15, halign: 'center' },
            6: { cellWidth: 15, halign: 'center' },
            7: { cellWidth: 30, halign: 'right' },
            8: { cellWidth: 25, halign: 'right' },
            9: { cellWidth: 20, halign: 'center' }
          };

      autoTable(doc, {
        startY: yPosition,
        head: headers,
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 7
        },
        columnStyles: columnStyles as any,
        margin: { left: 14, right: 14 }
      });

      const fileName = `tabela_precos_${tableFormat}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      alert('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF');
    }
  }

  const totalItems = filteredItems.length;
  const withPrice = filteredItems.filter(i => i.suggested_price && i.suggested_price > 0).length;
  const withoutPrice = totalItems - withPrice;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando tabela de preços...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tabela de Preços</h2>
          <p className="text-gray-600">Sincronizada com cadastros de Produtos e Insumos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPriceData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8" />
            <div className="text-sm opacity-90">Total de Itens</div>
          </div>
          <div className="text-3xl font-bold">{totalItems}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8" />
            <div className="text-sm opacity-90">Com Preço</div>
          </div>
          <div className="text-3xl font-bold">{withPrice}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-8 h-8" />
            <div className="text-sm opacity-90">Sem Preço</div>
          </div>
          <div className="text-3xl font-bold">{withoutPrice}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Filter className="w-4 h-4" />
          <span className="font-semibold">Filtros e Formato</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato de Tabela
            </label>
            <select
              value={tableFormat}
              onChange={(e) => setTableFormat(e.target.value as TableFormat)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="vendedor">Vendedor (sem custo)</option>
              <option value="gerencial">Gerencial (com custo/margem)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="produtos">Produtos</option>
              <option value="revenda">Revenda</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Apenas ativos</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome ou código..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {tableFormat === 'vendedor' ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <h3 className="text-lg font-semibold">Tabela Vendedor (sem informações de custo)</h3>
            <p className="text-sm opacity-90">Formato ideal para distribuir aos vendedores</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Unidade</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço de Venda</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Desc. Máx.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Mín.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={`${item.category}-${item.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.category === 'produto'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.category === 'produto' ? 'Produto' : 'Revenda'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">{item.unit}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      {item.suggested_price ? (
                        <span className="font-semibold text-green-600">R$ {item.suggested_price.toFixed(2)}</span>
                      ) : (
                        <span className="text-red-500 text-xs">Preço não calculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">
                      {item.max_discount ? `${item.max_discount.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">
                      {item.min_price ? `R$ ${item.min_price.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <h3 className="text-lg font-semibold">Tabela Gerencial (com custo e margem)</h3>
            <p className="text-sm opacity-90">Formato completo para análise e gestão</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cat.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Un.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Unit.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Imp. %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marg. %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Sug.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lucro Un.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Marg. Real</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={`${item.category}-${item.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.category === 'produto'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.category === 'produto' ? 'P' : 'R'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.code}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.name}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-600">{item.unit}</td>
                    <td className="px-4 py-4 text-sm text-right text-gray-900">
                      {item.unit_cost ? `R$ ${item.unit_cost.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-right text-gray-600">
                      {item.tax_percentage ? `${item.tax_percentage.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-right text-gray-600">
                      {item.margin_percentage ? `${item.margin_percentage.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      {item.suggested_price ? (
                        <span className="font-semibold text-green-600">R$ {item.suggested_price.toFixed(2)}</span>
                      ) : (
                        <span className="text-red-500 text-xs">N/C</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      {item.profit ? (
                        <span className={item.profit > 0 ? 'text-blue-600' : 'text-red-600'}>
                          R$ {item.profit.toFixed(2)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-right">
                      {item.real_margin ? (
                        <span className={`font-medium ${item.real_margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.real_margin.toFixed(1)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4 text-xs text-center text-gray-500">
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Sobre as Tabelas</h4>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>Tabela Vendedor:</strong> Exibe apenas informações comerciais (preços de venda), sem expor custos. Ideal para distribuir à equipe de vendas.</p>
            <p><strong>Tabela Gerencial:</strong> Exibe informações completas incluindo custos, margens e análise de lucratividade. Uso restrito à gestão.</p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Sincronização Automática</h4>
          <div className="text-sm text-green-800 space-y-2">
            <p><strong>Produtos:</strong> Preço sugerido = final_sale_price (preço com impostos)</p>
            <p><strong>Revenda:</strong> Preço sugerido = resale_price (custo + impostos + margem)</p>
            <p className="font-semibold mt-2">Os valores são SEMPRE lidos dos cadastros. Esta tabela NÃO calcula preços, apenas exibe.</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Itens sem Preço Calculado</h4>
        <p className="text-sm text-yellow-800">
          Se um item aparecer como "Preço não calculado" ou "N/C", significa que ele não tem preço definido no cadastro.
          <br />
          <strong>Solução:</strong> Acesse a aba "Produtos" (para produtos) ou "Insumos" (para revenda) e defina os valores de custo, margem e impostos para calcular o preço automaticamente.
        </p>
      </div>
    </div>
  );
}
