import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Filter,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  Search,
  BarChart3,
  PieChart,
  Download,
  RefreshCw
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

export default function EngineeringFinance() {
  const [activeView, setActiveView] = useState<'manager' | 'charts' | 'reports' | 'categories'>('manager');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<FinanceBalance | null>(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [pendingPayrollCount, setPendingPayrollCount] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<{
    receitas: CategoryData[];
    despesas: CategoryData[];
  }>({ receitas: [], despesas: [] });

  // Filtro padrão: mês atual
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const [startDate, setStartDate] = useState(format(firstDayOfMonth, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(lastDayOfMonth, 'yyyy-MM-dd'));

  useEffect(() => {
    loadData().catch(err => {
      console.error('Erro ao carregar dados:', err);
      setLoading(false);
    });
    checkPendingPayrolls().catch(err => {
      console.error('Erro ao verificar salários pendentes:', err);
    });
  }, [startDate, endDate]);

  // Verificar salários pendentes ao carregar
  async function checkPendingPayrolls() {
    try {
      const { data, error } = await supabase
        .from('v_pending_payroll_current_month')
        .select('schedule_id', { count: 'exact', head: false });

      if (error) throw error;

      const count = data?.length || 0;
      setPendingPayrollCount(count);

      // Mostrar modal automaticamente se houver salários pendentes
      if (count > 0) {
        // Aguardar 1 segundo para não aparecer muito rápido
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

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadBalance(),
      loadMonthlyData(),
      loadCategoryData(),
    ]);
    setLoading(false);
  }

  async function loadBalance() {
    try {
      const { data, error } = await supabase
        .rpc('get_engineering_finance_balance', {
          p_start_date: startDate || null,
          p_end_date: endDate || null,
        });

      if (error) {
        console.error('Erro RPC get_engineering_finance_balance:', error);
        throw error;
      }
      if (data && data.length > 0) {
        setBalance(data[0]);
      } else {
        // Se não houver dados, inicializar com zeros
        setBalance({
          total_receitas: 0,
          total_despesas: 0,
          saldo: 0,
          receitas_honorarios: 0,
          receitas_reembolsos: 0,
          receitas_outras: 0,
          despesas_antecipacoes: 0,
          despesas_operacionais: 0,
          despesas_outras: 0,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar saldo:', error);
      // Em caso de erro, inicializar com zeros
      setBalance({
        total_receitas: 0,
        total_despesas: 0,
        saldo: 0,
        receitas_honorarios: 0,
        receitas_reembolsos: 0,
        receitas_outras: 0,
        despesas_antecipacoes: 0,
        despesas_operacionais: 0,
        despesas_outras: 0,
      });
    }
  }

  async function loadMonthlyData() {
    try {
      const { data, error } = await supabase
        .from('engineering_finance_entries')
        .select('entry_date, entry_type, amount, status')
        .gte('entry_date', startDate || '2026-01-01')
        .lte('entry_date', endDate || format(new Date(), 'yyyy-MM-dd'))
        .eq('status', 'efetivado');

      if (error) {
        console.error('Erro ao carregar dados mensais:', error);
        throw error;
      }

      const monthlyMap = new Map<string, { receitas: number; despesas: number }>();

      data?.forEach((entry) => {
        const month = format(new Date(entry.entry_date), 'yyyy-MM');
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { receitas: 0, despesas: 0 });
        }
        const monthData = monthlyMap.get(month)!;
        if (entry.entry_type === 'receita') {
          monthData.receitas += entry.amount;
        } else {
          monthData.despesas += entry.amount;
        }
      });

      const monthly = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          receitas: data.receitas,
          despesas: data.despesas,
          saldo: data.receitas - data.despesas,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMonthlyData(monthly);
    } catch (error) {
      console.error('Erro ao carregar dados mensais:', error);
    }
  }

  async function loadCategoryData() {
    try {
      const { data, error } = await supabase
        .from('engineering_finance_entries')
        .select('entry_type, category, amount')
        .gte('entry_date', startDate || '2026-01-01')
        .lte('entry_date', endDate || format(new Date(), 'yyyy-MM-dd'))
        .eq('status', 'efetivado');

      if (error) {
        console.error('Erro ao carregar dados por categoria:', error);
        throw error;
      }

      const receitasMap = new Map<string, { amount: number; count: number }>();
      const despesasMap = new Map<string, { amount: number; count: number }>();

      data?.forEach((entry) => {
        const map = entry.entry_type === 'receita' ? receitasMap : despesasMap;
        if (!map.has(entry.category)) {
          map.set(entry.category, { amount: 0, count: 0 });
        }
        const catData = map.get(entry.category)!;
        catData.amount += entry.amount;
        catData.count += 1;
      });

      const receitas = Array.from(receitasMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
      }));

      const despesas = Array.from(despesasMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
      }));

      setCategoryData({ receitas, despesas });
    } catch (error) {
      console.error('Erro ao carregar dados por categoria:', error);
    }
  }

  function getCategoryLabel(category: string): string {
    const categoryOptions = {
      receita: [
        { value: 'honorarios', label: 'Honorários' },
        { value: 'antecipacao_reembolso', label: 'Antecipação/Reembolso' },
        { value: 'outras_receitas', label: 'Outras Receitas' },
      ],
      despesa: [
        { value: 'antecipacao_cliente', label: 'Antecipação para Cliente' },
        { value: 'operacional', label: 'Despesa Operacional' },
        { value: 'outras_despesas', label: 'Outras Despesas' },
      ],
    };

    const allCategories = [...categoryOptions.receita, ...categoryOptions.despesa];
    return allCategories.find(c => c.value === category)?.label || category;
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  async function exportToPDF() {
    if (!balance) return;

    try {
      // Carregar configurações da empresa
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
        .single();

      const doc = new jsPDF();

      // Adicionar cabeçalho com logo
      const { addPDFHeader } = await import('../lib/pdfGenerator');
      let currentY = await addPDFHeader(
        doc,
        'Relatório Financeiro - Engenharia',
        companyData || undefined,
        15
      );

      currentY += 5;

      // Período
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Período:', 14, currentY);
      doc.setFont(undefined, 'normal');
      doc.text(`${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`, 33, currentY);
      currentY += 10;

      // Resumo Financeiro
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Resumo Financeiro:', 14, currentY);
      currentY += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');

      // Receitas
      doc.setTextColor(0, 128, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Receitas: ${formatCurrency(balance.total_receitas)}`, 14, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Honorários: ${formatCurrency(balance.receitas_honorarios)} (${balance.total_receitas > 0 ? ((balance.receitas_honorarios / balance.total_receitas) * 100).toFixed(1) : 0}%)`, 20, currentY);
      currentY += 5;
      doc.text(`Reembolsos: ${formatCurrency(balance.receitas_reembolsos)} (${balance.total_receitas > 0 ? ((balance.receitas_reembolsos / balance.total_receitas) * 100).toFixed(1) : 0}%)`, 20, currentY);
      currentY += 5;
      doc.text(`Outras: ${formatCurrency(balance.receitas_outras)} (${balance.total_receitas > 0 ? ((balance.receitas_outras / balance.total_receitas) * 100).toFixed(1) : 0}%)`, 20, currentY);
      currentY += 8;

      // Despesas
      doc.setTextColor(255, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Despesas: ${formatCurrency(balance.total_despesas)}`, 14, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Antecipações: ${formatCurrency(balance.despesas_antecipacoes)} (${balance.total_despesas > 0 ? ((balance.despesas_antecipacoes / balance.total_despesas) * 100).toFixed(1) : 0}%)`, 20, currentY);
      currentY += 5;
      doc.text(`Operacionais: ${formatCurrency(balance.despesas_operacionais)} (${balance.total_despesas > 0 ? ((balance.despesas_operacionais / balance.total_despesas) * 100).toFixed(1) : 0}%)`, 20, currentY);
      currentY += 5;
      doc.text(`Outras: ${formatCurrency(balance.despesas_outras)} (${balance.total_despesas > 0 ? ((balance.despesas_outras / balance.total_despesas) * 100).toFixed(1) : 0}%)`, 20, currentY);
      currentY += 8;

      // Saldo
      doc.setTextColor(0, 0, 255);
      doc.setFont(undefined, 'bold');
      doc.text(`Saldo Final: ${formatCurrency(balance.saldo)}`, 14, currentY);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      currentY += 10;

      // Tabela mensal
      const tableData = monthlyData.map(data => [
        format(new Date(data.month + '-01'), 'MMM/yyyy'),
        formatCurrency(data.receitas),
        formatCurrency(data.despesas),
        formatCurrency(data.saldo),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Mês', 'Receitas', 'Despesas', 'Saldo']],
        body: tableData,
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeView === 'manager'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            Lançamentos
          </button>
          <button
            onClick={() => setActiveView('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeView === 'categories'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Plus className="h-4 w-4" />
            Categorias
          </button>
          <button
            onClick={() => setActiveView('charts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeView === 'charts'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Gráficos
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeView === 'reports'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
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
              const newStart = new Date(current.getFullYear(), current.getMonth() - 1, 1);
              const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
              setStartDate(format(newStart, 'yyyy-MM-dd'));
              setEndDate(format(newEnd, 'yyyy-MM-dd'));
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
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                const newStart = new Date(parseInt(year), parseInt(month) - 1, 1);
                const newEnd = new Date(parseInt(year), parseInt(month), 0);
                setStartDate(format(newStart, 'yyyy-MM-dd'));
                setEndDate(format(newEnd, 'yyyy-MM-dd'));
              }}
              className="border-none bg-transparent text-gray-800 font-semibold focus:ring-0 cursor-pointer text-sm"
            />
          </div>

          <button
            onClick={() => {
              const current = new Date(startDate);
              const newStart = new Date(current.getFullYear(), current.getMonth() + 1, 1);
              const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
              setStartDate(format(newStart, 'yyyy-MM-dd'));
              setEndDate(format(newEnd, 'yyyy-MM-dd'));
            }}
            className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium text-sm"
          >
            Próximo Mês
          </button>

          <button
            onClick={() => {
              const today = new Date();
              const newStart = new Date(today.getFullYear(), today.getMonth(), 1);
              const newEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              setStartDate(format(newStart, 'yyyy-MM-dd'));
              setEndDate(format(newEnd, 'yyyy-MM-dd'));
            }}
            className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-sm border border-blue-200"
          >
            Mês Atual
          </button>

          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm ml-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Receitas</p>
                <p className="text-2xl font-bold text-green-700 mt-2">
                  {formatCurrency(balance.total_receitas)}
                </p>
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
                <p className="text-2xl font-bold text-red-700 mt-2">
                  {formatCurrency(balance.total_despesas)}
                </p>
                <div className="mt-3 space-y-1 text-xs text-red-600">
                  <p>Antecipações: {formatCurrency(balance.despesas_antecipacoes)}</p>
                  <p>Operacionais: {formatCurrency(balance.despesas_operacionais)}</p>
                  <p>Outras: {formatCurrency(balance.despesas_outras)}</p>
                </div>
              </div>
              <TrendingDown className="h-12 w-12 text-red-600 opacity-50" />
            </div>
          </div>

          <div className={`bg-gradient-to-br ${balance.saldo >= 0 ? 'from-blue-50 to-blue-100' : 'from-orange-50 to-orange-100'} rounded-lg shadow p-6 border ${balance.saldo >= 0 ? 'border-blue-200' : 'border-orange-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${balance.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Saldo
                </p>
                <p className={`text-2xl font-bold ${balance.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'} mt-2`}>
                  {formatCurrency(balance.saldo)}
                </p>
                <p className="mt-3 text-xs text-gray-600">
                  Receitas - Despesas
                </p>
              </div>
              <DollarSign className={`h-12 w-12 ${balance.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'} opacity-50`} />
            </div>
          </div>
        </div>
      )}

      {activeView === 'manager' && (
        <EngineeringFinanceManager
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      )}

      {activeView === 'categories' && (
        <ExpenseCategoriesManager />
      )}

      {activeView === 'charts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Evolução Mensal</h3>
            <div className="space-y-4">
              {monthlyData.map((data, index) => {
                const maxValue = Math.max(...monthlyData.map(d => Math.max(d.receitas, d.despesas)));
                const receitasWidth = (data.receitas / maxValue) * 100;
                const despesasWidth = (data.despesas / maxValue) * 100;

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
                          <div
                            className="h-full bg-green-500 flex items-center justify-end px-2"
                            style={{ width: `${receitasWidth}%` }}
                          >
                            <span className="text-xs text-white font-medium">
                              {formatCurrency(data.receitas)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 w-20">Despesas</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-red-500 flex items-center justify-end px-2"
                            style={{ width: `${despesasWidth}%` }}
                          >
                            <span className="text-xs text-white font-medium">
                              {formatCurrency(data.despesas)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Receitas por Categoria</h3>
              <div className="space-y-4">
                {categoryData.receitas.map((cat, index) => {
                  const total = categoryData.receitas.reduce((sum, c) => sum + c.amount, 0);
                  const percentage = total > 0 ? (cat.amount / total) * 100 : 0;

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{getCategoryLabel(cat.category)}</span>
                        <span className="text-green-600 font-semibold">{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{cat.count} lançamento(s)</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Despesas por Categoria</h3>
              <div className="space-y-4">
                {categoryData.despesas.map((cat, index) => {
                  const total = categoryData.despesas.reduce((sum, c) => sum + c.amount, 0);
                  const percentage = total > 0 ? (cat.amount / total) * 100 : 0;

                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{getCategoryLabel(cat.category)}</span>
                        <span className="text-red-600 font-semibold">{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-red-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{cat.count} lançamento(s)</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'reports' && balance && (
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

      {/* Modal de Confirmação de Salários */}
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
