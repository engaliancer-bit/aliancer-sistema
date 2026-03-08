import { useState, useCallback, useRef } from 'react';

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface UseFormStateReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isDirty: boolean;
  setValue: (name: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (name: keyof T, error: string) => void;
  setTouched: (name: keyof T, touched: boolean) => void;
  resetForm: (newValues?: T) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  setSubmitting: (isSubmitting: boolean) => void;
}

export function useFormState<T extends Record<string, any>>(
  initialValues: T
): UseFormStateReturn<T> {
  const initialValuesRef = useRef(initialValues);

  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isDirty: false,
  });

  const setValue = useCallback((name: keyof T, value: any) => {
    setState((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        [name]: value,
      },
      isDirty: true,
    }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setState((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        ...newValues,
      },
      isDirty: true,
    }));
  }, []);

  const setError = useCallback((name: keyof T, error: string) => {
    setState((prev) => ({
      ...prev,
      errors: {
        ...prev.errors,
        [name]: error,
      },
    }));
  }, []);

  const setTouched = useCallback((name: keyof T, touched: boolean) => {
    setState((prev) => ({
      ...prev,
      touched: {
        ...prev.touched,
        [name]: touched,
      },
    }));
  }, []);

  const resetForm = useCallback((newValues?: T) => {
    const valuesToSet = newValues || initialValuesRef.current;
    setState({
      values: valuesToSet,
      errors: {},
      touched: {},
      isSubmitting: false,
      isDirty: false,
    });
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const fieldValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
      setValue(name as keyof T, fieldValue);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name } = e.target;
      setTouched(name as keyof T, true);
    },
    [setTouched]
  );

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setState((prev) => ({
      ...prev,
      isSubmitting,
    }));
  }, []);

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isSubmitting: state.isSubmitting,
    isDirty: state.isDirty,
    setValue,
    setValues,
    setError,
    setTouched,
    resetForm,
    handleChange,
    handleBlur,
    setSubmitting,
  };
}
