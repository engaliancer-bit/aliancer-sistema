import { describe, it, expect, vi } from 'vitest';
import { DatabaseError, validateData } from '../../lib/dbHelper';

describe('DatabaseError', () => {
  it('should create DatabaseError with message', () => {
    const error = new DatabaseError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('DatabaseError');
    expect(error instanceof Error).toBe(true);
  });

  it('should store original error and operation details', () => {
    const originalError = new Error('Original');
    const error = new DatabaseError('Test error', originalError, 'insert', 'users');

    expect(error.originalError).toBe(originalError);
    expect(error.operation).toBe('insert');
    expect(error.table).toBe('users');
  });
});

describe('validateData', () => {
  it('should validate data with all passing validations', () => {
    const data = {
      name: 'John',
      email: 'john@example.com',
      age: 30,
    };

    const validations = {
      name: (value: string) => (value ? null : 'Name is required'),
      email: (value: string) => (value.includes('@') ? null : 'Invalid email'),
      age: (value: number) => (value > 0 ? null : 'Age must be positive'),
    };

    const result = validateData('TestComponent', data, validations);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('should return errors for failing validations', () => {
    const data = {
      name: '',
      email: 'invalid',
      age: -5,
    };

    const validations = {
      name: (value: string) => (value ? null : 'Name is required'),
      email: (value: string) => (value.includes('@') ? null : 'Invalid email'),
      age: (value: number) => (value > 0 ? null : 'Age must be positive'),
    };

    const result = validateData('TestComponent', data, validations);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({
      name: 'Name is required',
      email: 'Invalid email',
      age: 'Age must be positive',
    });
  });

  it('should handle partial validations', () => {
    const data = {
      name: 'John',
      email: 'invalid',
      age: 30,
    };

    const validations = {
      name: (value: string) => (value ? null : 'Name is required'),
      email: (value: string) => (value.includes('@') ? null : 'Invalid email'),
      age: (value: number) => (value > 0 ? null : 'Age must be positive'),
    };

    const result = validateData('TestComponent', data, validations);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({
      email: 'Invalid email',
    });
  });

  it('should handle empty data', () => {
    const data = {
      name: '',
      email: '',
    };

    const validations = {
      name: (value: string) => (value ? null : 'Name is required'),
      email: (value: string) => (value ? null : 'Email is required'),
    };

    const result = validateData('TestComponent', data, validations);

    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toHaveLength(2);
  });

  it('should handle custom validation logic', () => {
    const data = {
      password: 'short',
      confirmPassword: 'different',
    };

    const validations = {
      password: (value: string) => (value.length >= 8 ? null : 'Password must be at least 8 characters'),
      confirmPassword: (value: string) => (value === data.password ? null : 'Passwords do not match'),
    };

    const result = validateData('TestComponent', data, validations);

    expect(result.valid).toBe(false);
    expect(result.errors.password).toBe('Password must be at least 8 characters');
    expect(result.errors.confirmPassword).toBe('Passwords do not match');
  });

  it('should handle numeric validations', () => {
    const data = {
      amount: 0,
      quantity: -5,
      price: 100.50,
    };

    const validations = {
      amount: (value: number) => (value > 0 ? null : 'Amount must be greater than 0'),
      quantity: (value: number) => (value >= 0 ? null : 'Quantity cannot be negative'),
      price: (value: number) => (value > 0 && value < 1000000 ? null : 'Invalid price range'),
    };

    const result = validateData('TestComponent', data, validations);

    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBe('Amount must be greater than 0');
    expect(result.errors.quantity).toBe('Quantity cannot be negative');
    expect(result.errors.price).toBeUndefined();
  });
});
