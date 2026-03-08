import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, Calendar, CheckCircle, Clock, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeadlineAlert {
  id: string;
  property_id: string;
  document_type: string;
  document_number: string;
  expiry_date: string;
  renewal_cost: number;
  status: string;
  property_name: string;
  customer_name: string;
  customer_phone: string;
  days_until_expiry: number;
}

export default function DeadlineAlerts() {
  const [alerts, setAlerts] = useState<DeadlineAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);

      const today = new Date();
      const sixtyDaysFromNow = new Date(today);
      sixtyDaysFromNow.setDate(today.getDate() + 60);

      const todayStr = today.toISOString().split('T')[0];
      const sixtyDaysStr = sixtyDaysFromNow.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('document_deadlines')
        .select(`
          *,
          properties!inner (
            id,
            name,
            customer_id,
            customers!inner (
              id,
              name,
              phone
            )
          )
        `)
        .in('status', ['active', 'alert_sent', 'proposal_accepted', 'renewal_in_progress'])
        .gte('expiry_date', todayStr)
        .lte('expiry_date', sixtyDaysStr)
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      const formattedAlerts: DeadlineAlert[] = (data || []).map(item => {
        const property = item.properties;
        const customer = property.customers;
        const expiryDate = new Date(item.expiry_date + 'T00:00:00');
        const daysUntil = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: item.id,
          property_id: property.id,
          document_type: item.document_type,
          document_number: item.document_number,
          expiry_date: item.expiry_date,
          renewal_cost: item.renewal_cost,
          status: item.status,
          property_name: property.name,
          customer_name: customer.name,
          customer_phone: customer.phone,
          days_until_expiry: daysUntil,
        };
      });

      setAlerts(formattedAlerts);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 300000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const getAlertColor = (days: number) => {
    if (days <= 7) return 'bg-red-50 border-red-200';
    if (days <= 15) return 'bg-orange-50 border-orange-200';
    if (days <= 30) return 'bg-yellow-50 border-yellow-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getAlertIcon = (days: number) => {
    if (days <= 7) return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (days <= 15) return <AlertCircle className="w-5 h-5 text-orange-600" />;
    if (days <= 30) return <Calendar className="w-5 h-5 text-yellow-600" />;
    return <Calendar className="w-5 h-5 text-blue-600" />;
  };

  const getStatusInfo = (status: string) => {
    const statusMap = {
      active: { label: 'Aguardando', icon: <Clock className="w-4 h-4" />, color: 'text-gray-600' },
      alert_sent: { label: 'Alerta Enviado', icon: <Bell className="w-4 h-4" />, color: 'text-yellow-600' },
      proposal_accepted: { label: 'Aceito', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600' },
      renewal_in_progress: { label: 'Em Renovação', icon: <Clock className="w-4 h-4" />, color: 'text-purple-600' },
    };
    return statusMap[status] || statusMap.active;
  };

  const urgentAlerts = useMemo(() => alerts.filter(a => a.days_until_expiry <= 30), [alerts]);
  const displayAlerts = useMemo(() => showAll ? alerts : urgentAlerts.slice(0, 5), [showAll, alerts, urgentAlerts]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-center text-gray-500 text-sm">
          Carregando alertas...
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#0A7EC2]" />
          <h3 className="text-lg font-semibold text-gray-900">
            Alertas de Vencimento
          </h3>
          {urgentAlerts.length > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
              {urgentAlerts.length} urgente{urgentAlerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {alerts.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-[#0A7EC2] hover:text-[#0968A8] font-medium"
          >
            {showAll ? 'Ver menos' : `Ver todos (${alerts.length})`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {displayAlerts.map((alert) => {
          const statusInfo = getStatusInfo(alert.status);
          const docTypeLabel = {
            ccir: 'CCIR',
            itr: 'ITR',
            cib: 'CIB',
            car: 'CAR',
          }[alert.document_type] || alert.document_type.toUpperCase();

          return (
            <div
              key={alert.id}
              className={`border rounded-lg p-3 ${getAlertColor(alert.days_until_expiry)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getAlertIcon(alert.days_until_expiry)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {alert.property_name}
                    </h4>
                    <span className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mb-1">
                    Cliente: {alert.customer_name}
                    {alert.customer_phone && ` • ${alert.customer_phone}`}
                  </p>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-medium text-gray-700">
                      {docTypeLabel} {alert.document_number && `• ${alert.document_number}`}
                    </span>
                    <span className={`font-semibold ${
                      alert.days_until_expiry <= 7 ? 'text-red-600' :
                      alert.days_until_expiry <= 15 ? 'text-orange-600' :
                      alert.days_until_expiry <= 30 ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      Vence em {alert.days_until_expiry} dia{alert.days_until_expiry !== 1 ? 's' : ''}
                    </span>
                    {alert.renewal_cost > 0 && (
                      <span className="text-gray-600">
                        R$ {alert.renewal_cost.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Sistema de monitoramento automático ativo
          </p>
        </div>
      )}
    </div>
  );
}
