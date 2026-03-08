import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

interface PaymentStatusCardsProps {
  totalPending: number;
  totalConfirmed: number;
  countPending: number;
  countConfirmed: number;
  period: string;
}

export default function PaymentStatusCards({
  totalPending,
  totalConfirmed,
  countPending,
  countConfirmed,
  period
}: PaymentStatusCardsProps) {
  const totalLaunched = totalPending + totalConfirmed;
  const balance = totalPending;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* A Pagar */}
      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">A Pagar</p>
            <h3 className="text-2xl font-bold text-yellow-900 mt-1">
              {totalPending.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}
            </h3>
          </div>
          <TrendingDown className="h-5 w-5 text-yellow-600" />
        </div>
        <p className="text-xs text-yellow-700 mt-2">
          {countPending} lançamento{countPending !== 1 ? 's' : ''} pendente{countPending !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Pagamentos Efetivados */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Efetivados</p>
            <h3 className="text-2xl font-bold text-green-900 mt-1">
              {totalConfirmed.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}
            </h3>
          </div>
          <TrendingUp className="h-5 w-5 text-green-600" />
        </div>
        <p className="text-xs text-green-700 mt-2">
          {countConfirmed} pagamento{countConfirmed !== 1 ? 's' : ''} confirmado{countConfirmed !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Total Lançado */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total Lançado</p>
            <h3 className="text-2xl font-bold text-blue-900 mt-1">
              {totalLaunched.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}
            </h3>
          </div>
          <DollarSign className="h-5 w-5 text-blue-600" />
        </div>
        <p className="text-xs text-blue-700 mt-2">
          {countPending + countConfirmed} lançamento{countPending + countConfirmed !== 1 ? 's' : ''} no período
        </p>
      </div>
    </div>
  );
}
