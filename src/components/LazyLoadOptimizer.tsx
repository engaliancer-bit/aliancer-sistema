import { useEffect } from 'react';

const componentPreloaders: Record<string, () => Promise<any>> = {
  'Products': () => import('./Products'),
  'DailyProduction': () => import('./DailyProduction'),
  'Inventory': () => import('./Inventory'),
  'Materials': () => import('./Materials'),
  'MaterialInventory': () => import('./MaterialInventory'),
  'Recipes': () => import('./Recipes'),
  'Suppliers': () => import('./Suppliers'),
  'Molds': () => import('./Molds'),
  'Employees': () => import('./Employees'),
  'IndirectCosts': () => import('./IndirectCosts'),
  'SalesReport': () => import('./SalesReport'),
  'Dashboard': () => import('./Dashboard'),
  'SalesPrices': () => import('./SalesPrices'),
  'Customers': () => import('./Customers'),
  'Quotes': () => import('./Quotes'),
  'ProductionOrders': () => import('./ProductionOrders'),
  'Compositions': () => import('./Compositions'),
  'RibbedSlabQuote': () => import('./RibbedSlabQuote'),
  'CashFlow': () => import('./CashFlow'),
  'Deliveries': () => import('./Deliveries'),
  'EngineeringServices': () => import('./EngineeringServices'),
  'EngineeringEmployees': () => import('./EngineeringEmployees'),
  'EngineeringProjectsManager': () => import('./EngineeringProjectsManager'),
  'ConstructionProjects': () => import('./ConstructionProjects'),
  'ConstructionFinance': () => import('./ConstructionFinance'),
  'Properties': () => import('./Properties'),
  'CompanySettings': () => import('./CompanySettings'),
  'ModuleSharing': () => import('./ModuleSharing'),
  'UnifiedSales': () => import('./UnifiedSales'),
  'CustomerStatement': () => import('./CustomerStatement'),
};

interface LazyLoadOptimizerProps {
  componentsToPreload?: string[];
}

export default function LazyLoadOptimizer({ componentsToPreload = [] }: LazyLoadOptimizerProps) {
  useEffect(() => {
    if (componentsToPreload.length === 0) return;

    const preloadTimer = setTimeout(() => {
      componentsToPreload.forEach(componentName => {
        const preloader = componentPreloaders[componentName];
        if (preloader) {
          preloader().catch(() => {});
        }
      });
    }, 1000);

    return () => clearTimeout(preloadTimer);
  }, [componentsToPreload]);

  return null;
}

export function preloadComponent(componentName: string) {
  const preloader = componentPreloaders[componentName];
  if (preloader) {
    return preloader();
  }
  return Promise.resolve();
}

export function preloadCriticalComponents() {
  const criticalComponents = ['Products', 'Customers', 'Quotes', 'UnifiedSales'];
  return Promise.all(
    criticalComponents.map(name => preloadComponent(name))
  );
}
