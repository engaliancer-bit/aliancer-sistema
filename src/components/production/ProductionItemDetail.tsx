import { useState, useEffect, useCallback } from 'react';
import {
  X, Package, Layers, Ruler, Scale, QrCode, Printer, History,
  Plus, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock,
  Truck, Hammer, RotateCcw
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
  type: string;
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
  status: 'pending' | 'in_production' | 'produced' | 'shipped';
  produced_at?: string;
  notes?: string;
  qrCodeUrl?: string;
}

interface TrackingRecord {
  id: string;
  qr_token: string;
  production_date?: string;
  expedition_date?: string;
  assembly_date?: string;
  recipe_name?: string;
  quantity?: number;
  additional_notes?: string;
  created_at: string;
  product_tracking_stages?: {
    id: string;
    completed_at: string;
    completed_by?: string;
    notes?: string;
    production_stages?: { stage_key: string; name?: string };
  }[];
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

const SUB_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  in_production: 'Em Producao',
  produced: 'Produzida',
  shipped: 'Expedida',
};

const SUB_ORDER_STATUS_STYLE: Record<string, string> = {
  pending: 'text-gray-600 bg-gray-50 border-gray-200',
  in_production: 'text-amber-700 bg-amber-50 border-amber-200',
  produced: 'text-green-700 bg-green-50 border-green-200',
  shipped: 'text-blue-700 bg-blue-50 border-blue-200',
};

export default function ProductionItemDetail({ item, order, onClose, onGenerateLabel, onRefresh }: Props) {
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [mold, setMold] = useState<MoldDetail | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [reinforcements, setReinforcements] = useState<Reinforcement[]>([]);
  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSubOrders, setGeneratingSubOrders] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('recipe');

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
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadProduct = async (productId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*, recipes(id, name, concrete_type, specific_weight, moisture_percentage)')
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
      .order('type');
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
  };

  const loadTrackingRecords = async () => {
    const { data } = await supabase
      .from('product_tracking')
      .select(`
        *,
        product_tracking_stages:production_tracking_stages(
          id, completed_at, completed_by, notes,
          production_stages(stage_key)
        )
      `)
      .eq('production_order_id', order.id)
      .order('created_at', { ascending: false });
    setTrackingRecords(data || []);
  };

  const handleGenerateSubOrders = async () => {
    if (!confirm(`Gerar ${item.quantity} sub-ordens com QR codes individuais para esta peca?`)) return;
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

      const toInsert = Array.from({ length: item.quantity }, (_, i) => ({
        production_order_id: order.id,
        production_order_item_id: item.id,
        sequence_number: i + 1,
        total_in_item: item.quantity,
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

  const handleUpdateSubOrderStatus = async (subOrderId: string, newStatus: SubOrder['status']) => {
    const { error } = await supabase
      .from('production_sub_orders')
      .update({
        status: newStatus,
        produced_at: newStatus === 'produced' || newStatus === 'shipped' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subOrderId);

    if (error) { alert('Erro ao atualizar status: ' + error.message); return; }
    await loadSubOrders();
  };

  const handlePrintAllQR = useCallback(async () => {
    if (subOrders.length === 0) return;
    const productName = itemName;
    const orderNum = order.order_number;
    const customerName = order.customers?.name || 'Estoque';
    const recipeName = recipe?.name || 'Traco nao especificado';

    const cells = await Promise.all(subOrders.map(async (so) => {
      const url = `${window.location.origin}/track/${so.qr_token}`;
      const qrUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
      return `
        <div class="label">
          <div class="product-name">${productName}</div>
          <div class="info-row"><span class="label-text">OP #${orderNum} &mdash; Peca ${so.sequence_number}/${so.total_in_item}</span></div>
          <div class="info-row"><span class="label-text">${customerName}</span></div>
          <div class="info-row"><span class="label-text">${recipeName}</span></div>
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
  }, [subOrders, itemName, order, recipe]);

  const groupedReinforcements = reinforcements.reduce<Record<string, Reinforcement[]>>((acc, r) => {
    const key = r.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const totalConcreteVolume = mold?.reference_volume_m3
    ? mold.reference_volume_m3 * item.quantity
    : null;

  const concreteTypeLabel = (type?: string) => {
    switch (type) {
      case 'dry': return 'Concreto Seco (TCS)';
      case 'plastic': return 'Concreto Plastico (TCP)';
      default: return type || 'Nao especificado';
    }
  };

  const sections = [
    { key: 'recipe', label: 'Traco / Concreto', icon: Layers },
    { key: 'ferragem', label: 'Ferragem', icon: Ruler },
    { key: 'suborders', label: `Sub-ordens / QR (${subOrders.length})`, icon: QrCode },
    { key: 'historico', label: 'Historico', icon: History },
  ];

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
              {mold?.reference_volume_m3 && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Vol. unit.</div>
                  <div className="font-bold text-gray-800 text-sm">{mold.reference_volume_m3.toFixed(4)} m³</div>
                </div>
              )}
              {totalConcreteVolume && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Vol. total pedido</div>
                  <div className="font-bold text-blue-700 text-sm">{totalConcreteVolume.toFixed(3)} m³</div>
                </div>
              )}
              {productDetail.has_flange && productDetail.flange_length_meters && (
                <div className="text-center">
                  <div className="text-xs text-gray-400">Flange</div>
                  <div className="font-bold text-gray-800 text-sm">{productDetail.flange_length_meters.toFixed(2)} m</div>
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
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-blue-500">Qtd. Total</th>
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

              {activeSection === 'suborders' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold text-gray-800">Sub-Ordens Individuais</div>
                      <div className="text-xs text-gray-500">Uma sub-ordem por peca fisica, com QR unico</div>
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
                        {subOrders.length > 0 ? 'Regenerar' : 'Gerar'} Sub-Ordens ({item.quantity})
                      </button>
                    </div>
                  </div>

                  {subOrders.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                      <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nenhuma sub-ordem gerada ainda</p>
                      <p className="text-xs mt-1">Clique em "Gerar Sub-Ordens" para criar {item.quantity} QR code(s)</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {subOrders.map((so) => (
                        <div key={so.id} className={`border-2 rounded-xl p-3 flex flex-col items-center gap-2 ${
                          so.status === 'produced' || so.status === 'shipped' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                        }`}>
                          <div className="text-xs font-bold text-gray-700">
                            Peca {so.sequence_number}/{so.total_in_item}
                          </div>

                          {so.qrCodeUrl && (
                            <img src={so.qrCodeUrl} alt={`QR peca ${so.sequence_number}`} className="w-20 h-20" />
                          )}

                          <span className={`text-xs px-2 py-0.5 rounded-full border ${SUB_ORDER_STATUS_STYLE[so.status]}`}>
                            {SUB_ORDER_STATUS_LABEL[so.status]}
                          </span>

                          {so.produced_at && (
                            <div className="text-xs text-gray-400">
                              {new Date(so.produced_at).toLocaleDateString('pt-BR')}
                            </div>
                          )}

                          <div className="flex flex-col gap-1 w-full">
                            <button
                              onClick={() => onGenerateLabel(order, item, so)}
                              className="w-full flex items-center justify-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg border border-blue-200 transition-colors"
                            >
                              <Printer className="w-3 h-3" />
                              Etiqueta
                            </button>

                            {so.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateSubOrderStatus(so.id, 'in_production')}
                                className="w-full flex items-center justify-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1.5 rounded-lg border border-amber-200 transition-colors"
                              >
                                <Hammer className="w-3 h-3" />
                                Iniciar
                              </button>
                            )}
                            {so.status === 'in_production' && (
                              <button
                                onClick={() => handleUpdateSubOrderStatus(so.id, 'produced')}
                                className="w-full flex items-center justify-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded-lg border border-green-200 transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Produzida
                              </button>
                            )}
                            {so.status === 'produced' && (
                              <button
                                onClick={() => handleUpdateSubOrderStatus(so.id, 'shipped')}
                                className="w-full flex items-center justify-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg border border-blue-200 transition-colors"
                              >
                                <Truck className="w-3 h-3" />
                                Expedir
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'historico' && (
                <div className="space-y-3">
                  {trackingRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>Nenhum registro de rastreamento encontrado</p>
                      <p className="text-xs mt-1">Gere uma etiqueta QR para iniciar o rastreamento</p>
                    </div>
                  ) : (
                    trackingRecords.map((record) => (
                      <div key={record.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-800">
                            QR: <span className="font-mono text-xs text-gray-500">{record.qr_token.slice(0, 12)}...</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(record.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        {record.recipe_name && (
                          <div className="text-xs text-gray-500 mb-2">Traco: {record.recipe_name}</div>
                        )}
                        {(record.product_tracking_stages || []).length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {(record.product_tracking_stages || []).map((stage) => (
                              <div key={stage.id} className="flex items-center gap-2 text-xs">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                <span className="text-gray-600 capitalize">
                                  {stage.production_stages?.stage_key?.replace(/_/g, ' ') || 'Etapa'}
                                </span>
                                <span className="text-gray-400 ml-auto">
                                  {new Date(stage.completed_at).toLocaleDateString('pt-BR')}
                                </span>
                                {stage.completed_by && (
                                  <span className="text-gray-400">{stage.completed_by}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => onGenerateLabel(order, item)}
            className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Gerar Etiqueta QR
          </button>
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
