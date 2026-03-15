import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { Package, ClipboardList, Package2, Droplet, BookOpen, Building2, Users, DollarSign, BarChart3, Target, Tag, Home, UserPlus, FileText, Clipboard, AlertTriangle, Layers, Activity, Briefcase, HardHat, MapPin, Settings, Share2, Box, Calculator, Truck, Calendar, FileSpreadsheet, MessageSquare, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';
import LoadingFallback from './components/LoadingFallback';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAStatus from './components/PWAStatus';
import { preloadComponent } from './components/LazyLoadOptimizer';
import MemoryDiagnostics from './components/MemoryDiagnostics';
import QueryPerformanceMonitor from './components/QueryPerformanceMonitor';
import SupabaseConnectionMonitor from './components/SupabaseConnectionMonitor';
import MemoryLeakMonitor from './components/MemoryLeakMonitor';
import AuthDiagnostics from './components/AuthDiagnostics';
import CriticalPerformanceMonitor from './components/CriticalPerformanceMonitor';
import DiagnosticsPanel from './components/DiagnosticsPanel';
import { globalMemoryCleanup } from './lib/memoryCleanup';

const Products = lazy(() => import('./components/Products'));
const DailyProduction = lazy(() => import('./components/DailyProduction'));
const Inventory = lazy(() => import('./components/Inventory'));
const Materials = lazy(() => import('./components/Materials'));
const MaterialInventory = lazy(() => import('./components/MaterialInventory'));
const Recipes = lazy(() => import('./components/Recipes'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const Molds = lazy(() => import('./components/Molds'));
const Employees = lazy(() => import('./components/Employees'));
const IndirectCosts = lazy(() => import('./components/IndirectCosts'));
const SalesReport = lazy(() => import('./components/SalesReport'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const SalesPrices = lazy(() => import('./components/SalesPrices'));
const Customers = lazy(() => import('./components/Customers'));
const Quotes = lazy(() => import('./components/Quotes'));
const ProductionOrders = lazy(() => import('./components/ProductionOrders'));
const ProductionPending = lazy(() => import('./components/ProductionPending'));
const Compositions = lazy(() => import('./components/Compositions'));
const RibbedSlabQuote = lazy(() => import('./components/RibbedSlabQuote'));
const PublicQRView = lazy(() => import('./components/PublicQRView'));
const ProductionStageTracker = lazy(() => import('./components/ProductionStageTracker'));
const FactoryFinance = lazy(() => import('./components/FactoryFinance'));
const Deliveries = lazy(() => import('./components/Deliveries'));
const EngineeringServices = lazy(() => import('./components/EngineeringServices'));
const EngineeringEmployees = lazy(() => import('./components/EngineeringEmployees'));
const EngineeringProjectsManager = lazy(() => import('./components/EngineeringProjectsManager'));
const AIDocumentGenerator = lazy(() => import('./components/AIDocumentGenerator'));
const EngineeringFinance = lazy(() => import('./components/EngineeringFinance'));
const ConstructionProjects = lazy(() => import('./components/ConstructionProjects'));
const ConstructionFinance = lazy(() => import('./components/ConstructionFinance'));
const ConstructionBudgets = lazy(() => import('./components/construction/ConstructionBudgets'));
const PaymentAudit = lazy(() => import('./components/PaymentAudit'));
const AssemblyStructure = lazy(() => import('./components/assembly/AssemblyStructure'));
const Properties = lazy(() => import('./components/Properties'));
const CompanySettings = lazy(() => import('./components/CompanySettings'));
const ModuleSharing = lazy(() => import('./components/ModuleSharing'));
const ClientPortal = lazy(() => import('./components/ClientPortal'));
const UnifiedSales = lazy(() => import('./components/UnifiedSales'));
const CustomerStatement = lazy(() => import('./components/CustomerStatement'));
const EngineeringMeetings = lazy(() => import('./components/EngineeringMeetings'));
type MainTab = 'factory' | 'engineering' | 'construction' | 'sales' | 'settings' | 'sharing';
type FactoryTab = 'products' | 'molds' | 'production' | 'inventory' | 'materials' | 'material-inventory' | 'recipes' | 'suppliers' | 'employees' | 'indirect-costs' | 'sales-report' | 'dashboard' | 'sales-prices' | 'customers' | 'quotes' | 'production-orders' | 'production-pending' | 'compositions' | 'ribbed-slab-quote' | 'stage-tracker' | 'cashflow' | 'deliveries';
type EngineeringTab = 'eng-customers' | 'eng-properties' | 'eng-projects' | 'eng-services' | 'eng-employees' | 'eng-ai-docs' | 'eng-finance' | 'eng-meetings';
type ConstructionTab = 'const-customers' | 'const-projects' | 'const-finance' | 'const-budgets' | 'const-audit' | 'const-assembly';

const mainTabs = [
  { id: 'factory' as MainTab, label: 'Indústria de Artefatos e Pré-Moldados', icon: Package, color: 'from-blue-500 to-blue-600' },
  { id: 'engineering' as MainTab, label: 'Escritório de Engenharia e Topografia', icon: Briefcase, color: 'from-green-500 to-green-600' },
  { id: 'construction' as MainTab, label: 'Construtora', icon: HardHat, color: 'from-orange-500 to-orange-600' },
  { id: 'sales' as MainTab, label: 'Financeiro de Vendas', icon: DollarSign, color: 'from-emerald-500 to-emerald-600' },
  { id: 'sharing' as MainTab, label: 'Compartilhar Módulos', icon: Share2, color: 'from-teal-500 to-teal-600' },
  { id: 'settings' as MainTab, label: 'Configurações da Empresa', icon: Settings, color: 'from-gray-500 to-gray-600' },
];

const factoryTabs = [
  { id: 'products' as FactoryTab, label: 'Produtos', icon: Package },
  { id: 'molds' as FactoryTab, label: 'Fôrmas', icon: Box },
  { id: 'materials' as FactoryTab, label: 'Insumos/Compras', icon: Droplet },
  { id: 'production' as FactoryTab, label: 'Produção', icon: ClipboardList },
  { id: 'customers' as FactoryTab, label: 'Clientes', icon: UserPlus },
  { id: 'cashflow' as FactoryTab, label: 'Receitas/Despesas', icon: Activity },
  { id: 'compositions' as FactoryTab, label: 'Composições', icon: Layers },
  { id: 'ribbed-slab-quote' as FactoryTab, label: 'Orçamento de Laje Treliçada', icon: Calculator },
  { id: 'quotes' as FactoryTab, label: 'Orçamentos', icon: FileText },
  { id: 'production-orders' as FactoryTab, label: 'Ordens de Produção', icon: Clipboard },
  { id: 'production-pending' as FactoryTab, label: 'Itens a Produzir', icon: AlertTriangle },
  { id: 'deliveries' as FactoryTab, label: 'Entregas', icon: Truck },
  { id: 'recipes' as FactoryTab, label: 'Traços', icon: BookOpen },
  { id: 'suppliers' as FactoryTab, label: 'Fornecedores', icon: Building2 },
  { id: 'inventory' as FactoryTab, label: 'Estoque Produtos', icon: Package2 },
  { id: 'material-inventory' as FactoryTab, label: 'Estoque Insumos', icon: Droplet },
  { id: 'stage-tracker' as FactoryTab, label: 'Etapas de Produção', icon: Activity },
  { id: 'employees' as FactoryTab, label: 'Colaboradores', icon: Users },
  { id: 'indirect-costs' as FactoryTab, label: 'Financeiro', icon: DollarSign },
  { id: 'sales-prices' as FactoryTab, label: 'Tabela de Preços', icon: Tag },
  { id: 'sales-report' as FactoryTab, label: 'Relatório de Produção', icon: BarChart3 },
  { id: 'dashboard' as FactoryTab, label: 'Metas', icon: Target },
];

const engineeringTabs = [
  { id: 'eng-customers' as EngineeringTab, label: 'Clientes', icon: UserPlus },
  { id: 'eng-properties' as EngineeringTab, label: 'Imóveis', icon: MapPin },
  { id: 'eng-projects' as EngineeringTab, label: 'Projetos', icon: Briefcase },
  { id: 'eng-finance' as EngineeringTab, label: 'Receitas/Despesas', icon: DollarSign },
  { id: 'eng-meetings' as EngineeringTab, label: 'Reuniões', icon: MessageSquare },
  { id: 'eng-services' as EngineeringTab, label: 'Projetos (Templates)', icon: Clipboard },
  { id: 'eng-employees' as EngineeringTab, label: 'Colaboradores', icon: Users },
  { id: 'eng-ai-docs' as EngineeringTab, label: 'Documentos IA', icon: FileText },
];

const constructionTabs = [
  { id: 'const-customers' as ConstructionTab, label: 'Clientes', icon: UserPlus },
  { id: 'const-budgets' as ConstructionTab, label: 'Orcamentos', icon: FileSpreadsheet },
  { id: 'const-projects' as ConstructionTab, label: 'Obras', icon: HardHat },
  { id: 'const-assembly' as ConstructionTab, label: 'Montagem de Estrutura', icon: Layers },
  { id: 'const-finance' as ConstructionTab, label: 'Financeiro', icon: DollarSign },
  { id: 'const-audit' as ConstructionTab, label: 'Auditoria de Pagamentos', icon: ShieldCheck },
];

const MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000;
const VISIBILITY_CLEANUP_DELAY = 30 * 1000;

function App() {
  const lastCleanupRef = useRef<number>(Date.now());
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializePDF = async () => {
      try {
        await import('jspdf');
        await import('jspdf-autotable');
      } catch (error) {
        console.error('Erro ao pré-carregar jsPDF:', error);
      }
    };

    initializePDF();
  }, []);

  useEffect(() => {
    const performCleanup = () => {
      const now = Date.now();
      if (now - lastCleanupRef.current >= MEMORY_CLEANUP_INTERVAL) {
        globalMemoryCleanup.runCleanup();
        lastCleanupRef.current = now;
      }
    };

    const cleanupInterval = setInterval(performCleanup, MEMORY_CLEANUP_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }
        cleanupTimeoutRef.current = setTimeout(() => {
          globalMemoryCleanup.runCleanup();
          lastCleanupRef.current = Date.now();
        }, VISIBILITY_CLEANUP_DELAY);
      } else {
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
          cleanupTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(cleanupInterval);
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab | null>(null);
  const [factoryTab, setFactoryTab] = useState<FactoryTab | null>(null);
  const [engineeringTab, setEngineeringTab] = useState<EngineeringTab | null>(null);
  const [constructionTab, setConstructionTab] = useState<ConstructionTab | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedRibbedSlabId, setSelectedRibbedSlabId] = useState<string | null>(null);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string | null>(null);
  const [fromSalesModule, setFromSalesModule] = useState<boolean>(false);
  const [isClientPortal] = useState<boolean>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const portalToken = urlParams.get('portal');
    const clientPortalParam = urlParams.get('client_portal');
    const hash = window.location.hash;

    const isPortal = !!(portalToken || clientPortalParam === 'true' || hash.startsWith('#client-portal'));

    if (isPortal && portalToken) {
      localStorage.setItem('client_portal_token', portalToken);
    }

    return isPortal;
  });
  const [productionOrdersOpen, setProductionOrdersOpen] = useState<number>(0);
  const [productionOrdersOverdue, setProductionOrdersOverdue] = useState<number>(0);
  const [deliveriesOpen, setDeliveriesOpen] = useState<number>(0);
  const [sharedModules, setSharedModules] = useState<string[]>(() => {
    const storedModules = localStorage.getItem('shared_modules');
    if (storedModules) {
      try {
        const modules = JSON.parse(storedModules);
        if (Array.isArray(modules) && modules.length > 0) {
          return modules;
        }
      } catch (e) {
        console.error('Erro ao carregar módulos compartilhados:', e);
        localStorage.removeItem('shared_modules');
      }
    }
    return [];
  });

  const hasLoadedStats = useRef(false);
  const statsLastFetchedRef = useRef<{ orders: number; deliveries: number }>({ orders: 0, deliveries: 0 });
  const STATS_CACHE_TTL = 10 * 60 * 1000;

  const loadProductionOrdersStats = useCallback(async () => {
    const now = Date.now();
    if (now - statsLastFetchedRef.current.orders < STATS_CACHE_TTL) return;

    try {
      const { data: orders, error } = await supabase
        .from('production_orders')
        .select('status, deadline')
        .in('status', ['open', 'in_progress']);

      if (error) throw error;

      statsLastFetchedRef.current.orders = Date.now();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const openCount = orders?.length || 0;
      const overdueCount = orders?.filter(order => {
        if (!order.deadline) return false;
        const deadline = new Date(order.deadline);
        deadline.setHours(0, 0, 0, 0);
        return deadline < today;
      }).length || 0;

      setProductionOrdersOpen(openCount);
      setProductionOrdersOverdue(overdueCount);
    } catch (error) {
      console.error('Erro ao carregar estatísticas das ordens:', error);
    }
  }, []);


  const loadDeliveriesStats = useCallback(async () => {
    const now = Date.now();
    if (now - statsLastFetchedRef.current.deliveries < STATS_CACHE_TTL) return;

    try {
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('id')
        .eq('status', 'open');

      if (error) throw error;

      statsLastFetchedRef.current.deliveries = Date.now();
      setDeliveriesOpen(deliveries?.length || 0);
    } catch (error) {
      console.error('Erro ao carregar estatísticas das entregas:', error);
    }
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const trackMatch = path.match(/\/track\/([^/]+)/);
    if (trackMatch) {
      setPublicToken(trackMatch[1]);
    }
  }, []);

  useEffect(() => {
    if (publicToken || isClientPortal) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const sharedModulesParam = urlParams.get('shared_modules');

    if (sharedModulesParam) {
      const modules = sharedModulesParam.split(',');
      localStorage.setItem('shared_modules', JSON.stringify(modules));
      setSharedModules(modules);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!hasLoadedStats.current) {
      hasLoadedStats.current = true;
      loadProductionOrdersStats();
      loadDeliveriesStats();
    }
  }, [publicToken, isClientPortal, loadProductionOrdersStats, loadDeliveriesStats]);

  const filteredFactoryTabs = useMemo(() =>
    sharedModules.length > 0
      ? factoryTabs.filter(tab => sharedModules.includes(tab.id))
      : factoryTabs,
    [sharedModules]
  );

  const filteredEngineeringTabs = useMemo(() =>
    sharedModules.length > 0
      ? engineeringTabs.filter(tab => sharedModules.includes(tab.id))
      : engineeringTabs,
    [sharedModules]
  );

  const filteredConstructionTabs = useMemo(() =>
    sharedModules.length > 0
      ? constructionTabs.filter(tab => sharedModules.includes(tab.id))
      : constructionTabs,
    [sharedModules]
  );

  const hasSharedModules = sharedModules.length > 0;
  const showMainTabs = useMemo(() =>
    hasSharedModules
      ? mainTabs.filter(t => t.id !== 'sharing' && t.id !== 'settings')
      : mainTabs,
    [hasSharedModules]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDiagnostics(d => !d);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleBackToMain = useCallback(() => {
    setFactoryTab(null);
    setEngineeringTab(null);
    setConstructionTab(null);
    setMainTab(null);
  }, []);

  const handleBackToBusinessUnit = useCallback(() => {
    setFactoryTab(null);
    setEngineeringTab(null);
    setConstructionTab(null);
    loadProductionOrdersStats();
    loadDeliveriesStats();
  }, [loadProductionOrdersStats, loadDeliveriesStats]);

  if (publicToken) {
    return <PublicQRView token={publicToken} />;
  }

  if (isClientPortal) {
    return <ClientPortal />;
  }

  return (
    <>
    <PWAInstallPrompt />
    <PWAStatus />
    {import.meta.env.DEV && <CriticalPerformanceMonitor />}
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                Sistema Integrado de Gestão Empresarial
              </h1>
              <p className="text-sm text-blue-100">
                Aliancer Engenharia & Topografia
              </p>
            </div>
            {mainTab && (
              <button
                onClick={handleBackToMain}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all backdrop-blur-sm"
              >
                <Home className="w-5 h-5" />
                <span className="hidden sm:inline">Início</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {hasSharedModules && (
          <div className="mb-6 bg-gradient-to-r from-teal-50 to-teal-100 border-2 border-teal-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Share2 className="w-6 h-6 text-teal-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-teal-900">Visualização de Módulos Compartilhados</h3>
                <p className="text-sm text-teal-700">
                  Você está visualizando apenas {sharedModules.length} módulo(s) compartilhado(s).
                  Para alterar os módulos disponíveis, acesse um novo link ou QR Code compartilhado.
                </p>
              </div>
            </div>
          </div>
        )}

        {!mainTab && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="h-32 w-32 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg mb-6 flex items-center justify-center">
                <Package className="w-20 h-20 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Bem-vindo ao Sistema Integrado
              </h2>
              <p className="text-lg text-gray-600">
                Selecione uma unidade de negócio para começar
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {showMainTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMainTab(tab.id)}
                    onMouseEnter={() => {
                      if (tab.id === 'sales') {
                        preloadComponent('UnifiedSales');
                      } else if (tab.id === 'settings') {
                        preloadComponent('CompanySettings');
                      } else if (tab.id === 'sharing') {
                        preloadComponent('ModuleSharing');
                      }
                    }}
                    className={`group p-8 bg-gradient-to-br ${tab.color} rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105`}
                  >
                    <Icon className="w-16 h-16 mx-auto mb-4 text-white" />
                    <h3 className="text-xl font-bold text-white text-center">
                      {tab.label}
                    </h3>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mainTab === 'factory' && !factoryTab && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <Package className="w-12 h-12 text-[#0A7EC2]" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Indústria de Artefatos e Pré-Moldados</h2>
                  <p className="text-gray-600">Gestão completa da produção industrial</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFactoryTabs.map((tab) => {
                const Icon = tab.icon;
                const componentMap: Record<string, string> = {
                  'products': 'Products',
                  'molds': 'Molds',
                  'materials': 'Materials',
                  'suppliers': 'Suppliers',
                  'customers': 'Customers',
                  'compositions': 'Compositions',
                  'ribbed-slab-quote': 'RibbedSlabQuote',
                  'quotes': 'Quotes',
                  'production-orders': 'ProductionOrders',
                  'production-pending': 'ProductionPending',
                  'deliveries': 'Deliveries',
                  'recipes': 'Recipes',
                  'production': 'DailyProduction',
                  'inventory': 'Inventory',
                  'material-inventory': 'MaterialInventory',
                  'stage-tracker': 'ProductionStageTracker',
                  'employees': 'Employees',
                  'indirect-costs': 'IndirectCosts',
                  'cashflow': 'FactoryFinance',
                  'sales-prices': 'SalesPrices',
                  'sales-report': 'SalesReport',
                  'dashboard': 'Dashboard',
                };
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFactoryTab(tab.id)}
                    onMouseEnter={() => {
                      const componentName = componentMap[tab.id];
                      if (componentName) {
                        preloadComponent(componentName);
                      }
                    }}
                    className="group p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105 relative"
                  >
                    {tab.id === 'production-orders' && (productionOrdersOpen > 0 || productionOrdersOverdue > 0) && (
                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                        {productionOrdersOpen > 0 && (
                          <div className="bg-white text-blue-600 text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                            <Clipboard className="w-3 h-3" />
                            {productionOrdersOpen}
                          </div>
                        )}
                        {productionOrdersOverdue > 0 && (
                          <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            {productionOrdersOverdue}
                          </div>
                        )}
                      </div>
                    )}
                    {tab.id === 'deliveries' && deliveriesOpen > 0 && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                          <Truck className="w-3 h-3" />
                          {deliveriesOpen}
                        </div>
                      </div>
                    )}
                    <Icon className="w-12 h-12 mx-auto mb-3 text-white" />
                    <p className="font-bold text-white text-center text-base">
                      {tab.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mainTab === 'engineering' && !engineeringTab && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <Briefcase className="w-12 h-12 text-green-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Escritório de Engenharia e Topografia</h2>
                  <p className="text-gray-600">Gestão de projetos e serviços técnicos</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredEngineeringTabs.map((tab) => {
                const Icon = tab.icon;
                const componentMap: Record<string, string> = {
                  'eng-customers': 'Customers',
                  'eng-properties': 'Properties',
                  'eng-projects': 'EngineeringProjectsManager',
                  'eng-services': 'EngineeringServices',
                  'eng-employees': 'EngineeringEmployees',
                  'eng-ai-docs': 'AIDocumentGenerator',
                  'eng-meetings': 'EngineeringMeetings',
                };
                return (
                  <button
                    key={tab.id}
                    onClick={() => setEngineeringTab(tab.id)}
                    onMouseEnter={() => {
                      const componentName = componentMap[tab.id];
                      if (componentName) {
                        preloadComponent(componentName);
                      }
                    }}
                    className="group p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Icon className="w-12 h-12 mx-auto mb-3 text-white" />
                    <p className="font-bold text-white text-center text-base">
                      {tab.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mainTab === 'construction' && !constructionTab && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <HardHat className="w-12 h-12 text-orange-600" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Construtora</h2>
                  <p className="text-gray-600">Gestão e acompanhamento de obras</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredConstructionTabs.map((tab) => {
                const Icon = tab.icon;
                const componentMap: Record<string, string> = {
                  'const-customers': 'Customers',
                  'const-projects': 'ConstructionProjects',
                  'const-finance': 'ConstructionFinance',
                };
                return (
                  <button
                    key={tab.id}
                    onClick={() => setConstructionTab(tab.id)}
                    onMouseEnter={() => {
                      const componentName = componentMap[tab.id];
                      if (componentName) {
                        preloadComponent(componentName);
                      }
                    }}
                    className="group p-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Icon className="w-12 h-12 mx-auto mb-3 text-white" />
                    <p className="font-bold text-white text-center text-base">
                      {tab.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mainTab === 'sales' && (
          <Suspense fallback={<LoadingFallback />}>
            <UnifiedSales
              onNavigateToQuote={(quoteId, receivableId) => {
                setSelectedQuoteId(quoteId);
                setSelectedReceivableId(receivableId);
                setFromSalesModule(true);
                setMainTab('factory');
                setFactoryTab('quotes');
              }}
              onNavigateToRibbedSlab={(quoteId, receivableId) => {
                setSelectedRibbedSlabId(quoteId);
                setSelectedReceivableId(receivableId);
                setFromSalesModule(true);
                setMainTab('factory');
                setFactoryTab('ribbed-slab-quote');
              }}
              highlightReceivableId={selectedReceivableId}
              onReceivableOpened={() => {
                setSelectedReceivableId(null);
                setFromSalesModule(false);
              }}
            />
          </Suspense>
        )}

        {mainTab === 'sharing' && (
          <Suspense fallback={<LoadingFallback />}>
            <ModuleSharing />
          </Suspense>
        )}

        {mainTab === 'settings' && (
          <Suspense fallback={<LoadingFallback />}>
            <CompanySettings />
          </Suspense>
        )}

        <div className="transition-all duration-200">
          {factoryTab && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={handleBackToBusinessUnit}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Voltar
                </button>
                <h2 className="text-2xl font-bold text-gray-900">
                  {filteredFactoryTabs.find(t => t.id === factoryTab)?.label}
                </h2>
              </div>

              <Suspense fallback={<LoadingFallback />}>
                {factoryTab === 'products' && <Products />}
                {factoryTab === 'molds' && <Molds />}
                {factoryTab === 'materials' && <Materials />}
                {factoryTab === 'suppliers' && <Suppliers />}
                {factoryTab === 'customers' && <Customers />}
                {factoryTab === 'compositions' && <Compositions />}
                {factoryTab === 'ribbed-slab-quote' && (
                  <RibbedSlabQuote
                    highlightQuoteId={selectedRibbedSlabId}
                    onQuoteOpened={() => setSelectedRibbedSlabId(null)}
                    receivableId={fromSalesModule ? selectedReceivableId : null}
                    onBackToSale={fromSalesModule ? (receivableId) => {
                      setSelectedReceivableId(receivableId);
                      setMainTab('sales');
                      setFromSalesModule(false);
                    } : undefined}
                  />
                )}
                {factoryTab === 'quotes' && (
                  <Quotes
                    highlightQuoteId={selectedQuoteId}
                    onQuoteOpened={() => setSelectedQuoteId(null)}
                    receivableId={fromSalesModule ? selectedReceivableId : null}
                    onBackToSale={fromSalesModule ? (receivableId) => {
                      setSelectedReceivableId(receivableId);
                      setMainTab('sales');
                      setFromSalesModule(false);
                    } : undefined}
                  />
                )}
                {factoryTab === 'production-orders' && <ProductionOrders />}
                {factoryTab === 'production-pending' && <ProductionPending />}
                {factoryTab === 'deliveries' && <Deliveries />}
                {factoryTab === 'recipes' && <Recipes />}
                {factoryTab === 'production' && <DailyProduction />}
                {factoryTab === 'inventory' && <Inventory />}
                {factoryTab === 'material-inventory' && <MaterialInventory />}
                {factoryTab === 'stage-tracker' && <ProductionStageTracker />}
                {factoryTab === 'employees' && <Employees />}
                {factoryTab === 'indirect-costs' && <IndirectCosts />}
                {factoryTab === 'cashflow' && <FactoryFinance />}
                {factoryTab === 'sales-prices' && <SalesPrices />}
                {factoryTab === 'sales-report' && <SalesReport />}
                {factoryTab === 'dashboard' && <Dashboard />}
              </Suspense>
            </div>
          )}

          {engineeringTab && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={handleBackToBusinessUnit}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Voltar
                </button>
                <h2 className="text-2xl font-bold text-gray-900">
                  {filteredEngineeringTabs.find(t => t.id === engineeringTab)?.label}
                </h2>
              </div>

              <Suspense fallback={<LoadingFallback />}>
                {engineeringTab === 'eng-customers' && <Customers showProperties={true} />}
                {engineeringTab === 'eng-properties' && <Properties />}
                {engineeringTab === 'eng-projects' && <EngineeringProjectsManager />}
                {engineeringTab === 'eng-finance' && <EngineeringFinance />}
                {engineeringTab === 'eng-meetings' && <EngineeringMeetings />}
                {engineeringTab === 'eng-services' && <EngineeringServices />}
                {engineeringTab === 'eng-employees' && <EngineeringEmployees />}
                {engineeringTab === 'eng-ai-docs' && <AIDocumentGenerator />}
              </Suspense>
            </div>
          )}

          {constructionTab && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={handleBackToBusinessUnit}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Voltar
                </button>
                <h2 className="text-2xl font-bold text-gray-900">
                  {filteredConstructionTabs.find(t => t.id === constructionTab)?.label}
                </h2>
              </div>

              <Suspense fallback={<LoadingFallback />}>
                {constructionTab === 'const-customers' && <Customers />}
                {constructionTab === 'const-budgets' && <ConstructionBudgets />}
                {constructionTab === 'const-projects' && <ConstructionProjects />}
                {constructionTab === 'const-assembly' && <AssemblyStructure />}
                {constructionTab === 'const-finance' && <ConstructionFinance />}
                {constructionTab === 'const-audit' && <PaymentAudit />}
              </Suspense>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-12 py-6 bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm font-medium">
            Sistema Integrado de Gestão Empresarial
          </p>
          <p className="text-xs text-blue-100 mt-1">
            Aliancer Engenharia & Topografia
          </p>
        </div>
      </footer>
    </div>
      {import.meta.env.DEV && (
        <>
          <MemoryDiagnostics />
          <QueryPerformanceMonitor />
          <SupabaseConnectionMonitor />
          <MemoryLeakMonitor />
          <AuthDiagnostics />
        </>
      )}
      <button
        onClick={() => setShowDiagnostics(true)}
        className="fixed bottom-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg opacity-20 hover:opacity-100 transition-opacity"
        title="Diagnóstico de Performance (Ctrl+Shift+D)"
      >
        <Activity className="w-5 h-5" />
      </button>
      {showDiagnostics && <DiagnosticsPanel onClose={() => setShowDiagnostics(false)} />}
    </>
  );
}

export default App;