interface ResourceHints {
  preconnect?: string[];
  dnsPrefetch?: string[];
  preload?: Array<{
    href: string;
    as: string;
    type?: string;
    crossorigin?: boolean;
  }>;
  prefetch?: string[];
}

export class ResourceOptimizer {
  private static instance: ResourceOptimizer;
  private addedResources = new Set<string>();

  private constructor() {}

  static getInstance(): ResourceOptimizer {
    if (!ResourceOptimizer.instance) {
      ResourceOptimizer.instance = new ResourceOptimizer();
    }
    return ResourceOptimizer.instance;
  }

  addPreconnect(url: string) {
    if (this.addedResources.has(`preconnect:${url}`)) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    this.addedResources.add(`preconnect:${url}`);
  }

  addDnsPrefetch(url: string) {
    if (this.addedResources.has(`dns-prefetch:${url}`)) return;

    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = url;
    document.head.appendChild(link);

    this.addedResources.add(`dns-prefetch:${url}`);
  }

  addPreload(href: string, as: string, type?: string, crossorigin = false) {
    if (this.addedResources.has(`preload:${href}`)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) link.type = type;
    if (crossorigin) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    this.addedResources.add(`preload:${href}`);
  }

  addPrefetch(href: string) {
    if (this.addedResources.has(`prefetch:${href}`)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);

    this.addedResources.add(`prefetch:${href}`);
  }

  preloadFont(href: string) {
    this.addPreload(href, 'font', 'font/woff2', true);
  }

  preloadImage(href: string) {
    this.addPreload(href, 'image');
  }

  preloadScript(href: string) {
    this.addPreload(href, 'script');
  }

  preloadStyle(href: string) {
    this.addPreload(href, 'style');
  }

  initializeSupabaseOptimizations(supabaseUrl: string) {
    const url = new URL(supabaseUrl);
    this.addPreconnect(url.origin);
    this.addDnsPrefetch(url.origin);
  }

  initializeCriticalResources(hints: ResourceHints = {}) {
    hints.preconnect?.forEach((url) => this.addPreconnect(url));
    hints.dnsPrefetch?.forEach((url) => this.addDnsPrefetch(url));
    hints.preload?.forEach(({ href, as, type, crossorigin }) =>
      this.addPreload(href, as, type, crossorigin)
    );
    hints.prefetch?.forEach((url) => this.addPrefetch(url));
  }

  preloadCriticalChunks() {
    const criticalChunks = [
      { href: '/assets/react-vendor', as: 'script' },
      { href: '/assets/supabase-vendor', as: 'script' },
    ];

    criticalChunks.forEach(({ href, as }) => {
      const scriptTags = document.querySelectorAll('script[src*="' + href + '"]');
      scriptTags.forEach((script) => {
        const src = script.getAttribute('src');
        if (src) {
          this.addPreload(src, as);
        }
      });
    });
  }
}

export const resourceOptimizer = ResourceOptimizer.getInstance();

export function optimizeImageLoading() {
  if ('loading' in HTMLImageElement.prototype) {
    document.querySelectorAll('img[data-src]').forEach((img) => {
      img.setAttribute('loading', 'lazy');
      const src = img.getAttribute('data-src');
      if (src) {
        img.setAttribute('src', src);
      }
    });
  }
}

export function enableResourcePriorityHints() {
  const criticalImages = document.querySelectorAll('img[data-priority="high"]');
  criticalImages.forEach((img) => {
    img.setAttribute('fetchpriority', 'high');
  });

  const lowPriorityScripts = document.querySelectorAll('script[data-priority="low"]');
  lowPriorityScripts.forEach((script) => {
    script.setAttribute('fetchpriority', 'low');
  });
}

export function measureResourceTiming(resourceName: string) {
  if ('performance' in window && 'getEntriesByName' in performance) {
    const resources = performance.getEntriesByName(resourceName);
    if (resources.length > 0) {
      const resource = resources[0] as PerformanceResourceTiming;
      return {
        duration: resource.duration,
        transferSize: resource.transferSize,
        cached: resource.transferSize === 0,
      };
    }
  }
  return null;
}

export function getResourceMetrics() {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const metrics = {
      totalResources: resources.length,
      cached: resources.filter((r) => r.transferSize === 0).length,
      scripts: resources.filter((r) => r.initiatorType === 'script').length,
      css: resources.filter((r) => r.initiatorType === 'link').length,
      images: resources.filter((r) => r.initiatorType === 'img').length,
      totalTransferSize: resources.reduce((sum, r) => sum + r.transferSize, 0),
      avgDuration: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length,
    };

    return metrics;
  }
  return null;
}
