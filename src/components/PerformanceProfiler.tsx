import { Profiler, ProfilerOnRenderCallback } from 'react';
import { onRenderCallback } from '../lib/performanceAnalyzer';

interface PerformanceProfilerProps {
  id: string;
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * Wrapper para React.Profiler que se integra com o Performance Analyzer
 *
 * USO:
 * ```tsx
 * <PerformanceProfiler id="EngineeringProjectsManager">
 *   <EngineeringProjectsManager />
 * </PerformanceProfiler>
 * ```
 *
 * Depois no console:
 * ```js
 * startProfiler()
 * // Executar ação
 * stopProfiler()
 * ```
 */
export function PerformanceProfiler({
  id,
  children,
  enabled = true,
}: PerformanceProfilerProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const handleRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    // Registrar no Performance Analyzer
    onRenderCallback(id, phase, actualDuration, baseDuration, startTime, commitTime);

    // Log detalhado se estiver em desenvolvimento
    if (import.meta.env.DEV) {
      const emoji = actualDuration < 5 ? '🟢' : actualDuration < 16 ? '🟡' : '🔴';
      console.log(
        `${emoji} [${id}] ${phase} render: ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(
          2
        )}ms)`
      );
    }
  };

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
}

/**
 * HOC para envolver componentes com PerformanceProfiler
 *
 * USO:
 * ```tsx
 * const MyComponent = withPerformanceProfiler(
 *   function MyComponent() {
 *     return <div>...</div>;
 *   },
 *   'MyComponent'
 * );
 * ```
 */
export function withPerformanceProfiler<P extends object>(
  Component: React.ComponentType<P>,
  id?: string
): React.ComponentType<P> {
  const componentId = id || Component.displayName || Component.name || 'Unknown';

  return function ProfiledComponent(props: P) {
    return (
      <PerformanceProfiler id={componentId}>
        <Component {...props} />
      </PerformanceProfiler>
    );
  };
}
