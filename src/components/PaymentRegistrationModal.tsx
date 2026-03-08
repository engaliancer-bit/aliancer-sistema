import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quoteId: string;
  customerName: string;
  reference: string;
  totalAmount: number;
  paidAmount: number;
  description: string;
}

export const PaymentRegistrationModal: React.FC<PaymentRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  quoteId,
  customerName,
  reference,
  totalAmount,
  paidAmount,
  description,
}) => {
  const [currentTotalAmount, setCurrentTotalAmount] = useState(totalAmount);
  const [currentPaidAmount, setCurrentPaidAmount] = useState(paidAmount);
  const [paymentAmount, setPaymentAmount] = useState(totalAmount - paidAmount);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingQuoteData, setLoadingQuoteData] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // Load current quote data when modal opens
  useEffect(() => {
    if (isOpen && quoteId) {
      loadCurrentQuoteData();
    }
  }, [isOpen, quoteId]);

  const loadCurrentQuoteData = async () => {
    setLoadingQuoteData(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('quotes')
        .select('id, total_value, paid_amount')
        .eq('id', quoteId)
        .maybeSingle();

      if (fetchError) {
        console.error('Erro ao carregar dados do orçamento:', fetchError);
        return;
      }

      if (data && isMountedRef.current) {
        const actualPaidAmount = Number(data.paid_amount) || 0;
        const actualTotalAmount = Number(data.total_value) || 0;

        setCurrentTotalAmount(actualTotalAmount);
        setCurrentPaidAmount(actualPaidAmount);
        setPaymentAmount(actualTotalAmount - actualPaidAmount);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do orçamento:', err);
    } finally {
      setLoadingQuoteData(false);
    }
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const amountOwed = currentTotalAmount - currentPaidAmount;
  const isPartialPayment = paymentAmount < amountOwed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (paymentAmount <= 0) {
      setError('Valor do pagamento deve ser maior que zero');
      return;
    }

    if (paymentAmount > amountOwed) {
      setError(`Valor do pagamento não pode ser maior que ${amountOwed.toFixed(2)} devidos`);
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('quote_payments')
        .insert([
          {
            quote_id: quoteId,
            payment_amount: paymentAmount,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            receipt_number: receiptNumber || null,
            notes: notes || null,
          },
        ]);

      if (insertError) {
        setError(`Erro ao registrar pagamento: ${insertError.message}`);
        return;
      }

      setSuccess('Pagamento registrado com sucesso!');
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          onSuccess();
          onClose();
          setPaymentAmount(amountOwed);
          setPaymentMethod('pix');
          setReceiptNumber('');
          setNotes('');
        }
      }, 1500);
    } catch (err) {
      setError('Erro inesperado ao registrar pagamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full my-auto max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Registrar Pagamento</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Read-only info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
              {customerName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referência
            </label>
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
              {reference}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 max-h-20 overflow-y-auto">
              {description}
            </div>
          </div>

          {/* Amount info */}
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            {loadingQuoteData && (
              <div className="text-sm text-amber-600 mb-2">Atualizando dados...</div>
            )}
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Valor Total:</span>
              <span className="font-semibold text-gray-900">R$ {currentTotalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Já Pago:</span>
              <span className="font-semibold text-gray-900">R$ {currentPaidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-blue-300 pt-1 mt-1">
              <span className="font-medium text-gray-700">Devido:</span>
              <span className="font-bold text-blue-600">R$ {amountOwed.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor a Pagar *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={amountOwed}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
            />
            {isPartialPayment && (
              <p className="text-xs text-amber-600 mt-1">
                Pagamento parcial: Saldo restante será R$ {(amountOwed - paymentAmount).toFixed(2)}
              </p>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forma de Pagamento *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="boleto">Boleto</option>
              <option value="cheque">Cheque</option>
              <option value="transferencia">Transferência</option>
            </select>
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data do Pagamento *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
            />
          </div>

          {/* Receipt number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número do Recibo (opcional)
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="Ex: REC-001, TRX-12345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loading}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre o pagamento..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              disabled={loading}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
              {success}
            </div>
          )}

        </form>

        <div className="flex gap-2 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
