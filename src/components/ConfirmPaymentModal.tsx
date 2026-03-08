import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, CheckCircle, Calendar, DollarSign, Check } from 'lucide-react';

interface ExpenseEntry {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method_id: string | null;
  notes: string | null;
  payment_status?: string;
  payment_confirmed_date?: string;
  payment_methods?: {
    name: string;
  };
}

interface ConfirmPaymentModalProps {
  isOpen: boolean;
  entry: ExpenseEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfirmPaymentModal({
  isOpen,
  entry,
  onClose,
  onSuccess
}: ConfirmPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
      setConfirmedDate(new Date().toISOString().split('T')[0]);
      setError('');
      setShowSuccess(false);

      if (entry?.payment_method_id) {
        setPaymentMethod(entry.payment_method_id);
      } else {
        setPaymentMethod('');
      }
    }
  }, [isOpen, entry?.payment_method_id]);

  async function loadPaymentMethods() {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('active', true)
      .order('name');

    setPaymentMethods(data || []);
  }

  async function handleConfirmPayment() {
    if (!entry || !confirmedDate) {
      setError('Data de confirmacao e obrigatoria');
      return;
    }

    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const updateData: Record<string, any> = {
        payment_status: 'confirmado',
        payment_confirmed_date: confirmedDate,
        original_amount: entry.amount
      };

      if (user?.id) {
        updateData.payment_confirmed_by = user.id;
      }

      if (paymentMethod && paymentMethods.length > 0) {
        const method = paymentMethods.find(m => m.id === paymentMethod);
        if (method) {
          updateData.payment_method = method.name;
        }
      }

      const { data: updatedData, error: updateError } = await supabase
        .from('cash_flow')
        .update(updateData)
        .eq('id', entry.id)
        .select()
        .single();

      if (updateError) {
        console.error('Erro detalhado:', updateError);
        throw updateError;
      }

      setShowSuccess(true);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error('Erro ao confirmar pagamento:', err);
      setError(err?.message || 'Erro ao confirmar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !entry) return null;

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Pagamento Confirmado!
            </h3>
            <p className="text-gray-600 mb-6">
              O pagamento de{' '}
              <span className="font-semibold">
                {entry.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>{' '}
              foi confirmado com sucesso.
            </p>
            <button
              onClick={() => { onSuccess(); onClose(); }}
              className="px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Confirmar Pagamento
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Categoria</p>
              <p className="text-sm font-medium text-gray-900">{entry.category}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Descricao</p>
              <p className="text-sm font-medium text-gray-900">{entry.description}</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-600 uppercase tracking-wide">Valor</span>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-gray-600" />
                <span className="text-lg font-bold text-gray-900">
                  {entry.amount.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data da Confirmacao *
                </div>
              </label>
              <input
                type="date"
                value={confirmedDate}
                onChange={(e) => setConfirmedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metodo de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Selecione um metodo...</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Confirmando...' : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
