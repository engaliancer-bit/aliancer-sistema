import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import FactoryFinanceManager from './FactoryFinanceManager';

const CustomerStatement = lazy(() => import('./CustomerStatement'));

interface MonthlyData {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface CategoryData {
  category: string;
  amount: number;
  count: number;
}

interface FactoryBalance {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  receitas_vendas: number;
  receitas_servicos: number;
  receitas_outras: number;
  despesas_insumos: number;
  despesas_pessoal: number;
  despesas_operacionais: number;
  despesas_outras: number;
}

interface RawEntry {
  type: string;
  amount: number;
  date: string;
  category_name: string | null;
  category_type: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function FactoryFinance() {
  const [activeView, setActiveView] = useState<'manager' | 'charts' | 'reports' | 'customer-statement'>('manager');
  const [loading, setLoading] = useState(true);
  const [rawEntries, setRawEntries] = useState<RawEntry[]>([]);

  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(format(firstDayOfMonth, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(lastDayOfMonth, 'yyyy-MM-dd'));

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    loadData(abortRef.current.signal).catch(err => {
      if (err?.name !== 'AbortError') console.error('Erro ao carregar dados:', err);
    });
    return () => { abortRef.current?.abort(); };
  }, [startDate, endDate]);

  async function loadData(signal?: AbortSignal) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_flow')
        .select('type, amount, date, cost_categories(name, type)')
        .eq('business_unit', 'factory')
        .gte('date', startDate)
        .lte('date', endDate)
        .abortSignal(signal as AbortSignal);

      if (error) throw error;

      const entries: RawEntry[] = (data || []).map((e: any) => ({
        type: e.type,
        amount: e.amount ?? 0,
        date: e.date,
        category_name: e.cost_categories?.name ?? null,
        category_type: e.cost_categories?.type ?? null,
      }));

      setRawEntries(entries);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Erro ao carregar dados:', error);
        setRawEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const balance = useMemo<FactoryBalance>(() => {
    const total_receitas = rawEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const total_despesas = rawEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    const receitas_vendas = rawEntries
      .filter(e => e.type === 'income' && e.category_type === 'income_sales')
      .reduce((s, e) => s + e.amount, 0);
    const receitas_servicos = rawEntries
      .filter(e => e.type === 'income' && e.category_type === 'income_services')
      .reduce((s, e) => s + e.amount, 0);

    const despesas_insumos = rawEntries
      .filter(e => e.type === 'expense' && ['direct_production', 'direct_resale'].includes(e.category_type ?? ''))
      .reduce((s, e) => s + e.amount, 0);
    const despesas_pessoal = rawEntries
      .filter(e => e.type === 'expense' && e.category_type === 'personnel')
      .reduce((s, e) => s + e.amount, 0);
    const despesas_operacionais = rawEntries
      .filter(e => e.type === 'expense' && ['transport', 'utilities', 'maintenance'].includes(e.category_type ?? ''))
      .reduce((s, e) => s + e.amount, 0);

    return {
      total_receitas,
      total_despesas,
      saldo: total_receitas - total_despesas,
      receitas_vendas,
      receitas_servicos,
      receitas_outras: Math.max(0, total_receitas - receitas_vendas - receitas_servicos),
      despesas_insumos,
      despesas_pessoal,
      despesas_operacionais,
      despesas_outras: Math.max(0, total_despesas - despesas_insumos - despesas_pessoal - despesas_operacionais),
    };
  }, [rawEntries]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    const map = new Map<string, { receitas: number; despesas: number }>();
    for (const e of rawEntries) {
      const month = e.date.slice(0, 7);
      const md = map.get(month) ?? { receitas: 0, despesas: 0 };
      if (e.type === 'income') md.receitas += e.amount;
      else md.despesas += e.amount;
      map.set(month, md);
    }
    return Array.from(map.entries())
      .map(([month, d]) => ({ month, receitas: d.receitas, despesas: d.despesas, saldo: d.receitas - d.despesas }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [rawEntries]);

  const categoryData = useMemo<{ receitas: CategoryData[]; despesas: CategoryData[] }>(() => {
    const recMap = new Map<string, { amount: number; count: number }>();
    const desMap = new Map<string, { amount: number; count: number }>();
    for (const e of rawEntries) {
      const name = e.category_name ?? 'Sem categoria';
      const map = e.type === 'income' ? recMap : desMap;
      const cd = map.get(name) ?? { amount: 0, count: 0 };
      cd.amount += e.amount;
      cd.count += 1;
      map.set(name, cd);
    }
    return {
      receitas: Array.from(recMap.entries()).map(([category, d]) => ({ category, ...d })),
      despesas: Array.from(desMap.entries()).map(([category, d]) => ({ category, ...d })),
    };
  }, [rawEntries]);

  const monthlyMaxValue = useMemo(
    () => Math.max(...monthlyData.map(d => Math.max(d.receitas, d.despesas)), 1),
    [monthlyData]
  );

  const receitasTotalCat = useMemo(
    () => categoryData.receitas.reduce((s, c) => s + c.amount, 0),
    [categoryData.receitas]
  );

  const despesasTotalCat = useMemo(
    () => categoryData.despesas.reduce((s, c) => s + c.amount, 0),
    [categoryData.despesas]
  );

  async function exportToPDF() {
    if (!balance) return;
    try {
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
        .maybeSingle();

      const doc = new jsPDF();
      const { addPDFHeader } = await import('../lib/pdfGenerator');
      let currentY = await addPDFHeader(doc, 'Relatório Financeiro - Fábrica de Artefatos', companyData || undefined, 15);

      currentY += 5;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Período:', 14, currentY);
      doc.setFont(undefined, 'normal');
      doc.text(`${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`, 33, currentY);
      currentY += 10;

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Resumo Financeiro:', 14, currentY);
      currentY += 7;

      doc.setFontSize(10);
      doc.setTextColor(0, 128, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Receitas: ${formatCurrency(balance.total_receitas)}`, 14, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Vendas: ${formatCurrency(balance.receitas_vendas)}`, 20, currentY); currentY += 5;
      doc.text(`Serviços: ${formatCurrency(balance.receitas_servicos)}`, 20, currentY); currentY += 5;
      doc.text(`Outras: ${formatCurrency(balance.receitas_outras)}`, 20, currentY); currentY += 8;

      doc.setTextColor(255, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Despesas: ${formatCurrency(balance.total_despesas)}`, 14, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Insumos: ${formatCurrency(balance.despesas_insumos)}`, 20, currentY); currentY += 5;
      doc.text(`Pessoal: ${formatCurrency(balance.despesas_pessoal)}`, 20, currentY); currentY += 5;
      doc.text(`Operacionais: ${formatCurrency(balance.despesas_operacionais)}`, 20, currentY); currentY += 5;
      doc.text(`Outras: ${formatCurrency(balance.despesas_outras)}`, 20, currentY); currentY += 8;

      doc.setTextColor(0, 0, 255);
      doc.setFont(undefined, 'bold');
      doc.text(`Saldo Final: ${formatCurrency(balance.saldo)}`, 14, currentY);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      currentY += 10;

      if (monthlyData.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [['Mês', 'Receitas', 'Despesas', 'Saldo']],
          body: monthlyData.map(d => [
            format(new Date(d.month + '-01'), 'MMM/yyyy'),
            formatCurrency(d.receitas),
            formatCurrency(d.despesas),
            formatCurrency(d.saldo),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 10 },
        });
      }

      doc.save(`relatorio-financeiro-fabrica-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas e Despesas</h1>
          <p className="text-sm text-gray-600 mt-1">Controle financeiro da fábrica de artefatos</p>
        </div>
        <div className="flex gap-2">
          {(['manager', 'charts', 'reports', 'customer-statement'] as const).map(view => {
            const icons = { manager: FileText, charts: BarChart3, reports: PieChart, 'customer-statement': Users };
            const labels = { manager: 'Lançamentos', charts: 'Gráficos', reports: 'Relatórios', 'customer-statement': 'Extrato de Clientes' };
            const Icon = icons[view];
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  activeView === view ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {labels[view]}
              </button>
            );
          })}
        </div>
      </div>

      {activeView !== 'customer-statement' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const current = new Date(startDate);
                const ns = new Date(current.getFullYear(), current.getMonth() - 1, 1);
                setStartDate(format(ns, 'yyyy-MM-dd'));
                setEndDate(format(new Date(ns.getFullYear(), ns.getMonth() + 1, 0), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-sm"
            >
              Mês Anterior
            </button>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              <Calendar className="h-5 w-5 text-blue-600" />
              <input
                type="month"
                value={startDate.slice(0, 7)}
                onChange={e => {
                  const [year, month] = e.target.value.split('-');
                  const ns = new Date(parseInt(year), parseInt(month) - 1, 1);
                  setStartDate(format(ns, 'yyyy-MM-dd'));
                  setEndDate(format(new Date(parseInt(year), parseInt(month), 0), 'yyyy-MM-dd'));
                }}
                className="border-none bg-transparent text-gray-800 font-semibold focus:ring-0 cursor-pointer text-sm"
              />
            </div>
            <button
              onClick={() => {
                const current = new Date(startDate);
                const ns = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                setStartDate(format(ns, 'yyyy-MM-dd'));
                setEndDate(format(new Date(ns.getFullYear(), ns.getMonth() + 1, 0), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-sm"
            >
              Próximo Mês
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const ns = new Date(today.getFullYear(), today.getMonth(), 1);
                setStartDate(format(ns, 'yyyy-MM-dd'));
                setEndDate(format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-sm border border-blue-200"
            >
              Mês Atual
            </button>
            <button
              onClick={() => loadData()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm ml-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>
      )}

      {activeView !== 'customer-statement' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Receitas</p>
                <p className="text-2xl font-bold text-green-700 mt-2">{formatCurrency(balance.total_receitas)}</p>
                <div className="mt-3 space-y-1 text-xs text-green-600">
                  <p>Vendas: {formatCurrency(balance.receitas_vendas)}</p>
                  <p>Serviços: {formatCurrency(balance.receitas_servicos)}</p>
                  <p>Outras: {formatCurrency(balance.receitas_outras)}</p>
                </div>
              </div>
              <TrendingUp className="h-12 w-12 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Total Despesas</p>
                <p className="text-2xl font-bold text-red-700 mt-2">{formatCurrency(balance.total_despesas)}</p>
                <div className="mt-3 space-y-1 text-xs text-red-600">
                  <p>Insumos: {formatCurrency(balance.despesas_insumos)}</p>
                  <p>Pessoal: {formatCurrency(balance.despesas_pessoal)}</p>
                  <p>Operacionais: {formatCurrency(balance.despesas_operacionais)}</p>
                  <p>Outras: {formatCurrency(balance.despesas_outras)}</p>
                </div>
              </div>
              <TrendingDown className="h-12 w-12 text-red-600 opacity-50" />
            </div>
          </div>

          <div className={`bg-gradient-to-br ${balance.saldo >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'} rounded-lg shadow p-6 border`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${balance.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
                <p className={`text-2xl font-bold ${balance.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'} mt-2`}>
                  {formatCurrency(balance.saldo)}
                </p>
                <p className="mt-3 text-xs text-gray-600">Receitas - Despesas</p>
              </div>
              <DollarSign className={`h-12 w-12 ${balance.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'} opacity-50`} />
            </div>
          </div>
        </div>
      )}

      {activeView === 'manager' && (
        <FactoryFinanceManager initialStartDate={startDate} initialEndDate={endDate} />
      )}

      {activeView === 'customer-statement' && (
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-4 text-gray-600">Carregando...</p>
            </div>
          </div>
        }>
          <CustomerStatement />
        </Suspense>
      )}

      {activeView === 'charts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Evolução Mensal</h3>
            {monthlyData.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum dado no período selecionado</p>
            ) : (
              <div className="space-y-4">
                {monthlyData.map((data, index) => {
                  const receitasWidth = (data.receitas / monthlyMaxValue) * 100;
                  const despesasWidth = (data.despesas / monthlyMaxValue) * 100;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                        <span>{format(new Date(data.month + '-01'), 'MMM/yyyy')}</span>
                        <span className={data.saldo >= 0 ? 'text-green-600' : 'text-red-600'}>
                          Saldo: {formatCurrency(data.saldo)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 w-20">Receitas</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                            <div className="h-full bg-green-500 flex items-center justify-end px-2" style={{ width: `${receitasWidth}%` }}>
                              <span className="text-xs text-white font-medium">{formatCurrency(data.receitas)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 w-20">Despesas</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                            <div className="h-full bg-red-500 flex items-center justify-end px-2" style={{ width: `${despesasWidth}%` }}>
                              <span className="text-xs text-white font-medium">{formatCurrency(data.despesas)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Receitas por Categoria</h3>
              {categoryData.receitas.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma receita no período</p>
              ) : (
                <div className="space-y-4">
                  {categoryData.receitas.map((cat, index) => {
                    const percentage = receitasTotalCat > 0 ? (cat.amount / receitasTotalCat) * 100 : 0;
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">{cat.category}</span>
                          <span className="text-green-600 font-semibold">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-12 text-right">{percentage.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-gray-500">{cat.count} lançamento(s)</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Despesas por Categoria</h3>
              {categoryData.despesas.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma despesa no período</p>
              ) : (
                <div className="space-y-4">
                  {categoryData.despesas.map((cat, index) => {
                    const percentage = despesasTotalCat > 0 ? (cat.amount / despesasTotalCat) * 100 : 0;
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">{cat.category}</span>
                          <span className="text-red-600 font-semibold">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-12 text-right">{percentage.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-gray-500">{cat.count} lançamento(s)</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'reports' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Relatório Gerencial</h3>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Período Analisado</h4>
              <p className="text-gray-600">
                {format(new Date(startDate), 'dd/MM/yyyy')} a {format(new Date(endDate), 'dd/MM/yyyy')}
              </p>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Resumo Financeiro</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Total de Receitas</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(balance.total_receitas)}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Vendas: {formatCurrency(balance.receitas_vendas)}{balance.total_receitas > 0 && ` (${((balance.receitas_vendas / balance.total_receitas) * 100).toFixed(1)}%)`}</p>
                    <p>Serviços: {formatCurrency(balance.receitas_servicos)}{balance.total_receitas > 0 && ` (${((balance.receitas_servicos / balance.total_receitas) * 100).toFixed(1)}%)`}</p>
                    <p>Outras: {formatCurrency(balance.receitas_outras)}{balance.total_receitas > 0 && ` (${((balance.receitas_outras / balance.total_receitas) * 100).toFixed(1)}%)`}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Total de Despesas</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(balance.total_despesas)}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Insumos: {formatCurrency(balance.despesas_insumos)}{balance.total_despesas > 0 && ` (${((balance.despesas_insumos / balance.total_despesas) * 100).toFixed(1)}%)`}</p>
                    <p>Pessoal: {formatCurrency(balance.despesas_pessoal)}{balance.total_despesas > 0 && ` (${((balance.despesas_pessoal / balance.total_despesas) * 100).toFixed(1)}%)`}</p>
                    <p>Operacionais: {formatCurrency(balance.despesas_operacionais)}{balance.total_despesas > 0 && ` (${((balance.despesas_operacionais / balance.total_despesas) * 100).toFixed(1)}%)`}</p>
                    <p>Outras: {formatCurrency(balance.despesas_outras)}{balance.total_despesas > 0 && ` (${((balance.despesas_outras / balance.total_despesas) * 100).toFixed(1)}%)`}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Resultado</h4>
              <div className={`p-4 rounded-lg ${balance.saldo >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm font-medium text-gray-700">Saldo do Período</p>
                <p className={`text-3xl font-bold ${balance.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(balance.saldo)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Margem: {balance.total_receitas > 0 ? `${((balance.saldo / balance.total_receitas) * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>

            {monthlyData.length > 0 && (
              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Dados por Mês</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Receitas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Despesas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {monthlyData.map((data, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{format(new Date(data.month + '-01'), 'MMM/yyyy')}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{formatCurrency(data.receitas)}</td>
                          <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{formatCurrency(data.despesas)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-bold ${data.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {formatCurrency(data.saldo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
