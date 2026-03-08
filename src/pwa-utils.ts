export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // First, unregister all existing service workers to force fresh install
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const oldVersions = registrations.filter(reg =>
          reg.active && reg.active.scriptURL.includes('sw.js')
        );

        if (oldVersions.length > 0) {
          console.log('Unregistering old service workers...');
          Promise.all(oldVersions.map(reg => reg.unregister())).then(() => {
            // After unregistering, clear all caches
            caches.keys().then((cacheNames) => {
              return Promise.all(
                cacheNames.map((cacheName) => {
                  console.log('Deleting cache:', cacheName);
                  return caches.delete(cacheName);
                })
              );
            }).then(() => {
              // Now register the new service worker
              registerNewServiceWorker();
            });
          });
        } else {
          registerNewServiceWorker();
        }
      });
    });
  }
}

// Global reference to store the update interval ID for cleanup
let updateIntervalId: number | null = null;

function registerNewServiceWorker() {
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      console.log('Service Worker registrado com sucesso:', registration);

      // Clear any existing update interval
      if (updateIntervalId !== null) {
        clearInterval(updateIntervalId);
      }

      // Check for updates every 30 seconds
      updateIntervalId = window.setInterval(() => {
        registration.update();
      }, 30000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Nova versão do Service Worker disponível. Atualizando automaticamente...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              // Auto-reload after 1 second
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
          });
        }
      });
    })
    .catch((error) => {
      console.error('Erro ao registrar Service Worker:', error);
    });
}

// Export cleanup function for proper resource management
export function cleanupServiceWorkerUpdates() {
  if (updateIntervalId !== null) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
}

// Store handlers for cleanup
let beforeInstallPromptHandler: ((e: Event) => void) | null = null;
let appInstalledHandler: (() => void) | null = null;

export function checkInstallability() {
  let deferredPrompt: any = null;

  // Remove existing handlers if any
  if (beforeInstallPromptHandler) {
    window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
  }
  if (appInstalledHandler) {
    window.removeEventListener('appinstalled', appInstalledHandler);
  }

  beforeInstallPromptHandler = (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
      installButton.style.display = 'block';
      installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User response to install prompt: ${outcome}`);
          deferredPrompt = null;
          installButton.style.display = 'none';
        }
      });
    }
  };

  appInstalledHandler = () => {
    console.log('PWA instalado com sucesso!');
    deferredPrompt = null;
  };

  window.addEventListener('beforeinstallprompt', beforeInstallPromptHandler);
  window.addEventListener('appinstalled', appInstalledHandler);
}

export function cleanupInstallability() {
  if (beforeInstallPromptHandler) {
    window.removeEventListener('beforeinstallprompt', beforeInstallPromptHandler);
    beforeInstallPromptHandler = null;
  }
  if (appInstalledHandler) {
    window.removeEventListener('appinstalled', appInstalledHandler);
    appInstalledHandler = null;
  }
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

export function getSharedModules(): string[] {
  const urlParams = new URLSearchParams(window.location.search);
  const sharedModules = urlParams.get('shared_modules');
  return sharedModules ? sharedModules.split(',') : [];
}
