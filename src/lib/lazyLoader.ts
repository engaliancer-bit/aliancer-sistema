import { lazy, ComponentType } from 'react';

interface LazyLoadOptions {
  delay?: number;
  preload?: boolean;
}

const preloadedComponents = new Set<string>();

export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  options: LazyLoadOptions = {}
): React.LazyExoticComponent<T> {
  const { delay = 0, preload = false } = options;

  let importPromise: Promise<{ default: T }> | null = null;

  const getImport = () => {
    if (!importPromise) {
      importPromise = delay
        ? new Promise((resolve) => {
            setTimeout(() => {
              importFn().then(resolve);
            }, delay);
          })
        : importFn();
    }
    return importPromise;
  };

  if (preload && !preloadedComponents.has(componentName)) {
    preloadedComponents.add(componentName);
    setTimeout(() => {
      getImport();
    }, 100);
  }

  const LazyComponent = lazy(getImport);

  (LazyComponent as any).preload = () => {
    if (!preloadedComponents.has(componentName)) {
      preloadedComponents.add(componentName);
      return getImport();
    }
    return importPromise;
  };

  return LazyComponent;
}

export function preloadComponent(component: any) {
  if (component && typeof component.preload === 'function') {
    component.preload();
  }
}

export function preloadComponents(components: any[]) {
  components.forEach(preloadComponent);
}

export const componentRegistry = {
  Products: () => lazyLoad(() => import('../components/Products'), 'Products'),
  Materials: () => lazyLoad(() => import('../components/Materials'), 'Materials'),
  Quotes: () => lazyLoad(() => import('../components/Quotes'), 'Quotes'),
  UnifiedSales: () => lazyLoad(() => import('../components/UnifiedSales'), 'UnifiedSales'),
  RibbedSlabQuote: () => lazyLoad(() => import('../components/RibbedSlabQuote'), 'RibbedSlabQuote'),
  CashFlow: () => lazyLoad(() => import('../components/CashFlow'), 'CashFlow'),
  EngineeringProjectsManager: () => lazyLoad(() => import('../components/EngineeringProjectsManager'), 'EngineeringProjectsManager'),
  Deliveries: () => lazyLoad(() => import('../components/Deliveries'), 'Deliveries'),
  ConstructionProjects: () => lazyLoad(() => import('../components/ConstructionProjects'), 'ConstructionProjects'),
  Customers: () => lazyLoad(() => import('../components/Customers'), 'Customers'),
  ProductionOrders: () => lazyLoad(() => import('../components/ProductionOrders'), 'ProductionOrders'),
  Inventory: () => lazyLoad(() => import('../components/Inventory'), 'Inventory'),
  MaterialInventory: () => lazyLoad(() => import('../components/MaterialInventory'), 'MaterialInventory'),
  Dashboard: () => lazyLoad(() => import('../components/Dashboard'), 'Dashboard'),
  Molds: () => lazyLoad(() => import('../components/Molds'), 'Molds'),
  IndirectCosts: () => lazyLoad(() => import('../components/IndirectCosts'), 'IndirectCosts'),
  Compositions: () => lazyLoad(() => import('../components/Compositions'), 'Compositions'),
};
