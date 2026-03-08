import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { DollarSign, Calendar, FileText, Save, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFormState } from '../hooks/useFormState';
import { useAsyncValidation, createSupplierValidator, createAmountValidator } from '../hooks/useAsyncValidation';
import { SimpleDateInput } from './OptimizedDatePicker';

interface PaymentFormData {
  supplier_id: string;
  description: string;
  amount: string;
  due_date: string;
  payment_date: string;
  cash_account_id: string;
  installments: number;
  notes: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface CashAccount {
  id: string;
  name: string;
}

interface OptimizedPaymentFormProps {
  onSubmit: (data: PaymentFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<PaymentFormData>;
  suppliers: Supplier[];
  cashAccounts: CashAccount[];
}

const SupplierSelect = memo<{
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  suppliers: Supplier[];
  error?: string;
  isValidating: boolean;
  required?: boolean;
}>(({ value, onChange, onBlur, suppliers, error, isValidating, required }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Fornecedor *
        {isValidating && <Loader className="inline-block w-4 h-4 ml-2 animate-spin text-blue-500" />}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        <option value="">Selecione um fornecedor</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      {error && (
        <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
});

SupplierSelect.displayName = 'SupplierSelect';

const AmountInput = memo<{
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  isValidating: boolean;
  required?: boolean;
}>(({ value, onChange, onBlur, error, isValidating, required }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Valor *
        {isValidating && <Loader className="inline-block w-4 h-4 ml-2 animate-spin text-blue-500" />}
      </label>
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
          placeholder="0.00"
          className={`w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />
      </div>
      {error && (
        <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
});

AmountInput.displayName = 'AmountInput';

const OptimizedPaymentForm = memo<OptimizedPaymentFormProps>(
  ({ onSubmit, onCancel, initialData, suppliers, cashAccounts }) => {
    const initialValues: PaymentFormData = useMemo(
      () => ({
        supplier_id: initialData?.supplier_id || '',
        description: initialData?.description || '',
        amount: initialData?.amount || '',
        due_date: initialData?.due_date || new Date().toISOString().split('T')[0],
        payment_date: initialData?.payment_date || '',
        cash_account_id: initialData?.cash_account_id || '',
        installments: initialData?.installments || 1,
        notes: initialData?.notes || '',
      }),
      [initialData]
    );

    const {
      values,
      errors,
      touched,
      isSubmitting,
      isDirty,
      setValue,
      setError,
      setTouched,
      resetForm,
      handleChange,
      handleBlur,
      setSubmitting,
    } = useFormState(initialValues);

    const supplierValidation = useAsyncValidation(createSupplierValidator(supabase), 500);
    const amountValidation = useAsyncValidation(createAmountValidator(), 300);

    const handleSupplierChange = useCallback(
      async (supplierId: string) => {
        setValue('supplier_id', supplierId);
        if (supplierId) {
          const result = await supplierValidation.validate(supplierId);
          if (!result.isValid && result.error) {
            setError('supplier_id', result.error);
          }
        }
      },
      [setValue, setError, supplierValidation]
    );

    const handleAmountChange = useCallback(
      async (amount: string) => {
        setValue('amount', amount);
        if (amount) {
          const result = await amountValidation.validate(amount);
          if (!result.isValid && result.error) {
            setError('amount', result.error);
          }
        }
      },
      [setValue, setError, amountValidation]
    );

    const handleSupplierBlur = useCallback(() => {
      setTouched('supplier_id', true);
    }, [setTouched]);

    const handleAmountBlur = useCallback(() => {
      setTouched('amount', true);
    }, [setTouched]);

    const validateForm = useCallback((): boolean => {
      let isValid = true;

      if (!values.supplier_id) {
        setError('supplier_id', 'Fornecedor é obrigatório');
        isValid = false;
      }

      if (!values.description.trim()) {
        setError('description', 'Descrição é obrigatória');
        isValid = false;
      }

      if (!values.amount || parseFloat(values.amount) <= 0) {
        setError('amount', 'Valor deve ser maior que zero');
        isValid = false;
      }

      if (!values.due_date) {
        setError('due_date', 'Data de vencimento é obrigatória');
        isValid = false;
      }

      if (values.payment_date && !values.cash_account_id) {
        setError('cash_account_id', 'Selecione a conta de caixa para pagamento');
        isValid = false;
      }

      return isValid;
    }, [values, setError]);

    const handleFormSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
          return;
        }

        if (supplierValidation.isValidating || amountValidation.isValidating) {
          return;
        }

        try {
          setSubmitting(true);
          await onSubmit(values);
          resetForm();
        } catch (error) {
          console.error('Error submitting form:', error);
          alert('Erro ao salvar. Tente novamente.');
        } finally {
          setSubmitting(false);
        }
      },
      [
        validateForm,
        supplierValidation.isValidating,
        amountValidation.isValidating,
        values,
        onSubmit,
        setSubmitting,
        resetForm,
      ]
    );

    const handleCancelClick = useCallback(() => {
      if (isDirty && !confirm('Descartar alterações?')) {
        return;
      }
      resetForm();
      onCancel();
    }, [isDirty, resetForm, onCancel]);

    const hasValidationErrors = useMemo(() => {
      return Object.keys(errors).length > 0;
    }, [errors]);

    const isValidationInProgress = useMemo(() => {
      return supplierValidation.isValidating || amountValidation.isValidating;
    }, [supplierValidation.isValidating, amountValidation.isValidating]);

    return (
      <form onSubmit={handleFormSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-xl font-bold text-gray-800">
            {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h3>
          {isDirty && (
            <span className="text-sm text-orange-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Não salvo
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SupplierSelect
            value={values.supplier_id}
            onChange={handleSupplierChange}
            onBlur={handleSupplierBlur}
            suppliers={suppliers}
            error={touched.supplier_id ? errors.supplier_id : undefined}
            isValidating={supplierValidation.isValidating}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <input
              type="text"
              name="description"
              value={values.description}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              placeholder="Descrição do lançamento"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <AmountInput
            value={values.amount}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            error={touched.amount ? errors.amount : undefined}
            isValidating={amountValidation.isValidating}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
            <input
              type="number"
              min="1"
              max="120"
              name="installments"
              value={values.installments}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento *</label>
            <SimpleDateInput
              value={values.due_date}
              onChange={(date) => setValue('due_date', date)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Pagamento</label>
            <SimpleDateInput
              value={values.payment_date}
              onChange={(date) => setValue('payment_date', date)}
            />
          </div>

          {values.payment_date && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta de Caixa *</label>
              <select
                name="cash_account_id"
                value={values.cash_account_id}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione a conta</option>
                {cashAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              name="notes"
              value={values.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Observações adicionais..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {hasValidationErrors && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Corrija os erros antes de salvar:</p>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {Object.values(errors).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isValidationInProgress || hasValidationErrors}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar
              </>
            )}
          </button>
        </div>
      </form>
    );
  }
);

OptimizedPaymentForm.displayName = 'OptimizedPaymentForm';

export default OptimizedPaymentForm;
