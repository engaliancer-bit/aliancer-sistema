import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response: ${outcome}`);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div className="bg-gradient-to-br from-[#0A7EC2] to-[#0968A8] text-white rounded-xl shadow-2xl p-6 border-2 border-white/20">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="bg-white/20 p-3 rounded-full">
            <Smartphone className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Instalar App</h3>
            <p className="text-sm text-blue-100 mb-4">
              Instale o Sistema Aliancer no seu dispositivo para acesso rápido e experiência completa de aplicativo!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-[#0A7EC2] rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md"
              >
                <Download className="w-5 h-5" />
                Instalar Agora
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                Depois
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/20">
          <ul className="text-xs space-y-1 text-blue-100">
            <li>• Acesso rápido pela tela inicial</li>
            <li>• Funciona offline</li>
            <li>• Atualizações automáticas</li>
            <li>• Sem ocupar espaço em lojas de apps</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
