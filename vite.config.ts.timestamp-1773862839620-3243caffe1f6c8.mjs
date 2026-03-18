// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => ({
  plugins: [
    react()
  ],
  server: {
    host: true,
    port: 5173
  },
  build: {
    minify: "esbuild",
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        compact: true,
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: (id) => {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("@supabase/supabase-js") || id.includes("@supabase/")) {
            return "vendor-supabase";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("jspdf") || id.includes("qrcode")) {
            return "vendor-pdf";
          }
          if (id.includes("react-datepicker") || id.includes("date-fns")) {
            return "vendor-datetime";
          }
          if (id.includes("react-window")) {
            return "vendor-virtual";
          }
          if (id.includes("components/Products") || id.includes("components/DailyProduction") || id.includes("components/ProductionOrders") || id.includes("components/ProductionStageTracker")) {
            return "module-factory-production";
          }
          if (id.includes("components/Inventory") || id.includes("components/Materials") || id.includes("components/MaterialInventory") || id.includes("components/Deliveries")) {
            return "module-factory-inventory";
          }
          if (id.includes("components/Quotes") || id.includes("components/RibbedSlabQuote") || id.includes("components/UnifiedSales") || id.includes("components/SalesReport") || id.includes("components/CustomerStatement")) {
            return "module-factory-sales";
          }
          if (id.includes("components/CashFlow") || id.includes("components/IndirectCosts") || id.includes("components/Dashboard") || id.includes("components/SalesPrices")) {
            return "module-factory-finance";
          }
          if (id.includes("components/Recipes") || id.includes("components/Compositions") || id.includes("components/Molds") || id.includes("components/Suppliers")) {
            return "module-factory-config";
          }
          if (id.includes("components/Engineering") || id.includes("components/Properties")) {
            return "module-engineering";
          }
          if (id.includes("components/Construction")) {
            return "module-construction";
          }
          if (id.includes("components/Customers") || id.includes("components/Employees") || id.includes("components/CompanySettings")) {
            return "shared-common";
          }
          if (id.includes("components/ClientPortal") || id.includes("components/PublicQRView") || id.includes("components/ModuleSharing")) {
            return "shared-portal";
          }
          if (id.includes("node_modules/")) {
            return "vendor-other";
          }
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
    include: [
      "qrcode",
      "@supabase/supabase-js",
      "react",
      "react-dom",
      "react-dom/client",
      "react-datepicker",
      "react-window"
    ],
    esbuildOptions: {
      target: "es2020"
    }
  },
  resolve: {
    alias: {
      qrcode: "qrcode/lib/browser.js"
    }
  },
  esbuild: {
    legalComments: "none",
    treeShaking: true
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICBdLFxuXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IHRydWUsXG4gICAgcG9ydDogNTE3MyxcbiAgfSxcblxuICBidWlsZDoge1xuICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxuXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGNvbXBhY3Q6IHRydWUsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXScsXG5cbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcbiAgICAgICAgICAvLyBSZWFjdCBjb3JlXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvcmVhY3QvJykgfHwgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9yZWFjdC1kb20vJykpIHtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXJlYWN0JztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTdXBhYmFzZVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJykgfHwgaWQuaW5jbHVkZXMoJ0BzdXBhYmFzZS8nKSkge1xuICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3Itc3VwYWJhc2UnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEx1Y2lkZSBpY29uc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbHVjaWRlLXJlYWN0JykpIHtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWljb25zJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBQREYgZ2VuZXJhdGlvblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnanNwZGYnKSB8fCBpZC5pbmNsdWRlcygncXJjb2RlJykpIHtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXBkZic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRGF0ZS9UaW1lIHV0aWxpdGllc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3QtZGF0ZXBpY2tlcicpIHx8IGlkLmluY2x1ZGVzKCdkYXRlLWZucycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1kYXRldGltZSc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVmlydHVhbCBzY3JvbGxcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0LXdpbmRvdycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci12aXJ0dWFsJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBGYWN0b3J5IG1vZHVsZSAtIFByb2R1Y3Rpb24gY29tcG9uZW50c1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnY29tcG9uZW50cy9Qcm9kdWN0cycpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0RhaWx5UHJvZHVjdGlvbicpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL1Byb2R1Y3Rpb25PcmRlcnMnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9Qcm9kdWN0aW9uU3RhZ2VUcmFja2VyJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnbW9kdWxlLWZhY3RvcnktcHJvZHVjdGlvbic7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRmFjdG9yeSBtb2R1bGUgLSBJbnZlbnRvcnkgY29tcG9uZW50c1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnY29tcG9uZW50cy9JbnZlbnRvcnknKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9NYXRlcmlhbHMnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9NYXRlcmlhbEludmVudG9yeScpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0RlbGl2ZXJpZXMnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdtb2R1bGUtZmFjdG9yeS1pbnZlbnRvcnknO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEZhY3RvcnkgbW9kdWxlIC0gU2FsZXMgY29tcG9uZW50c1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnY29tcG9uZW50cy9RdW90ZXMnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9SaWJiZWRTbGFiUXVvdGUnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9VbmlmaWVkU2FsZXMnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9TYWxlc1JlcG9ydCcpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0N1c3RvbWVyU3RhdGVtZW50JykpIHtcbiAgICAgICAgICAgIHJldHVybiAnbW9kdWxlLWZhY3Rvcnktc2FsZXMnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEZhY3RvcnkgbW9kdWxlIC0gRmluYW5jZSBjb21wb25lbnRzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0Nhc2hGbG93JykgfHxcbiAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ2NvbXBvbmVudHMvSW5kaXJlY3RDb3N0cycpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0Rhc2hib2FyZCcpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL1NhbGVzUHJpY2VzJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnbW9kdWxlLWZhY3RvcnktZmluYW5jZSc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRmFjdG9yeSBtb2R1bGUgLSBDb25maWd1cmF0aW9uIGNvbXBvbmVudHNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2NvbXBvbmVudHMvUmVjaXBlcycpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0NvbXBvc2l0aW9ucycpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL01vbGRzJykgfHxcbiAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ2NvbXBvbmVudHMvU3VwcGxpZXJzJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnbW9kdWxlLWZhY3RvcnktY29uZmlnJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBFbmdpbmVlcmluZyBtb2R1bGVcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2NvbXBvbmVudHMvRW5naW5lZXJpbmcnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9Qcm9wZXJ0aWVzJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnbW9kdWxlLWVuZ2luZWVyaW5nJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDb25zdHJ1Y3Rpb24gbW9kdWxlXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0NvbnN0cnVjdGlvbicpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ21vZHVsZS1jb25zdHJ1Y3Rpb24nO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIENvbW1vbiBjb21wb25lbnRzIChDdXN0b21lcnMsIEVtcGxveWVlcywgZXRjKVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnY29tcG9uZW50cy9DdXN0b21lcnMnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9FbXBsb3llZXMnKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnY29tcG9uZW50cy9Db21wYW55U2V0dGluZ3MnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdzaGFyZWQtY29tbW9uJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBQb3J0YWwgYW5kIHB1YmxpYyBjb21wb25lbnRzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL0NsaWVudFBvcnRhbCcpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL1B1YmxpY1FSVmlldycpIHx8XG4gICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdjb21wb25lbnRzL01vZHVsZVNoYXJpbmcnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdzaGFyZWQtcG9ydGFsJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBPdGhlciB2ZW5kb3IgZGVwZW5kZW5jaWVzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvJykpIHtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yLW90aGVyJztcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG5cbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXhjbHVkZTogWydsdWNpZGUtcmVhY3QnXSxcbiAgICBpbmNsdWRlOiBbXG4gICAgICAncXJjb2RlJyxcbiAgICAgICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnLFxuICAgICAgJ3JlYWN0JyxcbiAgICAgICdyZWFjdC1kb20nLFxuICAgICAgJ3JlYWN0LWRvbS9jbGllbnQnLFxuICAgICAgJ3JlYWN0LWRhdGVwaWNrZXInLFxuICAgICAgJ3JlYWN0LXdpbmRvdycsXG4gICAgXSxcbiAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICB9LFxuICB9LFxuXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgcXJjb2RlOiAncXJjb2RlL2xpYi9icm93c2VyLmpzJyxcbiAgICB9LFxuICB9LFxuXG4gIGVzYnVpbGQ6IHtcbiAgICBsZWdhbENvbW1lbnRzOiAnbm9uZScsXG4gICAgdHJlZVNoYWtpbmc6IHRydWUsXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFFQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBRUEsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsY0FBYztBQUFBLElBQ2QsdUJBQXVCO0FBQUEsSUFFdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sU0FBUztBQUFBLFFBQ1QsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFFaEIsY0FBYyxDQUFDLE9BQU87QUFFcEIsY0FBSSxHQUFHLFNBQVMscUJBQXFCLEtBQUssR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQ2hGLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLHVCQUF1QixLQUFLLEdBQUcsU0FBUyxZQUFZLEdBQUc7QUFDckUsbUJBQU87QUFBQSxVQUNUO0FBR0EsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLE9BQU8sS0FBSyxHQUFHLFNBQVMsUUFBUSxHQUFHO0FBQ2pELG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLGtCQUFrQixLQUFLLEdBQUcsU0FBUyxVQUFVLEdBQUc7QUFDOUQsbUJBQU87QUFBQSxVQUNUO0FBR0EsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLHFCQUFxQixLQUNqQyxHQUFHLFNBQVMsNEJBQTRCLEtBQ3hDLEdBQUcsU0FBUyw2QkFBNkIsS0FDekMsR0FBRyxTQUFTLG1DQUFtQyxHQUFHO0FBQ3BELG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLHNCQUFzQixLQUNsQyxHQUFHLFNBQVMsc0JBQXNCLEtBQ2xDLEdBQUcsU0FBUyw4QkFBOEIsS0FDMUMsR0FBRyxTQUFTLHVCQUF1QixHQUFHO0FBQ3hDLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLG1CQUFtQixLQUMvQixHQUFHLFNBQVMsNEJBQTRCLEtBQ3hDLEdBQUcsU0FBUyx5QkFBeUIsS0FDckMsR0FBRyxTQUFTLHdCQUF3QixLQUNwQyxHQUFHLFNBQVMsOEJBQThCLEdBQUc7QUFDL0MsbUJBQU87QUFBQSxVQUNUO0FBR0EsY0FBSSxHQUFHLFNBQVMscUJBQXFCLEtBQ2pDLEdBQUcsU0FBUywwQkFBMEIsS0FDdEMsR0FBRyxTQUFTLHNCQUFzQixLQUNsQyxHQUFHLFNBQVMsd0JBQXdCLEdBQUc7QUFDekMsbUJBQU87QUFBQSxVQUNUO0FBR0EsY0FBSSxHQUFHLFNBQVMsb0JBQW9CLEtBQ2hDLEdBQUcsU0FBUyx5QkFBeUIsS0FDckMsR0FBRyxTQUFTLGtCQUFrQixLQUM5QixHQUFHLFNBQVMsc0JBQXNCLEdBQUc7QUFDdkMsbUJBQU87QUFBQSxVQUNUO0FBR0EsY0FBSSxHQUFHLFNBQVMsd0JBQXdCLEtBQ3BDLEdBQUcsU0FBUyx1QkFBdUIsR0FBRztBQUN4QyxtQkFBTztBQUFBLFVBQ1Q7QUFHQSxjQUFJLEdBQUcsU0FBUyx5QkFBeUIsR0FBRztBQUMxQyxtQkFBTztBQUFBLFVBQ1Q7QUFHQSxjQUFJLEdBQUcsU0FBUyxzQkFBc0IsS0FDbEMsR0FBRyxTQUFTLHNCQUFzQixLQUNsQyxHQUFHLFNBQVMsNEJBQTRCLEdBQUc7QUFDN0MsbUJBQU87QUFBQSxVQUNUO0FBR0EsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEtBQ3JDLEdBQUcsU0FBUyx5QkFBeUIsS0FDckMsR0FBRyxTQUFTLDBCQUEwQixHQUFHO0FBQzNDLG1CQUFPO0FBQUEsVUFDVDtBQUdBLGNBQUksR0FBRyxTQUFTLGVBQWUsR0FBRztBQUNoQyxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLElBQ3hCLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0EsZ0JBQWdCO0FBQUEsTUFDZCxRQUFRO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFBQSxFQUVBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBRUEsU0FBUztBQUFBLElBQ1AsZUFBZTtBQUFBLElBQ2YsYUFBYTtBQUFBLEVBQ2Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
