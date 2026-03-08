import { createRoot } from 'react-dom/client';
import { Suspense } from 'react';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './pwa-utils';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import { resourceOptimizer, optimizeImageLoading, enableResourcePriorityHints } from './lib/resourceOptimizer';
import { AppCacheProvider } from './contexts/AppCacheContext';
import { AuthProvider } from './contexts/AuthContext';
import { setupMemoryCleanup } from './lib/memoryCleanup';
import { initCacheManager } from './lib/cacheManager';
import { monitorWebVitals } from './lib/performanceLogger';
import './lib/consoleWrapper';
import './lib/leakDetector'; // Ativar leak detector em DEV

setupMemoryCleanup();
initCacheManager();

if (!import.meta.env.PROD) {
  monitorWebVitals();
  console.log('🔍 Memory Leak Detector ativado. Use __leakDetector.getStats() no console.');
}

if (import.meta.env.PROD) {
  registerServiceWorker();
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  resourceOptimizer.initializeSupabaseOptimizations(supabaseUrl);
}

resourceOptimizer.preloadCriticalChunks();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    optimizeImageLoading();
    enableResourcePriorityHints();
  });
} else {
  optimizeImageLoading();
  enableResourcePriorityHints();
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <ErrorBoundary>
    <AuthProvider>
      <AppCacheProvider>
        <Suspense fallback={<LoadingFallback />}>
          <App />
        </Suspense>
      </AppCacheProvider>
    </AuthProvider>
  </ErrorBoundary>
);
