import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, DollarSign, AlertCircle, CheckCircle, X, Clock, RefreshCw } from 'lucide-react';

interface RecurringCharge {
  id: string;
  project_id: string;
  project_name: string;
  customer_name: string;
  charge_date: string;
  due_date: string;
  amount: number;
  description: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  days_overdue: number;
  created_at: string;
}

export default function RecurringChargesManager() {
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');

  useEffect(() => {
    loadCharges();
  }, [filter]);

  async function loadCharges() {
    setLoading(true);
    try {
      let query = supabase
        .from('v_recurring_charges_pending')
        .select('*')
        .order('due_date', { ascending: true });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filter === 'overdue') {
        query = query.eq('status', 'overdue');
      } else if (filter === 'paid') {
        const { data, error } = await supabase
          .from('engineering_recurring_charges')
          .select(`
            id,
            project_id,
            charge_date,
            due_date,
            amount,
            description,
            status,
            created_at,
            engineering_projects!inner (
              name,
              customers!inner (name)
            )
          `)
          .eq('status', 'paid')
          .order('due_date', { ascending: false })
          .limit(50);

        if (error) throw error;

        const formattedData = (data || []).map((charge: any) => ({
          id: charge.id,
          project_id: charge.project_id,
          project_name: charge.engineering_projects.name,
          customer_name: charge.engineering_projects.customers.name,
          charge_date: charge.charge_date,
          due_date: charge.due_date,
          amount: charge.amount,
          description: charge.description,
          status: charge.status,
          days_overdue: 0,
          created_at: charge.created_at,
        }));

        setCharges(formattedData);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      setCharges(data || []);
    } catch (error) {
      console.error('Erro ao carregar cobranças:', error);
      alert('Erro ao carregar cobranças recorrentes');
    } finally {
      setLoading(false);
    }
  }

  async function generateMonthlyCharges() {
    if (!confirm('Deseja gerar as cobranças mensais de todos os projetos ativos com cobrança recorrente?')) {
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_all_monthly_charges');

      if (error) throw error;

      const count = data?.length || 0;
      alert(`${count} cobrança(s) gerada(s) com sucesso!`);
      loadCharges();
    } catch (error) {
      console.error('Erro ao gerar cobranças:', error);
      alert('Erro ao gerar cobranças mensais');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkAsPaid(chargeId: string) {
    if (!confirm('Confirmar que esta cobrança foi paga?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('engineering_recurring_charges')
        .update({ status: 'paid' })
        .eq('id', chargeId);

      if (error) throw error;

      alert('Cobrança marcada como paga!');
      loadCharges();
    } catch (error) {
      console.error('Erro ao atualizar cobrança:', error);
      alert('Erro ao atualizar status da cobrança');
    }
  }

  async function handleCancelCharge(chargeId: string) {
    if (!confirm('Tem certeza que deseja cancelar esta cobrança?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('engineering_recurring_charges')
        .update({ status: 'cancelled' })
        .eq('id', chargeId);

      if (error) throw error;

      alert('Cobrança cancelada com sucesso!');
      loadCharges();
    } catch (error) {
      console.error('Erro ao cancelar cobrança:', error);
      alert('Erro ao cancelar cobrança');
    }
  }

  function getStatusBadge(status: string, daysOverdue: number) {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <CheckCircle className="w-3 h-3" />
          Pago
        </span>
      );
    }

    if (status === 'overdue' || daysOverdue > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
          <AlertCircle className="w-3 h-3" />
          Vencido ({daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'})
        </span>
      );
    }

    if (status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
          <X className="w-3 h-3" />
          Cancelado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
        <Clock className="w-3 h-3" />
        Pendente
      </span>
    );
  }

  const totalPending = charges
    .filter(c => c.status === 'pending' || c.status === 'overdue')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalOverdue = charges
    .filter(c => c.status === 'overdue' || c.days_overdue > 0)
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cobranças Recorrentes</h2>
          <p className="text-sm text-gray-600 mt-1">Gestão de mensalidades de consultoria</p>
        </div>
        <button
          onClick={generateMonthlyCharges}
          disabled={generating}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Gerando...' : 'Gerar Cobranças do Mês'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pendente</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Vencido</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Cobranças</p>
              <p className="text-2xl font-bold text-gray-900">{charges.length}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex gap-2 p-4 border-b">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'overdue'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Vencidas
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'paid'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pagas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600">Carregando cobranças...</p>
        </div>
      ) : charges.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma cobrança encontrada.</p>
          <p className="text-gray-500 text-sm mt-2">
            {filter === 'all'
              ? 'Clique em "Gerar Cobranças do Mês" para criar as cobranças mensais.'
              : 'Altere o filtro para visualizar outras cobranças.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Projeto / Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {charges.map((charge) => (
                  <tr key={charge.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{charge.project_name}</div>
                        <div className="text-sm text-gray-500">{charge.customer_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{charge.description}</div>
                      <div className="text-xs text-gray-500">
                        Gerado em {new Date(charge.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(charge.due_date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-gray-500">
                        Ref: {new Date(charge.charge_date).toLocaleDateString('pt-BR', {
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        R$ {charge.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(charge.status, charge.days_overdue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-2 justify-end">
                        {charge.status === 'pending' || charge.status === 'overdue' ? (
                          <>
                            <button
                              onClick={() => handleMarkAsPaid(charge.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Marcar como pago"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleCancelCharge(charge.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Cancelar cobrança"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
