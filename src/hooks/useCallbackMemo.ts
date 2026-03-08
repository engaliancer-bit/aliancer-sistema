import { useCallback, useRef, useEffect, useState, useMemo } from 'react';

export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

export function useMemoizedValue<T>(value: T, isEqual?: (prev: T, next: T) => boolean): T {
  const ref = useRef<T>(value);

  if (isEqual ? !isEqual(ref.current, value) : ref.current !== value) {
    ref.current = value;
  }

  return ref.current;
}

export function useDeepCompareMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (!ref.current || !areDeepEqual(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory(),
    };
  }

  return ref.current.value;
}

function areDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || !areDeepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export function useComputedValue<T>(compute: () => T, deps: React.DependencyList): T {
  return useMemo(compute, deps);
}

export function useEventListener(
  eventName: string,
  handler: EventListener,
  element: HTMLElement | Window | Document = window,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef<EventListener>(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener: EventListener = (event) => savedHandler.current(event);

    element.addEventListener(eventName, eventListener, options);

    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

export function useThrottle<T>(value: T, interval: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());

  useEffect(() => {
    if (Date.now() >= lastExecuted.current + interval) {
      lastExecuted.current = Date.now();
      setThrottledValue(value);
    } else {
      const timerId = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, interval);

      return () => clearTimeout(timerId);
    }
  }, [value, interval]);

  return throttledValue;
}
