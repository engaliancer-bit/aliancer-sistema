import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, AlertCircle, CheckCircle, Clock, DollarSign, Filter, Search, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

interface PayableAccount {
  id: string;
  purchase_id: string | null;
  supplier_id: string;
  description: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  payment_date: string | null;
  payment_status: 'pending' | 'paid' | 'overdue';
  cash_account_id: string | null;
  cash_flow_id: string | null;
  notes: string | null;
  suppliers?: {
    name: string;
  };
  contas_caixa?: {
    name: string;
  };
}

interface Supplier {
  id: string;
  name: string;
}

interface CashAccount {
  id: string;
  name: string;
}

export default function PayableAccounts() {
  const [accounts, setAccounts] = useState<PayableAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<PayableAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PayableAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
  });

  const [formData, setFormData] = useState({
    supplier_id: '',
    description: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    payment_date: '',
    cash_account_id: '',
    installments: 1,
    notes: ''
  });

  const [paymentData, setPaymentData] = useState({
    account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    cash_account_id: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [accounts, statusFilter, searchTerm, dateFilter]);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadAccounts(),
      loadSuppliers(),
      loadCashAccounts()
    ]);
    setLoading(false);
  }

  async function loadAccounts() {
    const { data, error } = await supabase
      .from('payable_accounts')
      .select(`
        *,
        suppliers (name),
        contas_caixa (name)
      `)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error loading payable accounts:', error);
      return;
    }

    await updateOverdueAccounts();
    setAccounts(data || []);
  }

  async function updateOverdueAccounts() {
    await supabase.rpc('update_overdue_payable_accounts');
  }

  async function loadSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    setSuppliers(data || []);
  }

  async function loadCashAccounts() {
    const { data } = await supabase
      .from('contas_caixa')
      .select('id, name')
      .order('name');
    setCashAccounts(data || []);
  }

  function applyFilters() {
    let filtered = [...accounts];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.payment_status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.description.toLowerCase().includes(term) ||
        a.suppliers?.name.toLowerCase().includes(term)
      );
    }

    // Para contas pagas, filtrar pela data de pagamento
    // Para contas pendentes/vencidas, filtrar pela data de vencimento
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(a => {
        const dateToCompare = a.payment_status === 'paid' && a.payment_date
          ? a.payment_date
          : a.due_date;

        const passesStart = !dateFilter.startDate || dateToCompare >= dateFilter.startDate;
        const passesEnd = !dateFilter.endDate || dateToCompare <= dateFilter.endDate;

        return passesStart && passesEnd;
      });
    }

    filtered.sort((a, b) => {
      // Para contas pagas, ordenar pela data de pagamento
      // Para contas pendentes/vencidas, ordenar pela data de vencimento
      const dateA = a.payment_status === 'paid' && a.payment_date
        ? new Date(a.payment_date).getTime()
        : new Date(a.due_date).getTime();

      const dateB = b.payment_status === 'paid' && b.payment_date
        ? new Date(b.payment_date).getTime()
        : new Date(b.due_date).getTime();

      return dateA - dateB;
    });

    setFilteredAccounts(filtered);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.supplier_id || !formData.description || !formData.amount) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    // Validar se pagamento imediato exige conta de caixa
    if (formData.payment_date && !formData.cash_account_id) {
      alert('Se informar data de pagamento, é necessário selecionar a conta de caixa!');
      return;
    }

    try {
      const amount = parseFloat(formData.amount);
      const installments = parseInt(formData.installments.toString());

      if (installments > 1) {
        // Para múltiplas parcelas, criar pendentes (não suporta pagamento imediato)
        await supabase.rpc('create_payable_accounts_from_purchase', {
          purchase_id_param: null,
          supplier_id_param: formData.supplier_id,
          description_param: formData.description,
          total_amount_param: amount,
          installments_param: installments,
          first_due_date_param: formData.due_date
        });
      } else {
        // Usar nova função que processa pagamento imediato se aplicável
        const { error } = await supabase.rpc('create_payable_account_with_optional_payment', {
          supplier_id_param: formData.supplier_id,
          description_param: formData.description,
          amount_param: amount,
          due_date_param: formData.due_date,
          payment_date_param: formData.payment_date || null,
          cash_account_id_param: formData.cash_account_id || null,
          notes_param: formData.notes || null
        });

        if (error) throw error;
      }

      alert('Conta a pagar cadastrada com sucesso!');
      resetForm();
      loadAccounts();
    } catch (error) {
      console.error('Error creating payable account:', error);
      alert('Erro ao cadastrar conta a pagar');
    }
  }

  async function handlePayment(accountId: string) {
    if (!paymentData.cash_account_id) {
      alert('Selecione uma conta de caixa!');
      return;
    }

    if (paymentLoading) return;
    setPaymentLoading(true);

    try {
      const { error } = await supabase.rpc('process_payable_account_payment', {
        payable_account_id_param: accountId,
        payment_date_param: paymentData.payment_date,
        cash_account_id_param: paymentData.cash_account_id
      });

      if (error) throw error;

      setPaymentSuccess(true);
      loadAccounts();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Erro ao processar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  }

  function closePaymentModal() {
    setPaymentData({
      account_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      cash_account_id: ''
    });
    setPaymentSuccess(false);
    setPaymentLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta conta a pagar?')) {
      return;
    }

    const account = accounts.find(a => a.id === id);
    if (account?.payment_status === 'paid') {
      alert('Não é possível excluir uma conta já paga!');
      return;
    }

    const { error } = await supabase
      .from('payable_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting account:', error);
      alert('Erro ao excluir conta');
      return;
    }

    loadAccounts();
  }

  function resetForm() {
    setFormData({
      supplier_id: '',
      description: '',
      amount: '',
      due_date: new Date().toISOString().split('T')[0],
      payment_date: '',
      cash_account_id: '',
      installments: 1,
      notes: ''
    });
    setShowForm(false);
    setEditingAccount(null);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Pago
        </span>;
      case 'overdue':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Vencido
        </span>;
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Pendente
        </span>;
      default:
        return null;
    }
  }

  const totalPending = accounts
    .filter(a => a.payment_status === 'pending')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalOverdue = accounts
    .filter(a => a.payment_status === 'overdue')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalPaid = accounts
    .filter(a => a.payment_status === 'paid')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="text-gray-500">Carregando...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Contas a Pagar
          </h2>
          <p className="text-gray-600 mt-1">Gerencie suas contas e vencimentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.filter(a => a.payment_status === 'pending').length}
              </p>
              <p className="text-xs text-yellow-700">R$ {totalPending.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Vencidas</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.filter(a => a.payment_status === 'overdue').length}
              </p>
              <p className="text-xs text-red-700">R$ {totalOverdue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Pagas</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.filter(a => a.payment_status === 'paid').length}
              </p>
              <p className="text-xs text-green-700">R$ {totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.length}
              </p>
              <p className="text-xs text-blue-700">R$ {(totalPending + totalOverdue + totalPaid).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {accounts.filter(a => a.payment_status !== 'paid' && a.due_date === new Date().toISOString().split('T')[0]).length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <AlertCircle className="h-6 w-6 text-orange-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 text-lg">Atenção! Contas Vencendo Hoje</h3>
              <p className="text-orange-700">
                {accounts.filter(a => a.payment_status !== 'paid' && a.due_date === new Date().toISOString().split('T')[0]).length} conta(s) vencem hoje -
                Total: R$ {accounts.filter(a => a.payment_status !== 'paid' && a.due_date === new Date().toISOString().split('T')[0])
                  .reduce((sum, a) => sum + Number(a.amount), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={() => setDateFilter({
              startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
              endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString().split('T')[0],
            })}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Resetar Período
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setStatusFilter('overdue')}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'overdue' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Vencidas
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 rounded-lg ${statusFilter === 'paid' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Pagas
          </button>
        </div>

        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por descrição ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parcela</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  Nenhuma conta encontrada
                </td>
              </tr>
            ) : (
              filteredAccounts.map((account) => (
                <tr key={account.id} className={account.payment_status === 'overdue' ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.payment_status !== 'paid' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setPaymentData({
                              account_id: account.id,
                              payment_date: new Date().toISOString().split('T')[0],
                              cash_account_id: ''
                            });
                          }}
                          className="p-2 bg-green-600 text-white rounded hover:bg-green-700"
                          title="Confirmar Pagamento"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Pago</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {new Date(account.due_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.suppliers?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {account.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.installment_number}/{account.total_installments}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {Number(account.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(account.payment_status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.payment_date ? (
                      <div>
                        <div>{new Date(account.payment_date).toLocaleDateString()}</div>
                        {account.contas_caixa && (
                          <div className="text-xs text-gray-500">{account.contas_caixa.name}</div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Nova Conta a Pagar</h3>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fornecedor *
                </label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Selecione...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Total *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vencimento da {formData.installments > 1 ? 'Primeira Parcela' : 'Conta'} *
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              {formData.installments === 1 && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800 font-medium mb-2">
                      Pagamento Imediato (Opcional)
                    </p>
                    <p className="text-xs text-blue-600 mb-3">
                      Se esta conta já foi paga, informe a data e a conta de caixa abaixo.
                      Caso contrário, deixe em branco para registrar como pendente.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data do Pagamento
                        </label>
                        <input
                          type="date"
                          value={formData.payment_date}
                          onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Conta de Caixa
                        </label>
                        <select
                          value={formData.cash_account_id}
                          onChange={(e) => setFormData({ ...formData, cash_account_id: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg bg-white"
                          disabled={!formData.payment_date}
                        >
                          <option value="">Selecione...</option>
                          {cashAccounts.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Save className="h-5 w-5" />
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentData.account_id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            {paymentSuccess ? (
              <div className="text-center py-4">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Pagamento Confirmado!</h3>
                <p className="text-gray-600 mb-6">O pagamento foi registrado com sucesso.</p>
                <button
                  onClick={closePaymentModal}
                  className="px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  OK
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Confirmar Pagamento</h3>
                  <button onClick={closePaymentModal} className="text-gray-500 hover:text-gray-700">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data do Pagamento *
                    </label>
                    <input
                      type="date"
                      value={paymentData.payment_date}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conta de Caixa *
                    </label>
                    <select
                      value={paymentData.cash_account_id}
                      onChange={(e) => setPaymentData({ ...paymentData, cash_account_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    >
                      <option value="">Selecione...</option>
                      {cashAccounts.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => handlePayment(paymentData.account_id)}
                      disabled={paymentLoading}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="h-5 w-5" />
                      {paymentLoading ? 'Processando...' : 'Confirmar Pagamento'}
                    </button>
                    <button
                      onClick={closePaymentModal}
                      disabled={paymentLoading}
                      className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
