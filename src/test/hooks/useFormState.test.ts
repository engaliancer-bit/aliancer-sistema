import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormState } from '../../hooks/useFormState';

describe('useFormState', () => {
  it('should initialize with provided values', () => {
    const initialValues = {
      name: 'John',
      email: 'john@example.com',
      age: 30,
    };

    const { result } = renderHook(() => useFormState(initialValues));

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  it('should update single value and mark as dirty', () => {
    const initialValues = { name: 'John', email: 'john@example.com' };
    const { result } = renderHook(() => useFormState(initialValues));

    act(() => {
      result.current.setValue('name', 'Jane');
    });

    expect(result.current.values.name).toBe('Jane');
    expect(result.current.isDirty).toBe(true);
  });

  it('should update multiple values at once', () => {
    const initialValues = { name: 'John', email: 'john@example.com', age: 30 };
    const { result } = renderHook(() => useFormState(initialValues));

    act(() => {
      result.current.setValues({ name: 'Jane', age: 25 });
    });

    expect(result.current.values.name).toBe('Jane');
    expect(result.current.values.age).toBe(25);
    expect(result.current.values.email).toBe('john@example.com');
    expect(result.current.isDirty).toBe(true);
  });

  it('should set and clear errors', () => {
    const initialValues = { name: '', email: '' };
    const { result } = renderHook(() => useFormState(initialValues));

    act(() => {
      result.current.setError('name', 'Name is required');
    });

    expect(result.current.errors.name).toBe('Name is required');

    act(() => {
      result.current.setError('name', '');
    });

    expect(result.current.errors.name).toBe('');
  });

  it('should track touched fields', () => {
    const initialValues = { name: '', email: '' };
    const { result } = renderHook(() => useFormState(initialValues));

    act(() => {
      result.current.setTouched('name', true);
    });

    expect(result.current.touched.name).toBe(true);
    expect(result.current.touched.email).toBe(undefined);
  });

  it('should reset form to initial values', () => {
    const initialValues = { name: 'John', email: 'john@example.com' };
    const { result } = renderHook(() => useFormState(initialValues));

    act(() => {
      result.current.setValue('name', 'Jane');
      result.current.setError('name', 'Error');
      result.current.setTouched('name', true);
    });

    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it('should reset form to new values', () => {
    const initialValues = { name: 'John', email: 'john@example.com' };
    const newValues = { name: 'Jane', email: 'jane@example.com' };
    const { result } = renderHook(() => useFormState(initialValues));

    act(() => {
      result.current.resetForm(newValues);
    });

    expect(result.current.values).toEqual(newValues);
    expect(result.current.isDirty).toBe(false);
  });

  it('should handle submitting state', () => {
    const initialValues = { name: 'John' };
    const { result } = renderHook(() => useFormState(initialValues));

    expect(result.current.isSubmitting).toBe(false);

    act(() => {
      result.current.setSubmitting(true);
    });

    expect(result.current.isSubmitting).toBe(true);

    act(() => {
      result.current.setSubmitting(false);
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('should handle change events', () => {
    const initialValues = { name: '', email: '' };
    const { result } = renderHook(() => useFormState(initialValues));

    const event = {
      target: { name: 'name', value: 'John', type: 'text' },
    } as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleChange(event);
    });

    expect(result.current.values.name).toBe('John');
    expect(result.current.isDirty).toBe(true);
  });

  it('should handle checkbox change events', () => {
    const initialValues = { accepted: false };
    const { result } = renderHook(() => useFormState(initialValues));

    const event = {
      target: { name: 'accepted', checked: true, type: 'checkbox' },
    } as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleChange(event);
    });

    expect(result.current.values.accepted).toBe(true);
  });

  it('should handle blur events', () => {
    const initialValues = { name: '' };
    const { result } = renderHook(() => useFormState(initialValues));

    const event = {
      target: { name: 'name' },
    } as React.FocusEvent<HTMLInputElement>;

    act(() => {
      result.current.handleBlur(event);
    });

    expect(result.current.touched.name).toBe(true);
  });
});
