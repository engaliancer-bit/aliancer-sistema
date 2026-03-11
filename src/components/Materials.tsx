import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Plus, Edit2, Trash2, Droplet, Save, Check, Upload, AlertCircle, Search, FileDown, Users, Eye, ShoppingCart, Calendar, ChevronLeft, ChevronRight, Lock, Unlock, Clock, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import MaterialSuppliersManager from './MaterialSuppliersManager';
import XMLImporter from './XMLImporter';
import InvoicePurchaseModal, { type InvoicePurchaseData } from './InvoicePurchaseModal';
import { usePagination } from '../hooks/usePagination';
import { useAbortController } from '../hooks/useAbortController';
// [DEBOUNCE] useAdvancedDebounce replaces simple useDebounce — provides maxWait guard
import { useAdvancedDebounce } from '../hooks/useAdvancedDebounceThrottle';
// [MONITOR] Performance tracking for key list operations
import { measureAsync, recordMetric } from '../lib/performanceMonitor';
// [CANCEL] Request cancellation on search/filter changes
import { cancelRequestsByCategory } from '../lib/requestCancellation';
import { useRealtimeChannel, RealtimeEvent } from '../hooks/useRealtimeChannel';
import { useNormalizedRefTable } from '../hooks/useNormalizedRefTable';

interface Supplier {
  id: string;
  name: string;
  cnpj: string;
}

interface Material {
  id: string;
  name: string;
  description: string;
  unit: string;
  brand: string;
  supplier_id: string | null;
  unit_cost: number;
  unit_length_meters: number | null;
  cost_per_meter: number | null;
  total_weight_kg: number | null;
  resale_enabled: boolean;
  resale_tax_percentage: number;
  resale_margin_percentage: number;
  resale_price: number;
  import_status: 'manual' | 'imported_pending' | 'imported_reviewed';
  imported_at: string | null;
  nfe_key: string | null;
  minimum_stock?: number;
  created_at: string;
  suppliers?: Supplier;
  price_locked: boolean;
  price_lock_note: string | null;
  price_updated_at: string | null;
  price_updated_by_source: string | null;
}

interface PriceHistory {
  id: string;
  material_id: string;
  old_unit_cost: number | null;
  new_unit_cost: number | null;
  old_unit: string | null;
  new_unit: string | null;
  source: string;
  nfe_key: string | null;
  notes: string | null;
  changed_at: string;
}

interface MaterialRowProps {
  material: Material;
  onEdit: (m: Material) => void;
  onDelete: (id: string) => void;
  onOpenPurchase: (m: Material) => void;
  onLoadStock: (m: Material) => void;
  onOpenPriceHistory: (m: Material) => void;
  onToggleLock: (m: Material) => void;
  onManageSuppliers: (m: Material) => void;
}

// [MEMO] MaterialRow wrapped in React.memo — individual rows never re-render unless
// their own data changes, even when parent state (search term, filters) is updated.
const MaterialRow = memo(function MaterialRow({
  material,
  onEdit,
  onDelete,
  onOpenPurchase,
  onLoadStock,
  onOpenPriceHistory,
  onToggleLock,
  onManageSuppliers,
}: MaterialRowProps) {
  const salePrice = material.resale_enabled
    ? material.unit_cost +
      (material.unit_cost * material.resale_tax_percentage / 100) +
      (material.unit_cost * material.resale_margin_percentage / 100)
    : 0;

  return (
    <tr
      className={`hover:bg-gray-50 ${material.import_status === 'imported_pending' ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
        <div className="flex items-center gap-2">
          <button onClick={() => onOpenPurchase(material)} className="text-green-600 hover:text-green-900" title="Registrar compra">
            <ShoppingCart className="w-4 h-4 inline" />
          </button>
          <button onClick={() => onLoadStock(material)} className="text-blue-600 hover:text-blue-900" title="Ver estoque e movimentações">
            <Eye className="w-4 h-4 inline" />
          </button>
          <button onClick={() => onOpenPriceHistory(material)} className="text-gray-500 hover:text-gray-800" title="Historico de precos">
            <Clock className="w-4 h-4 inline" />
          </button>
          <button
            onClick={() => onToggleLock(material)}
            className={material.price_locked ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-gray-600'}
            title={material.price_locked ? `Preco travado${material.price_lock_note ? `: ${material.price_lock_note}` : ''} — clique para destravar` : 'Clique para travar o preco'}
          >
            {material.price_locked ? <Lock className="w-4 h-4 inline" /> : <Unlock className="w-4 h-4 inline" />}
          </button>
          <button onClick={() => onEdit(material)} className="text-blue-600 hover:text-blue-900" title="Editar insumo">
            <Edit2 className="w-4 h-4 inline" />
          </button>
          <button onClick={() => onDelete(material.id)} className="text-red-600 hover:text-red-900" title="Excluir insumo">
            <Trash2 className="w-4 h-4 inline" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium text-gray-900">{material.name}</div>
            <div className="text-xs text-gray-500">{material.description || ''}</div>
          </div>
          {material.import_status === 'imported_pending' && (
            <div className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              <span>Precisa revisar</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-600">{material.brand || '-'}</div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">{material.suppliers?.name || '-'}</div>
          <button onClick={() => onManageSuppliers(material)} className="text-blue-600 hover:text-blue-900" title="Gerenciar fornecedores">
            <Users className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{material.unit}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1.5">
          {material.price_locked && <Lock className="w-3 h-3 text-red-400 flex-shrink-0" />}
          <div className={`text-sm font-semibold ${material.price_locked ? 'text-red-700' : 'text-gray-900'}`}>
            R$ {material.unit_cost ? material.unit_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
          </div>
        </div>
        {material.price_updated_by_source && material.price_updated_by_source !== 'manual' && (
          <div className="text-[10px] text-amber-600 text-right mt-0.5">
            via {material.price_updated_by_source === 'nfe_import' ? 'NF-e' : 'compra'}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {material.resale_enabled ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sim</span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Não</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        {material.resale_enabled ? (
          <div className="text-sm">
            <div className="font-semibold text-green-600">
              R$ {salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500">
              +{material.resale_tax_percentage}% imp. +{material.resale_margin_percentage}% marg.
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>
    </tr>
  );
});

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [materialsOffset, setMaterialsOffset] = useState(0);
  const MATERIALS_PAGE_SIZE = 50;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: 'unid',
    brand: '',
    supplier_id: '',
    package_size: '',
    package_price: '',
    unit_cost: '',
    unit_length_meters: '',
    total_weight_kg: '',
    resale_enabled: false,
    resale_tax_percentage: '',
    resale_margin_percentage: '',
    minimum_resale_price: '',
    maximum_discount_percent: '',
    minimum_stock: '',
    ncm: '',
    cfop: '',
    csosn: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSuppliersManager, setShowSuppliersManager] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'imported_pending' | 'manual'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMaterial, setStockMaterial] = useState<Material | null>(null);
  const [materialMovements, setMaterialMovements] = useState<any[]>([]);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [editMovementQuantity, setEditMovementQuantity] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseInitialMaterial, setPurchaseInitialMaterial] = useState<{
    id: string; name: string; unit: string; unit_cost: number; supplier_id?: string | null;
  } | undefined>(undefined);
  const [showNewMaterialForm, setShowNewMaterialForm] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockingMaterial, setLockingMaterial] = useState<Material | null>(null);
  const [lockNote, setLockNote] = useState('');
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [priceHistoryMaterial, setPriceHistoryMaterial] = useState<Material | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPurchasePriceConfirm, setShowPurchasePriceConfirm] = useState(false);
  const [pendingPurchasePrice, setPendingPurchasePrice] = useState<{ materialId: string; newPrice: number; currentPrice: number } | null>(null);


  const { signal } = useAbortController();

  const suppliersRef = useRef<Supplier[]>([]);
  suppliersRef.current = suppliers;
  const suppliersMapRef = useRef<Map<string, Supplier>>(new Map());
  suppliersMapRef.current = new Map(suppliers.map((s) => [s.id, s]));

  const pendingInsertIdsRef = useRef<Set<string>>(new Set());
  const insertFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { populate: populateSuppliersCache } = useNormalizedRefTable<Supplier>({
    tableName: 'suppliers',
    selectFields: 'id, name, cnpj',
  });

  useRealtimeChannel({
    channelName: 'insumos-materials',
    tables: ['materials'],
    onBatchEvents: useCallback((events: RealtimeEvent[]) => {
      const insertIds: string[] = [];

      setMaterials((prev) => {
        let next = [...prev];

        for (const evt of events) {
          if (evt.eventType === 'DELETE') {
            const oldId = (evt.old as any)?.id as string | undefined;
            if (oldId) next = next.filter((m) => m.id !== oldId);
            continue;
          }

          if (evt.eventType === 'UPDATE') {
            const raw = evt.new as Partial<Material>;
            if (!raw.id) continue;
            const supplierObj = raw.supplier_id
              ? (suppliersMapRef.current.get(raw.supplier_id) ?? null)
              : null;
            next = next.map((m) =>
              m.id === raw.id
                ? { ...m, ...(raw as Material), suppliers: supplierObj ?? m.suppliers }
                : m
            );
            continue;
          }

          if (evt.eventType === 'INSERT') {
            const id = (evt.new as any)?.id as string | undefined;
            if (!id) continue;
            const alreadyPresent = next.some((m) => m.id === id);
            if (!alreadyPresent) insertIds.push(id);
          }
        }

        return next;
      });

      if (insertIds.length > 0) {
        insertIds.forEach((id) => pendingInsertIdsRef.current.add(id));
        if (insertFlushTimerRef.current) clearTimeout(insertFlushTimerRef.current);
        insertFlushTimerRef.current = setTimeout(async () => {
          const ids = Array.from(pendingInsertIdsRef.current);
          pendingInsertIdsRef.current.clear();
          try {
            const { data, error } = await supabase
              .from('materials')
              .select('id, name, description, unit, brand, supplier_id, unit_cost, unit_length_meters, cost_per_meter, total_weight_kg, resale_enabled, resale_tax_percentage, resale_margin_percentage, resale_price, import_status, imported_at, nfe_key, minimum_stock, created_at, price_locked, price_lock_note, price_updated_at, price_updated_by_source')
              .in('id', ids);
            if (error) throw error;
            if (data && data.length > 0) {
              const supMap = suppliersMapRef.current;
              const enriched = data.map((m) => ({
                ...m,
                suppliers: m.supplier_id ? (supMap.get(m.supplier_id) ?? null) : null,
              })) as Material[];
              setMaterials((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const newOnes = enriched.filter((m) => !existingIds.has(m.id));
                return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
              });
            }
          } catch (err) {
            console.error('Materials: failed to fetch new inserts', err);
          }
        }, 400);
      }
    }, []),
  });

  useEffect(() => {
    if (suppliers.length > 0) {
      populateSuppliersCache(suppliers);
    }
  }, [suppliers, populateSuppliersCache]);

  useEffect(() => {
    loadData(signal);
  }, []);

  useEffect(() => {
    if (editingId && formData.name.trim()) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      setAutoSaveStatus('idle');

      autoSaveTimerRef.current = setTimeout(async () => {
        await autoSave();
      }, 2000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [formData, editingId]);

  // Cleanup para notification timer ao desmontar componente
  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }
    };
  }, []);

  const autoSave = async () => {
    if (!editingId || !formData.name.trim()) return;

    try {
      setAutoSaveStatus('saving');

      // Parse com validação (silenciosa no auto-save)
      const unitCost = formData.unit_cost ? parseFloat(formData.unit_cost) : 0;
      if (isNaN(unitCost) || unitCost < 0) {
        setAutoSaveStatus('idle');
        return;
      }

      const parsedPackageSize = formData.package_size ? parseFloat(formData.package_size) : 1;
      if (isNaN(parsedPackageSize) || parsedPackageSize <= 0) {
        setAutoSaveStatus('idle');
        return;
      }

      const packagePrice = unitCost * parsedPackageSize;

      const taxPercentage = formData.resale_tax_percentage ? parseFloat(formData.resale_tax_percentage) : 0;
      if (isNaN(taxPercentage) || taxPercentage < 0) {
        setAutoSaveStatus('idle');
        return;
      }

      const marginPercentage = formData.resale_margin_percentage ? parseFloat(formData.resale_margin_percentage) : 0;
      if (isNaN(marginPercentage) || marginPercentage < 0) {
        setAutoSaveStatus('idle');
        return;
      }

      const resalePrice = formData.resale_enabled
        ? calculateResalePrice(packagePrice, taxPercentage, marginPercentage)
        : 0;

      // Validar resalePrice
      if (isNaN(resalePrice) || !isFinite(resalePrice)) {
        setAutoSaveStatus('idle');
        return;
      }

      const parsedTotalWeight = formData.total_weight_kg ? parseFloat(formData.total_weight_kg) : null;
      if (parsedTotalWeight !== null && (isNaN(parsedTotalWeight) || parsedTotalWeight <= 0)) {
        setAutoSaveStatus('idle');
        return;
      }

      const parsedUnitLength = formData.unit_length_meters ? parseFloat(formData.unit_length_meters) : null;
      if (parsedUnitLength !== null && (isNaN(parsedUnitLength) || parsedUnitLength <= 0)) {
        setAutoSaveStatus('idle');
        return;
      }

      const parsedMinStock = formData.minimum_stock ? parseFloat(formData.minimum_stock) : 0;
      if (isNaN(parsedMinStock) || parsedMinStock < 0) {
        setAutoSaveStatus('idle');
        return;
      }

      const minResalePriceStr = String(formData.minimum_resale_price || '').replace(',', '.');
      const parsedMinResalePrice = minResalePriceStr ? parseFloat(minResalePriceStr) : null;

      const maxDiscountStr = String(formData.maximum_discount_percent || '').replace(',', '.');
      const parsedMaxDiscount = maxDiscountStr ? parseFloat(maxDiscountStr) : null;

      const dataToSave = {
        name: (formData.name || '').trim(),
        description: (formData.description || '').trim(),
        unit: formData.unit,
        brand: (formData.brand || '').trim(),
        supplier_id: formData.supplier_id || null,
        package_size: parsedPackageSize,
        unit_cost: unitCost,
        unit_length_meters: parsedUnitLength,
        total_weight_kg: parsedTotalWeight,
        resale_enabled: formData.resale_enabled,
        resale_tax_percentage: taxPercentage,
        resale_margin_percentage: marginPercentage,
        resale_price: resalePrice,
        minimum_resale_price: parsedMinResalePrice,
        maximum_discount_percent: parsedMaxDiscount,
        minimum_stock: parsedMinStock,
        ncm: (formData.ncm || '').trim() || null,
        cfop: (formData.cfop || '').trim() || null,
        csosn: (formData.csosn || '').trim() || null,
      };

      const { error } = await supabase
        .from('materials')
        .update(dataToSave)
        .eq('id', editingId);

      if (error) throw error;

      setAutoSaveStatus('saved');

      // Limpar timer anterior se existir
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }

      notificationTimerRef.current = setTimeout(() => {
        setAutoSaveStatus('idle');
        notificationTimerRef.current = null;
      }, 2000);

      loadData();
    } catch (error) {
      console.error('Erro ao salvar automaticamente:', error);
      setAutoSaveStatus('idle');
    }
  };

  const calculateResalePrice = (
    packagePrice: number,
    taxPercentage: number,
    marginPercentage: number
  ): number => {
    // Validar inputs
    if (!packagePrice || packagePrice <= 0 || isNaN(packagePrice) || !isFinite(packagePrice)) {
      return 0;
    }

    if (isNaN(taxPercentage) || !isFinite(taxPercentage)) {
      taxPercentage = 0;
    }

    if (isNaN(marginPercentage) || !isFinite(marginPercentage)) {
      marginPercentage = 0;
    }

    const taxAmount = packagePrice * (taxPercentage / 100);
    const marginAmount = packagePrice * (marginPercentage / 100);
    const result = packagePrice + taxAmount + marginAmount;

    // Garantir resultado válido
    if (isNaN(result) || !isFinite(result)) {
      return 0;
    }

    return result;
  };

  const togglePriceLock = async (material: Material) => {
    if (material.price_locked) {
      await supabase.from('materials').update({ price_locked: false, price_lock_note: null }).eq('id', material.id);
      loadData();
    } else {
      setLockingMaterial(material);
      setLockNote('');
      setShowLockModal(true);
    }
  };

  const confirmPriceLock = async () => {
    if (!lockingMaterial) return;
    await supabase.from('materials').update({ price_locked: true, price_lock_note: lockNote.trim() || null }).eq('id', lockingMaterial.id);
    setShowLockModal(false);
    setLockingMaterial(null);
    setLockNote('');
    loadData();
  };

  const openPriceHistory = async (material: Material) => {
    setPriceHistoryMaterial(material);
    setShowPriceHistoryModal(true);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('material_price_history')
      .select('*')
      .eq('material_id', material.id)
      .order('changed_at', { ascending: false })
      .limit(50);
    setPriceHistory(data || []);
    setLoadingHistory(false);
  };

  const revertPrice = async (history: PriceHistory) => {
    if (!priceHistoryMaterial) return;
    if (!window.confirm(`Reverter para R$ ${history.old_unit_cost?.toFixed(4)} / ${history.old_unit}?`)) return;
    const old = history.old_unit_cost;
    const current = priceHistoryMaterial.unit_cost;
    await supabase.from('materials').update({
      unit_cost: old,
      unit: history.old_unit || priceHistoryMaterial.unit,
      price_updated_at: new Date().toISOString(),
      price_updated_by_source: 'manual',
    }).eq('id', priceHistoryMaterial.id);
    await supabase.from('material_price_history').insert({
      material_id: priceHistoryMaterial.id,
      old_unit_cost: current,
      new_unit_cost: old,
      old_unit: priceHistoryMaterial.unit,
      new_unit: history.old_unit,
      source: 'manual',
      notes: 'Reversao manual de preco',
    });
    setShowPriceHistoryModal(false);
    loadData();
  };

  const loadData = async (signal?: AbortSignal) => {
    try {
      setMaterialsOffset(0);

      if (signal?.aborted) return;

      // [MONITOR] Track initial list load time for insumos module
      const [materialsRes, suppliersRes] = await measureAsync(
        'insumos:load_list',
        () => Promise.all([
          supabase
            .from('materials')
            // [CACHE] Only select columns needed for the list view to minimize payload
            .select('id, name, description, unit, brand, supplier_id, unit_cost, unit_length_meters, cost_per_meter, total_weight_kg, resale_enabled, resale_tax_percentage, resale_margin_percentage, resale_price, import_status, imported_at, nfe_key, minimum_stock, created_at, price_locked, price_lock_note, price_updated_at, price_updated_by_source')
            .order('name')
            .range(0, MATERIALS_PAGE_SIZE - 1),
          supabase.from('suppliers').select('id, name, cnpj').order('name'),
        ]),
        { module: 'insumos' }
      );

      if (signal?.aborted) return;
      if (materialsRes.error) throw materialsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      // [MEMO] Build lookup map once to avoid O(n²) join in render
      const suppliersMap = new Map((suppliersRes.data || []).map(s => [s.id, s]));
      const materialsWithSuppliers = (materialsRes.data || []).map(m => ({
        ...m,
        suppliers: m.supplier_id ? suppliersMap.get(m.supplier_id) : null
      }));

      setMaterials(materialsWithSuppliers);
      setSuppliers(suppliersRes.data || []);
      setHasMore((materialsRes.data?.length || 0) === MATERIALS_PAGE_SIZE);
      setMaterialsOffset(MATERIALS_PAGE_SIZE);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const loadMoreMaterials = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name')
        .range(materialsOffset, materialsOffset + MATERIALS_PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        const suppliersMap = new Map(suppliers.map(s => [s.id, s]));
        const newMaterials = data.map(m => ({
          ...m,
          suppliers: m.supplier_id ? suppliersMap.get(m.supplier_id) : null
        }));
        setMaterials(prev => [...prev, ...newMaterials]);
        setHasMore(data.length === MATERIALS_PAGE_SIZE);
        setMaterialsOffset(prev => prev + MATERIALS_PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais materiais:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, materialsOffset, suppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.name.trim()) {
      alert('Nome do insumo é obrigatório');
      return;
    }

    try {
      console.log('🚀 Iniciando salvamento do insumo...');
      console.log('📋 FormData completo:', formData);

      // Parse com validação
      const unitCostStr = String(formData.unit_cost || '0').replace(',', '.');
      const unitCost = parseFloat(unitCostStr);
      console.log('💰 Unit cost:', { original: formData.unit_cost, parsed: unitCost });

      if (isNaN(unitCost) || unitCost < 0) {
        alert('Custo unitário inválido');
        return;
      }

      const packageSizeStr = String(formData.package_size || '1').replace(',', '.');
      const parsedPackageSize = parseFloat(packageSizeStr);
      console.log('📦 Package size:', { original: formData.package_size, parsed: parsedPackageSize });

      if (isNaN(parsedPackageSize) || parsedPackageSize <= 0) {
        alert('Tamanho do pacote deve ser maior que zero');
        return;
      }

      const packagePrice = unitCost * parsedPackageSize;
      console.log('💵 Package price:', packagePrice);

      const taxPercentageStr = String(formData.resale_tax_percentage || '0').replace(',', '.');
      const taxPercentage = parseFloat(taxPercentageStr);
      console.log('📊 Tax percentage:', { original: formData.resale_tax_percentage, parsed: taxPercentage });

      if (isNaN(taxPercentage) || taxPercentage < 0) {
        alert('Percentual de impostos inválido');
        return;
      }

      const marginPercentageStr = String(formData.resale_margin_percentage || '0').replace(',', '.');
      const marginPercentage = parseFloat(marginPercentageStr);
      console.log('📈 Margin percentage:', { original: formData.resale_margin_percentage, parsed: marginPercentage });

      if (isNaN(marginPercentage) || marginPercentage < 0) {
        alert('Margem de lucro inválida');
        return;
      }

      const resalePrice = formData.resale_enabled
        ? calculateResalePrice(packagePrice, taxPercentage, marginPercentage)
        : 0;
      console.log('💰 Resale price calculated:', resalePrice);

      // Validar resalePrice
      if (isNaN(resalePrice) || !isFinite(resalePrice)) {
        alert('Erro no cálculo do preço de revenda. Verifique os valores informados.');
        return;
      }

      const totalWeightStr = String(formData.total_weight_kg || '').replace(',', '.');
      const parsedTotalWeight = totalWeightStr ? parseFloat(totalWeightStr) : null;
      console.log('⚖️ Total weight:', { original: formData.total_weight_kg, parsed: parsedTotalWeight });

      if (parsedTotalWeight !== null && (isNaN(parsedTotalWeight) || parsedTotalWeight <= 0)) {
        alert('Peso total deve ser maior que zero ou deixar em branco');
        return;
      }

      const unitLengthStr = String(formData.unit_length_meters || '').replace(',', '.');
      const parsedUnitLength = unitLengthStr ? parseFloat(unitLengthStr) : null;
      console.log('📏 Unit length:', { original: formData.unit_length_meters, parsed: parsedUnitLength });

      if (parsedUnitLength !== null && (isNaN(parsedUnitLength) || parsedUnitLength <= 0)) {
        alert('Comprimento unitário deve ser maior que zero ou deixar em branco');
        return;
      }

      const minStockStr = String(formData.minimum_stock || '0').replace(',', '.');
      const parsedMinStock = parseFloat(minStockStr);
      console.log('📊 Min stock:', { original: formData.minimum_stock, parsed: parsedMinStock });

      if (isNaN(parsedMinStock) || parsedMinStock < 0) {
        alert('Estoque mínimo inválido');
        return;
      }

      const minResalePriceStr = String(formData.minimum_resale_price || '').replace(',', '.');
      const parsedMinResalePrice = minResalePriceStr ? parseFloat(minResalePriceStr) : null;

      const maxDiscountStr = String(formData.maximum_discount_percent || '').replace(',', '.');
      const parsedMaxDiscount = maxDiscountStr ? parseFloat(maxDiscountStr) : null;

      const dataToSave = {
        name: (formData.name || '').trim(),
        description: (formData.description || '').trim(),
        unit: formData.unit,
        brand: (formData.brand || '').trim(),
        supplier_id: formData.supplier_id || null,
        package_size: parsedPackageSize,
        unit_cost: unitCost,
        unit_length_meters: parsedUnitLength,
        total_weight_kg: parsedTotalWeight,
        resale_enabled: formData.resale_enabled,
        resale_tax_percentage: taxPercentage,
        resale_margin_percentage: marginPercentage,
        resale_price: resalePrice,
        minimum_resale_price: parsedMinResalePrice,
        maximum_discount_percent: parsedMaxDiscount,
        minimum_stock: parsedMinStock,
        ncm: (formData.ncm || '').trim() || null,
        cfop: (formData.cfop || '').trim() || null,
        csosn: (formData.csosn || '').trim() || null,
      };

      if (editingId) {
        console.log('🔍 Atualizando material ID:', editingId);
        console.log('📦 Dados a salvar:', JSON.stringify(dataToSave, null, 2));

        const { data: currentMaterial } = await supabase
          .from('materials')
          .select('import_status')
          .eq('id', editingId)
          .single();

        const updateData = {
          ...dataToSave,
          import_status: currentMaterial?.import_status === 'imported_pending' ? 'imported_reviewed' : currentMaterial?.import_status || 'manual',
        };

        console.log('📝 Dados finais com import_status:', JSON.stringify(updateData, null, 2));

        const { error, data } = await supabase
          .from('materials')
          .update(updateData)
          .eq('id', editingId)
          .select();

        if (error) {
          console.error('❌ Erro do Supabase:', error);
          throw error;
        }

        console.log('✅ Material atualizado com sucesso:', data);
      } else {
        const { error } = await supabase
          .from('materials')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setFormData({
        name: '',
        description: '',
        unit: 'unid',
        brand: '',
        supplier_id: '',
        package_size: '',
        package_price: '',
        unit_cost: '',
        unit_length_meters: '',
        total_weight_kg: '',
        resale_enabled: false,
        resale_tax_percentage: '',
        resale_margin_percentage: '',
        minimum_stock: '',
        ncm: '',
        cfop: '',
        csosn: '',
      });
      setEditingId(null);
      setShowNewMaterialForm(false);

      console.log('🔄 Recarregando lista de materiais...');
      await loadData();
      console.log('✅ Lista recarregada com sucesso!');
    } catch (error: any) {
      console.error('======= ERRO AO SALVAR INSUMO =======');
      console.error('Erro completo:', error);
      console.error('Mensagem:', error?.message);
      console.error('Detalhes:', error?.details);
      console.error('Hint:', error?.hint);
      console.error('Código:', error?.code);
      console.error('Stack:', error?.stack);
      console.error('====================================');

      // Se o erro for relacionado ao signal/aborted, não mostrar ao usuário
      if (error?.message?.includes('aborted') || error?.message?.includes('signal')) {
        console.error('⚠️ Erro relacionado ao AbortSignal - não exibindo ao usuário');
        return;
      }

      // Mensagens de erro mais amigáveis
      let userMessage = 'Erro ao salvar insumo:\n\n';

      if (error?.code === '23514') {
        userMessage += 'Violação de restrição do banco de dados.\n';
        userMessage += 'Verifique se todos os valores numéricos são válidos.\n\n';
        userMessage += 'Detalhes: ' + (error?.message || '');
      } else if (error?.code === '23503') {
        userMessage += 'Fornecedor inválido ou não encontrado.\n';
        userMessage += 'Selecione um fornecedor válido da lista.';
      } else if (error?.message?.includes('violates check constraint')) {
        userMessage += 'Valor inválido em um dos campos:\n';
        userMessage += '- Tamanho do pacote deve ser maior que zero\n';
        userMessage += '- Custo deve ser maior ou igual a zero\n';
        userMessage += '- Peso total deve ser maior que zero (se preenchido)\n\n';
        userMessage += 'Erro: ' + error?.message;
      } else {
        userMessage += error?.message || 'Erro desconhecido';
        if (error?.details) {
          userMessage += '\n\nDetalhes: ' + error?.details;
        }
        if (error?.hint) {
          userMessage += '\n\nDica: ' + error?.hint;
        }
      }

      alert(userMessage);
    }
  };

  const handleEdit = (material: Material) => {
    const packageSize = (material as any).package_size || 1;
    const packagePrice = material.unit_cost && packageSize ? (material.unit_cost * packageSize).toFixed(2) : '';

    setFormData({
      name: material.name,
      description: material.description,
      unit: material.unit,
      brand: material.brand || '',
      supplier_id: material.supplier_id || '',
      package_size: packageSize.toString(),
      package_price: packagePrice,
      unit_cost: material.unit_cost ? material.unit_cost.toString() : '',
      unit_length_meters: material.unit_length_meters ? material.unit_length_meters.toString() : '',
      total_weight_kg: material.total_weight_kg ? material.total_weight_kg.toString() : '',
      resale_enabled: material.resale_enabled || false,
      resale_tax_percentage: material.resale_tax_percentage ? material.resale_tax_percentage.toString() : '',
      resale_margin_percentage: material.resale_margin_percentage ? material.resale_margin_percentage.toString() : '',
      minimum_resale_price: (material as any).minimum_resale_price ? (material as any).minimum_resale_price.toString() : '',
      maximum_discount_percent: (material as any).maximum_discount_percent ? (material as any).maximum_discount_percent.toString() : '',
      minimum_stock: material.minimum_stock ? material.minimum_stock.toString() : '',
      ncm: (material as any).ncm || '',
      cfop: (material as any).cfop || '',
      csosn: (material as any).csosn || '',
    });
    setEditingId(material.id);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este insumo?')) return;

    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir insumo:', error);
      alert('Erro ao excluir insumo');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      unit: 'unid',
      brand: '',
      supplier_id: '',
      package_size: '',
      package_price: '',
      unit_cost: '',
      unit_length_meters: '',
      total_weight_kg: '',
      resale_enabled: false,
      resale_tax_percentage: '',
      resale_margin_percentage: '',
      minimum_resale_price: '',
      maximum_discount_percent: '',
      minimum_stock: '',
      ncm: '',
      cfop: '',
      csosn: '',
    });
    setEditingId(null);
  };

  const loadMaterialStock = async (material: Material) => {
    try {
      const { data, error } = await supabase
        .from('material_movements')
        .select('*')
        .eq('material_id', material.id)
        .order('movement_date', { ascending: false });

      if (error) throw error;

      setMaterialMovements(data || []);
      setStockMaterial(material);
      setShowStockModal(true);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      alert('Erro ao carregar movimentações de estoque');
    }
  };

  const calculateCurrentStock = () => {
    if (!materialMovements.length) return 0;

    return materialMovements.reduce((total, movement) => {
      const qty = parseFloat(movement.quantity.toString());
      if (movement.movement_type === 'entrada') {
        return total + qty;
      } else if (movement.movement_type === 'saida') {
        return total - qty;
      }
      return total;
    }, 0);
  };

  const handleEditMovement = (movement: any) => {
    setEditingMovement(movement);
    setEditMovementQuantity(movement.quantity.toString());
  };

  const handleSaveMovement = async () => {
    if (!editingMovement || !editMovementQuantity) return;

    try {
      const newQuantity = parseFloat(editMovementQuantity);
      if (isNaN(newQuantity) || newQuantity <= 0) {
        alert('Quantidade inválida');
        return;
      }

      const { error } = await supabase
        .from('material_movements')
        .update({ quantity: newQuantity })
        .eq('id', editingMovement.id);

      if (error) throw error;

      setEditingMovement(null);
      setEditMovementQuantity('');
      if (stockMaterial) {
        await loadMaterialStock(stockMaterial);
      }
      await loadData();
      alert('Quantidade atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
      alert('Erro ao atualizar quantidade');
    }
  };

  const handleDeleteMovement = async (movement: any) => {
    if (!confirm('Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('material_movements')
        .delete()
        .eq('id', movement.id);

      if (error) throw error;

      if (stockMaterial) {
        await loadMaterialStock(stockMaterial);
      }
      await loadData();
      alert('Movimentação excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir movimentação:', error);
      alert('Erro ao excluir movimentação');
    }
  };

  const handleOpenPurchaseModal = (material?: Material) => {
    if (material) {
      setPurchaseInitialMaterial({
        id: material.id,
        name: material.name,
        unit: material.unit,
        unit_cost: material.unit_cost,
        supplier_id: material.supplier_id,
      });
    } else {
      setPurchaseInitialMaterial(undefined);
    }
    setShowPurchaseModal(true);
  };

  const handleInvoicePurchaseSave = async (data: InvoicePurchaseData) => {
    const supplierName = suppliers.find(s => s.id === data.supplierId)?.name || '';
    const nfLabel = data.invoiceNumber || 'N/A';
    const itemNames = data.items.map(i => i.product_name).join(', ');
    const itemNamesShort = itemNames.length > 80 ? itemNames.substring(0, 80) + '...' : itemNames;

    const { data: purchaseRecord, error: purchaseError } = await supabase
      .from('purchases')
      .insert([{
        invoice_number: data.invoiceNumber || `COMPRA-${Date.now()}`,
        invoice_date: data.purchaseDate,
        supplier_id: data.supplierId || null,
        total_amount: data.totalAmount,
        notes: data.notes || null,
        due_date: data.firstDueDate,
        payment_type: data.paymentType,
        installments_count: data.installments.length,
      }])
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    const purchaseItems = data.items.map(item => ({
      purchase_id: purchaseRecord.id,
      material_id: item.material_id || null,
      product_description: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_cost,
      total_price: item.quantity * item.unit_cost,
      item_category: item.item_category || 'insumo',
      cost_category_id: item.cost_category_id || null,
      classification_status: item.cost_category_id ? 'classified' : 'pending',
    }));

    const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItems);
    if (itemsError) throw itemsError;

    const stockMovements = data.items
      .filter(item => item.material_id)
      .map(item => ({
        material_id: item.material_id!,
        movement_type: 'entrada',
        quantity: item.quantity,
        movement_date: data.purchaseDate,
        notes: `Compra - NF: ${nfLabel}`,
      }));

    if (stockMovements.length > 0) {
      const { error: movError } = await supabase.from('material_movements').insert(stockMovements);
      if (movError) throw movError;
    }

    const totalInstallments = data.installments.length;
    const payableRecords = data.installments.map(inst => ({
      purchase_id: purchaseRecord.id,
      supplier_id: data.supplierId || null,
      description: totalInstallments > 1
        ? `NF ${nfLabel} - ${supplierName || 'Fornecedor'} - Parcela ${inst.number}/${totalInstallments}`
        : `NF ${nfLabel} - ${supplierName || 'Fornecedor'}`,
      installment_number: inst.number,
      total_installments: totalInstallments,
      amount: inst.amount,
      due_date: inst.dueDate,
      payment_status: 'pending',
      notes: data.items.length > 1
        ? `${data.items.length} itens: ${itemNamesShort}`
        : data.notes || null,
    }));

    const { error: payableError } = await supabase.from('payable_accounts').insert(payableRecords);
    if (payableError) throw payableError;

    for (const item of data.items) {
      if (!item.material_id) continue;
      const mat = materials.find(m => m.id === item.material_id);
      if (!mat) continue;
      if (item.unit_cost !== mat.unit_cost && !mat.price_locked) {
        setPendingPurchasePrice({
          materialId: mat.id,
          newPrice: item.unit_cost,
          currentPrice: mat.unit_cost,
        });
        setShowPurchasePriceConfirm(true);
        break;
      }
    }

    setShowPurchaseModal(false);
    setPurchaseInitialMaterial(undefined);
    loadData();
    alert('Compra registrada com sucesso! Os itens foram adicionados ao estoque e as contas a pagar foram criadas.');
  };

  // [DEBOUNCE] Advanced debounce with maxWait=800ms prevents excessive re-filters on rapid typing
  // [CANCEL] cancelCategory ensures stale server searches are aborted when filter changes
  const debouncedSearchTerm = useAdvancedDebounce(searchTerm, {
    delay: 300,
    maxWait: 800,
    cancelCategory: 'insumos-search',
  });

  // Track search events via performanceMonitor
  const prevSearchRef = useRef('');
  useEffect(() => {
    if (debouncedSearchTerm !== prevSearchRef.current) {
      prevSearchRef.current = debouncedSearchTerm;
      if (debouncedSearchTerm) {
        // [MONITOR] Track search application
        recordMetric('insumos:search', 1, 'event', { term_length: String(debouncedSearchTerm.length) });
      }
    }
  }, [debouncedSearchTerm]);

  // [MEMO] filteredMaterials only recomputes when materials, filterStatus or debouncedSearchTerm change
  // Never runs heavy filter logic inside the render cycle
  const filteredMaterials = useMemo(() => {
    const start = performance.now();
    const result = materials.filter((material) => {
      const statusFilter = filterStatus === 'all' ||
        (filterStatus === 'imported_pending' && material.import_status === 'imported_pending') ||
        (filterStatus === 'manual' && (material.import_status === 'manual' || material.import_status === 'imported_reviewed'));

      if (!statusFilter) return false;

      if (!debouncedSearchTerm) return true;

      const searchLower = debouncedSearchTerm.toLowerCase();
      return (
        material.name.toLowerCase().includes(searchLower) ||
        (material.description && material.description.toLowerCase().includes(searchLower)) ||
        (material.brand && material.brand.toLowerCase().includes(searchLower)) ||
        (material.suppliers?.name && material.suppliers.name.toLowerCase().includes(searchLower))
      );
    });
    // [MONITOR] Track filter application duration
    recordMetric('insumos:apply_filter', performance.now() - start, 'ms', { total: String(result.length) });
    return result;
  }, [materials, filterStatus, debouncedSearchTerm]);

  // [VIRTUAL] Pagination provides windowed rendering — prevents DOM explosion with 10k+ items
  const pagination = usePagination(filteredMaterials.length, 50);

  // [MEMO] paginatedMaterials only recomputes when slice boundaries change
  const paginatedMaterials = useMemo(() => {
    return filteredMaterials.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredMaterials, pagination.startIndex, pagination.endIndex]);

  // [MEMO] Stable callback refs passed to MaterialRow so React.memo comparison works correctly.
  // Without useCallback, new function instances on every render would defeat memo.
  const handleEditCb = useCallback((m: Material) => handleEdit(m), []);
  const handleDeleteCb = useCallback((id: string) => handleDelete(id), []);
  const handleOpenPurchaseCb = useCallback((m: Material) => handleOpenPurchaseModal(m), []);
  const handleLoadStockCb = useCallback((m: Material) => loadMaterialStock(m), []);
  const handleOpenPriceHistoryCb = useCallback((m: Material) => openPriceHistory(m), []);
  const handleToggleLockCb = useCallback((m: Material) => togglePriceLock(m), []);
  const handleManageSuppliersCb = useCallback((m: Material) => {
    setSelectedMaterial(m);
    setShowSuppliersManager(true);
  }, []);

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Relatório de Insumos', 14, 20);

    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    doc.text(`Total de insumos: ${materials.length}`, 14, 34);

    const headers = [['Nome', 'Descrição', 'Marca', 'Fornecedor', 'Unidade', 'Custo (R$)', 'Revenda', 'Impostos (%)', 'Margem (%)', 'Preço Venda (R$)']];

    const rows = materials.map(material => {
      const salePrice = material.resale_enabled ? (
        material.unit_cost +
        (material.unit_cost * material.resale_tax_percentage / 100) +
        (material.unit_cost * material.resale_margin_percentage / 100)
      ) : 0;

      return [
        material.name,
        material.description || '-',
        material.brand || '-',
        material.suppliers?.name || '-',
        material.unit,
        `R$ ${material.unit_cost.toFixed(2)}`,
        material.resale_enabled ? 'Sim' : 'Não',
        material.resale_enabled ? material.resale_tax_percentage.toFixed(1) : '-',
        material.resale_enabled ? material.resale_margin_percentage.toFixed(1) : '-',
        material.resale_enabled ? `R$ ${salePrice.toFixed(2)}` : '-'
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [147, 51, 234],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 18 },
        5: { cellWidth: 22 },
        6: { cellWidth: 18 },
        7: { cellWidth: 22 },
        8: { cellWidth: 22 },
        9: { cellWidth: 25 }
      },
      margin: { top: 40 }
    });

    doc.save(`insumos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção de Registro de Compra - TOPO */}
      {!editingId && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-3 border-green-400 rounded-lg shadow-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-green-600" />
                Registrar Compra de Insumo
              </h3>
              <p className="text-base text-gray-700 mb-3">
                Clique no botão verde de compra (carrinho) ao lado de cada insumo na lista abaixo para registrar uma nova compra
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 inline-block">
                <p className="text-sm text-blue-800">
                  <strong>💡 Dica:</strong> Use a busca para encontrar rapidamente o insumo que deseja comprar
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão para Cadastrar Novo Insumo */}
      {!editingId && !showNewMaterialForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 mb-1">
                Cadastrar Novo Insumo
              </h3>
              <p className="text-sm text-gray-600">
                Adicione um novo insumo ao sistema ou importe de uma nota fiscal XML
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenPurchaseModal()}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
              >
                <ShoppingCart className="w-5 h-5" />
                Registrar Compra (NF)
              </button>
              <button
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                <Upload className="w-5 h-5" />
                Importar XML
              </button>
              <button
                onClick={() => setShowNewMaterialForm(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Novo Insumo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Cadastro/Edição */}
      {(showNewMaterialForm || editingId) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Droplet className="w-6 h-6" />
              {editingId ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}
            </h2>
            <div className="flex items-center gap-3">
              {editingId && (
                <div className="flex items-center gap-2">
                  {autoSaveStatus === 'saving' && (
                    <span className="text-sm text-blue-600 flex items-center gap-1">
                      <Save className="w-4 h-4 animate-pulse" />
                      Salvando...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Salvo
                    </span>
                  )}
                </div>
              )}
              {!editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMaterialForm(false);
                    handleCancel();
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
          {editingId && materials.find(m => m.id === editingId)?.import_status === 'imported_pending' && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  Item Importado - Revisão Necessária
                </p>
                <p className="text-sm text-yellow-700">
                  Este insumo foi importado de uma nota fiscal e precisa ser revisado. Configure se é para revenda, defina os impostos e a margem de lucro.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Insumo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Ex: Cimento, Areia, Brita"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Descrição do insumo"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidade de Medida *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="unid">Unid (Unidades)</option>
                <option value="m">m (Metro Linear)</option>
                <option value="m²">m² (Metro Quadrado)</option>
                <option value="m³">m³ (Metro Cúbico)</option>
                <option value="kg">kg (Quilograma)</option>
                <option value="ton">t (Tonelada)</option>
                <option value="L">L (Litro)</option>
                <option value="saco">Saco</option>
                <option value="barra">Barra</option>
                <option value="rolo">Rolo</option>
                <option value="peça">Peça</option>
                <option value="caixa">Caixa</option>
                <option value="fardo">Fardo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marca
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Votorantim, Nassau"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fornecedor
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Nenhum fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                📦 Cálculo de Custo por Embalagem
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamanho da Embalagem ({formData.unit})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.package_size}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                      setFormData({ ...formData, package_size: value });
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value && !isNaN(parseFloat(value))) {
                        const packageSize = parseFloat(value);
                        const packagePrice = formData.package_price ? parseFloat(formData.package_price) : 0;

                        if (packagePrice > 0 && packageSize > 0) {
                          const unitCost = packagePrice / packageSize;
                          setFormData({
                            ...formData,
                            package_size: packageSize.toFixed(2),
                            unit_cost: unitCost.toFixed(4),
                          });
                        } else {
                          setFormData({ ...formData, package_size: packageSize.toFixed(2) });
                        }
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Peso ou volume da embalagem
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço da Embalagem (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.package_price}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                      setFormData({ ...formData, package_price: value });
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value && !isNaN(parseFloat(value))) {
                        const packagePrice = parseFloat(value);
                        const packageSize = formData.package_size ? parseFloat(formData.package_size) : 0;

                        if (packageSize > 0 && packagePrice > 0) {
                          const unitCost = packagePrice / packageSize;
                          setFormData({
                            ...formData,
                            package_price: packagePrice.toFixed(2),
                            unit_cost: unitCost.toFixed(4),
                          });
                        } else {
                          setFormData({ ...formData, package_price: packagePrice.toFixed(2) });
                        }
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 200.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor total da embalagem
                  </p>
                </div>

                <div className="flex items-center">
                  <div className="bg-white border-2 border-blue-400 rounded-lg p-4 w-full">
                    <span className="text-sm text-gray-600 block">Custo Unitário</span>
                    <span className="text-2xl font-bold text-blue-600">
                      R$ {formData.unit_cost || '0.0000'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Por {formData.unit}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-100 border border-blue-300 rounded p-3 text-sm text-gray-700">
                💡 <strong>Exemplo:</strong> Se você comprou 1 tambor de 200kg por R$ 200,00, informe:
                <br />• Tamanho da Embalagem: 200
                <br />• Preço da Embalagem: 200.00
                <br />• O sistema calculará automaticamente: R$ 1,00 por kg
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custo Unitário Manual (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.unit_cost}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                  setFormData({ ...formData, unit_cost: value });
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value && !isNaN(parseFloat(value))) {
                    const unitCost = parseFloat(value);
                    const packageSize = formData.package_size ? parseFloat(formData.package_size) : 0;

                    if (packageSize > 0) {
                      const packagePrice = unitCost * packageSize;
                      setFormData({
                        ...formData,
                        unit_cost: unitCost.toFixed(4),
                        package_price: packagePrice.toFixed(2),
                      });
                    } else {
                      setFormData({ ...formData, unit_cost: unitCost.toFixed(4) });
                    }
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="0.0000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ou digite diretamente o custo por {formData.unit}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.unit === 'm³' || formData.unit === 'ton' || formData.unit === 'saco'
                  ? 'Peso da Unidade (kg)'
                  : 'Comprimento da Unidade (metros)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.unit_length_meters}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                  setFormData({ ...formData, unit_length_meters: value });
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value && !isNaN(parseFloat(value))) {
                    setFormData({ ...formData, unit_length_meters: parseFloat(value).toFixed(2) });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder={formData.unit === 'm³' || formData.unit === 'ton' || formData.unit === 'saco'
                  ? 'Ex: 50 (kg por saco de cimento)'
                  : 'Ex: 12 (para barras de 12m)'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.unit === 'm³' || formData.unit === 'ton' || formData.unit === 'saco'
                  ? 'Informe o peso em kg da unidade de medida'
                  : 'Para barras de ferro: informe 12 metros'}
              </p>
              {formData.unit_cost && formData.unit_length_meters && parseFloat(formData.unit_cost) > 0 && parseFloat(formData.unit_length_meters) > 0 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-700 font-medium">
                    {formData.unit === 'm³' || formData.unit === 'ton' || formData.unit === 'saco'
                      ? `Custo por kg: R$ ${(parseFloat(formData.unit_cost) / parseFloat(formData.unit_length_meters)).toFixed(4)}/kg`
                      : `Custo por metro: R$ ${(parseFloat(formData.unit_cost) / parseFloat(formData.unit_length_meters)).toFixed(4)}/m`}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Este valor será usado na precificação dos produtos
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-3 bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                ⚖️ Conversão de Peso
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Peso Total da Embalagem (kg)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.total_weight_kg}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                      setFormData({ ...formData, total_weight_kg: value });
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value && !isNaN(parseFloat(value))) {
                        setFormData({ ...formData, total_weight_kg: parseFloat(value).toFixed(3) });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex: 8 (para barra de 8kg)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Peso total do insumo na unidade de compra
                  </p>
                </div>

                {formData.total_weight_kg && formData.unit_length_meters && parseFloat(formData.total_weight_kg) > 0 && parseFloat(formData.unit_length_meters) > 0 && (
                  <div className="flex items-center">
                    <div className="bg-white border-2 border-green-400 rounded-lg p-4 w-full">
                      <span className="text-sm text-gray-600 block mb-1">Peso Convertido</span>
                      <span className="text-2xl font-bold text-green-600">
                        {(parseFloat(formData.total_weight_kg) / parseFloat(formData.unit_length_meters)).toFixed(4)} kg/m
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        {parseFloat(formData.total_weight_kg).toFixed(3)} kg ÷ {parseFloat(formData.unit_length_meters).toFixed(2)} m
                      </p>
                    </div>
                  </div>
                )}

                {formData.total_weight_kg && formData.package_size && parseFloat(formData.total_weight_kg) > 0 && parseFloat(formData.package_size) > 0 && !formData.unit_length_meters && (
                  <div className="flex items-center">
                    <div className="bg-white border-2 border-green-400 rounded-lg p-4 w-full">
                      <span className="text-sm text-gray-600 block mb-1">Peso Convertido</span>
                      <span className="text-2xl font-bold text-green-600">
                        {(parseFloat(formData.total_weight_kg) / parseFloat(formData.package_size)).toFixed(4)} kg/{formData.unit}
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        {parseFloat(formData.total_weight_kg).toFixed(3)} kg ÷ {parseFloat(formData.package_size).toFixed(2)} {formData.unit}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-green-100 border border-green-300 rounded p-3 text-sm text-gray-700">
                �� <strong>Exemplo:</strong> Barra de ferro de 12 metros pesando 8kg = 0.6667 kg/m
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estoque Mínimo
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: 1000"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-800 mb-2">
                    Dupla Funcionalidade: Insumo & Revenda
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">1.</span>
                      <div>
                        <strong className="text-blue-700">Como Insumo (em produtos/composições):</strong>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Usa apenas o <strong>Custo Unitário</strong> para calcular o custo de produção de artefatos e pré-moldados
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">2.</span>
                      <div>
                        <strong className="text-green-700">Como Revenda (em orçamentos diretos):</strong>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Usa o <strong>Preço de Venda</strong> (Custo + Impostos + Margem) quando vendido diretamente ao cliente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="resale_enabled"
                checked={formData.resale_enabled}
                onChange={(e) => setFormData({ ...formData, resale_enabled: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="resale_enabled" className="text-sm font-medium text-gray-700">
                Habilitar para Revenda Direta (este insumo também pode ser vendido diretamente)
              </label>
            </div>

            {formData.resale_enabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                <h4 className="text-sm font-semibold text-blue-900">Configuração de Preço para Revenda Direta</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Impostos na Revenda (%)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.resale_tax_percentage}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                        setFormData({ ...formData, resale_tax_percentage: value });
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value && !isNaN(parseFloat(value))) {
                          setFormData({ ...formData, resale_tax_percentage: parseFloat(value).toFixed(2) });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Ex: 18.00 para 18%</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Margem de Lucro (%)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.resale_margin_percentage}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                        setFormData({ ...formData, resale_margin_percentage: value });
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value && !isNaN(parseFloat(value))) {
                          setFormData({ ...formData, resale_margin_percentage: parseFloat(value).toFixed(2) });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Ex: 30.00 para 30%</p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-900 mb-3">
                    Informações Fiscais (Para Nota Fiscal)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NCM
                      </label>
                      <input
                        type="text"
                        value={formData.ncm}
                        onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Ex: 68109900"
                        maxLength={8}
                      />
                      <p className="text-xs text-gray-500 mt-1">Nomenclatura Comum do Mercosul (8 dígitos)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CFOP
                      </label>
                      <input
                        type="text"
                        value={formData.cfop}
                        onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Ex: 5101"
                        maxLength={4}
                      />
                      <p className="text-xs text-gray-500 mt-1">Código Fiscal de Operações (4 dígitos)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CSOSN
                      </label>
                      <input
                        type="text"
                        value={formData.csosn}
                        onChange={(e) => setFormData({ ...formData, csosn: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Ex: 101"
                        maxLength={4}
                      />
                      <p className="text-xs text-gray-500 mt-1">Código Simples Nacional (3-4 dígitos)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    Controles de Preço de Revenda
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preço Mínimo de Revenda (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.minimum_resale_price}
                        onChange={(e) => setFormData({ ...formData, minimum_resale_price: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Ex: 25.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Valor mínimo permitido na revenda (opcional)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Desconto Máximo (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.maximum_discount_percent}
                        onChange={(e) => setFormData({ ...formData, maximum_discount_percent: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Ex: 10"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Desconto máximo permitido (opcional)
                      </p>
                    </div>
                  </div>
                  {(formData.minimum_resale_price || formData.maximum_discount_percent) && (
                    <div className="mt-3 p-2 bg-orange-100 rounded text-xs text-gray-600">
                      <p className="font-medium text-orange-800 mb-1">ℹ️ Estes controles são opcionais:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {formData.minimum_resale_price && (
                          <li>Sistema alertará se revenda for abaixo de R$ {parseFloat(formData.minimum_resale_price).toFixed(2)}</li>
                        )}
                        {formData.maximum_discount_percent && (
                          <li>Sistema alertará se desconto exceder {formData.maximum_discount_percent}%</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-green-50 border-2 border-blue-300 rounded-lg p-4 shadow-md">
                  <h5 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📊 Memorial de Cálculo do Preço de Venda por Embalagem
                  </h5>
                  {formData.package_price && formData.resale_tax_percentage && formData.resale_margin_percentage ? (
                    <div className="space-y-2 text-sm">
                      <div className="bg-blue-100 border border-blue-300 px-3 py-2 rounded mb-2">
                        <span className="text-xs text-blue-700 block mb-1">Base de Cálculo</span>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">📦 Valor da Embalagem:</span>
                          <span className="font-bold text-blue-900 text-base">R$ {parseFloat(formData.package_price).toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {formData.package_size && `${parseFloat(formData.package_size).toFixed(2)} ${formData.unit}`}
                        </p>
                      </div>
                      <div className="flex justify-between bg-white px-3 py-2 rounded">
                        <span className="text-gray-700">📈 Impostos ({formData.resale_tax_percentage}%):</span>
                        <span className="font-semibold text-orange-600">
                          + R$ {(parseFloat(formData.package_price) * parseFloat(formData.resale_tax_percentage) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between bg-white px-3 py-2 rounded">
                        <span className="text-gray-700">💹 Margem de Lucro ({formData.resale_margin_percentage}%):</span>
                        <span className="font-semibold text-blue-600">
                          + R$ {(parseFloat(formData.package_price) * parseFloat(formData.resale_margin_percentage) / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between bg-green-100 border-2 border-green-400 px-3 py-3 rounded-lg mt-2">
                        <span className="font-bold text-gray-900 text-base">🎯 Preço de Venda por Embalagem:</span>
                        <span className="font-bold text-green-700 text-lg">
                          R$ {(
                            parseFloat(formData.package_price) +
                            (parseFloat(formData.package_price) * parseFloat(formData.resale_tax_percentage) / 100) +
                            (parseFloat(formData.package_price) * parseFloat(formData.resale_margin_percentage) / 100)
                          ).toFixed(2)}
                        </span>
                      </div>
                      {formData.package_size && parseFloat(formData.package_size) > 0 && (
                        <div className="bg-gray-50 border border-gray-300 px-3 py-2 rounded mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-xs">Preço por {formData.unit}:</span>
                            <span className="font-semibold text-gray-800">
                              R$ {(
                                (parseFloat(formData.package_price) +
                                (parseFloat(formData.package_price) * parseFloat(formData.resale_tax_percentage) / 100) +
                                (parseFloat(formData.package_price) * parseFloat(formData.resale_margin_percentage) / 100)) /
                                parseFloat(formData.package_size)
                              ).toFixed(4)}/{formData.unit}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">Preencha o preço da embalagem, impostos e margem de lucro</p>
                      <p className="text-sm">para visualizar o memorial de cálculo</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingId) {
                  handleCancel();
                } else {
                  setShowNewMaterialForm(false);
                  handleCancel();
                }
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Insumos Cadastrados ({filteredMaterials.length})
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md"
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </button>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filtrar:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'imported_pending' | 'manual')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">Todos ({materials.length})</option>
                <option value="imported_pending">
                  Pendentes de Revisão ({materials.filter(m => m.import_status === 'imported_pending').length})
                </option>
                <option value="manual">
                  Revisados ({materials.filter(m => m.import_status === 'manual' || m.import_status === 'imported_reviewed').length})
                </option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                <strong>Custo:</strong> usado em composições de produtos (artefatos/pré-moldados) •
                <strong className="ml-1">Preço Venda:</strong> usado em orçamentos diretos ao cliente
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-600" />
            Buscar Insumo
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Digite o nome, descrição, marca ou fornecedor para buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base shadow-sm"
            />
          </div>
          {searchTerm && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Encontrados: <strong className="text-purple-700">{filteredMaterials.length}</strong> insumo(s)
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                Limpar busca
              </button>
            </div>
          )}
        </div>

        {filteredMaterials.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {materials.length === 0 ? 'Nenhum insumo cadastrado ainda' : 'Nenhum insumo encontrado com os filtros aplicados'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Insumo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marca
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Custo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenda
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Venda
                  </th>
                </tr>
              </thead>
              {/* [VIRTUAL] Only current page rows rendered — prevents DOM explosion */}
              <tbody className="bg-white divide-y divide-gray-200">
                {/* [MEMO] MaterialRow components — each row only re-renders when its own data changes */}
                {paginatedMaterials.map((material) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    onEdit={handleEditCb}
                    onDelete={handleDeleteCb}
                    onOpenPurchase={handleOpenPurchaseCb}
                    onLoadStock={handleLoadStockCb}
                    onOpenPriceHistory={handleOpenPriceHistoryCb}
                    onToggleLock={handleToggleLockCb}
                    onManageSuppliers={handleManageSuppliersCb}
                  />
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-blue-50">
                <button
                  onClick={loadMoreMaterials}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#095a8a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Carregando...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4 rotate-90" />
                      Carregar Mais 20 Insumos
                    </>
                  )}
                </button>
              </div>
            )}

            {filteredMaterials.length > 50 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    Mostrando {pagination.startIndex + 1} a {pagination.endIndex} de {filteredMaterials.length} insumos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={pagination.previousPage}
                    disabled={!pagination.canGoPrevious}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <span className="text-sm text-gray-700 px-3">
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  <button
                    onClick={pagination.nextPage}
                    disabled={!pagination.canGoNext}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showImportDialog && (
        <XMLImporter
          materials={materials}
          suppliers={suppliers}
          onSuccess={() => {
            setShowImportDialog(false);
            loadData();
          }}
          onCancel={() => setShowImportDialog(false)}
        />
      )}

      {selectedMaterial && (
        <MaterialSuppliersManager
          materialId={selectedMaterial.id}
          materialName={selectedMaterial.name}
          isVisible={showSuppliersManager}
          onClose={() => {
            setShowSuppliersManager(false);
            setSelectedMaterial(null);
            loadData();
          }}
        />
      )}

      {showPurchaseModal && (
        <InvoicePurchaseModal
          suppliers={suppliers}
          initialMaterial={purchaseInitialMaterial}
          onSave={handleInvoicePurchaseSave}
          onClose={() => {
            setShowPurchaseModal(false);
            setPurchaseInitialMaterial(undefined);
          }}
        />
      )}

      {showStockModal && stockMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Estoque: {stockMaterial.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {stockMaterial.description || 'Insumo de produção'}
                  </p>
                  <p className="text-lg font-semibold text-blue-600 mt-2">
                    Estoque Atual: {calculateCurrentStock().toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {stockMaterial.unit}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowStockModal(false);
                    setStockMaterial(null);
                    setEditingMovement(null);
                    setEditMovementQuantity('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Movimentações de Estoque
              </h4>
              {materialMovements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Data
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Quantidade
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Observações
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {materialMovements.map((movement) => (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(movement.movement_date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3">
                            {movement.movement_type === 'entrada' ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                Entrada
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                Saída
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {editingMovement?.id === movement.id ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editMovementQuantity}
                                onChange={(e) => setEditMovementQuantity(e.target.value)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-gray-900">
                                {movement.quantity.toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {movement.notes || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {editingMovement?.id === movement.id ? (
                                <>
                                  <button
                                    onClick={handleSaveMovement}
                                    className="text-green-600 hover:text-green-900 text-xs font-medium"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingMovement(null);
                                      setEditMovementQuantity('');
                                    }}
                                    className="text-gray-600 hover:text-gray-900 text-xs font-medium"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditMovement(movement)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Editar quantidade"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMovement(movement)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Excluir movimentação"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setStockMaterial(null);
                  setEditingMovement(null);
                  setEditMovementQuantity('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Travar preco */}
      {showLockModal && lockingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Travar Preco</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Ao travar o preco de <strong>{lockingMaterial.name}</strong>, nenhuma importacao de NF-e ou registro de compra poderar alterar o valor automaticamente.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anotacao (opcional)
              </label>
              <input
                type="text"
                value={lockNote}
                onChange={e => setLockNote(e.target.value)}
                placeholder="Ex: Preco negociado com fornecedor ate dez/2026"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 text-sm"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmPriceLock()}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLockModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPriceLock}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Travar Preco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Historico de precos */}
      {showPriceHistoryModal && priceHistoryMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-bold text-gray-900">Historico de Precos</h3>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{priceHistoryMaterial.name}</p>
                <p className="text-xs text-gray-500">Preco atual: R$ {priceHistoryMaterial.unit_cost?.toLocaleString('pt-BR', { minimumFractionDigits: 4 })} / {priceHistoryMaterial.unit}</p>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : priceHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">Nenhum historico de alteracao de preco encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {priceHistory.map(h => (
                    <div key={h.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              h.source === 'nfe_import' ? 'bg-blue-100 text-blue-700' :
                              h.source === 'purchase' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {h.source === 'nfe_import' ? 'NF-e' : h.source === 'purchase' ? 'Compra' : 'Manual'}
                            </span>
                            <span className="text-xs text-gray-500">{new Date(h.changed_at).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-500">De: </span>
                            <span className="font-medium">R$ {h.old_unit_cost?.toLocaleString('pt-BR', { minimumFractionDigits: 4 }) ?? '-'} / {h.old_unit ?? '-'}</span>
                            <span className="mx-2 text-gray-400">→</span>
                            <span className={`font-medium ${(h.new_unit_cost ?? 0) > (h.old_unit_cost ?? 0) ? 'text-red-600' : 'text-green-600'}`}>
                              R$ {h.new_unit_cost?.toLocaleString('pt-BR', { minimumFractionDigits: 4 }) ?? '-'} / {h.new_unit ?? '-'}
                            </span>
                          </div>
                          {h.notes && <p className="text-xs text-gray-500 mt-1">{h.notes}</p>}
                        </div>
                        {h.old_unit_cost !== null && (
                          <button
                            onClick={() => revertPrice(h)}
                            className="flex-shrink-0 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                            title="Reverter para este preco"
                          >
                            Reverter
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowPriceHistoryModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar atualizacao de preco via compra */}
      {showPurchasePriceConfirm && pendingPurchasePrice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Atualizar Preco?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              O preco da compra e diferente do preco cadastrado. Deseja atualizar o preco do insumo?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm mb-5 space-y-1">
              <div><span className="text-gray-500">Preco atual: </span><span className="font-medium">R$ {pendingPurchasePrice.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</span></div>
              <div><span className="text-gray-500">Preco da compra: </span><span className={`font-medium ${pendingPurchasePrice.newPrice > pendingPurchasePrice.currentPrice ? 'text-red-600' : 'text-green-600'}`}>R$ {pendingPurchasePrice.newPrice.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</span></div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await supabase.from('materials').update({
                    unit_cost: pendingPurchasePrice.newPrice,
                    price_updated_at: new Date().toISOString(),
                    price_updated_by_source: 'purchase',
                  }).eq('id', pendingPurchasePrice.materialId);
                  await supabase.from('material_price_history').insert({
                    material_id: pendingPurchasePrice.materialId,
                    old_unit_cost: pendingPurchasePrice.currentPrice,
                    new_unit_cost: pendingPurchasePrice.newPrice,
                    source: 'purchase',
                    notes: 'Atualizado ao registrar compra',
                  });
                  setShowPurchasePriceConfirm(false);
                  setPendingPurchasePrice(null);
                  loadData();
                }}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"
              >
                Sim, atualizar
              </button>
              <button
                onClick={() => { setShowPurchasePriceConfirm(false); setPendingPurchasePrice(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Manter atual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
