interface LazyLoadModule {
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  loader: () => Promise<any>;
  loadedAt?: number;
  error?: Error;
}

interface LoadingState {
  loading: boolean;
  progress: number;
  currentModule?: string;
}

const moduleRegistry = new Map<string, LazyLoadModule>();
const loadingState: LoadingState = {
  loading: false,
  progress: 0
};

const listeners: Set<(state: LoadingState) => void> = new Set();

export function registerLazyModule(config: LazyLoadModule) {
  moduleRegistry.set(config.name, config);
}

export function registerMultipleLazyModules(configs: LazyLoadModule[]) {
  configs.forEach(config => registerLazyModule(config));
}

export function subscribeToLoadingState(listener: (state: LoadingState) => void): () => void {
  listeners.add(listener);
  listener(loadingState);

  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach(listener => listener({ ...loadingState }));
}

async function loadModule(module: LazyLoadModule): Promise<any> {
  if (module.loadedAt) {
    return;
  }

  loadingState.currentModule = module.name;
  notifyListeners();

  try {
    await module.loader();
    module.loadedAt = Date.now();
  } catch (error) {
    module.error = error instanceof Error ? error : new Error(String(error));
    console.error(`Failed to load module ${module.name}:`, module.error);
  }
}

export async function loadProgressively(
  onProgress?: (state: LoadingState) => void
): Promise<void> {
  const modules = Array.from(moduleRegistry.values());

  const priorities = ['critical', 'high', 'medium', 'low'] as const;
  const sortedModules = priorities.flatMap(priority =>
    modules.filter(m => m.priority === priority)
  );

  loadingState.loading = true;
  loadingState.progress = 0;

  const totalModules = sortedModules.length;

  for (let i = 0; i < sortedModules.length; i++) {
    const module = sortedModules[i];
    await loadModule(module);

    loadingState.progress = Math.round(((i + 1) / totalModules) * 100);
    notifyListeners();

    if (onProgress) {
      onProgress({ ...loadingState });
    }
  }

  loadingState.loading = false;
  loadingState.progress = 100;
  loadingState.currentModule = undefined;
  notifyListeners();
}

export function preloadModule(name: string): Promise<void> {
  const module = moduleRegistry.get(name);
  if (!module) {
    console.warn(`Module ${name} not found in registry`);
    return Promise.resolve();
  }

  return loadModule(module);
}

export function getLoadingState(): LoadingState {
  return { ...loadingState };
}

export function getModuleStatus(name: string) {
  const module = moduleRegistry.get(name);
  if (!module) {
    return null;
  }

  return {
    name: module.name,
    priority: module.priority,
    loaded: !!module.loadedAt,
    loadedAt: module.loadedAt,
    error: module.error
  };
}

export function getAllModuleStatus() {
  const statuses: Record<string, any> = {};

  moduleRegistry.forEach((module, name) => {
    statuses[name] = {
      priority: module.priority,
      loaded: !!module.loadedAt,
      loadedAt: module.loadedAt,
      error: module.error
    };
  });

  return statuses;
}

export function resetModuleCache() {
  moduleRegistry.forEach(module => {
    module.loadedAt = undefined;
    module.error = undefined;
  });
}

export interface ProgressiveLoadConfig {
  modules: LazyLoadModule[];
  immediate?: boolean;
  onProgress?: (state: LoadingState) => void;
}

export function initializeProgressiveLoading(config: ProgressiveLoadConfig) {
  registerMultipleLazyModules(config.modules);

  if (config.immediate) {
    loadProgressively(config.onProgress);
  }
}
