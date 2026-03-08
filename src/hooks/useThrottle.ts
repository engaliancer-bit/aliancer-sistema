import { useEffect, useRef, useState } from 'react';

/**
 * Hook para throttle de valores
 * Limita a frequência de atualização de um valor
 *
 * @param value - Valor a ser throttled
 * @param delay - Delay em milissegundos (padrão: 100ms)
 * @returns Valor throttled
 *
 * @example
 * const throttledWeight = useThrottle(weight, 100);
 *
 * // Cálculos só são executados no máximo a cada 100ms
 * useEffect(() => {
 *   calculateCost(throttledWeight);
 * }, [throttledWeight]);
 */
export function useThrottle<T>(value: T, delay: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastRan = now - lastRan.current;

    if (timeSinceLastRan >= delay) {
      setThrottledValue(value);
      lastRan.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }, delay - timeSinceLastRan);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return throttledValue;
}

/**
 * Hook para throttle de funções
 * Limita a frequência de execução de uma função
 *
 * @param callback - Função a ser throttled
 * @param delay - Delay em milissegundos (padrão: 100ms)
 * @returns Função throttled
 *
 * @example
 * const throttledCalculate = useThrottleCallback(() => {
 *   calculateExpensiveOperation();
 * }, 100);
 *
 * // Executa no máximo a cada 100ms
 * <input onChange={throttledCalculate} />
 */
export function useThrottleCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 100
): T {
  const lastRan = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRan = now - lastRan.current;

    if (timeSinceLastRan >= delay) {
      callback(...args);
      lastRan.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, delay - timeSinceLastRan);
    }
  }) as T;
}
