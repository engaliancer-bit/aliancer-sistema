import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
  ],

  server: {
    host: true,
    port: 5173,
  },

  build: {
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        compact: true,
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',

        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }

          // Supabase
          if (id.includes('@supabase/supabase-js') || id.includes('@supabase/')) {
            return 'vendor-supabase';
          }

          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          // PDF generation
          if (id.includes('jspdf') || id.includes('qrcode')) {
            return 'vendor-pdf';
          }

          // Date/Time utilities
          if (id.includes('react-datepicker') || id.includes('date-fns')) {
            return 'vendor-datetime';
          }

          // Virtual scroll
          if (id.includes('react-window')) {
            return 'vendor-virtual';
          }

          // Factory module - Production components
          if (id.includes('components/Products') ||
              id.includes('components/DailyProduction') ||
              id.includes('components/ProductionOrders') ||
              id.includes('components/ProductionStageTracker')) {
            return 'module-factory-production';
          }

          // Factory module - Inventory components
          if (id.includes('components/Inventory') ||
              id.includes('components/Materials') ||
              id.includes('components/MaterialInventory') ||
              id.includes('components/Deliveries')) {
            return 'module-factory-inventory';
          }

          // Factory module - Sales components
          if (id.includes('components/Quotes') ||
              id.includes('components/RibbedSlabQuote') ||
              id.includes('components/UnifiedSales') ||
              id.includes('components/SalesReport') ||
              id.includes('components/CustomerStatement')) {
            return 'module-factory-sales';
          }

          // Factory module - Finance components
          if (id.includes('components/CashFlow') ||
              id.includes('components/IndirectCosts') ||
              id.includes('components/Dashboard') ||
              id.includes('components/SalesPrices')) {
            return 'module-factory-finance';
          }

          // Factory module - Configuration components
          if (id.includes('components/Recipes') ||
              id.includes('components/Compositions') ||
              id.includes('components/Molds') ||
              id.includes('components/Suppliers')) {
            return 'module-factory-config';
          }

          // Engineering module
          if (id.includes('components/Engineering') ||
              id.includes('components/Properties')) {
            return 'module-engineering';
          }

          // Construction module
          if (id.includes('components/Construction')) {
            return 'module-construction';
          }

          // Common components (Customers, Employees, etc)
          if (id.includes('components/Customers') ||
              id.includes('components/Employees') ||
              id.includes('components/CompanySettings')) {
            return 'shared-common';
          }

          // Portal and public components
          if (id.includes('components/ClientPortal') ||
              id.includes('components/PublicQRView') ||
              id.includes('components/ModuleSharing')) {
            return 'shared-portal';
          }

          // Other vendor dependencies
          if (id.includes('node_modules/')) {
            return 'vendor-other';
          }
        },
      },
    },
  },

  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      'qrcode',
      '@supabase/supabase-js',
      'react',
      'react-dom',
      'react-dom/client',
      'react-datepicker',
      'react-window',
    ],
    esbuildOptions: {
      target: 'es2020',
    },
  },

  resolve: {
    alias: {
      qrcode: 'qrcode/lib/browser.js',
    },
  },

  esbuild: {
    legalComments: 'none',
    treeShaking: true,
  },
}));
