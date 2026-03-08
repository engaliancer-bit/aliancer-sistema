import { useRef, useCallback, useEffect } from 'react';

interface PollingOptions {
  initialInterval?: number;
  maxInterval?: number;
  backoffMultiplier?: number;
  maxAttempts?: number;
  onMaxAttemptsReached?: () => void;
}

interface PollingState {
  isPolling: boolean;
  currentInterval: number;
  attempts: number;
}

export function usePollingWithBackoff(
  callback: () => Promise<boolean>,
  options: PollingOptions = {}
) {
  const {
    initialInterval = 3000,
    maxInterval = 30000,
    backoffMultiplier = 1.5,
    maxAttempts = 50,
    onMaxAttemptsReached
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<PollingState>({
    isPolling: false,
    currentInterval: initialInterval,
    attempts: 0
  });
  const isMountedRef = useRef(true);
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  const clearPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stateRef.current.isPolling = false;
  }, []);

  const resetInterval = useCallback(() => {
    stateRef.current.currentInterval = initialInterval;
    stateRef.current.attempts = 0;
  }, [initialInterval]);

  const poll = useCallback(async () => {
    if (!isMountedRef.current || !stateRef.current.isPolling) return;

    stateRef.current.attempts++;

    if (stateRef.current.attempts > maxAttempts) {
      clearPolling();
      onMaxAttemptsReached?.();
      return;
    }

    try {
      const shouldContinue = await callbackRef.current();

      if (!isMountedRef.current) return;

      if (!shouldContinue) {
        clearPolling();
        return;
      }

      stateRef.current.currentInterval = Math.min(
        stateRef.current.currentInterval * backoffMultiplier,
        maxInterval
      );

      if (stateRef.current.isPolling && isMountedRef.current) {
        timeoutRef.current = setTimeout(poll, stateRef.current.currentInterval);
      }
    } catch (error) {
      console.error('[usePollingWithBackoff] Error:', error);

      if (!isMountedRef.current) return;

      stateRef.current.currentInterval = Math.min(
        stateRef.current.currentInterval * 2,
        maxInterval
      );

      if (stateRef.current.isPolling && isMountedRef.current) {
        timeoutRef.current = setTimeout(poll, stateRef.current.currentInterval);
      }
    }
  }, [maxAttempts, maxInterval, backoffMultiplier, clearPolling, onMaxAttemptsReached]);

  const startPolling = useCallback(() => {
    if (stateRef.current.isPolling) return;

    stateRef.current.isPolling = true;
    stateRef.current.currentInterval = initialInterval;
    stateRef.current.attempts = 0;

    poll();
  }, [initialInterval, poll]);

  const stopPolling = useCallback(() => {
    clearPolling();
    resetInterval();
  }, [clearPolling, resetInterval]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  return {
    startPolling,
    stopPolling,
    resetInterval,
    isPolling: () => stateRef.current.isPolling,
    getAttempts: () => stateRef.current.attempts,
    getCurrentInterval: () => stateRef.current.currentInterval
  };
}

export function useMultiplePolling() {
  const pollingsRef = useRef<Map<string, ReturnType<typeof usePollingWithBackoff>>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pollingsRef.current.forEach(polling => polling.stopPolling());
      pollingsRef.current.clear();
    };
  }, []);

  const addPolling = useCallback((
    id: string,
    callback: () => Promise<boolean>,
    options?: PollingOptions
  ) => {
    if (pollingsRef.current.has(id)) {
      pollingsRef.current.get(id)?.stopPolling();
    }

    const polling = {
      isPolling: false,
      timeoutId: null as NodeJS.Timeout | null,
      currentInterval: options?.initialInterval || 3000,
      attempts: 0,
      maxAttempts: options?.maxAttempts || 50,
      maxInterval: options?.maxInterval || 30000,
      backoffMultiplier: options?.backoffMultiplier || 1.5,
    };

    const poll = async () => {
      if (!isMountedRef.current || !polling.isPolling) return;

      polling.attempts++;

      if (polling.attempts > polling.maxAttempts) {
        removePolling(id);
        options?.onMaxAttemptsReached?.();
        return;
      }

      try {
        const shouldContinue = await callback();

        if (!isMountedRef.current) return;

        if (!shouldContinue) {
          removePolling(id);
          return;
        }

        polling.currentInterval = Math.min(
          polling.currentInterval * polling.backoffMultiplier,
          polling.maxInterval
        );

        if (polling.isPolling && isMountedRef.current) {
          polling.timeoutId = setTimeout(poll, polling.currentInterval);
        }
      } catch (error) {
        console.error(`[useMultiplePolling] Error for ${id}:`, error);

        if (!isMountedRef.current) return;

        polling.currentInterval = Math.min(
          polling.currentInterval * 2,
          polling.maxInterval
        );

        if (polling.isPolling && isMountedRef.current) {
          polling.timeoutId = setTimeout(poll, polling.currentInterval);
        }
      }
    };

    const startPolling = () => {
      if (polling.isPolling) return;
      polling.isPolling = true;
      polling.currentInterval = options?.initialInterval || 3000;
      polling.attempts = 0;
      poll();
    };

    const stopPolling = () => {
      polling.isPolling = false;
      if (polling.timeoutId) {
        clearTimeout(polling.timeoutId);
        polling.timeoutId = null;
      }
    };

    const pollingInstance = {
      startPolling,
      stopPolling,
      resetInterval: () => {
        polling.currentInterval = options?.initialInterval || 3000;
        polling.attempts = 0;
      },
      isPolling: () => polling.isPolling,
      getAttempts: () => polling.attempts,
      getCurrentInterval: () => polling.currentInterval
    };

    pollingsRef.current.set(id, pollingInstance);
    return pollingInstance;
  }, []);

  const removePolling = useCallback((id: string) => {
    const polling = pollingsRef.current.get(id);
    if (polling) {
      polling.stopPolling();
      pollingsRef.current.delete(id);
    }
  }, []);

  const getPolling = useCallback((id: string) => {
    return pollingsRef.current.get(id);
  }, []);

  const hasPolling = useCallback((id: string) => {
    return pollingsRef.current.has(id);
  }, []);

  const stopAll = useCallback(() => {
    pollingsRef.current.forEach(polling => polling.stopPolling());
    pollingsRef.current.clear();
  }, []);

  const getActiveCount = useCallback(() => {
    let count = 0;
    pollingsRef.current.forEach(polling => {
      if (polling.isPolling()) count++;
    });
    return count;
  }, []);

  return {
    addPolling,
    removePolling,
    getPolling,
    hasPolling,
    stopAll,
    getActiveCount
  };
}
