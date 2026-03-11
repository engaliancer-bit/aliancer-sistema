import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  FileText,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import EngineeringFinanceManager from './EngineeringFinanceManager';
import PayrollConfirmationModal from './engineering/PayrollConfirmationModal';
import ExpenseCategoriesManager from './engineering/ExpenseCategoriesManager';

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

interface FinanceBalance {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  receitas_honorarios: number;
  receitas_reembolsos: number;
  receitas_outras: number;
  despesas_antecipacoes: number;
  despesas_operacionais: number;
  despesas_outras: number;
}

interface RawEntry {
  entry_date: string;
  entry_type: string;
  category: string;
  amount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  honorarios: 'Honorários',
  antecipacao_reembolso: 'Antecipação/Reembolso',
  outras_receitas: 'Outras Receitas',
  antecipacao_cliente: 'Antecipação para Cliente',
  operacional: 'Despesa Operacional',
  outras_despesas: 'Outras Despesas',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function EngineeringFinance() {
  const [activeView, setActiveView] = useState<'manager' | 'charts' | 'reports' | 'categories'>('manager');
  const [loading, setLoading] = useState(true);
  const [rawEntries, setRawEntries] = useState<RawEntry[]>([]);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [pendingPayrollCount, setPendingPayrollCount] = useState(0);

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
    checkPendingPayrolls().catch(err => {
      console.error('Erro ao verificar salários pendentes:', err);
    });
    return () => { abortRef.current?.abort(); };
  }, [startDate, endDate]);

  async function checkPendingPayrolls() {
    try {
      const { data, error } = await supabase
        .from('v_pending_payroll_current_month')
        .select('schedule_id', { count: 'exact', head: false });

      if (error) throw error;

      const count = data?.length || 0;
      setPendingPayrollCount(count);

      if (count > 0) {
        setTimeout(() => {
          if (confirm(`Há ${count} pagamento(s) de salário pendente(s) para este mês. Deseja revisar agora?`)) {
            setShowPayrollModal(true);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao verificar salários pendentes:', error);
    }
  }

  async function loadData(signal?: AbortSignal) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('engineering_finance_entries')
        .select('entry_date, entry_type, category, amount')
        .gte('entry_date', startDate || '2026-01-01')
        .lte('entry_date', endDate || format(new Date(), 'yyyy-MM-dd'))
        .eq('status', 'efetivado')
        .abortSignal(signal as AbortSignal);

      if (error) throw error;

      setRawEntries((data || []) as RawEntry[]);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Erro ao carregar dados:', error);
        setRawEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const balance = useMemo<FinanceBalance>(() => {
    let total_receitas = 0;
    let total_despesas = 0;
    let receitas_honorarios = 0;
    let receitas_reembolsos = 0;
    let despesas_antecipacoes = 0;
    let despesas_operacionais = 0;

    for (const e of rawEntries) {
      const amt = e.amount ?? 0;
      if (e.entry_type === 'receita') {
        total_receitas += amt;
        if (e.category === 'honorarios') receitas_honorarios += amt;
        else if (e.category === 'antecipacao_reembolso') receitas_reembolsos += amt;
      } else {
        total_despesas += amt;
        if (e.category === 'antecipacao_cliente') despesas_antecipacoes += amt;
        else if (e.category === 'operacional') despesas_operacionais += amt;
      }
    }

    return {
      total_receitas,
      total_despesas,
      saldo: total_receitas - total_despesas,
      receitas_honorarios,
      receitas_reembolsos,
      receitas_outras: Math.max(0, total_receitas - receitas_honorarios - receitas_reembolsos),
      despesas_antecipacoes,
      despesas_operacionais,
      despesas_outras: Math.max(0, total_despesas - despesas_antecipacoes - despesas_operacionais),
    };
  }, [rawEntries]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    const map = new Map<string, { receitas: number; despesas: number }>();
    for (const e of rawEntries) {
      const month = e.entry_date.slice(0, 7);
      const md = map.get(month) ?? { receitas: 0, despesas: 0 };
      if (e.entry_type === 'receita') md.receitas += e.amount;
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
      const map = e.entry_type === 'receita' ? recMap : desMap;
      const cd = map.get(e.category) ?? { amount: 0, count: 0 };
      cd.amount += e.amount;
      cd.count += 1;
      map.set(e.category, cd);
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
    try {
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
        .maybeSingle();

      const doc = new jsPDF();
      const { addPDFHeader } = await import('../lib/pdfGenerator');
      let currentY = await addPDFHeader(doc, 'Relatório Financeiro - Engenharia', companyData || undefined, 15);

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
      doc.text(`Honorários: ${formatCurrency(balance.receitas_honorarios)} (${balance.total_receitas > 0 ? ((balance.receitas_honorarios / balance.total_receitas) * 100).toFixed(1) : 0}%)`, 20, currentY); currentY += 5;
      doc.text(`Reembolsos: ${formatCurrency(balance.receitas_reembolsos)} (${balance.total_receitas > 0 ? ((balance.receitas_reembolsos / balance.total_receitas) * 100).toFixed(1) : 0}%)`, 20, currentY); currentY += 5;
      doc.text(`Outras: ${formatCurrency(balance.receitas_outras)} (${balance.total_receitas > 0 ? ((balance.receitas_outras / balance.total_receitas) * 100).toFixed(1) : 0}%)`, 20, currentY); currentY += 8;

      doc.setTextColor(255, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Despesas: ${formatCurrency(balance.total_despesas)}`, 14, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Antecipações: ${formatCurrency(balance.despesas_antecipacoes)} (${balance.total_despesas > 0 ? ((balance.despesas_antecipacoes / balance.total_despesas) * 100).toFixed(1) : 0}%)`, 20, currentY); currentY += 5;
      doc.text(`Operacionais: ${formatCurrency(balance.despesas_operacionais)} (${balance.total_despesas > 0 ? ((balance.despesas_operacionais / balance.total_despesas) * 100).toFixed(1) : 0}%)`, 20, currentY); currentY += 5;
      doc.text(`Outras: ${formatCurrency(balance.despesas_outras)} (${balance.total_despesas > 0 ? ((balance.despesas_outras / balance.total_despesas) * 100).toFixed(1) : 0}%)`, 20, currentY); currentY += 8;

      doc.setTextColor(0, 0, 255);
      doc.setFont(undefined, 'bold');
      doc.text(`Saldo Final: ${formatCurrency(balance.saldo)}`, 14, currentY);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      currentY += 10;

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

      doc.save(`relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
          <p className="text-sm text-gray-600 mt-1">Controle financeiro do escritório de engenharia</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('manager')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${activeView === 'manager' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <FileText className="h-4 w-4" />
            Lançamentos
          </button>
          <button
            onClick={() => setActiveView('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${activeView === 'categories' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Plus className="h-4 w-4" />
            Categorias
          </button>
          <button
            onClick={() => setActiveView('charts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${activeView === 'charts' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <BarChart3 className="h-4 w-4" />
            Gráficos
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${activeView === 'reports' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <PieChart className="h-4 w-4" />
            Relatórios
          </button>
          {pendingPayrollCount > 0 && (
            <button
              onClick={() => setShowPayrollModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 relative"
            >
              <DollarSign className="h-4 w-4" />
              Salários
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {pendingPayrollCount}
              </span>
            </button>
          )}
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Receitas</p>
              <p className="text-2xl font-bold text-green-700 mt-2">{formatCurrency(balance.total_receitas)}</p>
              <div className="mt-3 space-y-1 text-xs text-green-600">
                <p>Honorários: {formatCurrency(balance.receitas_honorarios)}</p>
                <p>Reembolsos: {formatCurrency(balance.receitas_reembolsos)}</p>
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
                <p>Antecipações: {formatCurrency(balance.despesas_antecipacoes)}</p>
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

      {activeView === 'manager' && (
        <EngineeringFinanceManager initialStartDate={startDate} initialEndDate={endDate} />
      )}

      {activeView === 'categories' && <ExpenseCategoriesManager />}

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
                          <span className="font-medium text-gray-700">{getCategoryLabel(cat.category)}</span>
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
                          <span className="font-medium text-gray-700">{getCategoryLabel(cat.category)}</span>
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
                    <p>Honorários: {formatCurrency(balance.receitas_honorarios)} ({balance.total_receitas > 0 ? ((balance.receitas_honorarios / balance.total_receitas) * 100).toFixed(1) : 0}%)</p>
                    <p>Reembolsos: {formatCurrency(balance.receitas_reembolsos)} ({balance.total_receitas > 0 ? ((balance.receitas_reembolsos / balance.total_receitas) * 100).toFixed(1) : 0}%)</p>
                    <p>Outras: {formatCurrency(balance.receitas_outras)} ({balance.total_receitas > 0 ? ((balance.receitas_outras / balance.total_receitas) * 100).toFixed(1) : 0}%)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Total de Despesas</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(balance.total_despesas)}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Antecipações: {formatCurrency(balance.despesas_antecipacoes)} ({balance.total_despesas > 0 ? ((balance.despesas_antecipacoes / balance.total_despesas) * 100).toFixed(1) : 0}%)</p>
                    <p>Operacionais: {formatCurrency(balance.despesas_operacionais)} ({balance.total_despesas > 0 ? ((balance.despesas_operacionais / balance.total_despesas) * 100).toFixed(1) : 0}%)</p>
                    <p>Outras: {formatCurrency(balance.despesas_outras)} ({balance.total_despesas > 0 ? ((balance.despesas_outras / balance.total_despesas) * 100).toFixed(1) : 0}%)</p>
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
                  Margem: {balance.total_receitas > 0 ? ((balance.saldo / balance.total_receitas) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <PayrollConfirmationModal
        isOpen={showPayrollModal}
        onClose={() => setShowPayrollModal(false)}
        onConfirm={() => {
          setShowPayrollModal(false);
          checkPendingPayrolls();
          loadData();
        }}
      />
    </div>
  );
}
