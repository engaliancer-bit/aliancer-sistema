import { useState, useCallback, useRef, useEffect } from 'react';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface UseAsyncValidationReturn {
  isValidating: boolean;
  validationError: string | null;
  validate: (value: any) => Promise<ValidationResult>;
  clearValidation: () => void;
}

export function useAsyncValidation(
  validatorFn: (value: any) => Promise<ValidationResult>,
  debounceMs: number = 500
): UseAsyncValidationReturn {
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const validate = useCallback(
    async (value: any): Promise<ValidationResult> => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      return new Promise((resolve) => {
        validationTimeoutRef.current = setTimeout(async () => {
          if (!mountedRef.current) {
            resolve({ isValid: true });
            return;
          }

          setIsValidating(true);
          setValidationError(null);

          try {
            const result = await validatorFn(value);

            if (!mountedRef.current) {
              resolve({ isValid: true });
              return;
            }

            setValidationError(result.error || null);
            setIsValidating(false);
            resolve(result);
          } catch (error) {
            if (!mountedRef.current) {
              resolve({ isValid: true });
              return;
            }

            const errorMessage = error instanceof Error ? error.message : 'Erro de validação';
            setValidationError(errorMessage);
            setIsValidating(false);
            resolve({ isValid: false, error: errorMessage });
          }
        }, debounceMs);
      });
    },
    [validatorFn, debounceMs]
  );

  const clearValidation = useCallback(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsValidating(false);
    setValidationError(null);
  }, []);

  return {
    isValidating,
    validationError,
    validate,
    clearValidation,
  };
}

export function createSupplierValidator(supabase: any) {
  return async (supplierId: string): Promise<ValidationResult> => {
    if (!supplierId) {
      return { isValid: false, error: 'Fornecedor é obrigatório' };
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', supplierId)
      .maybeSingle();

    if (error) {
      return { isValid: false, error: 'Erro ao verificar fornecedor' };
    }

    if (!data) {
      return { isValid: false, error: 'Fornecedor não encontrado' };
    }

    return { isValid: true };
  };
}

export function createAmountValidator() {
  return async (amount: string): Promise<ValidationResult> => {
    const numAmount = parseFloat(amount);

    if (!amount || amount.trim() === '') {
      return { isValid: false, error: 'Valor é obrigatório' };
    }

    if (isNaN(numAmount)) {
      return { isValid: false, error: 'Valor inválido' };
    }

    if (numAmount <= 0) {
      return { isValid: false, error: 'Valor deve ser maior que zero' };
    }

    if (numAmount > 999999999) {
      return { isValid: false, error: 'Valor muito alto' };
    }

    return { isValid: true };
  };
}

export function createDateValidator() {
  return async (date: string): Promise<ValidationResult> => {
    if (!date || date.trim() === '') {
      return { isValid: false, error: 'Data é obrigatória' };
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return { isValid: false, error: 'Data inválida' };
    }

    const minDate = new Date('2000-01-01');
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);

    if (dateObj < minDate) {
      return { isValid: false, error: 'Data muito antiga' };
    }

    if (dateObj > maxDate) {
      return { isValid: false, error: 'Data muito futura' };
    }

    return { isValid: true };
  };
}
