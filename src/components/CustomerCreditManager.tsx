import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, History, X, Check, AlertCircle } from 'lucide-react';

interface CustomerCredit {
  id: string;
  credit_type: 'adicao' | 'uso';
  amount: number;
  origin_type: string;
  applied_to_type: string | null;
  description: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  credit_balance: number;
}

interface CustomerCreditManagerProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onCreditChanged?: () => void;
}

export default function CustomerCreditManager({
  customerId,
  customerName,
  onClose,
  onCreditChanged
}: CustomerCreditManagerProps) {
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, [customerId]);

  async function loadData() {
    setLoading(true);
    try {
      const [customerRes, creditsRes] = await Promise.all([
        supabase.from('customers').select('id, name, credit_balance').eq('id', customerId).maybeSingle(),
        supabase
          .from('customer_credits')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (customerRes.data) setBalance(customerRes.data.credit_balance || 0);
      setCredits(creditsRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar creditos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCredit() {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) {
      setError('Informe um valor valido maior que zero.');
      return;
    }
    if (!addDescription.trim()) {
      setError('Informe uma descricao para o credito.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: rpcError } = await supabase.rpc('add_customer_credit', {
        p_customer_id: customerId,
        p_amount: amount,
        p_description: addDescription.trim(),
        p_origin_type: 'manual',
        p_origin_id: null,
        p_created_by: user?.id || null
      });
      if (rpcError) throw rpcError;
      setSuccess(`Credito de ${formatCurrency(amount)} adicionado com sucesso!`);
      setAddAmount('');
      setAddDescription('');
      setShowAddForm(false);
      await loadData();
      onCreditChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Erro ao adicionar credito.');
    } finally {
      setSaving(false);
    }
  }

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR');
  }

  function getCreditTypeLabel(type: string) {
    return type === 'adicao' ? 'Credito' : 'Uso';
  }

  function getCreditTypeBadge(type: string) {
    if (type === 'adicao') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Plus className="h-3 w-3" />
          Adicionado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Check className="h-3 w-3" />
        Utilizado
      </span>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Saldo para Compra Futura</h3>
              <p className="text-sm text-gray-500">{customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl p-6">
                <p className="text-sm font-medium text-green-700 mb-1">Saldo Disponivel</p>
                <p className="text-4xl font-bold text-green-900">{formatCurrency(balance)}</p>
                <p className="text-xs text-green-600 mt-2">
                  Disponivel para ser aplicado em orçamentos da fabrica
                </p>
              </div>

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              {!showAddForm ? (
                <button
                  onClick={() => { setShowAddForm(true); setSuccess(''); setError(''); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Plus className="h-5 w-5" />
                  Adicionar Credito Manualmente
                </button>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold text-gray-800">Adicionar Credito</h4>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0,00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descricao / Motivo *</label>
                    <input
                      type="text"
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Ex: Devolucao de produto, ajuste comercial..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAddCredit}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : (
                        <>
                          <Check className="h-4 w-4" />
                          Confirmar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setError(''); }}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-gray-500" />
                  <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Historico de Movimentacoes</h4>
                </div>

                {credits.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma movimentacao registrada</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {credits.map((credit) => (
                      <div key={credit.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getCreditTypeBadge(credit.credit_type)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{credit.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(credit.created_at)}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${credit.credit_type === 'adicao' ? 'text-green-600' : 'text-blue-600'}`}>
                          {credit.credit_type === 'adicao' ? '+' : '-'}{formatCurrency(credit.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
