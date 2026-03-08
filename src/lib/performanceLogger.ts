/**
 * Performance Logger - Monitoramento de Performance
 *
 * Sistema de logging e métricas de performance para identificar gargalos
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  category: 'query' | 'render' | 'action' | 'navigation';
  metadata?: Record<string, any>;
}

interface PerformanceAlert {
  metric: PerformanceMetric;
  threshold: number;
  message: string;
}

class PerformanceLogger {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();
  private enabled: boolean = true;
  private maxMetrics: number = 1000;

  // Thresholds (em ms)
  private thresholds = {
    query: 1000,      // Queries > 1s
    render: 100,      // Renders > 100ms
    action: 500,      // Ações > 500ms
    navigation: 2000  // Navegação > 2s
  };

  constructor() {
    // Desabilitar em produção por padrão
    this.enabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PERFORMANCE_LOG === 'true';
  }

  /**
   * Marcar início de medição
   */
  mark(name: string): void {
    if (!this.enabled) return;

    this.marks.set(name, performance.now());

    if (typeof performance.mark === 'function') {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * Medir e registrar duração
   */
  measure(
    name: string,
    category: PerformanceMetric['category'],
    metadata?: Record<string, any>
  ): number {
    if (!this.enabled) return 0;

    const startTime = this.marks.get(name);

    if (!startTime) {
      console.warn(`[Performance] Marca não encontrada: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      category,
      metadata
    };

    this.addMetric(metric);
    this.marks.delete(name);

    // Verificar threshold
    if (duration > this.thresholds[category]) {
      this.alert(metric);
    }

    if (typeof performance.measure === 'function') {
      try {
        performance.measure(name, `${name}-start`);
      } catch (e) {
        // Ignorar erros de measure
      }
    }

    return duration;
  }

  /**
   * Adicionar métrica
   */
  private addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Limitar tamanho do array
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Alertar sobre performance ruim
   */
  private alert(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.category];

    const alert: PerformanceAlert = {
      metric,
      threshold,
      message: `Performance alerta: ${metric.name} demorou ${metric.duration.toFixed(0)}ms (threshold: ${threshold}ms)`
    };

    console.warn(alert.message, metric.metadata);
  }

  /**
   * Obter métricas
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Obter métricas por categoria
   */
  getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
    return this.metrics.filter(m => m.category === category);
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    const stats = {
      query: this.calculateStats('query'),
      render: this.calculateStats('render'),
      action: this.calculateStats('action'),
      navigation: this.calculateStats('navigation')
    };

    return stats;
  }

  /**
   * Calcular estatísticas por categoria
   */
  private calculateStats(category: PerformanceMetric['category']) {
    const metrics = this.getMetricsByCategory(category);

    if (metrics.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p95: 0
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: metrics.length,
      avg: sum / metrics.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[p95Index] || 0
    };
  }

  /**
   * Limpar métricas
   */
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * Exportar métricas
   */
  export(): string {
    return JSON.stringify({
      metrics: this.metrics,
      stats: this.getStats(),
      timestamp: Date.now()
    }, null, 2);
  }

  /**
   * Habilitar/desabilitar logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Instância singleton
export const performanceLogger = new PerformanceLogger();

/**
 * Helper para medir query
 */
export async function measureQuery<T>(
  name: string,
  query: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  performanceLogger.mark(name);

  try {
    const result = await query();
    performanceLogger.measure(name, 'query', metadata);
    return result;
  } catch (error) {
    performanceLogger.measure(name, 'query', {
      ...metadata,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Helper para medir render
 */
export function measureRender(componentName: string): () => void {
  const markName = `render-${componentName}-${Date.now()}`;
  performanceLogger.mark(markName);

  return () => {
    performanceLogger.measure(markName, 'render', {
      component: componentName
    });
  };
}

/**
 * Helper para medir ação
 */
export async function measureAction<T>(
  actionName: string,
  action: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  performanceLogger.mark(actionName);

  try {
    const result = await action();
    performanceLogger.measure(actionName, 'action', metadata);
    return result;
  } catch (error) {
    performanceLogger.measure(actionName, 'action', {
      ...metadata,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Decorator para medir métodos de classe
 */
export function measureMethod(category: PerformanceMetric['category'] = 'action') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const name = `${target.constructor.name}.${propertyKey}`;
      performanceLogger.mark(name);

      try {
        const result = await originalMethod.apply(this, args);
        performanceLogger.measure(name, category);
        return result;
      } catch (error) {
        performanceLogger.measure(name, category, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Monitorar Web Vitals
 */
export function monitorWebVitals(): void {
  if (typeof window === 'undefined') return;

  // LCP - Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;

        console.log('[WebVitals] LCP:', lastEntry.renderTime || lastEntry.loadTime);
      });

      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Ignorar se não suportado
    }
  }

  // FID - First Input Delay
  if ('PerformanceObserver' in window) {
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          console.log('[WebVitals] FID:', entry.processingStart - entry.startTime);
        });
      });

      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // Ignorar se não suportado
    }
  }

  // CLS - Cumulative Layout Shift
  if ('PerformanceObserver' in window) {
    try {
      let clsScore = 0;

      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        });

        console.log('[WebVitals] CLS:', clsScore);
      });

      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // Ignorar se não suportado
    }
  }
}

/**
 * Relatório de performance
 */
export function generatePerformanceReport(): void {
  const stats = performanceLogger.getStats();

  console.group('📊 Performance Report');
  console.log('Queries:', stats.query);
  console.log('Renders:', stats.render);
  console.log('Actions:', stats.action);
  console.log('Navigation:', stats.navigation);
  console.groupEnd();

  // Queries lentas
  const slowQueries = performanceLogger
    .getMetricsByCategory('query')
    .filter(m => m.duration > 1000)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  if (slowQueries.length > 0) {
    console.group('🐌 Top 10 Queries Lentas');
    slowQueries.forEach(q => {
      console.log(`${q.name}: ${q.duration.toFixed(0)}ms`, q.metadata);
    });
    console.groupEnd();
  }

  // Renders lentos
  const slowRenders = performanceLogger
    .getMetricsByCategory('render')
    .filter(m => m.duration > 100)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  if (slowRenders.length > 0) {
    console.group('🐌 Top 10 Renders Lentos');
    slowRenders.forEach(r => {
      console.log(`${r.name}: ${r.duration.toFixed(0)}ms`, r.metadata);
    });
    console.groupEnd();
  }
}
