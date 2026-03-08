import { supabase } from './supabase';

interface PrefetchConfig {
  enabled: boolean;
  delayMs: number;
}

const prefetchQueue = new Map<string, Promise<any>>();
const prefetchTimeouts = new Map<string, NodeJS.Timeout>();

const defaultConfig: PrefetchConfig = {
  enabled: true,
  delayMs: 500
};

async function executePrefetch(key: string, fn: () => Promise<any>) {
  if (prefetchQueue.has(key)) {
    return prefetchQueue.get(key);
  }

  const promise = fn()
    .catch(err => {
      console.debug(`Prefetch failed for ${key}:`, err);
    })
    .finally(() => {
      prefetchQueue.delete(key);
    });

  prefetchQueue.set(key, promise);
  return promise;
}

export function prefetchProductsList() {
  const key = 'prefetch:products';
  if (prefetchQueue.has(key)) return;

  prefetchTimeouts.get(key)?.();
  prefetchTimeouts.delete(key);

  const timeout = setTimeout(
    () => {
      executePrefetch(key, () =>
        supabase
          .from('products')
          .select('id, name, code, product_type, status', { count: 'exact' })
          .limit(100)
      );
    },
    defaultConfig.delayMs
  );

  prefetchTimeouts.set(key, timeout);
}

export function prefetchCustomersList() {
  const key = 'prefetch:customers';
  if (prefetchQueue.has(key)) return;

  prefetchTimeouts.get(key)?.();
  prefetchTimeouts.delete(key);

  const timeout = setTimeout(
    () => {
      executePrefetch(key, () =>
        supabase
          .from('customers')
          .select('id, name, person_type, document_number')
          .limit(100)
      );
    },
    defaultConfig.delayMs
  );

  prefetchTimeouts.set(key, timeout);
}

export function prefetchMaterialsList() {
  const key = 'prefetch:materials';
  if (prefetchQueue.has(key)) return;

  prefetchTimeouts.get(key)?.();
  prefetchTimeouts.delete(key);

  const timeout = setTimeout(
    () => {
      executePrefetch(key, () =>
        supabase
          .from('materials')
          .select('id, name, unit, current_stock')
          .limit(100)
      );
    },
    defaultConfig.delayMs
  );

  prefetchTimeouts.set(key, timeout);
}

export function prefetchRecipesList() {
  const key = 'prefetch:recipes';
  if (prefetchQueue.has(key)) return;

  prefetchTimeouts.get(key)?.();
  prefetchTimeouts.delete(key);

  const timeout = setTimeout(
    () => {
      executePrefetch(key, () =>
        supabase
          .from('recipes')
          .select('id, name, product_id, status')
          .limit(100)
      );
    },
    defaultConfig.delayMs
  );

  prefetchTimeouts.set(key, timeout);
}

export function prefetchCompositionsList() {
  const key = 'prefetch:compositions';
  if (prefetchQueue.has(key)) return;

  prefetchTimeouts.get(key)?.();
  prefetchTimeouts.delete(key);

  const timeout = setTimeout(
    () => {
      executePrefetch(key, () =>
        supabase
          .from('compositions')
          .select('id, name, product_id, status')
          .limit(100)
      );
    },
    defaultConfig.delayMs
  );

  prefetchTimeouts.set(key, timeout);
}

export function prefetchEmployeesList() {
  const key = 'prefetch:employees';
  if (prefetchQueue.has(key)) return;

  prefetchTimeouts.get(key)?.();
  prefetchTimeouts.delete(key);

  const timeout = setTimeout(
    () => {
      executePrefetch(key, () =>
        supabase
          .from('employees')
          .select('id, name, email, employment_type')
          .limit(100)
      );
    },
    defaultConfig.delayMs
  );

  prefetchTimeouts.set(key, timeout);
}

export function clearPrefetchQueue() {
  prefetchQueue.clear();
  prefetchTimeouts.forEach(timeout => clearTimeout(timeout));
  prefetchTimeouts.clear();
}

export function isPrefetching(key: string): boolean {
  return prefetchQueue.has(key);
}
