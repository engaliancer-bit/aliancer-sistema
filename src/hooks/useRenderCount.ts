import { useRef, useEffect } from 'react';

export function useRenderCount(componentName?: string): number {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    if (componentName && import.meta.env.DEV) {
      console.log(`[${componentName}] Render count: ${renderCount.current}`);
    }
  });

  return renderCount.current;
}

export function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  const previousProps = useRef<Record<string, any>>();

  useEffect(() => {
    if (previousProps.current && import.meta.env.DEV) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log('[why-did-you-update]', name, changedProps);
      }
    }

    previousProps.current = props;
  });
}

export function useTraceUpdate(props: Record<string, any>, componentName?: string) {
  const prev = useRef(props);

  useEffect(() => {
    if (import.meta.env.DEV) {
      const changedProps = Object.entries(props).reduce((acc, [key, val]) => {
        if (prev.current[key] !== val) {
          acc[key] = {
            previous: prev.current[key],
            current: val,
          };
        }
        return acc;
      }, {} as Record<string, any>);

      if (Object.keys(changedProps).length > 0) {
        console.log(
          `[${componentName || 'Component'}] Changed props:`,
          changedProps
        );
      }
    }
    prev.current = props;
  });
}

export function useRenderTime(componentName: string) {
  const startTime = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - startTime.current;
    if (import.meta.env.DEV) {
      console.log(`[${componentName}] Render time: ${renderTime.toFixed(2)}ms`);
    }
    startTime.current = performance.now();
  });
}
