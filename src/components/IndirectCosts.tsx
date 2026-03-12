import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, TrendingUp, DollarSign, Package, Check, X, FileText, AlertCircle, Calendar, Tag } from 'lucide-react';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { FormSkeleton, TableSkeleton, SkeletonLoader } from './SkeletonLoader';
import PurchaseFormOptimized from './PurchaseFormOptimized';
import PurchaseEditModal from './PurchaseEditModal';

interface IndirectCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  allocation_method: string;
  active: boolean;
}

interface DepreciationAsset {
  id: string;
  name: string;
  purchase_value: number;
  purchase_date: string;
  useful_life_years: number;
  residual_value: number;
  active: boolean;
}

interface Investment {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  source?: string;
}

interface CostCategory {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface PendingPurchase {
  id: string;
  purchase_id?: string;
  material_id: string;
  supplier_id: string;
  nfe_key: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  classification_status: string;
  is_for_resale: boolean;
  is_asset: boolean;
  notes: string;
  imported_at: string;
  suppliers?: {
    name: string;
  };
  category_type?: string;
  category_name?: string;
}

export default function IndirectCosts() {
  const [activeTab, setActiveTab] = useState<'classification' | 'direct' | 'indirect' | 'depreciation' | 'investments' | 'reports'>('classification');
  const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);
  const [depreciationAssets, setDepreciationAssets] = useState<DepreciationAsset[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const [classifiedPurchases, setClassifiedPurchases] = useState<PendingPurchase[]>([]);
  const [directCosts, setDirectCosts] = useState<PendingPurchase[]>([]);
  const [indirectCostsClassified, setIndirectCostsClassified] = useState<PendingPurchase[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategory[]>([]);

  // Paginação
  const [pendingOffset, setPendingOffset] = useState(0);
  const [classifiedOffset, setClassifiedOffset] = useState(0);
  const [hasPendingMore, setHasPendingMore] = useState(true);
  const [hasClassifiedMore, setHasClassifiedMore] = useState(true);
  const [loadingPendingMore, setLoadingPendingMore] = useState(false);
  const [loadingClassifiedMore, setLoadingClassifiedMore] = useState(false);
  const PURCHASES_PAGE_SIZE = 20;
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isForResale, setIsForResale] = useState(false);
  const [isAsset, setIsAsset] = useState(false);
  const [notes, setNotes] = useState('');

  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any[]>([]);

  const [indirectForm, setIndirectForm] = useState({
    name: '',
    category: 'overhead',
    amount: '',
    allocation_method: 'monthly',
  });

  const [depreciationForm, setDepreciationForm] = useState({
    name: '',
    purchase_value: '',
    purchase_date: new Date().toISOString().split('T')[0],
    useful_life_years: '10',
    residual_value: '0',
  });

  const [investmentForm, setInvestmentForm] = useState({
    name: '',
    category: 'equipment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [directCostForm, setDirectCostForm] = useState({
    product_name: '',
    quantity: '',
    unit: 'kg',
    unit_cost: '',
    total_cost: '',
    supplier_id: '',
    cost_category_id: '',
    is_for_resale: false,
    is_asset: false,
    notes: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showDirectCostForm, setShowDirectCostForm] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const {
    isBasicDataLoaded,
    isHeavyDataLoaded,
    markStageStart,
    markStageComplete,
    markBasicDataLoaded,
    markHeavyDataLoaded,
    markAllComplete,
  } = useProgressiveLoading({
    onAllComplete: (totalDuration) => {
      console.log(`[IndirectCosts] Todos os dados carregados em ${totalDuration.toFixed(2)}ms`);
    },
  });

  useEffect(() => {
    console.log('[Performance] IndirectCosts component mounted, activeTab:', activeTab);
    loadData();
  }, [activeTab]);

  async function loadData() {
    const overallStart = performance.now();
    console.log('[Performance] Iniciando carregamento de dados...');

    // ETAPA 1: Dados Básicos (necessários para interatividade)
    const basicStart = markStageStart('basic-data');
    await Promise.all([
      loadCostCategories(),
      loadSuppliersBasic(),
    ]);
    markStageComplete('basic-data', basicStart);
    markBasicDataLoaded();

    // UI já está interativa aqui - usuário pode começar a usar

    // ETAPA 2: Dados Pesados (carregamento em background)
    setTimeout(async () => {
      const heavyStart = markStageStart('heavy-data');
      await Promise.all([
        loadIndirectCosts(),
        loadDepreciationAssets(),
        loadInvestments(),
        loadPendingPurchases(),
        loadClassifiedPurchases(),
      ]);
      markStageComplete('heavy-data', heavyStart);
      markHeavyDataLoaded();
      markAllComplete();

      const totalTime = performance.now() - overallStart;
      console.log('[Performance] Carregamento completo em:', totalTime.toFixed(2), 'ms');
    }, 100); // Pequeno delay para UI respirar
  }

  async function loadSuppliersBasic() {
    // Carregar apenas ID e nome para dropdowns
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name')
      .limit(100); // Limitar inicialmente

    if (error) {
      console.error('Error loading suppliers:', error);
      return;
    }

    setSuppliers(data || []);
  }

  async function loadSuppliers() {
    // Carregamento completo de fornecedores (chamado sob demanda)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading suppliers:', error);
      return;
    }

    setSuppliers(data || []);
  }

  async function loadIndirectCosts() {
    const { data, error } = await supabase
      .from('indirect_costs')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading indirect costs:', error);
      return;
    }

    setIndirectCosts(data || []);
  }

  async function loadDepreciationAssets() {
    const { data, error } = await supabase
      .from('depreciation_assets')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading depreciation assets:', error);
      return;
    }

    setDepreciationAssets(data || []);
  }

  async function loadInvestments() {
    // Buscar da tabela assets (patrimônio)
    const { data: assetsData, error: assetsError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        acquisition_value,
        acquisition_date,
        status,
        notes,
        description
      `)
      .order('acquisition_date', { ascending: false });

    if (assetsError) {
      console.error('Error loading assets:', assetsError);
    }

    // Buscar equipamentos classificados nas compras
    const { data: equipmentData, error: equipmentError } = await supabase
      .from('purchase_items')
      .select(`
        id,
        product_description,
        total_price,
        classified_at,
        created_at,
        notes,
        purchases!inner(
          invoice_date,
          supplier_id,
          suppliers(name)
        ),
        cost_categories!inner(
          type
        )
      `)
      .eq('classification_status', 'classified')
      .eq('cost_categories.type', 'equipment')
      .order('classified_at', { ascending: false });

    if (equipmentError) {
      console.error('Error loading equipment purchases:', equipmentError);
    }

    // Transformar assets para o formato esperado
    const transformedAssets = (assetsData || []).map((asset: any) => ({
      id: asset.id,
      name: asset.name,
      category: 'patrimonio',
      amount: parseFloat(asset.acquisition_value || '0'),
      date: asset.acquisition_date,
      description: asset.description || asset.notes || '',
      source: 'assets',
    }));

    // Transformar equipamentos para o formato esperado
    const transformedEquipment = (equipmentData || []).map((item: any) => ({
      id: item.id,
      name: item.product_description,
      category: 'equipment',
      amount: parseFloat(item.total_price || '0'),
      date: item.purchases?.invoice_date || item.classified_at || item.created_at,
      description: item.notes || `Fornecedor: ${item.purchases?.suppliers?.name || 'N/A'}`,
      source: 'purchases',
    }));

    // Combinar e ordenar por data
    const allInvestments = [...transformedAssets, ...transformedEquipment]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('Investments loaded:', allInvestments.length, allInvestments);
    setInvestments(allInvestments);
  }

  async function loadPendingPurchases() {
    console.log('Starting loadPendingPurchases...');
    setPendingOffset(0);
    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        id,
        product_code,
        product_description,
        quantity,
        unit,
        unit_price,
        total_price,
        item_category,
        classification_status,
        cost_category_id,
        is_for_resale,
        is_asset,
        notes,
        classified_at,
        created_at,
        purchases!inner(
          id,
          invoice_number,
          invoice_series,
          invoice_date,
          supplier_id,
          suppliers(name)
        )
      `)
      .eq('classification_status', 'pending')
      .order('created_at', { ascending: false })
      .range(0, PURCHASES_PAGE_SIZE - 1);

    if (error) {
      console.error('Error loading pending purchases:', error);
      return;
    }

    console.log('Raw pending purchases data:', data);

    // Transformar para o formato esperado pelo componente
    const transformed = (data || []).map((item: any) => ({
      id: item.id,
      purchase_id: item.purchases?.id || null,
      material_id: '',
      supplier_id: item.purchases?.supplier_id || '',
      nfe_key: item.purchases?.invoice_number || '',
      product_name: item.product_description,
      quantity: parseFloat(item.quantity),
      unit: item.unit,
      unit_cost: parseFloat(item.unit_price),
      total_cost: parseFloat(item.total_price),
      classification_status: item.classification_status || 'pending',
      is_for_resale: item.is_for_resale || false,
      is_asset: item.is_asset || false,
      notes: item.notes || `NF ${item.purchases?.invoice_number}/${item.purchases?.invoice_series}`,
      imported_at: item.created_at,
      suppliers: { name: item.purchases?.suppliers?.name || 'Sem fornecedor' },
    }));

    console.log('Pending purchases loaded:', transformed.length, transformed);
    setPendingPurchases(transformed);
    setHasPendingMore((data?.length || 0) === PURCHASES_PAGE_SIZE);
    setPendingOffset(PURCHASES_PAGE_SIZE);
  }

  async function loadClassifiedPurchases() {
    console.log('Starting loadClassifiedPurchases...');
    setClassifiedOffset(0);
    const { data, error } = await supabase
      .from('purchase_items')
      .select(`
        id,
        product_code,
        product_description,
        quantity,
        unit,
        unit_price,
        total_price,
        item_category,
        classification_status,
        cost_category_id,
        is_for_resale,
        is_asset,
        notes,
        classified_at,
        created_at,
        purchases!inner(
          id,
          invoice_number,
          invoice_series,
          invoice_date,
          supplier_id,
          suppliers(name)
        ),
        cost_categories(
          id,
          name,
          type
        )
      `)
      .eq('classification_status', 'classified')
      .order('classified_at', { ascending: false })
      .range(0, PURCHASES_PAGE_SIZE - 1);

    if (error) {
      console.error('Error loading classified purchases:', error);
      return;
    }

    console.log('Raw classified purchases data:', data);

    const transformed = (data || []).map((item: any) => ({
      id: item.id,
      purchase_id: item.purchases?.id || null,
      material_id: '',
      supplier_id: item.purchases?.supplier_id || '',
      nfe_key: item.purchases?.invoice_number || '',
      product_name: item.product_description,
      quantity: parseFloat(item.quantity),
      unit: item.unit,
      unit_cost: parseFloat(item.unit_price),
      total_cost: parseFloat(item.total_price),
      classification_status: item.classification_status,
      is_for_resale: item.is_for_resale || false,
      is_asset: item.is_asset || false,
      notes: item.notes || '',
      imported_at: item.created_at,
      suppliers: { name: item.purchases?.suppliers?.name || 'Sem fornecedor' },
      category_type: item.cost_categories?.type || '',
      category_name: item.cost_categories?.name || '',
    }));

    console.log('Classified purchases loaded:', transformed.length, transformed);
    setClassifiedPurchases(transformed);
    setHasClassifiedMore((data?.length || 0) === PURCHASES_PAGE_SIZE);
    setClassifiedOffset(PURCHASES_PAGE_SIZE);

    // Separar custos diretos e indiretos
    // Custos Diretos: direct_production, personnel
    const direct = transformed.filter(item =>
      item.category_type === 'direct_production' ||
      item.category_type === 'personnel'
    );

    // Custos Indiretos: administrative, maintenance, utilities, prolabore, taxes, ppe
    const indirect = transformed.filter(item =>
      item.category_type === 'administrative' ||
      item.category_type === 'maintenance' ||
      item.category_type === 'utilities' ||
      item.category_type === 'prolabore' ||
      item.category_type === 'taxes' ||
      item.category_type === 'ppe'
    );

    setDirectCosts(direct);
    setIndirectCostsClassified(indirect);
  }

  async function loadCostCategories() {
    console.log('Starting loadCostCategories...');
    const { data, error } = await supabase
      .from('cost_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading cost categories:', error);
      return;
    }

    console.log('Cost categories loaded:', data?.length, data);
    setCostCategories(data || []);
  }

  async function loadMorePendingPurchases() {
    if (loadingPendingMore || !hasPendingMore) return;

    try {
      setLoadingPendingMore(true);
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          id,
          product_code,
          product_description,
          quantity,
          unit,
          unit_price,
          total_price,
          item_category,
          classification_status,
          cost_category_id,
          is_for_resale,
          is_asset,
          notes,
          classified_at,
          created_at,
          purchases!inner(
            id,
            invoice_number,
            invoice_series,
            invoice_date,
            supplier_id,
            suppliers(name)
          )
        `)
        .eq('classification_status', 'pending')
        .order('created_at', { ascending: false })
        .range(pendingOffset, pendingOffset + PURCHASES_PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        const transformed = data.map((item: any) => ({
          id: item.id,
          material_id: '',
          supplier_id: item.purchases?.supplier_id || '',
          nfe_key: item.purchases?.invoice_number || '',
          product_name: item.product_description,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unit_cost: parseFloat(item.unit_price),
          total_cost: parseFloat(item.total_price),
          classification_status: item.classification_status || 'pending',
          is_for_resale: item.is_for_resale || false,
          is_asset: item.is_asset || false,
          notes: item.notes || `NF ${item.purchases?.invoice_number}/${item.purchases?.invoice_series}`,
          imported_at: item.created_at,
          suppliers: { name: item.purchases?.suppliers?.name || 'Sem fornecedor' },
        }));

        setPendingPurchases(prev => [...prev, ...transformed]);
        setHasPendingMore(data.length === PURCHASES_PAGE_SIZE);
        setPendingOffset(prev => prev + PURCHASES_PAGE_SIZE);
      } else {
        setHasPendingMore(false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais compras pendentes:', error);
    } finally {
      setLoadingPendingMore(false);
    }
  }

  async function loadMoreClassifiedPurchases() {
    if (loadingClassifiedMore || !hasClassifiedMore) return;

    try {
      setLoadingClassifiedMore(true);
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          id,
          product_code,
          product_description,
          quantity,
          unit,
          unit_price,
          total_price,
          item_category,
          classification_status,
          cost_category_id,
          is_for_resale,
          is_asset,
          notes,
          classified_at,
          created_at,
          purchases!inner(
            id,
            invoice_number,
            invoice_series,
            invoice_date,
            supplier_id,
            suppliers(name)
          ),
          cost_categories(
            id,
            name,
            type
          )
        `)
        .eq('classification_status', 'classified')
        .order('classified_at', { ascending: false })
        .range(classifiedOffset, classifiedOffset + PURCHASES_PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        const transformed = data.map((item: any) => ({
          id: item.id,
          material_id: '',
          supplier_id: item.purchases?.supplier_id || '',
          nfe_key: item.purchases?.invoice_number || '',
          product_name: item.product_description,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unit_cost: parseFloat(item.unit_price),
          total_cost: parseFloat(item.total_price),
          classification_status: item.classification_status,
          is_for_resale: item.is_for_resale || false,
          is_asset: item.is_asset || false,
          notes: item.notes || '',
          imported_at: item.created_at,
          suppliers: { name: item.purchases?.suppliers?.name || 'Sem fornecedor' },
          category_type: item.cost_categories?.type || '',
          category_name: item.cost_categories?.name || '',
        }));

        setClassifiedPurchases(prev => [...prev, ...transformed]);
        setHasClassifiedMore(data.length === PURCHASES_PAGE_SIZE);
        setClassifiedOffset(prev => prev + PURCHASES_PAGE_SIZE);

        // Separar custos diretos e indiretos dos novos itens
        const direct = transformed.filter(item =>
          item.category_type === 'direct_production' ||
          item.category_type === 'personnel'
        );

        const indirect = transformed.filter(item =>
          item.category_type === 'administrative' ||
          item.category_type === 'maintenance' ||
          item.category_type === 'utilities' ||
          item.category_type === 'prolabore' ||
          item.category_type === 'taxes' ||
          item.category_type === 'ppe'
        );

        setDirectCosts(prev => [...prev, ...direct]);
        setIndirectCostsClassified(prev => [...prev, ...indirect]);
      } else {
        setHasClassifiedMore(false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais compras classificadas:', error);
    } finally {
      setLoadingClassifiedMore(false);
    }
  }

  async function handleSubmitIndirect(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      name: indirectForm.name,
      category: indirectForm.category,
      amount: parseFloat(indirectForm.amount),
      allocation_method: indirectForm.allocation_method,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('indirect_costs')
        .update(data)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating indirect cost:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('indirect_costs')
        .insert([data]);

      if (error) {
        console.error('Error creating indirect cost:', error);
        return;
      }
    }

    resetForms();
    loadIndirectCosts();
  }

  async function handleSubmitDepreciation(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      name: depreciationForm.name,
      purchase_value: parseFloat(depreciationForm.purchase_value),
      purchase_date: depreciationForm.purchase_date,
      useful_life_years: parseFloat(depreciationForm.useful_life_years),
      residual_value: parseFloat(depreciationForm.residual_value),
    };

    if (editingItem) {
      const { error } = await supabase
        .from('depreciation_assets')
        .update(data)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating asset:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('depreciation_assets')
        .insert([data]);

      if (error) {
        console.error('Error creating asset:', error);
        return;
      }
    }

    resetForms();
    loadDepreciationAssets();
  }

  async function handleSubmitInvestment(e: React.FormEvent) {
    e.preventDefault();

    const data = {
      name: investmentForm.name,
      category: investmentForm.category,
      amount: parseFloat(investmentForm.amount),
      date: investmentForm.date,
      description: investmentForm.description,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('investments')
        .update(data)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating investment:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('investments')
        .insert([data]);

      if (error) {
        console.error('Error creating investment:', error);
        return;
      }
    }

    resetForms();
    loadInvestments();
  }

  async function handleDelete(table: string, id: string) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting record:', error);
      return;
    }

    loadData();
  }

  function resetForms() {
    setIndirectForm({
      name: '',
      category: 'overhead',
      amount: '',
      allocation_method: 'monthly',
    });
    setDepreciationForm({
      name: '',
      purchase_value: '',
      purchase_date: new Date().toISOString().split('T')[0],
      useful_life_years: '10',
      residual_value: '0',
    });
    setInvestmentForm({
      name: '',
      category: 'equipment',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setDirectCostForm({
      product_name: '',
      quantity: '',
      unit: 'kg',
      unit_cost: '',
      total_cost: '',
      supplier_id: '',
      cost_category_id: '',
      is_for_resale: false,
      is_asset: false,
      notes: '',
      purchase_date: new Date().toISOString().split('T')[0],
    });
    setEditingItem(null);
    setShowForm(false);
    setShowDirectCostForm(false);
  }

  function calculateMonthlyDepreciation(asset: DepreciationAsset): number {
    const depreciableValue = asset.purchase_value - asset.residual_value;
    const monthlyDepreciation = depreciableValue / (asset.useful_life_years * 12);
    return monthlyDepreciation;
  }

  function getTotalDirectCosts(): number {
    return directCosts.reduce((sum, cost) => sum + cost.total_cost, 0);
  }

  function getTotalIndirectCosts(): number {
    const fixedIndirectCosts = indirectCosts
      .filter(cost => cost.active)
      .reduce((sum, cost) => sum + cost.amount, 0);

    const classifiedIndirectCosts = indirectCostsClassified
      .reduce((sum, cost) => sum + cost.total_cost, 0);

    return fixedIndirectCosts + classifiedIndirectCosts;
  }

  function getTotalDepreciation(): number {
    return depreciationAssets
      .filter(asset => asset.active)
      .reduce((sum, asset) => sum + calculateMonthlyDepreciation(asset), 0);
  }

  function getTotalInvestments(): number {
    return investments.reduce((sum, inv) => sum + inv.amount, 0);
  }

  async function handleClassify(purchaseId: string) {
    if (!selectedCategory) {
      alert('Por favor, selecione uma categoria de custo');
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_items')
        .update({
          cost_category_id: selectedCategory,
          classification_status: 'classified',
          is_for_resale: isForResale,
          is_asset: isAsset,
          notes: notes,
          classified_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);

      if (error) throw error;

      setClassifyingId(null);
      setSelectedCategory('');
      setIsForResale(false);
      setIsAsset(false);
      setNotes('');
      loadPendingPurchases();
      loadClassifiedPurchases();
    } catch (error) {
      console.error('Erro ao classificar compra:', error);
      alert('Erro ao classificar compra');
    }
  }

  function handleStartClassification(purchase: PendingPurchase) {
    setClassifyingId(purchase.id);
    setSelectedCategory('');
    setIsForResale(false);
    setIsAsset(false);
    setNotes(purchase.notes || '');
  }

  function handleCancelClassification() {
    setClassifyingId(null);
    setSelectedCategory('');
    setIsForResale(false);
    setIsAsset(false);
    setNotes('');
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function getCategoryTypeLabel(type: string) {
    const labels: { [key: string]: string } = {
      direct_production: 'Custo Direto - Produção',
      direct_resale: 'Custo Direto - Revenda',
      administrative: 'Despesa Administrativa',
      personnel: 'Despesa com Pessoal',
      taxes: 'Impostos e Taxas',
      equipment: 'Equipamento/Patrimônio',
      maintenance: 'Manutenção',
      ppe: 'EPIs e Segurança',
      utilities: 'Utilidades (Energia/Água)',
      prolabore: 'Pro Labore',
    };
    return labels[type] || type;
  }

  async function generateReport() {
    const startDate = new Date(reportStartDate);
    const endDate = new Date(reportEndDate);
    endDate.setHours(23, 59, 59, 999);

    const allCosts: any[] = [];

    // Custos diretos e indiretos classificados
    const filteredClassified = classifiedPurchases.filter((item: any) => {
      const itemDate = new Date(item.classified_at || item.imported_at);
      return itemDate >= startDate && itemDate <= endDate;
    });

    filteredClassified.forEach((item: any) => {
      allCosts.push({
        date: item.classified_at || item.imported_at,
        description: item.product_name,
        category: item.category_name,
        type: getCategoryTypeLabel(item.category_type),
        amount: item.total_cost,
        classification: item.category_type === 'direct_production' || item.category_type === 'personnel' ? 'Custo Direto' : 'Custo Indireto',
      });
    });

    // Investimentos
    const filteredInvestments = investments.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });

    filteredInvestments.forEach((item: any) => {
      allCosts.push({
        date: item.date,
        description: item.name,
        category: item.category === 'patrimonio' ? 'Patrimônio' : 'Equipamento',
        type: 'Investimento',
        amount: item.amount,
        classification: 'Investimento',
      });
    });

    // Ordenar por data
    allCosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setReportData(allCosts);
  }

  async function handleSaveDirectCost() {
    if (!directCostForm.product_name || !directCostForm.quantity || !directCostForm.unit_cost || !directCostForm.cost_category_id) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const totalCost = parseFloat(directCostForm.quantity) * parseFloat(directCostForm.unit_cost);

    try {
      const { error } = await supabase
        .from('pending_purchases')
        .insert({
          product_name: directCostForm.product_name,
          quantity: parseFloat(directCostForm.quantity),
          unit: directCostForm.unit,
          unit_cost: parseFloat(directCostForm.unit_cost),
          total_cost: totalCost,
          supplier_id: directCostForm.supplier_id || null,
          cost_category_id: directCostForm.cost_category_id,
          classification_status: 'classified',
          is_for_resale: directCostForm.is_for_resale,
          is_asset: directCostForm.is_asset,
          notes: directCostForm.notes,
          classified_at: new Date().toISOString(),
          imported_at: directCostForm.purchase_date,
          nfe_key: 'MANUAL-' + Date.now(),
        });

      if (error) throw error;

      resetForms();
      loadClassifiedPurchases();
      alert('Custo direto cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar custo direto:', error);
      alert('Erro ao salvar custo direto');
    }
  }

  async function handleSaveMultiplePurchases(items: any[]) {
    const purchasesToInsert = items.map(item => ({
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      total_cost: item.quantity * item.unit_cost,
      supplier_id: item.supplier_id || null,
      cost_category_id: item.cost_category_id,
      classification_status: 'classified',
      is_for_resale: item.is_for_resale,
      is_asset: item.is_asset,
      notes: item.notes,
      classified_at: new Date().toISOString(),
      imported_at: directCostForm.purchase_date,
      nfe_key: 'MANUAL-' + Date.now() + '-' + Math.random(),
    }));

    const { error } = await supabase
      .from('pending_purchases')
      .insert(purchasesToInsert);

    if (error) throw error;

    setShowDirectCostForm(false);
    loadClassifiedPurchases();
    alert(`${items.length} ${items.length === 1 ? 'item cadastrado' : 'itens cadastrados'} com sucesso!`);
  }

  function handleDirectCostQuantityChange(value: string) {
    setDirectCostForm(prev => {
      const quantity = parseFloat(value) || 0;
      const unitCost = parseFloat(prev.unit_cost) || 0;
      return {
        ...prev,
        quantity: value,
        total_cost: (quantity * unitCost).toFixed(2),
      };
    });
  }

  function handleDirectCostUnitCostChange(value: string) {
    setDirectCostForm(prev => {
      const quantity = parseFloat(prev.quantity) || 0;
      const unitCost = parseFloat(value) || 0;
      return {
        ...prev,
        unit_cost: value,
        total_cost: (quantity * unitCost).toFixed(2),
      };
    });
  }

  // Skeleton loading enquanto dados básicos não carregaram
  if (!isBasicDataLoaded) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestão Financeira</h2>
            <p className="text-gray-600">Carregando dados essenciais...</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <SkeletonLoader type="card" rows={1} />
            </div>
          ))}
        </div>

        <FormSkeleton fields={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestão Financeira</h2>
          <p className="text-gray-600">
            Custos indiretos, depreciação e investimentos
            {!isHeavyDataLoaded && (
              <span className="ml-2 text-sm text-blue-600 animate-pulse">
                (carregando histórico...)
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-green-600" />
            <div className="text-sm text-gray-600">Custos Diretos Total</div>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(getTotalDirectCosts())}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {directCosts.length} registros
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-8 h-8 text-blue-600" />
            <div className="text-sm text-gray-600">Custos Indiretos Total</div>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(getTotalIndirectCosts())}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {indirectCosts.filter(c => c.active).length} fixos + {indirectCostsClassified.length} classificados
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-orange-600" />
            <div className="text-sm text-gray-600">Depreciação/Mês</div>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(getTotalDepreciation())}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {depreciationAssets.filter(a => a.active).length} ativos
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-purple-600" />
            <div className="text-sm text-gray-600">Investimentos Total</div>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(getTotalInvestments())}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {investments.length} registros
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('classification')}
              className={`px-6 py-3 text-sm font-medium border-b-2 relative ${
                activeTab === 'classification'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Classificação de Custos
              {pendingPurchases.length > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingPurchases.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'direct'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Custos Diretos
            </button>
            <button
              onClick={() => setActiveTab('indirect')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'indirect'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Custos Indiretos
            </button>
            <button
              onClick={() => setActiveTab('depreciation')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'depreciation'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Depreciação
            </button>
            <button
              onClick={() => setActiveTab('investments')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'investments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Investimentos
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'reports'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Relatórios
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab !== 'classification' && activeTab !== 'direct' && activeTab !== 'reports' && (
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {activeTab === 'indirect' && 'Custos Indiretos'}
                {activeTab === 'depreciation' && 'Ativos e Depreciação'}
                {activeTab === 'investments' && 'Investimentos'}
              </h3>
              <button
                onClick={() => {
                  setEditingItem(null);
                  resetForms();
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="w-5 h-5" />
                Novo
              </button>
            </div>
          )}

          {activeTab === 'classification' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Compras Pendentes de Classificação</h3>
                  <p className="text-sm text-blue-700">
                    As compras importadas via XML precisam ser classificadas manualmente para serem
                    incorporadas corretamente aos custos da empresa. Classifique cada item indicando
                    sua categoria de custo e finalidade.
                  </p>
                </div>
              </div>

              {!isHeavyDataLoaded ? (
                <TableSkeleton rows={3} />
              ) : pendingPurchases.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">Não há compras pendentes de classificação</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
                    >
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 px-6 py-4 border-b border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-5 h-5 text-gray-600" />
                              <h3 className="font-bold text-gray-900">{purchase.product_name}</h3>
                              {purchase.purchase_id && (
                                <button
                                  onClick={() => setEditingPurchaseId(purchase.purchase_id!)}
                                  className="ml-auto p-1.5 text-gray-400 hover:text-[#0A7EC2] hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar compra"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <FileText className="w-4 h-4" />
                                <span>Fornecedor: <strong>{purchase.suppliers?.name || 'N/A'}</strong></span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>Importado em: {formatDate(purchase.imported_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600 mb-1">Valor Total</div>
                            <div className="text-2xl font-bold text-[#0A7EC2]">
                              {formatCurrency(purchase.total_cost)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                          <div>
                            <span className="text-gray-600">Quantidade:</span>
                            <div className="font-semibold text-gray-900">
                              {purchase.quantity} {purchase.unit}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Custo Unitário:</span>
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(purchase.unit_cost)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Chave NFe:</span>
                            <div className="font-mono text-xs text-gray-700 truncate">
                              {purchase.nfe_key}
                            </div>
                          </div>
                        </div>

                        {classifyingId === purchase.id ? (
                          <div className="border-t border-gray-200 pt-4 space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Tag className="w-4 h-4" />
                                Categoria de Custo *
                              </label>
                              <select
                                value={selectedCategory}
                                onChange={(e) => {
                                  console.log('Category selected:', e.target.value);
                                  setSelectedCategory(e.target.value);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                              >
                                <option value="">Selecione uma categoria</option>
                                {costCategories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name} - {getCategoryTypeLabel(category.type)}
                                  </option>
                                ))}
                              </select>
                              {costCategories.length === 0 && (
                                <p className="text-xs text-red-600 mt-1">⚠️ Nenhuma categoria disponível</p>
                              )}
                            </div>

                            <div className="flex gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isForResale}
                                  onChange={(e) => setIsForResale(e.target.checked)}
                                  className="w-4 h-4 text-[#0A7EC2] border-gray-300 rounded focus:ring-[#0A7EC2]"
                                />
                                <span className="text-sm text-gray-700">Produto para Revenda</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isAsset}
                                  onChange={(e) => setIsAsset(e.target.checked)}
                                  className="w-4 h-4 text-[#0A7EC2] border-gray-300 rounded focus:ring-[#0A7EC2]"
                                />
                                <span className="text-sm text-gray-700">Patrimônio/Ativo</span>
                              </label>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Observações
                              </label>
                              <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Informações adicionais sobre esta compra..."
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent resize-none"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => handleClassify(purchase.id)}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                              >
                                <Check className="w-5 h-5" />
                                Confirmar Classificação
                              </button>
                              <button
                                onClick={handleCancelClassification}
                                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartClassification(purchase)}
                            className="w-full bg-[#0A7EC2] text-white px-4 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2 font-semibold"
                          >
                            <DollarSign className="w-5 h-5" />
                            Classificar Custo
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasPendingMore && pendingPurchases.length > 0 && (
                <div className="mt-4 flex items-center justify-center">
                  <button
                    onClick={loadMorePendingPurchases}
                    disabled={loadingPendingMore}
                    className="px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#095a8a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {loadingPendingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Carregar Mais 20 Compras
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'direct' && (
            !isHeavyDataLoaded ? (
              <TableSkeleton rows={5} />
            ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Custos Diretos Classificados</h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    Total de registros: {directCosts.length}
                  </div>
                  <button
                    onClick={() => setShowDirectCostForm(!showDirectCostForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Custo Direto
                  </button>
                </div>
              </div>

              {showDirectCostForm && (
                <PurchaseFormOptimized
                  suppliers={suppliers}
                  costCategories={costCategories}
                  purchaseDate={directCostForm.purchase_date}
                  onPurchaseDateChange={(date) => setDirectCostForm({...directCostForm, purchase_date: date})}
                  onSave={handleSaveMultiplePurchases}
                  onCancel={() => setShowDirectCostForm(false)}
                  getCategoryTypeLabel={getCategoryTypeLabel}
                />
              )}

              {directCosts.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Nenhum custo direto classificado ainda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Produto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fornecedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Quantidade
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Custo Unit.
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {directCosts.map((purchase: any) => (
                        <tr key={purchase.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(purchase.classified_at || purchase.imported_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {purchase.product_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {purchase.suppliers?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {purchase.category_name || 'N/A'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {getCategoryTypeLabel(purchase.category_type || '')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-center text-gray-900">
                            {purchase.quantity} {purchase.unit}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">
                            {formatCurrency(purchase.unit_cost)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(purchase.total_cost)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex gap-1 justify-center">
                              {purchase.is_for_resale && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Revenda
                                </span>
                              )}
                              {purchase.is_asset && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Ativo
                                </span>
                              )}
                              {!purchase.is_for_resale && !purchase.is_asset && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Produção
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {purchase.purchase_id && (
                              <button
                                onClick={() => setEditingPurchaseId(purchase.purchase_id)}
                                className="p-1.5 text-gray-400 hover:text-[#0A7EC2] hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar compra"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                          Total Geral:
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#0A7EC2] text-right">
                          {formatCurrency(
                            directCosts.reduce((sum, p) => sum + p.total_cost, 0)
                          )}
                        </td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {hasClassifiedMore && directCosts.length > 0 && (
                <div className="mt-4 flex items-center justify-center">
                  <button
                    onClick={loadMoreClassifiedPurchases}
                    disabled={loadingClassifiedMore}
                    className="px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#095a8a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {loadingClassifiedMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Carregar Mais 20 Custos
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            )
          )}

          {activeTab === 'indirect' && (
            !isHeavyDataLoaded ? (
              <TableSkeleton rows={5} />
            ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Custos Indiretos Classificados</h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    Total de registros: {indirectCostsClassified.length}
                  </div>
                </div>
              </div>

              {indirectCostsClassified.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Nenhum custo indireto classificado ainda</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Descrição
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Fornecedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Quantidade
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Custo Unit.
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12">
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {indirectCostsClassified.map((purchase: any) => (
                        <tr key={purchase.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(purchase.classified_at || purchase.imported_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {purchase.product_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {purchase.suppliers?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {purchase.category_name || 'N/A'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {getCategoryTypeLabel(purchase.category_type || '')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-center text-gray-900">
                            {purchase.quantity} {purchase.unit}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">
                            {formatCurrency(purchase.unit_cost)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(purchase.total_cost)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {purchase.purchase_id && (
                              <button
                                onClick={() => setEditingPurchaseId(purchase.purchase_id)}
                                className="p-1.5 text-gray-400 hover:text-[#0A7EC2] hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar compra"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                          Total Geral:
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#0A7EC2] text-right">
                          {formatCurrency(
                            indirectCostsClassified.reduce((sum, p) => sum + p.total_cost, 0)
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            )
          )}

          {activeTab === 'depreciation' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ativo
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor de Compra
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Vida Útil (anos)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Depreciação/Mês
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {depreciationAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{asset.name}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        R$ {asset.purchase_value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-600">
                        {asset.useful_life_years} anos
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-orange-600">
                        R$ {calculateMonthlyDepreciation(asset).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(asset);
                              setDepreciationForm({
                                name: asset.name,
                                purchase_value: asset.purchase_value.toString(),
                                purchase_date: asset.purchase_date,
                                useful_life_years: asset.useful_life_years.toString(),
                                residual_value: asset.residual_value.toString(),
                              });
                              setShowForm(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('depreciation_assets', asset.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'investments' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Data
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {investments.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{inv.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{inv.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(inv.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900">
                        R$ {inv.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(inv);
                              setInvestmentForm({
                                name: inv.name,
                                category: inv.category,
                                amount: inv.amount.toString(),
                                date: inv.date,
                                description: inv.description || '',
                              });
                              setShowForm(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('investments', inv.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Filtros de Período</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Final
                    </label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={generateReport}
                      className="w-full px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] font-semibold transition-colors"
                    >
                      Gerar Relatório
                    </button>
                  </div>
                </div>
              </div>

              {reportData.length > 0 && (
                <div className="bg-white rounded-lg shadow-md">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold">Relatório Consolidado de Custos</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Período: {new Date(reportStartDate).toLocaleDateString('pt-BR')} a {new Date(reportEndDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total de Registros</p>
                        <p className="text-2xl font-bold text-[#0A7EC2]">{reportData.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Custos Diretos</p>
                        <p className="text-2xl font-bold text-green-700">
                          {formatCurrency(reportData.filter(r => r.classification === 'Custo Direto').reduce((sum, r) => sum + r.amount, 0))}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Custos Indiretos</p>
                        <p className="text-2xl font-bold text-orange-700">
                          {formatCurrency(reportData.filter(r => r.classification === 'Custo Indireto').reduce((sum, r) => sum + r.amount, 0))}
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-1">Investimentos</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {formatCurrency(reportData.filter(r => r.classification === 'Investimento').reduce((sum, r) => sum + r.amount, 0))}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Data
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Descrição
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Categoria
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Classificação
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {reportData.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {new Date(item.date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {item.description}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {item.category}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {item.type}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  item.classification === 'Custo Direto' ? 'bg-green-100 text-green-800' :
                                  item.classification === 'Custo Indireto' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {item.classification}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={5} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                              TOTAL GERAL:
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-right text-[#0A7EC2]">
                              {formatCurrency(reportData.reduce((sum, r) => sum + r.amount, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingItem ? 'Editar' : 'Novo'}{' '}
              {activeTab === 'indirect' && 'Custo Indireto'}
              {activeTab === 'depreciation' && 'Ativo'}
              {activeTab === 'investments' && 'Investimento'}
            </h3>

            {activeTab === 'indirect' && (
              <form onSubmit={handleSubmitIndirect} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    required
                    value={indirectForm.name}
                    onChange={(e) => setIndirectForm({ ...indirectForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={indirectForm.category}
                    onChange={(e) => setIndirectForm({ ...indirectForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="overhead">Overhead</option>
                    <option value="utilities">Utilidades</option>
                    <option value="maintenance">Manutenção</option>
                    <option value="rent">Aluguel</option>
                    <option value="insurance">Seguros</option>
                    <option value="other">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={indirectForm.amount}
                    onChange={(e) => setIndirectForm({ ...indirectForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Alocação
                  </label>
                  <select
                    value={indirectForm.allocation_method}
                    onChange={(e) => setIndirectForm({ ...indirectForm, allocation_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="per_unit">Por Unidade</option>
                    <option value="per_batch">Por Lote</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
                  >
                    {editingItem ? 'Atualizar' : 'Cadastrar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForms}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'depreciation' && (
              <form onSubmit={handleSubmitDepreciation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Ativo
                  </label>
                  <input
                    type="text"
                    required
                    value={depreciationForm.name}
                    onChange={(e) => setDepreciationForm({ ...depreciationForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor de Compra (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={depreciationForm.purchase_value}
                    onChange={(e) => setDepreciationForm({ ...depreciationForm, purchase_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Compra
                  </label>
                  <input
                    type="date"
                    required
                    value={depreciationForm.purchase_date}
                    onChange={(e) => setDepreciationForm({ ...depreciationForm, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vida Útil (anos)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={depreciationForm.useful_life_years}
                    onChange={(e) => setDepreciationForm({ ...depreciationForm, useful_life_years: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Residual (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={depreciationForm.residual_value}
                    onChange={(e) => setDepreciationForm({ ...depreciationForm, residual_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
                  >
                    {editingItem ? 'Atualizar' : 'Cadastrar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForms}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'investments' && (
              <form onSubmit={handleSubmitInvestment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    required
                    value={investmentForm.name}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={investmentForm.category}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="equipment">Equipamento</option>
                    <option value="infrastructure">Infraestrutura</option>
                    <option value="technology">Tecnologia</option>
                    <option value="training">Treinamento</option>
                    <option value="other">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={investmentForm.amount}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={investmentForm.date}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={investmentForm.description}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
                  >
                    {editingItem ? 'Atualizar' : 'Cadastrar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForms}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {editingPurchaseId && (
        <PurchaseEditModal
          purchaseId={editingPurchaseId}
          suppliers={suppliers}
          onSave={() => {
            setEditingPurchaseId(null);
            loadData();
          }}
          onClose={() => setEditingPurchaseId(null)}
        />
      )}
    </div>
  );
}
