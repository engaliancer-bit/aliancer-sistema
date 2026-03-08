/**
 * Hook de Cleanup Automático
 *
 * Previne memory leaks com cleanup automático de:
 * - Event listeners
 * - Timers (setTimeout, setInterval)
 * - Subscriptions
 * - AbortControllers
 */

import { useEffect, useRef } from 'react';

export interface CleanupRegistry {
  addTimer: (id: number) => void;
  addListener: (element: EventTarget, event: string, handler: EventListener) => void;
  addAbortController: (controller: AbortController) => void;
  addCleanup: (cleanup: () => void) => void;
}

/**
 * Hook para cleanup automático de recursos
 */
export function useAutoCleanup(): CleanupRegistry {
  const timersRef = useRef<Set<number>>(new Set());
  const listenersRef = useRef<Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }>>([]);
  const controllersRef = useRef<Set<AbortController>>(new Set());
  const cleanupsRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    // Cleanup ao desmontar
    return () => {
      // Limpar timers
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();

      // Remover listeners
      listenersRef.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      listenersRef.current = [];

      // Abortar controllers
      controllersRef.current.forEach(controller => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      });
      controllersRef.current.clear();

      // Executar cleanups customizados
      cleanupsRef.current.forEach(cleanup => cleanup());
      cleanupsRef.current.clear();
    };
  }, []);

  return {
    addTimer: (id: number) => {
      timersRef.current.add(id);
    },
    addListener: (element: EventTarget, event: string, handler: EventListener) => {
      listenersRef.current.push({ element, event, handler });
      element.addEventListener(event, handler);
    },
    addAbortController: (controller: AbortController) => {
      controllersRef.current.add(controller);
    },
    addCleanup: (cleanup: () => void) => {
      cleanupsRef.current.add(cleanup);
    }
  };
}

/**
 * Hook para setTimeout com cleanup automático
 */
export function useTimeout(callback: () => void, delay: number | null) {
  const cleanup = useAutoCleanup();
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    cleanup.addTimer(id);

    return () => clearTimeout(id);
  }, [delay]);
}

/**
 * Hook para setInterval com cleanup automático
 */
export function useInterval(callback: () => void, delay: number | null) {
  const cleanup = useAutoCleanup();
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    cleanup.addTimer(id);

    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Hook para event listener com cleanup automático
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: EventTarget = window
) {
  const cleanup = useAutoCleanup();
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    cleanup.addListener(element, eventName, eventListener);

    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}

/**
 * Hook para AbortController com cleanup automático
 */
export function useAbortController(): AbortController {
  const cleanup = useAutoCleanup();
  const controllerRef = useRef<AbortController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new AbortController();
    cleanup.addAbortController(controllerRef.current);
  }

  return controllerRef.current;
}

/**
 * Hook para prevenir setState em componente desmontado
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return () => isMountedRef.current;
}

/**
 * Hook para cleanup de queries Supabase
 */
export function useSupabaseCleanup() {
  const controllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    return () => {
      // Abortar todas as queries pendentes
      controllersRef.current.forEach(controller => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      });
      controllersRef.current = [];
    };
  }, []);

  return {
    createAbortController: (): AbortController => {
      const controller = new AbortController();
      controllersRef.current.push(controller);
      return controller;
    }
  };
}
