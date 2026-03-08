/**
 * Cache Manager - Sistema de Cache Estratégico
 *
 * Reduz chamadas de API com cache inteligente em memória e localStorage
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * Cache em Memória com TTL
 */
class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private maxSize: number = 100; // Máximo de entradas

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Limpar cache se atingir limite
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    this.stats.size = this.cache.size;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Verificar se expirou
    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size = this.cache.size;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Cache em LocalStorage com TTL
 */
class LocalStorageCache {
  private prefix: string = 'aliancer_cache_';

  set<T>(key: string, data: T, ttl: number = 24 * 60 * 60 * 1000): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };

      localStorage.setItem(
        this.prefix + key,
        JSON.stringify(entry)
      );
    } catch (e) {
      console.warn('[Cache] Erro ao salvar no localStorage:', e);
    }
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);

      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);
      const now = Date.now();
      const age = now - entry.timestamp;

      if (age > entry.ttl) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }

      return entry.data;
    } catch (e) {
      console.warn('[Cache] Erro ao ler do localStorage:', e);
      return null;
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key);
      }
    }

    keys.forEach(key => localStorage.removeItem(key));
  }

  clearExpired(): void {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key);
      }
    }

    keys.forEach(key => {
      const shortKey = key.replace(this.prefix, '');
      this.get(shortKey); // Vai remover se expirado
    });
  }
}

/**
 * Gerenciador de Cache Principal
 */
class CacheManager {
  private memoryCache = new MemoryCache();
  private storageCache = new LocalStorageCache();

  /**
   * Cache em memória (volátil, 5min padrão)
   */
  setMemory<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.memoryCache.set(key, data, ttl);
  }

  getMemory<T>(key: string): T | null {
    return this.memoryCache.get<T>(key);
  }

  /**
   * Cache persistente (localStorage, 24h padrão)
   */
  setStorage<T>(key: string, data: T, ttl: number = 24 * 60 * 60 * 1000): void {
    this.storageCache.set(key, data, ttl);
  }

  getStorage<T>(key: string): T | null {
    return this.storageCache.get<T>(key);
  }

  /**
   * Cache automático (tenta memória primeiro, depois storage)
   */
  get<T>(key: string): T | null {
    const memoryData = this.memoryCache.get<T>(key);
    if (memoryData !== null) {
      return memoryData;
    }

    return this.storageCache.get<T>(key);
  }

  /**
   * Invalidar cache
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    this.storageCache.delete(key);
  }

  /**
   * Invalidar por padrão
   */
  invalidatePattern(pattern: string): void {
    // Implementação simples - pode ser melhorada
    if (pattern.includes('*')) {
      const prefix = pattern.replace('*', '');
      // TODO: implementar varredura de chaves
    } else {
      this.invalidate(pattern);
    }
  }

  /**
   * Limpar todo cache
   */
  clearAll(): void {
    this.memoryCache.clear();
    this.storageCache.clear();
  }

  /**
   * Estatísticas de cache
   */
  getStats(): CacheStats {
    return this.memoryCache.getStats();
  }

  /**
   * Limpar caches expirados
   */
  cleanup(): void {
    this.storageCache.clearExpired();
  }
}

// Instância singleton
export const cacheManager = new CacheManager();

/**
 * TTLs pré-definidos
 */
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 minuto
  MEDIUM: 5 * 60 * 1000,     // 5 minutos
  LONG: 30 * 60 * 1000,      // 30 minutos
  DAY: 24 * 60 * 60 * 1000,  // 24 horas
  WEEK: 7 * 24 * 60 * 60 * 1000 // 7 dias
} as const;

/**
 * Chaves de cache pré-definidas
 */
export const CACHE_KEYS = {
  USER_PROFILE: 'user_profile',
  COMPANY_SETTINGS: 'company_settings',
  MUNICIPALITIES: 'static_municipalities',
  BIOMES: 'static_biomes',
  STATES: 'static_states',
  PRODUCT_TYPES: 'static_product_types',
  MATERIAL_CATEGORIES: 'static_material_categories',
  SERVICE_TEMPLATES: 'service_templates',
  PRICE_TABLE: 'price_table'
} as const;

/**
 * Helper para cache de dados estáticos
 */
export function cacheStaticData<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  return cacheWithFetch(key, fetcher, CACHE_TTL.WEEK);
}

/**
 * Helper para cache com fetch automático
 */
export async function cacheWithFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> {
  // Tentar cache primeiro
  const cached = cacheManager.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Buscar dados
  const data = await fetcher();

  // Salvar no cache
  cacheManager.setMemory(key, data, ttl);

  return data;
}

/**
 * Limpar cache ao fazer logout
 */
export function clearCacheOnLogout(): void {
  cacheManager.clearAll();
}

// Store cleanup interval for proper cleanup
let cleanupIntervalId: number | null = null;

/**
 * Inicializar cache manager
 */
export function initCacheManager(): void {
  // Limpar caches expirados ao iniciar
  cacheManager.cleanup();

  // Limpar interval anterior se existir
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
  }

  // Agendar limpeza periódica (a cada 30 minutos para evitar acúmulo)
  cleanupIntervalId = window.setInterval(() => {
    cacheManager.cleanup();
  }, 30 * 60 * 1000);
}

/**
 * Cleanup cache manager (para desmontar)
 */
export function cleanupCacheManager(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
