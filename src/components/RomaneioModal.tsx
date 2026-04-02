import { useState } from 'react';
import { X, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateRomaneioPDF, RomaneioData, RomaneioItem } from '../lib/romaneioGenerator';

interface RomaneioQuote {
  id: string;
  status: string;
  total_value?: number;
  notes?: string;
  delivery_deadline?: string | null;
  customers?: {
    name: string;
    cpf?: string;
    phone?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
  };
  quote_items?: Array<{
    id?: string;
    item_type: string;
    quantity: number;
    proposed_price: number;
    notes?: string;
    products?: { name: string };
    materials?: { name: string; unit?: string };
    compositions?: { name: string };
    item_name?: string;
  }>;
}

interface RomaneioDelivery {
  id: string;
  delivery_date: string;
  vehicle_info?: string;
  driver_name?: string;
  notes?: string;
  quote_id?: string;
  customer_id?: string;
  customers?: { name: string; cpf?: string; phone?: string; street?: string; neighborhood?: string; city?: string };
  quotes?: RomaneioQuote;
}

interface RomaneioModalProps {
  source: 'quote' | 'delivery';
  quote?: RomaneioQuote;
  delivery?: RomaneioDelivery;
  companySettings: Record<string, string>;
  onClose: () => void;
}

export default function RomaneioModal({ source, quote, delivery, companySettings, onClose }: RomaneioModalProps) {
  const resolvedQuote = source === 'quote' ? quote : delivery?.quotes;
  const resolvedCustomer = resolvedQuote?.customers || delivery?.customers;
  const resolvedDelivery = source === 'delivery' ? delivery : null;

  const [incluirPrecos, setIncluirPrecos] = useState<'sim' | 'nao'>('sim');
  const [driverName, setDriverName] = useState(resolvedDelivery?.driver_name || '');
  const [vehiclePlate, setVehiclePlate] = useState(resolvedDelivery?.vehicle_info || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (resolvedDelivery?.delivery_date) {
      const d = new Date(resolvedDelivery.delivery_date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T08:00`;
  });

  const [frete, setFrete] = useState('0');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const customerName = resolvedCustomer?.name || '';

  const handleGenerate = async () => {
    if (!customerName) {
      setError('Cliente não encontrado. Verifique o orçamento ou entrega.');
      return;
    }

    const items = resolvedQuote?.quote_items;
    if (!items || items.length === 0) {
      setError('Nenhum item encontrado no orçamento/entrega.');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const includeP = incluirPrecos === 'sim';
      const freteVal = parseFloat(frete.replace(',', '.')) || 0;

      const romaneioItems: RomaneioItem[] = items.map((it) => {
        const name =
          it.item_name ||
          it.products?.name ||
          it.materials?.name ||
          it.compositions?.name ||
          'Item';
        const unit = it.materials?.unit || 'un';
        const unitP = it.proposed_price || 0;
        return {
          name,
          quantity: Number(it.quantity),
          unit,
          unit_price: unitP,
          total_price: unitP * Number(it.quantity),
          notes: it.notes,
        };
      });

      const subtotal = romaneioItems.reduce((s, i) => s + i.total_price, 0);
      const totalGeral = subtotal + freteVal;

      const numero = source === 'delivery'
        ? `ENT-${(resolvedDelivery?.id || '').substring(0, 8).toUpperCase()}`
        : `ORC-${(resolvedQuote?.id || '').substring(0, 8).toUpperCase()}`;

      const now = new Date();
      const validade = new Date(now);
      validade.setDate(validade.getDate() + 7);

      const addrParts = [
        resolvedCustomer?.street,
        resolvedCustomer?.neighborhood,
        resolvedCustomer?.city,
      ].filter(Boolean);

      const data: RomaneioData = {
        id: resolvedQuote?.id || resolvedDelivery?.id || '',
        tipo: source,
        numero,
        emissao: now,
        validade,
        cliente: {
          name: customerName,
          cpf_cnpj: resolvedCustomer?.cpf,
          address: addrParts.join(', '),
          phone: resolvedCustomer?.phone,
        },
        entrega: {
          address: deliveryAddress || addrParts.join(', '),
          scheduled_at: scheduledAt ? new Date(scheduledAt) : undefined,
          driver_name: driverName,
          vehicle_plate: vehiclePlate,
        },
        itens: romaneioItems,
        subtotal,
        frete: freteVal,
        total_geral: totalGeral,
        incluirPrecos: includeP,
        empresa: {
          name: companySettings['company_legal_name'] || companySettings['company_name'] || 'Aliancer',
          cnpj: companySettings['company_cnpj'],
          address: [
            companySettings['company_address_street'],
            companySettings['company_address_number'],
            companySettings['company_address_neighborhood'],
            companySettings['company_address_city'],
            companySettings['company_address_state'],
          ].filter(Boolean).join(', '),
          phone: companySettings['company_phone'],
          email: companySettings['company_email'],
          logo_url: companySettings['company_logo_url'],
        },
      };

      const pdfBytes = await generateRomaneioPDF(data);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Download
      const timestamp = Date.now();
      const filename = `romaneio_${numero}_${timestamp}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save to Supabase Storage
      let pathPdf = '';
      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('romaneios')
          .upload(`romaneios/${filename}`, blob, { contentType: 'application/pdf', upsert: true });
        if (!uploadError && uploadData) {
          pathPdf = uploadData.path;
        }
      } catch { /* storage optional */ }

      // Log
      await supabase.from('romaneios_log').insert({
        quote_id: resolvedQuote?.id || null,
        delivery_id: source === 'delivery' ? resolvedDelivery?.id : null,
        customer_name: customerName,
        path_pdf: pathPdf,
        status: 'emitido',
        include_prices: includeP,
        driver_name: driverName || null,
        vehicle_plate: vehiclePlate || null,
        delivery_address: deliveryAddress || null,
        scheduled_delivery_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });

      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (err: any) {
      console.error('Erro ao gerar romaneio:', err);
      setError(err?.message || 'Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Gerar Romaneio PDF</h2>
              <p className="text-sm text-gray-500">
                {source === 'quote' ? 'Orçamento Aprovado' : 'Ordem de Entrega'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Cliente */}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</span>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{customerName || '—'}</p>
          </div>

          {/* Incluir valores */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Incluir valores unitários e totais no PDF?
            </label>
            <div className="flex gap-3">
              {(['sim', 'nao'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setIncluirPrecos(opt)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    incluirPrecos === opt
                      ? opt === 'sim'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-red-50 border-red-400 text-red-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt === 'sim' ? 'Sim, incluir valores' : 'Não incluir valores'}
                </button>
              ))}
            </div>
          </div>

          {/* Dados de entrega */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motorista</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Nome do motorista"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                placeholder="AAA-0000"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data/Hora prevista da entrega</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de destino</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Rua, nº, bairro, cidade (opcional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {incluirPrecos === 'sim' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frete (R$)</label>
              <input
                type="number"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Romaneio gerado e baixado com sucesso!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={generating}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || success || !customerName}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Gerado!
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
