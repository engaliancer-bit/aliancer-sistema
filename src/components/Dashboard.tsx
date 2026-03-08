import React, { useState, useEffect } from 'react';
import { Truck, AlertCircle } from 'lucide-react';
import DeadlineAlerts from './DeadlineAlerts';
import AnnualTargets from './AnnualTargets';

export default function Dashboard() {
  const [hasOpenDelivery, setHasOpenDelivery] = useState(false);

  useEffect(() => {
    const check = () => {
      const openDelivery = localStorage.getItem('openDelivery');
      setHasOpenDelivery(!!openDelivery);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {hasOpenDelivery && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Truck className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-bold text-yellow-900">Carga em Aberto!</h3>
              </div>
              <p className="text-yellow-800 mb-3">
                Existe uma entrega em andamento. Continue o carregamento para não perder as informações dos itens já adicionados ao caminhão.
              </p>
              <a
                href="#entregas"
                className="inline-flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Truck className="h-4 w-4" />
                Ir para Entregas
              </a>
            </div>
          </div>
        </div>
      )}

      <DeadlineAlerts />
      <AnnualTargets />
    </div>
  );
}
