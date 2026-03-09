import { useState, useEffect, useRef, useCallback } from 'react';
import { cancelRequestsByCategory } from '../lib/requestCancellation';

interface DebounceOptions {
  delay?: number;
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
  cancelCategory?: string;
}

export function useAdvancedDebounce<T>(
  value: T,
  options: DebounceOptions = {}
): T {
  const {
    delay = 400,
    maxWait = 800,
    cancelCategory,
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<T>(value);
  const lastFiredRef = useRef<number>(Date.now());

  useEffect(() => {
    lastValueRef.current = value;

    // [CANCEL] Cancel in-flight requests when value changes
    if (cancelCategory) {
      cancelRequestsByCategory(cancelCategory);
    }

    // Clear previous debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const now = Date.now();
    const timeSinceLastFire = now - lastFiredRef.current;

    const fire = () => {
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      timerRef.current = null;
      lastFiredRef.current = Date.now();
      setDebouncedValue(lastValueRef.current);
    };

    // [DEBOUNCE] maxWait guard: if too much time has passed, fire immediately
    if (timeSinceLastFire >= maxWait) {
      fire();
      return;
    }

    // Schedule maxWait fallback if not already scheduled
    if (!maxWaitTimerRef.current) {
      const remaining = maxWait - timeSinceLastFire;
      maxWaitTimerRef.current = setTimeout(fire, remaining);
    }

    // Normal debounce timer
    timerRef.current = setTimeout(fire, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay, maxWait, cancelCategory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    };
  }, []);

  return debouncedValue;
}

export function useAdvancedDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  options: DebounceOptions = {}
): [(...args: Parameters<T>) => void, () => void] {
  const {
    delay = 400,
    maxWait = 800,
    cancelCategory,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFiredRef = useRef<number>(Date.now());
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    timerRef.current = null;
    maxWaitTimerRef.current = null;
  }, []);

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;

    // [CANCEL] Cancel pending requests when new call comes in
    if (cancelCategory) {
      cancelRequestsByCategory(cancelCategory);
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const now = Date.now();
    const timeSinceLastFire = now - lastFiredRef.current;

    const fire = () => {
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      timerRef.current = null;
      lastFiredRef.current = Date.now();
      if (lastArgsRef.current) {
        callbackRef.current(...lastArgsRef.current);
      }
    };

    if (timeSinceLastFire >= maxWait) {
      fire();
      return;
    }

    if (!maxWaitTimerRef.current) {
      const remaining = maxWait - timeSinceLastFire;
      maxWaitTimerRef.current = setTimeout(fire, remaining);
    }

    timerRef.current = setTimeout(fire, delay);
  }, [delay, maxWait, cancelCategory]);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return [debouncedFn, cancel];
}
