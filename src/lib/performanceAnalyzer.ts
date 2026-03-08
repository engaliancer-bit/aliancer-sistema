/**
 * Performance Analyzer - Identifica componentes lentos e re-renders desnecessários
 *
 * USO:
 * 1. Importar no componente: import { measureComponentRender, startProfiler } from './performanceAnalyzer'
 * 2. Envolver componente com measureComponentRender
 * 3. Usar startProfiler() antes de ação
 * 4. Ver resultados no console
 */

interface RenderMetric {
  componentName: string;
  renderTime: number;
  timestamp: number;
  props: any;
  renderCount: number;
}

interface ProfilerData {
  id: string;
  phase: 'mount' | 'update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

class PerformanceAnalyzer {
  private renderMetrics: Map<string, RenderMetric[]> = new Map();
  private isProfilingActive = false;
  private profilingStartTime = 0;
  private renderCounts: Map<string, number> = new Map();

  startProfiling() {
    this.isProfilingActive = true;
    this.profilingStartTime = performance.now();
    this.renderMetrics.clear();
    this.renderCounts.clear();
    console.log('🔍 Performance Profiling INICIADO');
    console.log('📊 Aguarde execução da ação e depois chame stopProfiling()');
  }

  stopProfiling() {
    this.isProfilingActive = false;
    const totalTime = performance.now() - this.profilingStartTime;

    console.log('\n📊 ===== RELATÓRIO DE PERFORMANCE =====\n');
    console.log(`⏱️  Tempo total: ${totalTime.toFixed(2)}ms\n`);

    this.generateReport();

    return this.getSummary();
  }

  recordRender(componentName: string, renderTime: number, props?: any) {
    if (!this.isProfilingActive) return;

    const count = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, count);

    const metric: RenderMetric = {
      componentName,
      renderTime,
      timestamp: performance.now() - this.profilingStartTime,
      props: props ? this.serializeProps(props) : {},
      renderCount: count,
    };

    if (!this.renderMetrics.has(componentName)) {
      this.renderMetrics.set(componentName, []);
    }
    this.renderMetrics.get(componentName)!.push(metric);
  }

  recordProfilerData(data: ProfilerData) {
    if (!this.isProfilingActive) return;

    const componentName = data.id;
    const count = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, count);

    const metric: RenderMetric = {
      componentName,
      renderTime: data.actualDuration,
      timestamp: data.commitTime - this.profilingStartTime,
      props: {},
      renderCount: count,
    };

    if (!this.renderMetrics.has(componentName)) {
      this.renderMetrics.set(componentName, []);
    }
    this.renderMetrics.get(componentName)!.push(metric);
  }

  private generateReport() {
    // 1. Componentes mais lentos
    console.log('🐌 TOP 10 COMPONENTES MAIS LENTOS:\n');
    const allRenders: RenderMetric[] = [];
    this.renderMetrics.forEach((metrics) => {
      allRenders.push(...metrics);
    });

    const slowestRenders = allRenders
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, 10);

    slowestRenders.forEach((render, idx) => {
      const status = this.getPerformanceStatus(render.renderTime);
      console.log(`${idx + 1}. ${render.componentName}`);
      console.log(`   ${status} ${render.renderTime.toFixed(2)}ms (render #${render.renderCount})`);
      console.log(`   Timestamp: ${render.timestamp.toFixed(2)}ms\n`);
    });

    // 2. Componentes com mais re-renders
    console.log('\n🔄 COMPONENTES COM MAIS RE-RENDERS:\n');
    const renderCountArray = Array.from(this.renderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    renderCountArray.forEach(([name, count], idx) => {
      const metrics = this.renderMetrics.get(name) || [];
      const avgTime = metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length;
      const totalTime = metrics.reduce((sum, m) => sum + m.renderTime, 0);

      const status = count > 3 ? '⚠️' : count > 1 ? '🟡' : '✅';
      console.log(`${idx + 1}. ${status} ${name}`);
      console.log(`   Re-renders: ${count}x`);
      console.log(`   Tempo médio: ${avgTime.toFixed(2)}ms`);
      console.log(`   Tempo total: ${totalTime.toFixed(2)}ms\n`);
    });

    // 3. Sugestões de otimização
    this.generateOptimizationSuggestions();
  }

  private generateOptimizationSuggestions() {
    console.log('\n💡 SUGESTÕES DE OTIMIZAÇÃO:\n');

    const suggestions: string[] = [];

    // Identificar componentes lentos
    this.renderMetrics.forEach((metrics, componentName) => {
      const avgTime = metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length;
      if (avgTime > 16) {
        suggestions.push(
          `🔴 ${componentName}: Muito lento (${avgTime.toFixed(2)}ms)\n` +
          `   → Aplicar React.memo()\n` +
          `   → Mover cálculos para useMemo()\n` +
          `   → Considerar code splitting\n`
        );
      } else if (avgTime > 8) {
        suggestions.push(
          `🟡 ${componentName}: Lento (${avgTime.toFixed(2)}ms)\n` +
          `   → Considerar React.memo()\n` +
          `   → Verificar props que mudam\n`
        );
      }
    });

    // Identificar componentes com muitos re-renders
    this.renderCounts.forEach((count, componentName) => {
      if (count > 3) {
        suggestions.push(
          `⚠️  ${componentName}: Muitos re-renders (${count}x)\n` +
          `   → Aplicar React.memo() URGENTE\n` +
          `   → Verificar useEffect dependencies\n` +
          `   → Usar useCallback para funções passadas como props\n`
        );
      }
    });

    if (suggestions.length === 0) {
      console.log('✅ Nenhuma otimização crítica necessária!');
      console.log('   Todos os componentes estão com boa performance.\n');
    } else {
      suggestions.forEach(s => console.log(s));
    }
  }

  private getPerformanceStatus(time: number): string {
    if (time < 5) return '🟢';
    if (time < 16) return '🟡';
    return '🔴';
  }

  private serializeProps(props: any): any {
    try {
      return JSON.parse(JSON.stringify(props, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Date) return value.toISOString();
        return value;
      }));
    } catch {
      return '[Unable to serialize]';
    }
  }

  getSummary() {
    const summary: any = {
      totalComponents: this.renderMetrics.size,
      totalRenders: Array.from(this.renderCounts.values()).reduce((sum, count) => sum + count, 0),
      slowestComponents: [],
      mostRerenderedComponents: [],
    };

    // Componentes mais lentos
    const allRenders: RenderMetric[] = [];
    this.renderMetrics.forEach((metrics) => {
      allRenders.push(...metrics);
    });
    summary.slowestComponents = allRenders
      .sort((a, b) => b.renderTime - a.renderTime)
      .slice(0, 5)
      .map(r => ({ name: r.componentName, time: r.renderTime }));

    // Componentes com mais re-renders
    summary.mostRerenderedComponents = Array.from(this.renderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return summary;
  }

  reset() {
    this.renderMetrics.clear();
    this.renderCounts.clear();
    this.isProfilingActive = false;
    this.profilingStartTime = 0;
  }
}

// Singleton instance
export const performanceAnalyzer = new PerformanceAnalyzer();

// HOC para medir performance de componentes
export function measureComponentRender<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const name = componentName || Component.displayName || Component.name || 'Unknown';

  return function MeasuredComponent(props: P) {
    const startTime = performance.now();

    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      performanceAnalyzer.recordRender(name, renderTime, props);
    });

    return React.createElement(Component, props);
  };
}

// Hook para medir performance de renders
export function useRenderPerformance(componentName: string, deps?: React.DependencyList) {
  const renderCountRef = React.useRef(0);
  const startTimeRef = React.useRef(performance.now());

  React.useEffect(() => {
    renderCountRef.current += 1;
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;

    performanceAnalyzer.recordRender(componentName, renderTime);

    startTimeRef.current = performance.now();
  }, deps);

  return renderCountRef.current;
}

// Wrapper para React.Profiler
export function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  performanceAnalyzer.recordProfilerData({
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  });
}

// Helpers para usar no console do navegador
if (typeof window !== 'undefined') {
  (window as any).startProfiler = () => performanceAnalyzer.startProfiling();
  (window as any).stopProfiler = () => performanceAnalyzer.stopProfiling();
  (window as any).resetProfiler = () => performanceAnalyzer.reset();

  console.log('🔧 Performance Analyzer carregado!');
  console.log('📝 Comandos disponíveis no console:');
  console.log('   - startProfiler()  → Iniciar análise');
  console.log('   - stopProfiler()   → Ver relatório');
  console.log('   - resetProfiler()  → Resetar dados');
}

// Export React para uso nos componentes
import * as React from 'react';
