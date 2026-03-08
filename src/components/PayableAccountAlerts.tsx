import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Calendar, Clock, DollarSign, TrendingDown, Bell } from 'lucide-react';

interface PayableAlert {
  id: string;
  supplier_id: string;
  supplier_name: string;
  description: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  payment_status: string;
  alert_level: 'overdue' | 'due_today' | 'due_soon' | 'normal';
  days_overdue: number;
}

export default function PayableAccountAlerts() {
  const [alerts, setAlerts] = useState<PayableAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 300000);
    return () => clearInterval(interval);
  }, []);

  async function loadAlerts() {
    const { data, error } = await supabase
      .from('payable_accounts_alerts')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error loading alerts:', error);
      return;
    }

    setAlerts(data || []);
    setLoading(false);
  }

  function getAlertStyle(level: string) {
    switch (level) {
      case 'overdue':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'due_today':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'due_soon':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  }

  function getAlertIcon(level: string) {
    switch (level) {
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'due_today':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'due_soon':
        return <Calendar className="h-5 w-5 text-yellow-600" />;
      default:
        return <Bell className="h-5 w-5 text-blue-600" />;
    }
  }

  function getAlertLabel(level: string, daysOverdue: number) {
    switch (level) {
      case 'overdue':
        return `Vencida há ${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'}`;
      case 'due_today':
        return 'Vence hoje';
      case 'due_soon':
        return 'Vence em breve';
      default:
        return 'Normal';
    }
  }

  const totalOverdue = alerts
    .filter(a => a.alert_level === 'overdue')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalDueToday = alerts
    .filter(a => a.alert_level === 'due_today')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalDueSoon = alerts
    .filter(a => a.alert_level === 'due_soon')
    .reduce((sum, a) => sum + Number(a.amount), 0);

  if (loading) {
    return null;
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-full">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-800">Nenhum vencimento próximo</h3>
            <p className="text-sm text-green-600">Todas as contas estão em dia!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-red-100 p-2 rounded-full">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-800 text-lg">Alertas de Vencimento</h3>
            <p className="text-sm text-red-600">
              {alerts.length} {alerts.length === 1 ? 'conta requer' : 'contas requerem'} atenção
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alerts.filter(a => a.alert_level === 'overdue').length > 0 && (
            <div className="bg-white rounded-lg p-3 border-2 border-red-300">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800">Vencidas</span>
              </div>
              <p className="text-2xl font-bold text-red-900">
                {alerts.filter(a => a.alert_level === 'overdue').length}
              </p>
              <p className="text-sm text-red-700">R$ {totalOverdue.toFixed(2)}</p>
            </div>
          )}

          {alerts.filter(a => a.alert_level === 'due_today').length > 0 && (
            <div className="bg-white rounded-lg p-3 border-2 border-orange-300">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-5 w-5 text-orange-600" />
                <span className="font-semibold text-orange-800">Vence Hoje</span>
              </div>
              <p className="text-2xl font-bold text-orange-900">
                {alerts.filter(a => a.alert_level === 'due_today').length}
              </p>
              <p className="text-sm text-orange-700">R$ {totalDueToday.toFixed(2)}</p>
            </div>
          )}

          {alerts.filter(a => a.alert_level === 'due_soon').length > 0 && (
            <div className="bg-white rounded-lg p-3 border-2 border-yellow-300">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-yellow-800">Próximos 7 Dias</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">
                {alerts.filter(a => a.alert_level === 'due_soon').length}
              </p>
              <p className="text-sm text-yellow-700">R$ {totalDueSoon.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-900">Contas Próximas do Vencimento</h4>
        </div>
        <div className="divide-y divide-gray-200">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-l-4 ${getAlertStyle(alert.alert_level)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getAlertIcon(alert.alert_level)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{alert.supplier_name}</span>
                      <span className="text-xs px-2 py-1 bg-white rounded-full">
                        {alert.installment_number}/{alert.total_installments}
                      </span>
                    </div>
                    <p className="text-sm mb-1">{alert.description}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(alert.due_date).toLocaleDateString()}
                      </span>
                      <span className="font-semibold">
                        {getAlertLabel(alert.alert_level, alert.days_overdue)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    R$ {Number(alert.amount).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
