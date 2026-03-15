import { useState, useEffect, useCallback } from 'react';
import {
  X, Package, Layers, Ruler, Scale, QrCode, Printer, History,
  Plus, AlertCircle, CheckCircle, Clock, Truck, Hammer, RotateCcw,
  ChevronRight, Eye, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import QRCode from 'qrcode';

interface ProductionOrderItem {
  id: string;
  production_order_id: string;
  item_type: 'product' | 'material' | 'composition';
  product_id?: string;
  material_id?: string;
  composition_id?: string;
  quantity: number;
  produced_quantity: number;
  unit_price: number;
  notes?: string;
  products?: { name: string; unit: string };
  materials?: { name: string; unit: string };
  compositions?: { name: string };
}

interface ProductionOrder {
  id: string;
  order_number: number;
  quote_id?: string;
  customer_id: string | null;
  product_id: string;
  total_quantity: number;
  produced_quantity: number;
  remaining_quantity: number;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  deadline?: string | null;
  created_at: string;
  customers?: { name: string; person_type: 'pf' | 'pj' } | null;
  products?: { name: string; unit: string };
}

interface Reinforcement {
  id: string;
  reinforcement_type: string;
  material_id?: string;
  bar_count: number;
  bar_length_meters: number;
  bar_diameter_mm: number;
  total_length_meters?: number;
  description?: string;
  notes?: string;
  reinforcement_location?: string;
  identifier?: string;
  longitudinal_position?: string;
  materials?: { name: string; unit: string };
}

interface RecipeItem {
  id: string;
  material_id: string;
  quantity: number;
  materials?: { name: string; unit: string; unit_cost?: number };
}

interface Recipe {
  id: string;
  name: string;
  concrete_type?: string;
  specific_weight?: number;
  moisture_percentage?: number;
}

interface ProductDetail {
  id: string;
  name: string;
  unit: string;
  description?: string;
  total_weight?: number;
  recipe_id?: string;
  has_flange?: boolean;
  flange_length_meters?: number;
  flange_volume_m3?: number;
  reference_volume?: number;
  enable_stage_tracking?: boolean;
  recipes?: Recipe;
}

interface MoldDetail {
  id: string;
  name: string;
  section_width_meters?: number;
  section_height_meters?: number;
  reference_measurement_meters?: number;
  reference_volume_m3?: number;
  has_flange?: boolean;
  flange_section_width_cm?: number;
  flange_section_height_cm?: number;
}

interface SubOrder {
  id: string;
  sequence_number: number;
  total_in_item: number;
  qr_token: string;
  status: 'pending' | 'in_production' | 'produced' | 'shipped' | 'installed';
  produced_at?: string;
  notes?: string;
  qrCodeUrl?: string;
}

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

interface TrackingStageRecord {
  id: string;
  tracking_id: string;
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
    responsible_name?: string;
    recipes?: { name: string };
  }[];
}

interface TrackingRecord {
  id: string;
  qr_token: string;
  sub_order_id?: string;
  production_date?: string;
  recipe_name?: string;
  quantity?: number;
  additional_notes?: string;
  created_at: string;
  production_tracking_stages?: TrackingStageRecord[];
}

interface Props {
  item: ProductionOrderItem;
  order: ProductionOrder;
  onClose: () => void;
  onGenerateLabel: (order: ProductionOrder, item: ProductionOrderItem, subOrder?: SubOrder) => void;
  onRefresh: () => void;
}

const REINFORCEMENT_TYPE_LABEL: Record<string, string> = {
  longitudinal: 'Longitudinal',
  transversal: 'Transversal',
  lifting: 'Gancho de Icamento',
  threaded_bar_hook: 'Barra Roscada / Gancho',
};

const SUB_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  in_production: 'Em Producao',
  produced: 'Produzida',
  shipped: 'Expedida',
  installed: 'Instalada',
};

const SUB_STATUS_STYLE: Record<string, string> = {
  pending: 'text-gray-600 bg-gray-50 border-gray-200',
  in_production: 'text-amber-700 bg-amber-50 border-amber-200',
  produced: 'text-green-700 bg-green-50 border-green-200',
  shipped: 'text-blue-700 bg-blue-50 border-blue-200',
  installed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

const BIP_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700 border-gray-300',
  1: 'bg-amber-100 text-amber-800 border-amber-300',
  2: 'bg-blue-100 text-blue-800 border-blue-300',
  3: 'bg-orange-100 text-orange-800 border-orange-300',
  4: 'bg-green-100 text-green-800 border-green-300',
  5: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  6: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

export default function ProductionItemDetail({ item, order, onClose, onGenerateLabel, onRefresh }: Props) {
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [mold, setMold] = useState<MoldDetail | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [reinforcements, setReinforcements] = useState<Reinforcement[]>([]);
  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[]>([]);
  const [bipStages, setBipStages] = useState<BipStage[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSubOrders, setGeneratingSubOrders] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('suborders');

  const itemName = item.products?.name || item.materials?.name || item.compositions?.name || 'Item';
  const itemUnit = item.products?.unit || item.materials?.unit || 'un';
  const progress = item.quantity === 0 ? 0 : Math.round((item.produced_quantity / item.quantity) * 100);

  useEffect(() => {
    loadAll();
  }, [item.id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        item.product_id ? loadProduct(item.product_id) : Promise.resolve(),
        loadSubOrders(),
        loadTrackingRecords(),
        loadBipStages(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadBipStages = async () => {
    const { data } = await supabase
      .from('production_stages')
      .select('*')
      .order('stage_order');
    setBipStages(data || []);
  };

  const loadProduct = async (productId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*, reference_volume, recipes(id, name, concrete_type, specific_weight, moisture_percentage)')
      .eq('id', productId)
      .maybeSingle();

    if (!data) return;
    setProductDetail(data);

    if (data.recipes) {
      setRecipe(data.recipes);
      const { data: rItems } = await supabase
        .from('recipe_items')
        .select('*, materials(name, unit, unit_cost)')
        .eq('recipe_id', data.recipes.id);
      setRecipeItems(rItems || []);
    }

    const { data: reinforcementsData } = await supabase
      .from('product_reinforcements')
      .select('*, materials(name, unit)')
      .eq('product_id', productId)
      .order('reinforcement_type');
    setReinforcements(reinforcementsData || []);

    const { data: moldsData } = await supabase
      .from('molds')
      .select('id, name, section_width_meters, section_height_meters, reference_measurement_meters, reference_volume_m3, has_flange, flange_section_width_cm, flange_section_height_cm')
      .eq('product_id', productId)
      .maybeSingle();
    if (moldsData) setMold(moldsData);
  };

  const loadSubOrders = async () => {
    const { data } = await supabase
      .from('production_sub_orders')
      .select('*')
      .eq('production_order_item_id', item.id)
      .order('sequence_number');

    if (!data || data.length === 0) { setSubOrders([]); return; }

    const withQR = await Promise.all(data.map(async (so) => {
      try {
        const url = `${window.location.origin}/track/${so.qr_token}`;
        const qrCodeUrl = await QRCode.toDataURL(url, { width: 160, margin: 1 });
        return { ...so, qrCodeUrl };
      } catch {
        return so;
      }
    }));
    setSubOrders(withQR);
    if (withQR.length > 0 && !selectedPiece) {
      setSelectedPiece(withQR[0].id);
    }
  };

  const loadTrackingRecords = async () => {
    const { data } = await supabase
      .from('product_tracking')
      .select(`
        *,
        production_tracking_stages(
          id, tracking_id, stage_id, completed_at, completed_by, notes,
          production_stages(id, stage_key, stage_name, stage_order, bip_number, requires_data, min_cure_hours, description),
          production_piece_bip_data(
            recipe_id, corpo_de_prova_number, ambient_temperature, cement_supplier,
            checklist_dimensions_ok, checklist_finish_ok, checklist_inserts_ok, inspector_name,
            truck_plate, driver_name, romaneio_number,
            foundation_reference, installer_name, responsible_name,
            recipes(name)
          )
        )
      `)
      .eq('production_order_id', order.id)
      .order('created_at', { ascending: false });
    setTrackingRecords(data || []);
  };

  const handleGenerateSubOrders = async () => {
    const totalPieces = Math.max(1, Math.round(parseFloat(String(item.quantity)) || 1));
    if (!confirm(`Gerar ${totalPieces} sub-ordens com QR codes individuais para esta peca?`)) return;
    setGeneratingSubOrders(true);
    try {
      const { data: existing } = await supabase
        .from('production_sub_orders')
        .select('id')
        .eq('production_order_item_id', item.id);

      if (existing && existing.length > 0) {
        const { error: delError } = await supabase
          .from('production_sub_orders')
          .delete()
          .eq('production_order_item_id', item.id);
        if (delError) throw delError;
      }

      const pieceCount = Math.max(1, Math.round(parseFloat(String(item.quantity)) || 1));
      const toInsert = Array.from({ length: pieceCount }, (_, i) => ({
        production_order_id: order.id,
        production_order_item_id: item.id,
        sequence_number: i + 1,
        total_in_item: pieceCount,
        qr_token: `${crypto.randomUUID()}-${Date.now()}-${i}`,
        status: 'pending',
      }));

      const { error } = await supabase.from('production_sub_orders').insert(toInsert);
      if (error) throw error;

      await loadSubOrders();
    } catch (err: any) {
      alert('Erro ao gerar sub-ordens: ' + err.message);
    } finally {
      setGeneratingSubOrders(false);
    }
  };

  const handlePrintAllQR = useCallback(async () => {
    if (subOrders.length === 0) return;
    const customerName = order.customers?.name || 'Estoque';
    const recipeName = recipe?.name || 'Traco nao especificado';
    const dims: string[] = [];
    if (mold?.section_width_meters) dims.push(`${(mold.section_width_meters * 100).toFixed(0)}x${(mold.section_height_meters || 0) * 100 > 0 ? ((mold.section_height_meters || 0) * 100).toFixed(0) : '?'} cm`);
    if (mold?.reference_measurement_meters) dims.push(`L=${mold.reference_measurement_meters.toFixed(2)}m`);
    const dimStr = dims.join(' ');

    const cells = await Promise.all(subOrders.map(async (so) => {
      const url = `${window.location.origin}/track/${so.qr_token}`;
      const qrUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
      return `
        <div class="label">
          <div class="product-name">${itemName}</div>
          ${dimStr ? `<div class="info-row">${dimStr}</div>` : ''}
          <div class="info-row">OP #${order.order_number} &mdash; Peca ${so.sequence_number}/${so.total_in_item}</div>
          <div class="info-row">${customerName}</div>
          <div class="info-row traco">${recipeName}</div>
          <img src="${qrUrl}" class="qr" />
        </div>
      `;
    }));

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: 5cm 8cm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; }
      .label { width: 5cm; height: 8cm; padding: 0.2cm; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; border: 1px solid #ccc; }
      .product-name { font-size: 7pt; font-weight: bold; text-align: center; margin-bottom: 0.1cm; }
      .info-row { font-size: 5.5pt; text-align: center; color: #333; margin-bottom: 0.05cm; }
      .traco { color: #1a5fa8; font-weight: bold; }
      .qr { width: 2.4cm; height: 2.4cm; margin-top: auto; }
    </style></head><body>${cells.join('')}</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => { URL.revokeObjectURL(url); win.print(); });
    } else {
      URL.revokeObjectURL(url);
      alert('Habilite pop-ups para imprimir as etiquetas');
    }
  }, [subOrders, itemName, order, recipe, mold]);

  const handlePrintSingleQR = useCallback(async (so: SubOrder) => {
    const customerName = order.customers?.name || 'Estoque';
    const recipeName = recipe?.name || 'Traco nao especificado';
    const dims: string[] = [];
    if (mold?.section_width_meters) dims.push(`${(mold.section_width_meters * 100).toFixed(0)}x${(mold.section_height_meters || 0) * 100 > 0 ? ((mold.section_height_meters || 0) * 100).toFixed(0) : '?'} cm`);
    if (mold?.reference_measurement_meters) dims.push(`L=${mold.reference_measurement_meters.toFixed(2)}m`);
    const dimStr = dims.join(' ');

    const url = `${window.location.origin}/track/${so.qr_token}`;
    const qrUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: 5cm 8cm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; display: flex; }
      .label { width: 5cm; height: 8cm; padding: 0.2cm; display: flex; flex-direction: column; align-items: center; border: 1px solid #ccc; }
      .product-name { font-size: 7pt; font-weight: bold; text-align: center; margin-bottom: 0.1cm; }
      .info-row { font-size: 5.5pt; text-align: center; color: #333; margin-bottom: 0.05cm; }
      .traco { color: #1a5fa8; font-weight: bold; }
      .qr { width: 2.4cm; height: 2.4cm; margin-top: auto; }
    </style></head><body>
      <div class="label">
        <div class="product-name">${itemName}</div>
        ${dimStr ? `<div class="info-row">${dimStr}</div>` : ''}
        <div class="info-row">OP #${order.order_number} &mdash; Peca ${so.sequence_number}/${so.total_in_item}</div>
        <div class="info-row">${customerName}</div>
        <div class="info-row traco">${recipeName}</div>
        <img src="${qrUrl}" class="qr" />
      </div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      win.addEventListener('load', () => { URL.revokeObjectURL(blobUrl); win.print(); });
    } else {
      URL.revokeObjectURL(blobUrl);
      alert('Habilite pop-ups para imprimir a etiqueta');
    }
  }, [itemName, order, recipe, mold]);

  const groupedReinforcements = reinforcements.reduce<Record<string, Reinforcement[]>>((acc, r) => {
    const key = r.reinforcement_type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const unitConcreteVolume = mold?.reference_volume_m3 || productDetail?.reference_volume || null;
  const totalConcreteVolume = unitConcreteVolume ? unitConcreteVolume * item.quantity : null;
  const volumeSource = mold?.reference_volume_m3 ? 'forma' : productDetail?.reference_volume ? 'produto' : null;

  const concreteTypeLabel = (type?: string) => {
    switch (type) {
      case 'dry': return 'Concreto Seco (TCS)';
      case 'plastic': return 'Concreto Plastico (TCP)';
      default: return type || 'Nao especificado';
    }
  };

  const getTrackingForPiece = (subOrderId: string) => {
    return trackingRecords.find(t => t.sub_order_id === subOrderId) || null;
  };

  const getCompletedBipNumbers = (tracking: TrackingRecord | null): number[] => {
    if (!tracking?.production_tracking_stages) return [];
    return tracking.production_tracking_stages
      .map(s => s.production_stages?.bip_number)
      .filter((n): n is number => n !== undefined && n !== null);
  };

  const statusCounts = subOrders.reduce<Record<string, number>>((acc, so) => {
    acc[so.status] = (acc[so.status] || 0) + 1;
    return acc;
  }, {});

  const sections = [
    { key: 'suborders', label: `Sub-ordens / QR (${subOrders.length})`, icon: QrCode },
    { key: 'ferragem', label: 'Ferragem', icon: Ruler },
    { key: 'recipe', label: 'Traco / Concreto', icon: Layers },
    { key: 'historico', label: 'Historico', icon: History },
  ];

  const selectedSubOrder = subOrders.find(s => s.id === selectedPiece) || null;
  const selectedTracking = selectedPiece ? getTrackingForPiece(selectedPiece) : null;
  const completedBips = getCompletedBipNumbers(selectedTracking);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">OP #{order.order_number}</span>
              {order.customers && (
                <span className="text-xs text-gray-500">{order.customers.name}</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 truncate">{itemName}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
              <span>{item.produced_quantity}/{item.quantity} {itemUnit}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs">{progress}%</span>
              </div>
              {order.deadline && (
                <span className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  {new Date(order.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X className="w-6 h-6" />
          </button>
        </div>

        {productDetail && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mold?.section_width_meters && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Largura</div>
                  <div className="font-bold text-gray-800 text-sm">{(mold.section_width_meters * 100).toFixed(0)} cm</div>
                </div>
              )}
              {mold?.section_height_meters && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Altura</div>
                  <div className="font-bold text-gray-800 text-sm">{(mold.section_height_meters * 100).toFixed(0)} cm</div>
                </div>
              )}
              {mold?.reference_measurement_meters && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Comprimento</div>
                  <div className="font-bold text-gray-800 text-sm">{mold.reference_measurement_meters.toFixed(2)} m</div>
                </div>
              )}
              {productDetail.total_weight && (
                <div className="text-center">
                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1"><Scale className="w-3 h-3" />Peso</div>
                  <div className="font-bold text-gray-800 text-sm">{productDetail.total_weight.toFixed(1)} kg</div>
                </div>
              )}
              {totalConcreteVolume && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Vol. total pedido</div>
                  <div className="font-bold text-blue-700 text-sm">{totalConcreteVolume.toFixed(3)} m³</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {sections.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === key
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : (
            <>
              {activeSection === 'suborders' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold text-gray-800">Pecas Individuais com QR</div>
                      <div className="text-xs text-gray-500">Um QR unico por peca fisica — bipado em cada etapa de producao</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {subOrders.length > 0 && (
                        <button
                          onClick={handlePrintAllQR}
                          className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg border border-gray-200 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          Imprimir Todas
                        </button>
                      )}
                      <button
                        onClick={handleGenerateSubOrders}
                        disabled={generatingSubOrders}
                        className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {generatingSubOrders ? (
                          <RotateCcw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {subOrders.length > 0 ? 'Regenerar' : 'Gerar'} ({item.quantity})
                      </button>
                    </div>
                  </div>

                  {subOrders.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(statusCounts).map(([status, count]) => (
                        <span key={status} className={`text-xs px-2 py-1 rounded-full border ${SUB_STATUS_STYLE[status]}`}>
                          {count} {SUB_STATUS_LABEL[status] || status}
                        </span>
                      ))}
                    </div>
                  )}

                  {subOrders.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                      <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma sub-ordem gerada ainda</p>
                      <p className="text-xs mt-1">Clique em "Gerar" para criar {item.quantity} QR code(s) individuais</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {subOrders.map((so) => {
                        const tracking = getTrackingForPiece(so.id);
                        const bipsCompleted = getCompletedBipNumbers(tracking);
                        const lastBip = bipsCompleted.length > 0 ? Math.max(...bipsCompleted) : -1;
                        const isSelected = selectedPiece === so.id;

                        return (
                          <div
                            key={so.id}
                            onClick={() => setSelectedPiece(so.id)}
                            className={`border-2 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-400 bg-blue-50 shadow-md'
                                : so.status === 'installed' ? 'border-emerald-200 bg-emerald-50'
                                : so.status === 'produced' || so.status === 'shipped' ? 'border-green-200 bg-green-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="text-xs font-bold text-gray-700 w-full text-center">
                              Peca {so.sequence_number}/{so.total_in_item}
                            </div>

                            {so.qrCodeUrl && (
                              <img src={so.qrCodeUrl} alt={`QR peca ${so.sequence_number}`} className="w-20 h-20" />
                            )}

                            <span className={`text-xs px-2 py-0.5 rounded-full border ${SUB_STATUS_STYLE[so.status]}`}>
                              {SUB_STATUS_LABEL[so.status]}
                            </span>

                            {lastBip >= 0 && (
                              <div className="text-xs text-gray-500">
                                BIP {lastBip} concluido
                              </div>
                            )}

                            <div className="flex gap-1 w-full">
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePrintSingleQR(so); }}
                                className="flex-1 flex items-center justify-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 py-1.5 rounded-lg border border-blue-200 transition-colors"
                              >
                                <Printer className="w-3 h-3" />
                                Etiqueta
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedPiece(so.id); setActiveSection('historico'); }}
                                className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 py-1.5 rounded-lg border border-gray-200 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                BIPs
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {subOrders.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-800">Fluxo de BIPs</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 1, 2, 3, 4, 5, 6].map((bip) => {
                          const stage = bipStages.find(s => s.bip_number === bip);
                          return (
                            <div key={bip} className={`text-xs px-2 py-1 rounded-lg border font-medium ${BIP_COLORS[bip]}`}>
                              BIP {bip}: {stage?.stage_name || `Etapa ${bip}`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'ferragem' && (
                <div className="space-y-4">
                  {reinforcements.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Ruler className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>Nenhuma ferragem cadastrada para este produto</p>
                    </div>
                  ) : (
                    Object.entries(groupedReinforcements).map(([type, items]) => (
                      <div key={type}>
                        <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-gray-400" />
                          {REINFORCEMENT_TYPE_LABEL[type] || type}
                          <span className="text-xs text-gray-400 font-normal">({items.length} item/ns)</span>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 mb-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Aco / Material</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Diametro</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Barras</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Comp./Barra</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500">Total</th>
                                {item.quantity > 1 && (
                                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-blue-500">Total pedido</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {items.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2.5">
                                    <div className="font-medium text-gray-800">{r.materials?.name || r.description || '—'}</div>
                                    {r.identifier && <div className="text-xs text-gray-400">{r.identifier}</div>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-gray-600">
                                    {r.bar_diameter_mm > 0 ? `${r.bar_diameter_mm} mm` : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-gray-600">{r.bar_count}</td>
                                  <td className="px-3 py-2.5 text-right text-gray-600">{r.bar_length_meters.toFixed(2)} m</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                                    {(r.total_length_meters || r.bar_count * r.bar_length_meters).toFixed(2)} m
                                  </td>
                                  {item.quantity > 1 && (
                                    <td className="px-3 py-2.5 text-right font-bold text-blue-700">
                                      {((r.total_length_meters || r.bar_count * r.bar_length_meters) * item.quantity).toFixed(2)} m
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'recipe' && (
                <div className="space-y-4">
                  {!recipe ? (
                    <div className="text-center py-8 text-gray-400">
                      <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>Nenhum traco vinculado a este produto</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-blue-900">{recipe.name}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-blue-600 mb-0.5">Tipo</div>
                            <div className="font-medium text-gray-800">{concreteTypeLabel(recipe.concrete_type)}</div>
                          </div>
                          {recipe.specific_weight && (
                            <div>
                              <div className="text-xs text-blue-600 mb-0.5">Peso especifico</div>
                              <div className="font-medium text-gray-800">{recipe.specific_weight} kg/m³</div>
                            </div>
                          )}
                          {recipe.moisture_percentage && (
                            <div>
                              <div className="text-xs text-blue-600 mb-0.5">Umidade</div>
                              <div className="font-medium text-gray-800">{recipe.moisture_percentage}%</div>
                            </div>
                          )}
                          {unitConcreteVolume && (
                            <div>
                              <div className="text-xs text-blue-600 mb-0.5">
                                Vol. unit. ({volumeSource === 'forma' ? 'forma' : 'produto'})
                              </div>
                              <div className="font-medium text-gray-800">{unitConcreteVolume.toFixed(4)} m³</div>
                            </div>
                          )}
                          {totalConcreteVolume && (
                            <div>
                              <div className="text-xs text-blue-600 mb-0.5">Volume total ({item.quantity} pcs)</div>
                              <div className="font-bold text-blue-700">{totalConcreteVolume.toFixed(3)} m³</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {recipeItems.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold text-gray-700 mb-2">Composicao do Traco</div>
                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Material</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Qtd./m³</th>
                                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Unidade</th>
                                  {totalConcreteVolume && (
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-blue-500">
                                      Qtd. Total ({item.quantity} pcs)
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {recipeItems.map((ri) => (
                                  <tr key={ri.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-medium text-gray-800">{ri.materials?.name || '—'}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-600">{ri.quantity.toFixed(3)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-500">{ri.materials?.unit || '—'}</td>
                                    {totalConcreteVolume && (
                                      <td className="px-4 py-2.5 text-right font-semibold text-blue-700">
                                        {(ri.quantity * totalConcreteVolume).toFixed(3)} {ri.materials?.unit}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeSection === 'historico' && (
                <div className="space-y-4">
                  {subOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Gere as sub-ordens para iniciar o rastreamento por peca</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Selecionar Peca</div>
                        <div className="flex flex-wrap gap-1.5">
                          {subOrders.map((so) => {
                            const tracking = getTrackingForPiece(so.id);
                            const bipsCompleted = getCompletedBipNumbers(tracking);
                            return (
                              <button
                                key={so.id}
                                onClick={() => setSelectedPiece(so.id)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                  selectedPiece === so.id
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                Peca {so.sequence_number}
                                {bipsCompleted.length > 0 && (
                                  <span className={`text-xs px-1 rounded ${selectedPiece === so.id ? 'bg-blue-500' : 'bg-green-100 text-green-700'}`}>
                                    BIP {Math.max(...bipsCompleted)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {selectedSubOrder && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-semibold text-gray-800">
                                Peca {selectedSubOrder.sequence_number}/{selectedSubOrder.total_in_item}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                QR: {selectedSubOrder.qr_token.slice(0, 16)}...
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border ${SUB_STATUS_STYLE[selectedSubOrder.status]}`}>
                              {SUB_STATUS_LABEL[selectedSubOrder.status]}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {bipStages.map((stage) => {
                              const bip = stage.bip_number ?? stage.stage_order - 1;
                              const completedStage = selectedTracking?.production_tracking_stages?.find(
                                s => s.stage_id === stage.id || s.production_stages?.stage_key === stage.stage_key
                              );
                              const isCompleted = !!completedStage;
                              const bipData = completedStage?.production_piece_bip_data?.[0];

                              return (
                                <div
                                  key={stage.id}
                                  className={`rounded-xl border-2 p-3 transition-all ${
                                    isCompleted
                                      ? 'border-green-200 bg-green-50'
                                      : 'border-gray-100 bg-gray-50 opacity-70'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                                      isCompleted ? 'bg-green-500 text-white border-green-500' : BIP_COLORS[bip]
                                    }`}>
                                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : bip}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-gray-800">{stage.stage_name}</span>
                                        {isCompleted && completedStage && (
                                          <span className="text-xs text-green-600 flex-shrink-0">
                                            {new Date(completedStage.completed_at).toLocaleDateString('pt-BR')} {new Date(completedStage.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                        {!isCompleted && (
                                          <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Aguardando
                                          </span>
                                        )}
                                      </div>

                                      {isCompleted && completedStage && (
                                        <div className="mt-1.5 space-y-1">
                                          {completedStage.completed_by && completedStage.completed_by !== 'Sistema' && (
                                            <div className="text-xs text-gray-600">
                                              <span className="font-medium">Responsavel:</span> {completedStage.completed_by}
                                            </div>
                                          )}
                                          {completedStage.notes && (
                                            <div className="text-xs text-gray-600">
                                              <span className="font-medium">Obs:</span> {completedStage.notes}
                                            </div>
                                          )}

                                          {bipData && bip === 2 && (
                                            <div className="bg-white rounded-lg p-2 border border-green-200 text-xs space-y-0.5 mt-1">
                                              {bipData.recipes?.name && (
                                                <div><span className="font-medium text-blue-700">Traco:</span> {bipData.recipes.name}</div>
                                              )}
                                              {bipData.corpo_de_prova_number && (
                                                <div><span className="font-medium">CP:</span> #{bipData.corpo_de_prova_number}</div>
                                              )}
                                              {bipData.ambient_temperature != null && (
                                                <div><span className="font-medium">Temperatura:</span> {bipData.ambient_temperature}°C</div>
                                              )}
                                              {bipData.cement_supplier && (
                                                <div><span className="font-medium">Fornecedor cimento:</span> {bipData.cement_supplier}</div>
                                              )}
                                            </div>
                                          )}

                                          {bipData && bip === 4 && (
                                            <div className="bg-white rounded-lg p-2 border border-green-200 text-xs space-y-0.5 mt-1">
                                              {bipData.inspector_name && (
                                                <div><span className="font-medium">Inspetor:</span> {bipData.inspector_name}</div>
                                              )}
                                              <div className="flex gap-3 mt-1">
                                                <span className={bipData.checklist_dimensions_ok ? 'text-green-600' : 'text-red-500'}>
                                                  {bipData.checklist_dimensions_ok ? '✓' : '✗'} Dimensoes
                                                </span>
                                                <span className={bipData.checklist_finish_ok ? 'text-green-600' : 'text-red-500'}>
                                                  {bipData.checklist_finish_ok ? '✓' : '✗'} Acabamento
                                                </span>
                                                <span className={bipData.checklist_inserts_ok ? 'text-green-600' : 'text-red-500'}>
                                                  {bipData.checklist_inserts_ok ? '✓' : '✗'} Insertos
                                                </span>
                                              </div>
                                            </div>
                                          )}

                                          {bipData && bip === 5 && (
                                            <div className="bg-white rounded-lg p-2 border border-green-200 text-xs space-y-0.5 mt-1">
                                              {bipData.truck_plate && (
                                                <div><span className="font-medium">Placa:</span> {bipData.truck_plate}</div>
                                              )}
                                              {bipData.driver_name && (
                                                <div><span className="font-medium">Motorista:</span> {bipData.driver_name}</div>
                                              )}
                                              {bipData.romaneio_number && (
                                                <div><span className="font-medium">Romaneio:</span> {bipData.romaneio_number}</div>
                                              )}
                                            </div>
                                          )}

                                          {bipData && bip === 6 && (
                                            <div className="bg-white rounded-lg p-2 border border-green-200 text-xs space-y-0.5 mt-1">
                                              {bipData.foundation_reference && (
                                                <div><span className="font-medium">Fundacao/Calice:</span> {bipData.foundation_reference}</div>
                                              )}
                                              {bipData.installer_name && (
                                                <div><span className="font-medium">Instalador:</span> {bipData.installer_name}</div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {!isCompleted && stage.description && (
                                        <div className="text-xs text-gray-400 mt-0.5">{stage.description}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {subOrders.length > 0 && selectedSubOrder && (
              <button
                onClick={() => handlePrintSingleQR(selectedSubOrder)}
                className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-200 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Etiqueta Peca {selectedSubOrder.sequence_number}
              </button>
            )}
            {subOrders.length > 0 && (
              <button
                onClick={handlePrintAllQR}
                className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <QrCode className="w-4 h-4" />
                Imprimir Todas ({subOrders.length})
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
