import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, AlertCircle, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import PaymentStatusCards from './PaymentStatusCards';
import ConfirmPaymentModal from './ConfirmPaymentModal';

interface ExpenseEntry {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method_id: string | null;
  notes: string | null;
  payment_status?: string | null;
  payment_confirmed_date?: string | null;
  payment_methods?: {
    name: string;
  };
}

interface ExpensePaymentTrackerProps {
  startDate?: string;
  endDate?: string;
  businessUnit?: string;
}

type FilterTab = 'all' | 'pending' | 'confirmed';

export default function ExpensePaymentTracker({
  startDate: propStartDate,
  endDate: propEndDate,
  businessUnit = 'factory'
}: ExpensePaymentTrackerProps) {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedPayment, setSelectedPayment] = useState<ExpenseEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState(
    propStartDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    propEndDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate]);

  async function loadExpenses() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cash_flow')
        .select('*, payment_methods(name)')
        .eq('type', 'expense')
        .eq('business_unit', businessUnit)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      setExpenses((data || []) as ExpenseEntry[]);
    } catch (err) {
      console.error('Erro ao carregar despesas:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (filterTab === 'pending') {
        return !exp.payment_status || exp.payment_status === 'pendente';
      }
      if (filterTab === 'confirmed') {
        return exp.payment_status === 'confirmado';
      }
      return true;
    });
  }, [expenses, filterTab]);

  const stats = useMemo(() => {
    const pending = expenses.filter(e => !e.payment_status || e.payment_status === 'pendente');
    const confirmed = expenses.filter(e => e.payment_status === 'confirmado');

    return {
      totalPending: pending.reduce((sum, e) => sum + e.amount, 0),
      totalConfirmed: confirmed.reduce((sum, e) => sum + e.amount, 0),
      countPending: pending.length,
      countConfirmed: confirmed.length,
    };
  }, [expenses]);

  function handleOpenModal(entry: ExpenseEntry) {
    setSelectedPayment(entry);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setSelectedPayment(null);
  }

  async function handleSuccess() {
    await loadExpenses();
  }

  const statusBadge = (status?: string | null) => {
    if (!status || status === 'pendente') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="h-3 w-3" />
          Pendente
        </span>
      );
    }
    if (status === 'confirmado') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3" />
          Confirmado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Carregando despesas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Confirmação de Pagamentos</h2>
          <p className="text-sm text-gray-600 mt-1">Visualize e confirme os pagamentos de despesas</p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-sm font-medium text-gray-700">Período:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-600">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <PaymentStatusCards
        totalPending={stats.totalPending}
        totalConfirmed={stats.totalConfirmed}
        countPending={stats.countPending}
        countConfirmed={stats.countConfirmed}
        period={`${new Date(startDate).toLocaleDateString('pt-BR')} - ${new Date(endDate).toLocaleDateString('pt-BR')}`}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {[
              { id: 'all', label: 'Todos', count: expenses.length },
              { id: 'pending', label: 'A Pagar', count: stats.countPending },
              { id: 'confirmed', label: 'Efetivados', count: stats.countConfirmed },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as FilterTab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  filterTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Data Confirmação</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-400" />
                      <p>Nenhuma despesa encontrada para o período selecionado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      entry.payment_status === 'confirmado' ? 'bg-green-50' : 'bg-white'
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{entry.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{entry.description}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      {entry.amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {statusBadge(entry.payment_status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">
                      {entry.payment_confirmed_date
                        ? new Date(entry.payment_confirmed_date).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(!entry.payment_status || entry.payment_status === 'pendente') && (
                        <button
                          onClick={() => handleOpenModal(entry)}
                          className="inline-flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                          title="Confirmar Pagamento"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Confirmar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm text-gray-900 text-right">
                    Total do filtro:
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                    {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ConfirmPaymentModal
        isOpen={showModal}
        entry={selectedPayment}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
