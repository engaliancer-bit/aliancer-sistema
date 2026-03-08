import { useEffect, useRef, useState } from 'react';
import { Smartphone, Wifi, WifiOff, CheckCircle, Download } from 'lucide-react';

export default function PWAStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowStatus(false), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!showStatus && isOnline) return null;

  return (
    <div className="fixed top-20 right-4 z-40 animate-slide-up">
      <div className={`rounded-lg shadow-lg p-4 border-2 ${
        isOnline
          ? 'bg-green-50 border-green-500'
          : 'bg-yellow-50 border-yellow-500'
      }`}>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-600" />
          ) : (
            <WifiOff className="w-5 h-5 text-yellow-600" />
          )}
          <div>
            <div className={`font-semibold text-sm ${
              isOnline ? 'text-green-900' : 'text-yellow-900'
            }`}>
              {isOnline ? 'Conectado' : 'Modo Offline'}
            </div>
            <div className={`text-xs ${
              isOnline ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {isOnline
                ? 'Dados sincronizados'
                : 'Algumas funcionalidades limitadas'
              }
            </div>
          </div>
          {isInstalled && (
            <div className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              App
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
