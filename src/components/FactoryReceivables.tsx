import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  DollarSign,
  Users,
  AlertCircle,
  TrendingDown,
  FileText,
  RefreshCw
} from 'lucide-react';

interface Receivable {
  customer_id: string;
  customer_name: string;
  origin_type: string;
  origin_id: string;
  origin_reference: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
}

export default function FactoryReceivables() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalClients: 0,
    totalOutstanding: 0,
    totalPaid: 0
  });

  useEffect(() => {
    loadReceivables();
  }, []);

  async function loadReceivables() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_factory_receivables');

      if (error) throw error;

      const sorted = (data || []).sort((a: Receivable, b: Receivable) =>
        (b.outstanding_amount || 0) - (a.outstanding_amount || 0)
      );

      setReceivables(sorted);

      // Calculate summary
      const uniqueClients = new Set(sorted.map((r: Receivable) => r.customer_id));
      const totalOutstanding = sorted.reduce((sum: number, r: Receivable) => sum + (r.outstanding_amount || 0), 0);
      const totalPaid = sorted.reduce((sum: number, r: Receivable) => sum + (r.paid_amount || 0), 0);

      setSummary({
        totalClients: uniqueClients.size,
        totalOutstanding: totalOutstanding,
        totalPaid: totalPaid
      });
    } catch (error) {
      console.error('Erro ao carregar recebíveis:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function formatDate(date: string | null) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  }

  function getDaysUntilDue(dueDate: string | null) {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getStatusColor(daysUntilDue: number | null) {
    if (daysUntilDue === null) return 'text-gray-600';
    if (daysUntilDue < 0) return 'text-red-600';
    if (daysUntilDue <= 7) return 'text-orange-600';
    return 'text-green-600';
  }

  function getStatusText(daysUntilDue: number | null) {
    if (daysUntilDue === null) return 'Sem vencimento';
    if (daysUntilDue < 0) return `Vencido há ${Math.abs(daysUntilDue)} dias`;
    if (daysUntilDue === 0) return 'Vence hoje';
    if (daysUntilDue <= 7) return `Vence em ${daysUntilDue} dias`;
    return `Vence em ${daysUntilDue} dias`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-500">Carregando recebíveis...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Clientes com Débitos</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{summary.totalClients}</p>
            </div>
            <Users className="h-8 w-8 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-medium">Total a Receber</p>
              <p className="text-2xl font-bold text-red-900 mt-2">
                {formatCurrency(summary.totalOutstanding)}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Já Recebido</p>
              <p className="text-2xl font-bold text-green-900 mt-2">
                {formatCurrency(summary.totalPaid)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400 opacity-50" />
          </div>
        </div>
      </div>

      {/* Receivables Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="font-semibold text-gray-900">Detalhes dos Recebíveis</h3>
          <button
            onClick={loadReceivables}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Origem</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Vencimento</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Recebido</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">A Receber</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum débito em aberto</p>
                  </td>
                </tr>
              ) : (
                receivables.map((receivable) => {
                  const daysUntilDue = getDaysUntilDue(receivable.due_date);
                  const statusColor = getStatusColor(daysUntilDue);

                  return (
                    <tr key={`${receivable.origin_id}-${receivable.origin_type}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {receivable.customer_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{receivable.origin_type}</p>
                            <p className="text-xs text-gray-500">{receivable.origin_reference}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(receivable.due_date)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-right text-gray-900">
                        {formatCurrency(receivable.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-right text-green-600">
                        {formatCurrency(receivable.paid_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-red-600">
                        {formatCurrency(receivable.outstanding_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`${statusColor} font-medium`}>
                          {getStatusText(daysUntilDue)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      {receivables.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p>Última atualização: {new Date().toLocaleString('pt-BR')}</p>
        </div>
      )}
    </div>
  );
}
