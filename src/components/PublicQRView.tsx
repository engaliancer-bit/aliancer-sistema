import { useEffect, useState, useCallback } from 'react';
import {
  Package, CheckCircle, Clock, AlertCircle, ChevronRight,
  Layers, Thermometer, ClipboardCheck, Truck, Hammer, Printer, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BipStage {
  id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  description?: string;
  bip_number?: number;
  requires_data?: boolean;
  min_cure_hours?: number;
}

interface TrackingStage {
  id: string;
  stage_id: string;
  completed_at: string;
  completed_by: string;
  notes?: string;
  production_stages?: BipStage;
  production_piece_bip_data?: {
    recipe_id?: string;
    corpo_de_prova_number?: string;
    ambient_temperature?: number;
    cement_supplier?: string;
    checklist_dimensions_ok?: boolean;
    checklist_finish_ok?: boolean;
    checklist_inserts_ok?: boolean;
    inspector_name?: string;
    truck_plate?: string;
    driver_name?: string;
    romaneio_number?: string;
    foundation_reference?: string;
    installer_name?: string;
    recipes?: { name: string };
  }[];
}

interface TrackingData {
  id: string;
  qr_token: string;
  sub_order_id?: string;
  production_order_id?: string;
  product_id?: string;
  recipe_name?: string;
  quantity?: number;
  additional_notes?: string;
  created_at: string;
  updated_at?: string;
  products?: { name: string; unit: string; enable_stage_tracking?: boolean };
  production_tracking_stages?: TrackingStage[];
}

interface SubOrderData {
  id: string;
  sequence_number: number;
  total_in_item: number;
  qr_token: string;
  status: string;
  production_order_id: string;
  production_order_item_id: string;
  production_orders?: {
    order_number: number;
    customers?: { name: string };
    products?: { name: string; unit: string };
  };
  production_order_items?: {
    quantity: number;
    products?: { name: string; unit: string };
    materials?: { name: string; unit: string };
  };
}

interface Recipe {
  id: string;
  name: string;
  concrete_type?: string;
}

interface BipFormData {
  responsible_name: string;
  notes: string;
  recipe_id: string;
  corpo_de_prova_number: string;
  ambient_temperature: string;
  cement_supplier: string;
  checklist_dimensions_ok: boolean;
  checklist_finish_ok: boolean;
  checklist_inserts_ok: boolean;
  inspector_name: string;
  truck_plate: string;
  driver_name: string;
  romaneio_number: string;
  foundation_reference: string;
  installer_name: string;
}

const BIP_COLORS: Record<number, { bg: string; text: string; border: string; badge: string }> = {
  0: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300', badge: 'bg-gray-100 text-gray-700' },
  1: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-800' },
  2: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-800' },
  3: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-800' },
  4: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300', badge: 'bg-green-100 text-green-800' },
  5: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-300', badge: 'bg-cyan-100 text-cyan-800' },
  6: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-800' },
};

const STATUS_MAP: Record<string, string> = {
  pending: 'Pendente',
  in_production: 'Em Producao',
  produced: 'Produzida',
  shipped: 'Expedida',
  installed: 'Instalada',
};

export default function PublicQRView({ token }: { token: string }) {
  const [subOrder, setSubOrder] = useState<SubOrderData | null>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [bipStages, setBipStages] = useState<BipStage[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [showBipForm, setShowBipForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cureWarning, setCureWarning] = useState<string | null>(null);

  const [formData, setFormData] = useState<BipFormData>({
    responsible_name: '',
    notes: '',
    recipe_id: '',
    corpo_de_prova_number: '',
    ambient_temperature: '',
    cement_supplier: '',
    checklist_dimensions_ok: false,
    checklist_finish_ok: false,
    checklist_inserts_ok: false,
    inspector_name: '',
    truck_plate: '',
    driver_name: '',
    romaneio_number: '',
    foundation_reference: '',
    installer_name: '',
  });

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subOrderResult, stagessResult, recipesResult] = await Promise.all([
        supabase
          .from('production_sub_orders')
          .select(`
            *,
            production_orders(order_number, customers(name), products(name, unit)),
            production_order_items(quantity, products(name, unit), materials(name, unit))
          `)
          .eq('qr_token', token)
          .maybeSingle(),
        supabase.from('production_stages').select('*').order('stage_order'),
        supabase.from('recipes').select('id, name, concrete_type').order('name'),
      ]);

      if (subOrderResult.data) {
        setSubOrder(subOrderResult.data);
        setBipStages(stagessResult.data || []);
        setRecipes(recipesResult.data || []);

        const { data: trackingData } = await supabase
          .from('product_tracking')
          .select(`
            *,
            products(name, unit, enable_stage_tracking),
            production_tracking_stages(
              id, stage_id, completed_at, completed_by, notes,
              production_stages(id, stage_key, stage_name, stage_order, bip_number, requires_data, min_cure_hours, description),
              production_piece_bip_data(
                recipe_id, corpo_de_prova_number, ambient_temperature, cement_supplier,
                checklist_dimensions_ok, checklist_finish_ok, checklist_inserts_ok, inspector_name,
                truck_plate, driver_name, romaneio_number, foundation_reference, installer_name,
                recipes(name)
              )
            )
          `)
          .eq('sub_order_id', subOrderResult.data.id)
          .maybeSingle();

        if (trackingData) {
          setTracking(trackingData);
        }
        return;
      }

      const { data: trackingData, error: trackErr } = await supabase
        .from('product_tracking')
        .select(`
          *,
          products(name, unit, enable_stage_tracking),
          production_tracking_stages(
            id, stage_id, completed_at, completed_by, notes,
            production_stages(id, stage_key, stage_name, stage_order, bip_number, requires_data, min_cure_hours, description),
            production_piece_bip_data(
              recipe_id, corpo_de_prova_number, ambient_temperature, cement_supplier,
              checklist_dimensions_ok, checklist_finish_ok, checklist_inserts_ok, inspector_name,
              truck_plate, driver_name, romaneio_number, foundation_reference, installer_name,
              recipes(name)
            )
          )
        `)
        .eq('qr_token', token)
        .maybeSingle();

      if (trackErr) throw trackErr;

      if (!trackingData) {
        setError('QR Code nao encontrado. Verifique se a etiqueta esta correta.');
        return;
      }

      setTracking(trackingData);
      setBipStages(stagessResult.data || []);
      setRecipes(recipesResult.data || []);
    } catch (err) {
      console.error('Erro ao carregar:', err);
      setError('Erro ao carregar informacoes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getCompletedBips = useCallback(() => {
    const stages = tracking?.production_tracking_stages || [];
    return stages
      .map(s => s.production_stages?.bip_number)
      .filter((n): n is number => n !== undefined && n !== null);
  }, [tracking]);

  const getNextBip = useCallback(() => {
    const completed = getCompletedBips();
    for (let i = 0; i <= 6; i++) {
      if (!completed.includes(i)) return i;
    }
    return null;
  }, [getCompletedBips]);

  const getNextStage = useCallback((): BipStage | null => {
    const nextBip = getNextBip();
    if (nextBip === null) return null;
    return bipStages.find(s => s.bip_number === nextBip) || null;
  }, [getNextBip, bipStages]);

  const checkCureTime = useCallback((): string | null => {
    const nextStage = getNextStage();
    if (!nextStage?.min_cure_hours) return null;

    const bip2Stage = tracking?.production_tracking_stages?.find(
      s => s.production_stages?.bip_number === 2
    );
    if (!bip2Stage) return null;

    const concreteTime = new Date(bip2Stage.completed_at).getTime();
    const now = Date.now();
    const hoursElapsed = (now - concreteTime) / (1000 * 60 * 60);
    const required = nextStage.min_cure_hours;

    if (hoursElapsed < required) {
      const remaining = required - hoursElapsed;
      return `Atencao: O tempo minimo de cura e de ${required}h. Apenas ${hoursElapsed.toFixed(1)}h se passaram desde a concretagem. Faltam ${remaining.toFixed(1)}h. Deseja registrar mesmo assim?`;
    }
    return null;
  }, [getNextStage, tracking]);

  const handleOpenBipForm = () => {
    const warning = checkCureTime();
    if (warning) {
      setCureWarning(warning);
    }
    setShowBipForm(true);
    setFormData({
      responsible_name: '',
      notes: '',
      recipe_id: '',
      corpo_de_prova_number: '',
      ambient_temperature: '',
      cement_supplier: '',
      checklist_dimensions_ok: false,
      checklist_finish_ok: false,
      checklist_inserts_ok: false,
      inspector_name: '',
      truck_plate: '',
      driver_name: '',
      romaneio_number: '',
      foundation_reference: '',
      installer_name: '',
    });
  };

  const handleRegisterBip = async () => {
    const nextStage = getNextStage();
    if (!nextStage) return;
    const nextBip = getNextBip()!;

    if (!formData.responsible_name.trim()) {
      alert('Informe o nome do responsavel.');
      return;
    }

    if (nextBip === 2 && !formData.recipe_id) {
      alert('Selecione o traco utilizado na concretagem.');
      return;
    }

    if (nextBip === 4 && !formData.inspector_name.trim()) {
      alert('Informe o nome do inspetor.');
      return;
    }

    setRegistering(true);
    try {
      let trackingId = tracking?.id;

      if (!trackingId) {
        const productName = subOrder?.production_order_items?.products?.name
          || subOrder?.production_orders?.products?.name
          || 'Peca';
        const recipeName = formData.recipe_id
          ? recipes.find(r => r.id === formData.recipe_id)?.name || 'Traco'
          : 'N/A';

        const { data: newTracking, error: tErr } = await supabase
          .from('product_tracking')
          .insert({
            qr_token: token,
            sub_order_id: subOrder?.id,
            production_order_id: subOrder?.production_order_id,
            product_id: null,
            recipe_name: recipeName,
            quantity: 1,
          })
          .select()
          .single();

        if (tErr) throw tErr;
        trackingId = newTracking.id;
      }

      const { data: newStage, error: stageErr } = await supabase
        .from('production_tracking_stages')
        .insert({
          tracking_id: trackingId,
          stage_id: nextStage.id,
          completed_at: new Date().toISOString(),
          completed_by: formData.responsible_name,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (stageErr) throw stageErr;

      const hasBipData = nextBip === 2 || nextBip === 4 || nextBip === 5 || nextBip === 6;
      if (hasBipData) {
        const bipData: Record<string, any> = {
          tracking_stage_id: newStage.id,
          sub_order_id: subOrder?.id || null,
          bip_number: nextBip,
          responsible_name: formData.responsible_name,
          notes: formData.notes || null,
        };

        if (nextBip === 2) {
          bipData.recipe_id = formData.recipe_id || null;
          bipData.corpo_de_prova_number = formData.corpo_de_prova_number || null;
          bipData.ambient_temperature = formData.ambient_temperature ? parseFloat(formData.ambient_temperature) : null;
          bipData.cement_supplier = formData.cement_supplier || null;
        } else if (nextBip === 4) {
          bipData.checklist_dimensions_ok = formData.checklist_dimensions_ok;
          bipData.checklist_finish_ok = formData.checklist_finish_ok;
          bipData.checklist_inserts_ok = formData.checklist_inserts_ok;
          bipData.inspector_name = formData.inspector_name;
        } else if (nextBip === 5) {
          bipData.truck_plate = formData.truck_plate || null;
          bipData.driver_name = formData.driver_name || null;
          bipData.romaneio_number = formData.romaneio_number || null;
        } else if (nextBip === 6) {
          bipData.foundation_reference = formData.foundation_reference || null;
          bipData.installer_name = formData.installer_name || null;
        }

        await supabase.from('production_piece_bip_data').insert(bipData);
      }

      const newStatus = nextBip === 0 ? 'pending'
        : nextBip === 1 ? 'in_production'
        : nextBip >= 2 && nextBip <= 4 ? 'produced'
        : nextBip === 5 ? 'shipped'
        : 'installed';

      if (subOrder?.id) {
        await supabase
          .from('production_sub_orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', subOrder.id);
      }

      setShowBipForm(false);
      setCureWarning(null);
      setSuccessMessage(`BIP ${nextBip} registrado com sucesso! ${nextStage.stage_name} concluido.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      await loadData();
    } catch (err: any) {
      alert('Erro ao registrar BIP: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm">Carregando informacoes da peca...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">QR Code nao encontrado</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const completedBips = getCompletedBips();
  const nextBip = getNextBip();
  const nextStage = getNextStage();
  const allDone = nextBip === null;
  const productName = subOrder?.production_order_items?.products?.name
    || subOrder?.production_order_items?.materials?.name
    || subOrder?.production_orders?.products?.name
    || tracking?.products?.name
    || 'Peca';
  const orderNumber = subOrder?.production_orders?.order_number;
  const customerName = subOrder?.production_orders?.customers?.name;
  const pieceNumber = subOrder ? `${subOrder.sequence_number}/${subOrder.total_in_item}` : null;
  const currentStatus = subOrder?.status || 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-5 text-white">
            <div className="flex items-center gap-3 mb-1">
              <Package className="w-6 h-6 opacity-80" />
              <span className="text-sm font-medium opacity-80">Rastreamento de Peca</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight">{productName}</h1>
            {pieceNumber && (
              <div className="mt-1 text-blue-100 text-sm font-medium">
                Peca {pieceNumber}
                {orderNumber && <span className="ml-2 opacity-70">OP #{orderNumber}</span>}
              </div>
            )}
            {customerName && (
              <div className="mt-0.5 text-blue-100 text-xs opacity-80">{customerName}</div>
            )}
          </div>

          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Status atual</div>
              <div className={`text-sm font-semibold ${
                currentStatus === 'installed' ? 'text-emerald-600'
                : currentStatus === 'shipped' ? 'text-cyan-600'
                : currentStatus === 'produced' ? 'text-green-600'
                : currentStatus === 'in_production' ? 'text-amber-600'
                : 'text-gray-600'
              }`}>
                {STATUS_MAP[currentStatus] || currentStatus}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 mb-0.5">BIPs concluidos</div>
              <div className="text-sm font-bold text-gray-700">
                {completedBips.length}/7
              </div>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700 text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {!allDone && nextStage && !showBipForm && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className={`px-5 py-4 ${BIP_COLORS[nextBip!]?.bg || 'bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Proxima etapa</div>
                  <div className={`text-lg font-bold ${BIP_COLORS[nextBip!]?.text || 'text-gray-800'}`}>
                    BIP {nextBip} — {nextStage.stage_name}
                  </div>
                  {nextStage.description && (
                    <div className="text-sm text-gray-500 mt-1">{nextStage.description}</div>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold ${BIP_COLORS[nextBip!]?.border} ${BIP_COLORS[nextBip!]?.badge}`}>
                  {nextBip}
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 pt-3">
              <button
                onClick={handleOpenBipForm}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
              >
                <ChevronRight className="w-5 h-5" />
                Registrar BIP {nextBip}
              </button>
            </div>
          </div>
        )}

        {allDone && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <div className="text-lg font-bold text-emerald-800">Todos os BIPs concluidos!</div>
            <div className="text-sm text-emerald-600 mt-1">Esta peca completou todo o ciclo de rastreamento.</div>
          </div>
        )}

        {showBipForm && nextStage && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className={`px-5 py-4 ${BIP_COLORS[nextBip!]?.bg || 'bg-gray-50'} border-b border-gray-100`}>
              <div className="font-bold text-gray-800">BIP {nextBip} — {nextStage.stage_name}</div>
              <div className="text-xs text-gray-500 mt-0.5">Preencha as informacoes abaixo</div>
            </div>

            <div className="p-5 space-y-4">
              {cureWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                  <div className="font-semibold mb-1">Aviso de Cura</div>
                  {cureWarning}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome do Responsavel *</label>
                <input
                  type="text"
                  value={formData.responsible_name}
                  onChange={e => setFormData(p => ({ ...p, responsible_name: e.target.value }))}
                  placeholder="Seu nome completo"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                />
              </div>

              {nextBip === 2 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <Layers className="w-3.5 h-3.5 inline mr-1" />
                      Traco Utilizado *
                    </label>
                    <select
                      value={formData.recipe_id}
                      onChange={e => setFormData(p => ({ ...p, recipe_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none bg-white"
                    >
                      <option value="">Selecione o traco...</option>
                      {recipes.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Numero do CP</label>
                      <input
                        type="text"
                        value={formData.corpo_de_prova_number}
                        onChange={e => setFormData(p => ({ ...p, corpo_de_prova_number: e.target.value }))}
                        placeholder="Ex: 042"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        <Thermometer className="w-3.5 h-3.5 inline mr-1" />
                        Temperatura (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.ambient_temperature}
                        onChange={e => setFormData(p => ({ ...p, ambient_temperature: e.target.value }))}
                        placeholder="Ex: 28.5"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fornecedor do Cimento</label>
                    <input
                      type="text"
                      value={formData.cement_supplier}
                      onChange={e => setFormData(p => ({ ...p, cement_supplier: e.target.value }))}
                      placeholder="Ex: Cimento Itambe"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>
                </>
              )}

              {nextBip === 4 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <ClipboardCheck className="w-3.5 h-3.5 inline mr-1" />
                      Checklist de Inspecao
                    </label>
                    <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
                      {[
                        { key: 'checklist_dimensions_ok', label: 'Dimensoes conferidas e dentro do tolerado' },
                        { key: 'checklist_finish_ok', label: 'Acabamento superficial aprovado' },
                        { key: 'checklist_inserts_ok', label: 'Integridade dos insertos metalicos OK' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData[key as keyof BipFormData] as boolean}
                            onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
                            className="w-5 h-5 rounded accent-green-600"
                          />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome do Inspetor/Engenheiro *</label>
                    <input
                      type="text"
                      value={formData.inspector_name}
                      onChange={e => setFormData(p => ({ ...p, inspector_name: e.target.value }))}
                      placeholder="Nome do responsavel pela inspecao"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>
                </>
              )}

              {nextBip === 5 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <Truck className="w-3.5 h-3.5 inline mr-1" />
                      Placa do Veiculo
                    </label>
                    <input
                      type="text"
                      value={formData.truck_plate}
                      onChange={e => setFormData(p => ({ ...p, truck_plate: e.target.value.toUpperCase() }))}
                      placeholder="Ex: ABC-1234"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome do Motorista</label>
                    <input
                      type="text"
                      value={formData.driver_name}
                      onChange={e => setFormData(p => ({ ...p, driver_name: e.target.value }))}
                      placeholder="Nome do motorista"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Numero do Romaneio</label>
                    <input
                      type="text"
                      value={formData.romaneio_number}
                      onChange={e => setFormData(p => ({ ...p, romaneio_number: e.target.value }))}
                      placeholder="Ex: ROM-2026-001"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>
                </>
              )}

              {nextBip === 6 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <Hammer className="w-3.5 h-3.5 inline mr-1" />
                      Referencia da Fundacao / Calice
                    </label>
                    <input
                      type="text"
                      value={formData.foundation_reference}
                      onChange={e => setFormData(p => ({ ...p, foundation_reference: e.target.value }))}
                      placeholder="Ex: Calice P1, Fundacao F3"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nome do Instalador</label>
                    <input
                      type="text"
                      value={formData.installer_name}
                      onChange={e => setFormData(p => ({ ...p, installer_name: e.target.value }))}
                      placeholder="Responsavel pela montagem"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observacoes (opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Observacoes sobre esta etapa..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowBipForm(false); setCureWarning(null); }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterBip}
                  disabled={registering}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirmar BIP {nextBip}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="font-semibold text-gray-800 text-sm">Historico de Rastreamento</div>
          </div>
          <div className="p-5 space-y-2">
            {bipStages.map((stage) => {
              const bip = stage.bip_number ?? stage.stage_order - 1;
              const completedStage = tracking?.production_tracking_stages?.find(
                s => s.stage_id === stage.id || s.production_stages?.stage_key === stage.stage_key
              );
              const isCompleted = !!completedStage;
              const bipData = completedStage?.production_piece_bip_data?.[0];
              const colors = BIP_COLORS[bip] || BIP_COLORS[0];

              return (
                <div
                  key={stage.id}
                  className={`rounded-xl border p-3 transition-all ${
                    isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isCompleted ? 'bg-green-500 text-white border-green-500' : `${colors.badge} ${colors.border}`
                    }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : bip}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800">{stage.stage_name}</span>
                        {isCompleted && completedStage ? (
                          <span className="text-xs text-green-600 flex-shrink-0">
                            {new Date(completedStage.completed_at).toLocaleDateString('pt-BR')} {new Date(completedStage.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </div>
                      {isCompleted && completedStage && (
                        <div className="text-xs text-green-700 mt-0.5">
                          {completedStage.completed_by}
                          {bipData?.recipes?.name && <span className="ml-2 text-blue-600">Traco: {bipData.recipes.name}</span>}
                          {bipData?.truck_plate && <span className="ml-2">Placa: {bipData.truck_plate}</span>}
                          {bipData?.inspector_name && <span className="ml-2">Inspetor: {bipData.inspector_name}</span>}
                          {bipData?.installer_name && <span className="ml-2">Instalador: {bipData.installer_name}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {bipStages.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma etapa de rastreamento configurada
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 pb-4">
          <FileText className="w-4 h-4 inline mr-1 opacity-50" />
          Sistema de Rastreamento de Producao — Aliancer
        </div>
      </div>
    </div>
  );
}
