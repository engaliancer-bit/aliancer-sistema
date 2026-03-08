import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Printer, X, CreditCard, DollarSign, FileText, Package2, ArrowLeft, Building2, Search, Lock, Unlock, Wallet } from 'lucide-react';
import CustomerCreditManager from './CustomerCreditManager';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import { VirtualizedQuoteItemsList, SimpleQuoteItemsList } from './VirtualizedQuoteItemsList';

interface Customer {
  id: string;
  name: string;
  person_type: 'pf' | 'pj';
}

interface Product {
  id: string;
  name: string;
  final_sale_price?: number;
  sale_price?: number;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  resale_enabled: boolean;
  resale_tax_percentage: number;
  resale_margin_percentage: number;
  resale_price: number;
  package_size: number;
}

interface Composition {
  id: string;
  name: string;
  description: string;
  total_cost: number;
}

interface QuoteItem {
  id?: string;
  tempId?: string;
  quote_id?: string;
  item_type: 'product' | 'material' | 'composition' | 'mao_de_obra';
  product_id?: string | null;
  material_id?: string | null;
  composition_id?: string | null;
  item_name?: string;
  quantity: number;
  suggested_price: number;
  proposed_price: number;
  notes?: string;
  products?: { name: string };
  materials?: { name: string; unit: string };
  compositions?: { name: string; total_cost: number };
}

interface Quote {
  id: string;
  customer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  created_at: string;
  updated_at?: string;
  quote_type?: 'complete_construction' | 'materials_only' | null;
  structure_type?: string | null;
  structure_description?: string;
  square_meters?: number;
  permit_count?: number;
  payment_method?: string | null;
  installments?: number | null;
  installment_value?: number | null;
  payment_notes?: string | null;
  discount_percentage?: number | null;
  discount_value?: number | null;
  total_value?: number;
  delivery_deadline?: string | null;
  precos_congelados?: boolean;
  snapshot_valores?: any;
  data_congelamento?: string | null;
  customers?: { name: string; person_type: 'pf' | 'pj' };
  quote_items?: QuoteItem[];
}

interface QuotesProps {
  highlightQuoteId?: string | null;
  onQuoteOpened?: () => void;
  receivableId?: string | null;
  onBackToSale?: (receivableId: string) => void;
}

export default function Quotes({ highlightQuoteId, onQuoteOpened, receivableId, onBackToSale }: QuotesProps = {}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const highlightedQuoteRef = useRef<HTMLDivElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [loadedQuoteDetails, setLoadedQuoteDetails] = useState<Set<string>>(new Set());
  const [loadingQuoteDetails, setLoadingQuoteDetails] = useState<Set<string>>(new Set());
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showStockCheckDialog, setShowStockCheckDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});
  const [stockCheckItems, setStockCheckItems] = useState<Array<{
    quoteItemId: string;
    productId: string;
    productName: string;
    quantityNeeded: number;
    quantityInStock: number;
    minimumStock: number;
    needsProduction: boolean;
    selected: boolean;
  }>>([]);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    quoteId: string;
    newStatus: 'pending' | 'approved' | 'rejected';
  } | null>(null);
  const [showWorkLinkDialog, setShowWorkLinkDialog] = useState(false);
  const [customerWorks, setCustomerWorks] = useState<any[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');

  const [formData, setFormData] = useState({
    customer_id: '',
    status: 'pending' as 'pending' | 'approved' | 'rejected',
    notes: '',
    quote_type: '' as 'complete_construction' | 'materials_only' | '',
    structure_type: '',
    structure_description: '',
    square_meters: 0,
    permit_count: 0,
    delivery_deadline: '',
  });

  const [pricesFrozen, setPricesFrozen] = useState(false);
  const [frozenSnapshot, setFrozenSnapshot] = useState<any>(null);

  const [itemFormData, setItemFormData] = useState({
    item_type: 'product' as 'product' | 'material' | 'composition' | 'mao_de_obra',
    product_id: '',
    material_id: '',
    composition_id: '',
    quantity: 0,
    suggested_price: 0,
    proposed_price: 0,
    discount_percentage: 0,
    notes: '',
  });

  const [localQuantity, setLocalQuantity] = useState<string>('0');
  const [localDiscount, setLocalDiscount] = useState<string>('0');
  const debouncedQuantity = useDebounce(localQuantity, 300);
  const debouncedDiscount = useDebounce(localDiscount, 300);

  const [paymentData, setPaymentData] = useState({
    payment_method: '',
    installments: 0,
    installment_value: 0,
    payment_notes: '',
    discount_percentage: 0,
    discount_value: 0,
    credit_applied: 0,
  });

  const [customerCreditBalance, setCustomerCreditBalance] = useState(0);
  const [showCreditManager, setShowCreditManager] = useState(false);
  const [creditManagerCustomer, setCreditManagerCustomer] = useState<{ id: string; name: string } | null>(null);

  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    loadData();
    loadCompanySettings();
  }, []);

  useEffect(() => {
    if (highlightQuoteId && quotes.length > 0) {
      setExpandedQuotes(prev => new Set(prev).add(highlightQuoteId));
      loadQuoteDetails(highlightQuoteId);

      const timer = setTimeout(() => {
        if (highlightedQuoteRef.current) {
          highlightedQuoteRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }

        if (onQuoteOpened) {
          onQuoteOpened();
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [highlightQuoteId, quotes, onQuoteOpened]);

  useEffect(() => {
    pagination.goToPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const quantity = parseFloat(debouncedQuantity) || 0;
    setItemFormData(prev => ({ ...prev, quantity }));
  }, [debouncedQuantity]);

  useEffect(() => {
    const discountPercentage = parseFloat(debouncedDiscount) || 0;
    const suggestedPrice = itemFormData.suggested_price || 0;
    const proposedPrice = suggestedPrice * (1 - discountPercentage / 100);
    setItemFormData(prev => ({
      ...prev,
      discount_percentage: discountPercentage,
      proposed_price: proposedPrice
    }));
  }, [debouncedDiscount, itemFormData.suggested_price]);

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach((s: { setting_key: string; setting_value: string }) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setCompanySettings(settingsMap);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadBasicData = async () => {
    try {
      setLoadedQuoteDetails(new Set());
      setLoadingQuoteDetails(new Set());

      const [quotesRes, customersRes, productsRes, materialsRes, compositionsRes] = await Promise.all([
        supabase
          .from('quotes')
          .select(`
            id,
            customer_id,
            status,
            notes,
            created_at,
            updated_at,
            quote_type,
            structure_type,
            structure_description,
            square_meters,
            permit_count,
            payment_method,
            installments,
            installment_value,
            payment_notes,
            discount_percentage,
            discount_value,
            total_value,
            delivery_deadline,
            precos_congelados,
            snapshot_valores,
            data_congelamento,
            customers (name, person_type)
          `)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('customers').select('id, name, person_type').order('name').limit(500),
        supabase.from('products').select('id, name, sale_price, final_sale_price, unit').order('name').limit(500),
        supabase.from('materials').select('id, name, unit, unit_cost, resale_enabled, resale_tax_percentage, resale_margin_percentage, resale_price, package_size').order('name').limit(500),
        supabase.from('compositions').select('id, name, description, unit_cost').order('name').limit(200),
      ]);

      if (quotesRes.data) {
        const quotesBasic = quotesRes.data.map(quote => ({ ...quote, quote_items: [] }));
        setQuotes(quotesBasic);
      }
      if (customersRes.data) setCustomers(customersRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      if (materialsRes.data) setMaterials(materialsRes.data);
      if (compositionsRes.data) setCompositions(compositionsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuoteDetails = useCallback(async (quoteId: string) => {
    setLoadedQuoteDetails(prev => {
      if (prev.has(quoteId)) {
        return prev;
      }
      return prev;
    });

    setLoadingQuoteDetails(prev => {
      if (prev.has(quoteId) || loadedQuoteDetails.has(quoteId)) {
        return prev;
      }
      return new Set(prev).add(quoteId);
    });

    try {
      const { data: items, error } = await supabase
        .from('quote_items')
        .select(`
          *,
          products (name),
          materials (name, unit),
          compositions (name, total_cost)
        `)
        .eq('quote_id', quoteId);

      if (error) throw error;

      setQuotes(prevQuotes =>
        prevQuotes.map(quote =>
          quote.id === quoteId
            ? { ...quote, quote_items: items || [] }
            : quote
        )
      );

      setLoadedQuoteDetails(prev => new Set(prev).add(quoteId));
    } catch (error) {
      console.error('Erro ao carregar detalhes do orçamento:', error);
    } finally {
      setLoadingQuoteDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(quoteId);
        return newSet;
      });
    }
  }, [loadedQuoteDetails]);

  const loadData = loadBasicData;

  const handleProductChange = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setItemFormData(prev => ({
        ...prev,
        product_id: productId,
        material_id: '',
        composition_id: '',
        suggested_price: product.final_sale_price || 0,
        proposed_price: product.final_sale_price || 0,
      }));
    }
  }, [products]);

  const handleMaterialChange = useCallback((materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (material) {
      let suggestedPrice = material.unit_cost;

      if (material.resale_price > 0) {
        suggestedPrice = material.resale_price;
      } else if (material.resale_enabled) {
        const withTax = suggestedPrice * (1 + material.resale_tax_percentage / 100);
        suggestedPrice = withTax * (1 + material.resale_margin_percentage / 100);
      }

      setItemFormData(prev => ({
        ...prev,
        material_id: materialId,
        product_id: '',
        composition_id: '',
        suggested_price: suggestedPrice,
        proposed_price: suggestedPrice,
      }));
    }
  }, [materials]);

  const handleCompositionChange = useCallback((compositionId: string) => {
    const composition = compositions.find(c => c.id === compositionId);
    if (composition) {
      setItemFormData(prev => ({
        ...prev,
        composition_id: compositionId,
        product_id: '',
        material_id: '',
        suggested_price: composition.total_cost,
        proposed_price: composition.total_cost,
      }));
    }
  }, [compositions]);

  const handleItemTypeChange = useCallback((type: 'product' | 'material' | 'composition' | 'mao_de_obra') => {
    setItemFormData(prev => ({
      ...prev,
      item_type: type,
      product_id: '',
      material_id: '',
      composition_id: '',
      quantity: 0,
      suggested_price: 0,
      proposed_price: 0,
      discount_percentage: 0,
    }));
  }, []);

  const addItemToQuote = useCallback(() => {
    if (itemFormData.item_type === 'product' && !itemFormData.product_id) {
      alert('Selecione um produto');
      return;
    }
    if (itemFormData.item_type === 'material' && !itemFormData.material_id) {
      alert('Selecione um insumo');
      return;
    }
    if (itemFormData.item_type === 'composition' && !itemFormData.composition_id) {
      alert('Selecione uma composição');
      return;
    }
    if (itemFormData.item_type === 'mao_de_obra' && !itemFormData.notes) {
      alert('Informe a descrição do serviço de mão de obra');
      return;
    }

    const currentQuantity = parseFloat(localQuantity) || 0;
    if (currentQuantity <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }

    const currentProposedPrice = itemFormData.proposed_price || 0;
    if (currentProposedPrice <= 0) {
      alert('Valor praticado deve ser maior que zero');
      return;
    }

    let itemName = '';
    if (itemFormData.item_type === 'product') {
      const product = products.find(p => p.id === itemFormData.product_id);
      itemName = product?.name || '';
    } else if (itemFormData.item_type === 'material') {
      const material = materials.find(m => m.id === itemFormData.material_id);
      itemName = material?.name || '';
    } else if (itemFormData.item_type === 'composition') {
      const composition = compositions.find(c => c.id === itemFormData.composition_id);
      itemName = composition?.name || '';
    } else if (itemFormData.item_type === 'mao_de_obra') {
      itemName = itemFormData.notes || 'Serviço de Mão de Obra';
    }

    const newItem: QuoteItem = {
      tempId: Math.random().toString(),
      item_type: itemFormData.item_type,
      product_id: itemFormData.item_type === 'product' ? itemFormData.product_id : null,
      material_id: itemFormData.item_type === 'material' ? itemFormData.material_id : null,
      composition_id: itemFormData.item_type === 'composition' ? itemFormData.composition_id : null,
      item_name: itemName,
      quantity: currentQuantity,
      suggested_price: itemFormData.suggested_price,
      proposed_price: currentProposedPrice,
      notes: itemFormData.notes,
    };

    setQuoteItems(prev => [...prev, newItem]);

    setLocalQuantity('0');
    setLocalDiscount('0');
    setItemFormData({
      item_type: 'product',
      product_id: '',
      material_id: '',
      composition_id: '',
      quantity: 0,
      suggested_price: 0,
      proposed_price: 0,
      discount_percentage: 0,
      notes: '',
    });
  }, [itemFormData, products, materials, compositions, localQuantity]);

  const removeItemFromQuote = useCallback((tempId: string) => {
    setQuoteItems(prev => prev.filter(item => item.tempId !== tempId));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      alert('Selecione um cliente');
      return;
    }

    if (quoteItems.length === 0) {
      alert('Adicione pelo menos um item ao orçamento');
      return;
    }

    try {
      const totalValue = quoteItems.reduce((sum, item) => sum + (item.quantity * item.proposed_price), 0);

      if (editingId) {
        // Primeiro atualizar itens, DEPOIS mudar o status (para não disparar o trigger antes dos itens existirem)
        await supabase.from('quote_items').delete().eq('quote_id', editingId);

        const itemsToInsert = quoteItems.map(item => ({
          quote_id: editingId,
          item_type: item.item_type,
          product_id: item.product_id || null,
          material_id: item.material_id || null,
          composition_id: item.composition_id || null,
          quantity: item.quantity,
          suggested_price: item.suggested_price,
          proposed_price: item.proposed_price,
          notes: item.notes || '',
        }));

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // Agora sim, atualizar o orçamento (incluindo status) - isso vai disparar o trigger se status = 'approved'
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            customer_id: formData.customer_id,
            status: formData.status,
            notes: formData.notes,
            quote_type: formData.quote_type || null,
            structure_type: formData.structure_type || null,
            structure_description: formData.structure_description || '',
            square_meters: formData.square_meters || 0,
            permit_count: formData.permit_count || 0,
            delivery_deadline: formData.delivery_deadline || null,
            total_value: totalValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (quoteError) throw quoteError;

        alert('Orçamento atualizado com sucesso!');
      } else {
        const { data: newQuote, error: quoteError } = await supabase
          .from('quotes')
          .insert({
            customer_id: formData.customer_id,
            status: formData.status,
            notes: formData.notes,
            quote_type: formData.quote_type || null,
            structure_type: formData.structure_type || null,
            structure_description: formData.structure_description || '',
            square_meters: formData.square_meters || 0,
            permit_count: formData.permit_count || 0,
            delivery_deadline: formData.delivery_deadline || null,
            total_value: totalValue,
          })
          .select()
          .single();

        if (quoteError) throw quoteError;

        const itemsToInsert = quoteItems.map(item => ({
          quote_id: newQuote.id,
          item_type: item.item_type,
          product_id: item.product_id || null,
          material_id: item.material_id || null,
          composition_id: item.composition_id || null,
          quantity: item.quantity,
          suggested_price: item.suggested_price,
          proposed_price: item.proposed_price,
          notes: item.notes || '',
        }));

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        alert('Orçamento criado com sucesso!');
      }

      setFormData({
        customer_id: '',
        status: 'pending',
        notes: '',
        quote_type: '',
        structure_type: '',
        structure_description: '',
        square_meters: 0,
        permit_count: 0,
        delivery_deadline: '',
      });
      setQuoteItems([]);
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      alert('Erro ao salvar orçamento');
    }
  };

  const togglePriceFreezeHandler = async () => {
    if (!editingId) return;

    try {
      if (pricesFrozen) {
        // Descongelar preços
        const { error } = await supabase.rpc('unfreeze_quote_prices', {
          p_quote_id: editingId
        });

        if (error) throw error;

        setPricesFrozen(false);
        setFrozenSnapshot(null);
        alert('Preços descongelados com sucesso! Os valores serão calculados em tempo real.');
        loadData();
      } else {
        // Congelar preços
        const { data, error } = await supabase.rpc('freeze_quote_prices', {
          p_quote_id: editingId
        });

        if (error) throw error;

        setPricesFrozen(true);
        setFrozenSnapshot(data);
        alert('Preços congelados com sucesso! Os valores deste orçamento não serão mais atualizados automaticamente.');
        loadData();
      }
    } catch (error) {
      console.error('Erro ao congelar/descongelar preços:', error);
      alert('Erro ao processar solicitação');
    }
  };

  const handleEdit = useCallback(async (quote: Quote) => {
    const startTime = performance.now();
    console.log('[Performance] Iniciando edição de orçamento:', quote.id);

    // Carregar estados de congelamento
    setPricesFrozen(quote.precos_congelados || false);
    setFrozenSnapshot(quote.snapshot_valores || null);

    setFormData({
      customer_id: quote.customer_id,
      status: quote.status,
      notes: quote.notes || '',
      quote_type: (quote.quote_type as 'complete_construction' | 'materials_only' | '') || '',
      structure_type: quote.structure_type || '',
      structure_description: quote.structure_description || '',
      square_meters: quote.square_meters || 0,
      permit_count: quote.permit_count || 0,
      delivery_deadline: quote.delivery_deadline || '',
    });

    const { data: items } = await supabase
      .from('quote_items')
      .select(`
        *,
        products (name),
        materials (name),
        compositions (name)
      `)
      .eq('quote_id', quote.id);

    const loadTime = performance.now() - startTime;
    console.log('[Performance] Itens carregados em:', loadTime.toFixed(2), 'ms');

    if (items) {
      const mappedItems = items.map(item => {
        let itemName = item.item_name;

        if (!itemName) {
          if (item.item_type === 'product' && item.products) {
            itemName = (item.products as any).name;
          } else if (item.item_type === 'material' && item.materials) {
            itemName = (item.materials as any).name;
          } else if (item.item_type === 'composition' && item.compositions) {
            itemName = (item.compositions as any).name;
          } else if (item.item_type === 'mao_de_obra') {
            itemName = item.item_name || 'Serviço de Mão de Obra';
          }
        }

        return {
          ...item,
          tempId: Math.random().toString(),
          item_name: itemName,
        };
      });
      setQuoteItems(mappedItems);
    }

    const totalTime = performance.now() - startTime;
    console.log('[Performance] Edição pronta em:', totalTime.toFixed(2), 'ms - Itens:', items?.length || 0);

    setEditingId(quote.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStatusChange = async (quoteId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      setLoading(true);

      if (newStatus === 'approved') {
        setPendingStatusChange({ quoteId, newStatus });

        const quote = quotes.find(q => q.id === quoteId);
        if (quote) {
          await checkCustomerWorks(quote.customer_id, quoteId);
        } else {
          await checkStockAndShowDialog(quoteId);
        }
      } else {
        await updateQuoteStatus(quoteId, newStatus);
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status do orçamento. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const checkCustomerWorks = async (customerId: string, quoteId: string) => {
    try {
      const { data: works, error } = await supabase
        .from('construction_works')
        .select('id, customer_id, work_name, status, address, start_date')
        .eq('customer_id', customerId)
        .in('status', ['em_andamento', 'pausada'])
        .limit(50);

      if (error) {
        console.error('Erro ao buscar obras:', error);
        await checkStockAndShowDialog(quoteId);
        return;
      }

      if (works && works.length > 0) {
        setCustomerWorks(works);
        setShowWorkLinkDialog(true);
      } else {
        await checkStockAndShowDialog(quoteId);
      }
    } catch (error) {
      console.error('Erro ao verificar obras:', error);
      await checkStockAndShowDialog(quoteId);
    }
  };

  const handleWorkLinkDecision = async (linkToWork: boolean) => {
    try {
      if (linkToWork && selectedWorkId && pendingStatusChange) {
        await linkQuoteToWork(pendingStatusChange.quoteId, selectedWorkId);
      }

      setShowWorkLinkDialog(false);
      setSelectedWorkId('');
      setCustomerWorks([]);

      if (pendingStatusChange) {
        await checkStockAndShowDialog(pendingStatusChange.quoteId);
      }
    } catch (error) {
      console.error('Erro ao processar decisão de vinculação:', error);
      alert('Erro ao processar vinculação. O orçamento será aprovado normalmente.');
      setShowWorkLinkDialog(false);
      if (pendingStatusChange) {
        await checkStockAndShowDialog(pendingStatusChange.quoteId);
      }
    }
  };

  const linkQuoteToWork = async (quoteId: string, workId: string) => {
    try {
      // Verificar se o orçamento já foi vinculado a esta obra
      const { data: existingLinks, error: checkError } = await supabase
        .from('construction_work_items')
        .select('id')
        .eq('work_id', workId)
        .eq('quote_id', quoteId)
        .limit(1);

      if (checkError) {
        console.error('Erro ao verificar vinculação existente:', checkError);
        throw checkError;
      }

      if (existingLinks && existingLinks.length > 0) {
        alert('Este orçamento já está vinculado a esta obra. Os itens não serão duplicados.');
        return; // Sai da função sem vincular novamente
      }

      const { data: quoteItems, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          products (id, name, unit),
          materials (id, name, unit),
          compositions (id, name)
        `)
        .eq('quote_id', quoteId);

      if (itemsError) {
        console.error('Erro ao buscar itens do orçamento:', itemsError);
        throw itemsError;
      }

      console.log('Itens do orçamento:', quoteItems);

      if (quoteItems && quoteItems.length > 0) {
        const workItems = quoteItems.map(item => {
          let itemName = 'Item sem nome';
          let itemUnit = '';
          let productId = null;
          let materialId = null;
          let compositionId = null;

          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          const material = Array.isArray(item.materials) ? item.materials[0] : item.materials;
          const composition = Array.isArray(item.compositions) ? item.compositions[0] : item.compositions;

          if (item.item_type === 'product' && product) {
            itemName = product.name || 'Produto sem nome';
            itemUnit = product.unit || '';
            productId = item.product_id;
          } else if (item.item_type === 'material' && material) {
            itemName = material.name || 'Material sem nome';
            itemUnit = material.unit || '';
            materialId = item.material_id;
          } else if (item.item_type === 'composition' && composition) {
            itemName = composition.name || 'Composição sem nome';
            itemUnit = 'un';
          } else if (item.item_type === 'mao_de_obra') {
            itemName = item.item_name || item.notes || 'Serviço de Mão de Obra';
            itemUnit = 'un';
            compositionId = item.composition_id;
          }

          return {
            work_id: workId,
            quote_id: quoteId,
            quote_item_id: item.id,
            item_type: item.item_type,
            item_name: itemName,
            quantity: Number(item.quantity),
            unit_price: Number(item.proposed_price),
            total_price: Number(item.quantity) * Number(item.proposed_price),
            unit: itemUnit || null,
            product_id: productId,
            material_id: materialId,
            composition_id: compositionId,
            notes: item.notes || null
          };
        });

        console.log('Itens preparados para inserção:', workItems);

        const { error: insertError } = await supabase
          .from('construction_work_items')
          .insert(workItems);

        if (insertError) {
          console.error('Erro detalhado ao vincular itens à obra:', insertError);
          alert(`Erro ao vincular itens: ${insertError.message}`);
          throw insertError;
        }

        alert('Orçamento vinculado à obra com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao vincular orçamento à obra:', error);
      alert(`Erro ao vincular orçamento à obra: ${error.message || 'Erro desconhecido'}`);
      throw error;
    }
  };

  const updateQuoteStatus = async (quoteId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      const currentQuote = quotes.find(q => q.id === quoteId);
      const wasApproved = currentQuote?.status === 'approved';

      const { error } = await supabase
        .from('quotes')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', quoteId);

      if (error) throw error;

      await loadData();

      if (newStatus === 'approved') {
        alert('Orçamento aprovado com sucesso!\n\nUma venda foi criada automaticamente no módulo Financeiro > Vendas.');
      } else if (newStatus === 'rejected') {
        if (wasApproved) {
          alert('Orçamento rejeitado.\n\nAs entregas pendentes foram canceladas e o estoque reservado foi liberado automaticamente.');
        } else {
          alert('Orçamento rejeitado.');
        }
      } else {
        alert('Status atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  };

  const processStockCheck = async (quoteId: string, quote: any, productItems: any[]) => {
    const productIds = productItems.map(item => item.product_id!).filter(Boolean);

    const [stockViewRes, productsRes] = await Promise.all([
      supabase
        .from('product_stock_view')
        .select('product_id, available_stock, quantity_reserved')
        .in('product_id', productIds),
      supabase
        .from('products')
        .select('id, name, minimum_stock')
        .in('id', productIds),
    ]);

    if (stockViewRes.error) {
      console.error('Erro ao buscar estoque:', stockViewRes.error);
      throw stockViewRes.error;
    }
    if (productsRes.error) {
      console.error('Erro ao buscar produtos:', productsRes.error);
      throw productsRes.error;
    }

    const stockMap = new Map<string, number>();
    stockViewRes.data?.forEach(sv => {
      stockMap.set(sv.product_id, parseFloat(sv.available_stock?.toString() || '0'));
    });

    const productsMap = new Map(productsRes.data?.map(p => [p.id, p]) || []);

    const stockCheckData = productItems.map(item => {
      const product = productsMap.get(item.product_id!);
      const currentStock = stockMap.get(item.product_id!) || 0;
      const minStock = product?.minimum_stock || 0;
      const quantityNeeded = item.quantity;
      const needsProduction = currentStock < quantityNeeded || currentStock < minStock;

      return {
        quoteItemId: item.id || item.tempId || '',
        productId: item.product_id!,
        productName: product?.name || 'Produto desconhecido',
        quantityNeeded,
        quantityInStock: currentStock,
        minimumStock: minStock,
        needsProduction,
        selected: needsProduction,
      };
    });

    const itemsNeedingProduction = stockCheckData.filter(item => item.needsProduction);

    if (itemsNeedingProduction.length === 0) {
      await updateQuoteStatus(quoteId, 'approved');
    } else {
      setStockCheckItems(stockCheckData);
      setSelectedQuote(quote);
      setShowStockCheckDialog(true);
    }
  };

  const checkStockAndShowDialog = async (quoteId: string) => {
    try {
      console.log('Iniciando verificação de estoque para orçamento:', quoteId);
      const quote = quotes.find(q => q.id === quoteId);
      if (!quote) {
        console.log('Orçamento não encontrado no estado local, buscando do banco...');
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            *,
            customers (name, person_type),
            quote_items (*)
          `)
          .eq('id', quoteId)
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error('Orçamento não encontrado');
        }

        console.log('Orçamento carregado do banco:', data);

        if (!data.quote_items || data.quote_items.length === 0) {
          console.log('Orçamento sem itens, aprovando diretamente');
          await updateQuoteStatus(quoteId, 'approved');
          return;
        }

        const productItems = data.quote_items.filter((item: any) => item.item_type === 'product' && item.product_id);
        if (productItems.length === 0) {
          console.log('Nenhum produto no orçamento, aprovando diretamente');
          await updateQuoteStatus(quoteId, 'approved');
          return;
        }

        await processStockCheck(quoteId, data, productItems);
        return;
      }

      if (!quote.quote_items || quote.quote_items.length === 0) {
        console.log('Orçamento sem itens, aprovando diretamente');
        await updateQuoteStatus(quoteId, 'approved');
        return;
      }

      console.log('Orçamento encontrado:', quote);
      const productItems = quote.quote_items.filter(item => item.item_type === 'product' && item.product_id);
      console.log('Itens de produto no orçamento:', productItems);

      if (productItems.length === 0) {
        console.log('Nenhum produto no orçamento, aprovando diretamente');
        await updateQuoteStatus(quoteId, 'approved');
        return;
      }

      await processStockCheck(quoteId, quote, productItems);
    } catch (error: any) {
      console.error('Erro ao verificar estoque:', error);
      alert(`Erro ao verificar estoque dos produtos: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  const toggleStockItemSelection = (productId: string) => {
    setStockCheckItems(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleConfirmStockCheck = async () => {
    if (!pendingStatusChange || !selectedQuote) {
      console.log('Cancelado: pendingStatusChange ou selectedQuote não encontrado');
      return;
    }

    try {
      const selectedItems = stockCheckItems.filter(item => item.selected);
      console.log('Itens selecionados para ordem de produção:', selectedItems);

      if (selectedItems.length > 0) {
        const deliveryDeadline = selectedQuote.delivery_deadline;
        let productionDeadline: Date | null = null;

        if (deliveryDeadline) {
          productionDeadline = new Date(deliveryDeadline + 'T00:00:00');
          productionDeadline.setDate(productionDeadline.getDate() - 2);
        }

        console.log('Prazo de entrega:', deliveryDeadline);
        console.log('Prazo de produção calculado:', productionDeadline);

        const { data: maxOrderNumber, error: maxOrderError } = await supabase
          .from('production_orders')
          .select('order_number')
          .order('order_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxOrderError) {
          console.error('Erro ao buscar último número de ordem:', maxOrderError);
          throw maxOrderError;
        }

        const nextOrderNumber = (maxOrderNumber?.order_number || 0) + 1;
        console.log('Próximo número de ordem:', nextOrderNumber);

        const totalQuantitySum = selectedItems.reduce((sum, item) => sum + Math.ceil(item.quantityNeeded), 0);

        const orderToCreate = {
          quote_id: pendingStatusChange.quoteId,
          customer_id: selectedQuote.customer_id,
          product_id: selectedItems.length === 1 ? selectedItems[0].productId : null,
          total_quantity: totalQuantitySum,
          produced_quantity: 0,
          remaining_quantity: totalQuantitySum,
          status: 'open',
          notes: `Ordem criada automaticamente ao aprovar orçamento. ${selectedItems.length} item(ns) incluído(s).`,
          order_number: nextOrderNumber,
          deadline: productionDeadline ? productionDeadline.toISOString().split('T')[0] : null,
        };

        console.log('Ordem a ser criada:', orderToCreate);

        const { data: insertedOrder, error: orderError } = await supabase
          .from('production_orders')
          .insert(orderToCreate)
          .select()
          .single();

        if (orderError) {
          console.error('Erro detalhado ao inserir ordem:', orderError);
          alert(`Erro ao criar ordem de produção: ${orderError.message}`);
          throw orderError;
        }

        console.log('Ordem criada com sucesso:', insertedOrder);

        const orderItemsToCreate = selectedItems.map(item => {
          const totalQty = Math.ceil(item.quantityNeeded);
          return {
            production_order_id: insertedOrder.id,
            quote_item_id: item.quoteItemId,
            item_type: 'product',
            product_id: item.productId,
            quantity: totalQty,
            produced_quantity: 0,
            unit_price: 0,
            notes: `Estoque atual: ${item.quantityInStock} ${item.quantityInStock < item.minimumStock ? '(abaixo do mínimo)' : ''}`,
          };
        });

        console.log('Itens da ordem a serem criados:', orderItemsToCreate);

        const { error: itemsError } = await supabase
          .from('production_order_items')
          .insert(orderItemsToCreate);

        if (itemsError) {
          console.error('Erro ao inserir itens da ordem:', itemsError);
          alert(`Erro ao criar itens da ordem de produção: ${itemsError.message}`);
          throw itemsError;
        }

        console.log('Itens da ordem criados com sucesso');
        alert(`Ordem de produção criada com sucesso!\nNúmero: ${nextOrderNumber}\nItens: ${selectedItems.length}${productionDeadline ? `\nPrazo: ${productionDeadline.toLocaleDateString('pt-BR')}` : ''}`);
      } else {
        console.log('Nenhum item selecionado para criar ordem de produção');
      }

      await updateQuoteStatus(pendingStatusChange.quoteId, 'approved');

      setShowStockCheckDialog(false);
      setStockCheckItems([]);
      setPendingStatusChange(null);
      setSelectedQuote(null);
    } catch (error: any) {
      console.error('Erro ao criar ordens de produção:', error);
      alert(`Erro ao criar ordens de produção: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  const handleCancelStockCheck = () => {
    setShowStockCheckDialog(false);
    setStockCheckItems([]);
    setPendingStatusChange(null);
    setSelectedQuote(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento e todos os seus itens?')) return;

    try {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
      loadData();
      alert('Orçamento excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir orçamento:', error);
      alert('Erro ao excluir orçamento');
    }
  };

  const handleCancel = () => {
    setFormData({
      customer_id: '',
      status: 'pending',
      notes: '',
      quote_type: '',
      structure_type: '',
      structure_description: '',
      square_meters: 0,
      permit_count: 0,
      delivery_deadline: '',
    });
    setPricesFrozen(false);
    setFrozenSnapshot(null);
    setQuoteItems([]);
    setEditingId(null);
  };

  const handlePrint = async (quote: Quote) => {
    try {
      let items = quote.quote_items || [];

      if (!items.length || !items[0]?.products) {
        const { data: quoteItems, error } = await supabase
          .from('quote_items')
          .select(`
            *,
            products (name),
            materials (name, unit),
            compositions (name, total_cost)
          `)
          .eq('quote_id', quote.id);

        if (error) {
          console.error('Erro ao carregar itens:', error);
          alert('Erro ao carregar itens do orçamento');
          return;
        }

        items = quoteItems || [];
      }

      const doc = new jsPDF();
      let currentY = 14;

      const headerTitle = companySettings.report_header_title || 'ORÇAMENTO';
      const headerSubtitle = companySettings.report_header_subtitle || 'Sistema de Gestão';
      const footerText = companySettings.report_footer_text || 'Documento gerado automaticamente pelo sistema';
      const showCompanyInfo = companySettings.report_show_company_info === 'true';
      const showLogo = companySettings.report_show_logo === 'true';
      const companyName = companySettings.company_trade_name || companySettings.company_name || '';
      const logoUrl = companySettings.company_logo_url;

      const pageWidth = doc.internal.pageSize.width;
      const rightMargin = pageWidth - 14;
      const logoWidth = 40;
      const logoHeight = 20;
      let logoStartY = currentY;

      if (showLogo && logoUrl) {
        try {
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const reader = new FileReader();

          await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const logoData = reader.result as string;
          doc.addImage(logoData, 'PNG', rightMargin - logoWidth, logoStartY, logoWidth, logoHeight);
        } catch (error) {
          console.error('Erro ao carregar logo:', error);
        }
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(headerTitle, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
      currentY += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(headerSubtitle, 14, currentY);
      currentY += 8;

      if (companyName) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, 14, currentY);
        currentY += 6;
      }

      if (showCompanyInfo) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const companyInfo = [];
        const address = [
          companySettings.company_address_street,
          companySettings.company_address_number,
          companySettings.company_address_neighborhood,
          companySettings.company_address_city,
          companySettings.company_address_state
        ].filter(Boolean).join(', ');

        if (address) companyInfo.push(address);
        if (companySettings.company_phone) companyInfo.push(`Tel: ${companySettings.company_phone}`);
        if (companySettings.company_email) companyInfo.push(`Email: ${companySettings.company_email}`);

        companyInfo.forEach(info => {
          doc.text(info, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
          currentY += 4;
        });
        currentY += 2;
      }

      if (showLogo && logoUrl && currentY < (logoStartY + logoHeight)) {
        currentY = logoStartY + logoHeight + 4;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;

      const customer = customers.find(c => c.id === quote.customer_id);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DO CLIENTE', 14, currentY);
      currentY += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cliente: ${customer?.name || 'N/A'}`, 14, currentY);
      currentY += 5;
      doc.text(`Tipo: ${customer?.person_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}`, 14, currentY);
      currentY += 5;
      doc.text(`Data: ${new Date(quote.created_at).toLocaleDateString('pt-BR')}`, 14, currentY);
      currentY += 5;
      doc.text(`Status: ${getStatusLabel(quote.status)}`, 14, currentY);
      currentY += 5;

      if (quote.delivery_deadline) {
        doc.setFont('helvetica', 'bold');
        doc.text(`Prazo de Entrega: ${new Date(quote.delivery_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, currentY);
        doc.setFont('helvetica', 'normal');
        currentY += 5;
      }

      currentY += 3;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ITENS DO ORÇAMENTO', 14, currentY);
      currentY += 6;

      const tableData = items.map(item => {
        const itemName = item.item_type === 'product' ? item.products?.name :
                         item.item_type === 'material' ? item.materials?.name :
                         item.item_type === 'composition' ? item.compositions?.name :
                         item.item_name;
        const itemType = item.item_type === 'product' ? 'Produto' :
                         item.item_type === 'material' ? 'Insumo' :
                         item.item_type === 'composition' ? 'Composição' : 'Mão de Obra';

        return [
          itemName || 'N/A',
          itemType,
          Number(item.quantity).toFixed(2),
          `R$ ${item.proposed_price.toFixed(2)}`,
          `R$ ${(Number(item.quantity) * item.proposed_price).toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Item', 'Tipo', 'Qtd', 'Valor Unit.', 'Total']],
        body: tableData,
        headStyles: {
          fillColor: [10, 126, 194],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 10
        },
        bodyStyles: {
          textColor: [50, 50, 50],
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' }
        },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      if (quote.payment_method) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('FORMA DE PAGAMENTO', 14, currentY);
        currentY += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Método: ${getPaymentMethodLabel(quote.payment_method)}`, 14, currentY);
        currentY += 5;

        if (quote.installments) {
          doc.text(`Parcelas: ${quote.installments}x de R$ ${quote.installment_value?.toFixed(2)}`, 14, currentY);
          currentY += 5;
        }

        if (quote.discount_value && quote.discount_value > 0) {
          doc.text(`Desconto: R$ ${quote.discount_value.toFixed(2)}`, 14, currentY);
          currentY += 5;
        }

        if (quote.payment_notes) {
          doc.text(`Observações: ${quote.payment_notes}`, 14, currentY);
          currentY += 5;
        }

        currentY += 3;
      }

      if (quote.notes) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OBSERVAÇÕES', 14, currentY);
        currentY += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 28);
        doc.text(splitNotes, 14, currentY);
        currentY += (splitNotes.length * 5) + 3;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 6;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 126, 194);
      doc.text(`VALOR TOTAL: R$ ${(quote.total_value || 0).toFixed(2)}`, 14, currentY);
      currentY += 12;

      const pageHeight = doc.internal.pageSize.height;
      const signatureY = pageHeight - 40;

      if (currentY < signatureY) {
        currentY = signatureY;
      }

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const leftSignatureX = 14;
      const rightSignatureX = 110;
      const signatureWidth = 80;

      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.line(leftSignatureX, currentY, leftSignatureX + signatureWidth, currentY);
      doc.line(rightSignatureX, currentY, rightSignatureX + signatureWidth, currentY);

      currentY += 4;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Aliancer Engenharia e Topografia LTDA', leftSignatureX + (signatureWidth / 2), currentY, { align: 'center' });
      doc.text(customer?.name || 'Cliente', rightSignatureX + (signatureWidth / 2), currentY, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100);
      doc.text(footerText, 14, pageHeight - 10);
      doc.text('Página 1', 196, pageHeight - 10, { align: 'right' });

      doc.save(`orcamento_${customer?.name || 'cliente'}_${new Date(quote.created_at).toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF do orçamento');
    }
  };

  const handlePaymentDialogOpen = async (quote: Quote) => {
    setSelectedQuote(quote);
    setPaymentData({
      payment_method: quote.payment_method || '',
      installments: quote.installments || 0,
      installment_value: quote.installment_value || 0,
      payment_notes: quote.payment_notes || '',
      discount_percentage: quote.discount_percentage || 0,
      discount_value: quote.discount_value || 0,
      credit_applied: 0,
    });
    setCustomerCreditBalance(0);
    if (quote.customer_id) {
      const { data } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', quote.customer_id)
        .maybeSingle();
      setCustomerCreditBalance(data?.credit_balance || 0);
    }
    setShowPaymentDialog(true);
  };

  const handleSavePayment = async () => {
    if (!selectedQuote) return;

    try {
      let totalValue = selectedQuote.total_value || 0;
      if (paymentData.discount_value > 0) {
        totalValue -= paymentData.discount_value;
      }
      if (paymentData.credit_applied > 0) {
        totalValue -= paymentData.credit_applied;
        if (totalValue < 0) totalValue = 0;
      }

      const installmentValue = paymentData.installments > 0
        ? totalValue / paymentData.installments
        : 0;

      const { error } = await supabase
        .from('quotes')
        .update({
          payment_method: paymentData.payment_method || null,
          installments: paymentData.installments || null,
          installment_value: installmentValue || null,
          payment_notes: paymentData.payment_notes || null,
          discount_percentage: paymentData.discount_percentage || null,
          discount_value: paymentData.discount_value || null,
          total_value: totalValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedQuote.id);

      if (error) throw error;

      if (paymentData.credit_applied > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: creditError } = await supabase.rpc('use_customer_credit', {
          p_customer_id: selectedQuote.customer_id,
          p_amount: paymentData.credit_applied,
          p_applied_to_type: 'quote',
          p_applied_to_id: selectedQuote.id,
          p_description: `Saldo aplicado no orcamento ${selectedQuote.id.substring(0, 8)}`,
          p_created_by: user?.id || null
        });
        if (creditError) throw creditError;
      }

      alert('Forma de pagamento salva com sucesso!');
      setShowPaymentDialog(false);
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar forma de pagamento:', error);
      alert('Erro ao salvar forma de pagamento: ' + (error?.message || ''));
    }
  };

  const toggleQuoteExpansion = useCallback(async (quoteId: string) => {
    setExpandedQuotes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(quoteId)) {
        newExpanded.delete(quoteId);
      } else {
        newExpanded.add(quoteId);
        loadQuoteDetails(quoteId);
      }
      return newExpanded;
    });
  }, [loadQuoteDetails]);

  const getStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      default: return status;
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border border-red-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  }, []);

  const getPaymentMethodLabel = useCallback((method: string) => {
    const methods: Record<string, string> = {
      cash: 'Dinheiro',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      pix: 'PIX',
      bank_transfer: 'Transferência Bancária',
      installments: 'Parcelado',
      other: 'Outro',
    };
    return methods[method] || method;
  }, []);

  const calculateQuoteSummary = useMemo(() => {
    const subtotal = quoteItems.reduce((sum, item) => sum + (item.quantity * item.proposed_price), 0);
    const itemsCount = quoteItems.length;
    const totalQuantity = quoteItems.reduce((sum, item) => sum + item.quantity, 0);

    const averageDiscount = itemsCount > 0
      ? quoteItems.reduce((sum, item) => {
          const discount = ((item.suggested_price - item.proposed_price) / item.suggested_price) * 100;
          return sum + (isNaN(discount) ? 0 : discount);
        }, 0) / itemsCount
      : 0;

    return {
      subtotal,
      itemsCount,
      totalQuantity,
      averageDiscount: isNaN(averageDiscount) ? 0 : averageDiscount,
    };
  }, [quoteItems]);

  const calculateTotal = useMemo(() => {
    return calculateQuoteSummary.subtotal;
  }, [calculateQuoteSummary]);

  const stockItemsNeedingProduction = useMemo(() => {
    return stockCheckItems.filter(item => item.needsProduction);
  }, [stockCheckItems]);

  const stockItemsWithSufficientStock = useMemo(() => {
    return stockCheckItems.filter(item => !item.needsProduction);
  }, [stockCheckItems]);

  const selectedStockItemsCount = useMemo(() => {
    return stockCheckItems.filter(item => item.selected).length;
  }, [stockCheckItems]);

  const filteredQuotes = useMemo(() => {
    if (!debouncedSearchTerm) return quotes;

    const term = debouncedSearchTerm.toLowerCase();
    return quotes.filter(quote => {
      const customerName = quote.customers?.name?.toLowerCase() || '';
      const status = getStatusLabel(quote.status).toLowerCase();
      const notes = quote.notes?.toLowerCase() || '';
      const quoteType = quote.quote_type?.toLowerCase() || '';

      return (
        customerName.includes(term) ||
        status.includes(term) ||
        notes.includes(term) ||
        quoteType.includes(term)
      );
    });
  }, [quotes, debouncedSearchTerm, getStatusLabel]);

  const pagination = usePagination(filteredQuotes.length, 20);

  const paginatedQuotes = useMemo(() => {
    return filteredQuotes.slice(pagination.startIndex, pagination.endIndex);
  }, [filteredQuotes, pagination.startIndex, pagination.endIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {receivableId && onBackToSale && (
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 border-2 border-blue-300 rounded-lg p-4 shadow-md">
          <button
            onClick={() => onBackToSale(receivableId)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Venda
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Você acessou este orçamento via módulo de vendas. Clique no botão acima para voltar à venda.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#0A7EC2]" />
          {editingId ? 'Editar Orçamento' : 'Novo Orçamento'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente *
              </label>
              <select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                required
              >
                <option value="">Selecione um cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.person_type === 'pf' ? 'PF' : 'PJ'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'approved' | 'rejected' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                required
              >
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>
          </div>

          {/* Toggle de Congelamento de Preços */}
          {editingId && (
            <div className={`border-2 rounded-lg p-4 ${pricesFrozen ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {pricesFrozen ? (
                    <Lock className="w-5 h-5 text-amber-600" />
                  ) : (
                    <Unlock className="w-5 h-5 text-gray-600" />
                  )}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pricesFrozen}
                        onChange={togglePriceFreezeHandler}
                        className="w-5 h-5 text-[#0A7EC2] border-gray-300 rounded focus:ring-[#0A7EC2]"
                      />
                      <span className="font-medium text-gray-900">
                        Congelar Preços
                      </span>
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      {pricesFrozen ? (
                        <>
                          <strong>Preços congelados desde {frozenSnapshot?.frozen_at ? new Date(frozenSnapshot.frozen_at).toLocaleString('pt-BR') : 'data desconhecida'}</strong>
                          <br />
                          Os valores deste orçamento não serão atualizados automaticamente. Os preços dos produtos no sistema continuam atualizando normalmente.
                        </>
                      ) : (
                        'Congela os valores deste orçamento, criando um snapshot dos preços atuais. Os preços dos produtos no sistema continuam atualizando normalmente.'
                      )}
                    </p>
                  </div>
                </div>
                {pricesFrozen && frozenSnapshot?.totals && (
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Valor Congelado</div>
                    <div className="text-xl font-bold text-amber-600">
                      R$ {parseFloat(frozenSnapshot.totals.final_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                rows={3}
                placeholder="Observações gerais do orçamento..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prazo de Entrega (opcional)
              </label>
              <input
                type="date"
                value={formData.delivery_deadline}
                onChange={(e) => setFormData({ ...formData, delivery_deadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Data estimada para entrega/conclusão</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Adicionar Item ao Orçamento</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Item *
                </label>
                <select
                  value={itemFormData.item_type}
                  onChange={(e) => handleItemTypeChange(e.target.value as 'product' | 'material' | 'composition' | 'mao_de_obra')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                >
                  <option value="product">Produto</option>
                  <option value="material">Insumo</option>
                  <option value="composition">Composição</option>
                  <option value="mao_de_obra">Mão de Obra</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {itemFormData.item_type === 'product' ? 'Produto' :
                   itemFormData.item_type === 'material' ? 'Insumo' :
                   itemFormData.item_type === 'composition' ? 'Composição' : 'Descrição do Serviço'} *
                </label>
                {itemFormData.item_type === 'product' ? (
                  <select
                    value={itemFormData.product_id}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  >
                    <option value="">Selecione um produto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                ) : itemFormData.item_type === 'material' ? (
                  <>
                    <select
                      value={itemFormData.material_id}
                      onChange={(e) => handleMaterialChange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    >
                      <option value="">Selecione um insumo</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} ({material.unit})
                          {material.resale_price > 0 ? ' - Embalagem' : material.resale_enabled ? ' - Revenda' : ''}
                        </option>
                      ))}
                    </select>
                    {itemFormData.material_id && (() => {
                      const selectedMaterial = materials.find(m => m.id === itemFormData.material_id);
                      if (!selectedMaterial) return null;

                      if (selectedMaterial.resale_price > 0) {
                        return (
                          <div className="mt-2 bg-green-50 border border-green-200 rounded p-2">
                            <p className="text-xs text-green-700">
                              <strong>Preço da Embalagem:</strong> R$ {selectedMaterial.resale_price.toFixed(2)} por embalagem de {selectedMaterial.package_size} {selectedMaterial.unit}
                            </p>
                          </div>
                        );
                      } else if (selectedMaterial.resale_enabled) {
                        return (
                          <div className="mt-2 bg-green-50 border border-green-200 rounded p-2">
                            <p className="text-xs text-green-700">
                              <strong>Preço de Revenda:</strong> Custo + Impostos ({selectedMaterial.resale_tax_percentage}%) + Margem ({selectedMaterial.resale_margin_percentage}%)
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
                            <p className="text-xs text-blue-700">
                              <strong>Apenas Custo:</strong> Este insumo não tem revenda habilitada. Preço baseado apenas no custo unitário.
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </>
                ) : itemFormData.item_type === 'composition' ? (
                  <select
                    value={itemFormData.composition_id}
                    onChange={(e) => handleCompositionChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  >
                    <option value="">Selecione uma composição</option>
                    {compositions.map((composition) => (
                      <option key={composition.id} value={composition.id}>
                        {composition.name} - R$ {composition.total_cost.toFixed(2)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={itemFormData.notes || ''}
                    onChange={(e) => setItemFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Ex: Pedreiro, Eletricista, Pintor..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  />
                )}
              </div>
            </div>

            {itemFormData.item_type === 'material' && (
              <div className="mb-4 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="flex-1">
                    <p className="text-sm text-blue-800">
                      <strong>Venda Direta de Insumos:</strong> O sistema utiliza automaticamente:<br/>
                      1. <strong>Preço da Embalagem</strong> se informado na aba de insumos<br/>
                      2. <strong>Preço de Revenda</strong> (custo + impostos + margem) se habilitado<br/>
                      3. <strong>Custo Unitário</strong> como fallback
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade * <span className="text-xs text-gray-500">(debounce 300ms)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={localQuantity === '0' ? '' : localQuantity}
                  onChange={(e) => setLocalQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Sugerido (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemFormData.suggested_price === 0 ? '' : itemFormData.suggested_price}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Praticado (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemFormData.proposed_price === 0 ? '' : itemFormData.proposed_price}
                  onChange={(e) => {
                    const proposedPrice = parseFloat(e.target.value) || 0;
                    const suggestedPrice = itemFormData.suggested_price || 0;
                    let discountPercentage = 0;
                    if (suggestedPrice > 0) {
                      discountPercentage = ((suggestedPrice - proposedPrice) / suggestedPrice) * 100;
                    }
                    setItemFormData({
                      ...itemFormData,
                      proposed_price: proposedPrice,
                      discount_percentage: discountPercentage
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desconto/Acréscimo (%) <span className="text-xs text-gray-500">(debounce 300ms)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={localDiscount === '0' ? '' : localDiscount}
                  onChange={(e) => setLocalDiscount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {itemFormData.discount_percentage > 0 ? 'Desconto' : itemFormData.discount_percentage < 0 ? 'Acréscimo' : 'Sem alteração'}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações do Item
              </label>
              <input
                type="text"
                value={itemFormData.notes}
                onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                placeholder="Observações específicas deste item..."
              />
            </div>

            <button
              type="button"
              onClick={addItemToQuote}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Item
            </button>
          </div>

          {quoteItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-md font-semibold text-gray-800 mb-3">
                Itens do Orçamento ({quoteItems.length})
                {quoteItems.length > 20 && (
                  <span className="ml-2 text-xs text-gray-500">(lista virtualizada para melhor performance)</span>
                )}
              </h4>
              {quoteItems.length > 20 ? (
                <VirtualizedQuoteItemsList
                  items={quoteItems}
                  onRemoveItem={removeItemFromQuote}
                />
              ) : (
                <SimpleQuoteItemsList
                  items={quoteItems}
                  onRemoveItem={removeItemFromQuote}
                />
              )}
              <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>Total de itens: {calculateQuoteSummary.itemsCount}</div>
                  <div>Quantidade total: {calculateQuoteSummary.totalQuantity.toFixed(2)}</div>
                  {calculateQuoteSummary.averageDiscount !== 0 && (
                    <div className="col-span-2">
                      Desconto médio: {calculateQuoteSummary.averageDiscount.toFixed(2)}%
                    </div>
                  )}
                </div>
                <div className="text-lg font-bold text-gray-900">
                  Valor Total do Orçamento: R$ {calculateTotal.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-[#0A7EC2] text-white px-6 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              {editingId ? 'Atualizar Orçamento' : 'Salvar Orçamento'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-gray-800">
            Orçamentos Cadastrados ({filteredQuotes.length}{filteredQuotes.length !== quotes.length ? ` de ${quotes.length}` : ''})
          </h3>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por cliente, status, tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {filteredQuotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum orçamento cadastrado ainda
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

                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Itens
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedQuotes.map((quote) => (
                  <>
                    <tr
                      key={quote.id}
                      ref={quote.id === highlightQuoteId ? highlightedQuoteRef : null}
                      className={`hover:bg-gray-50 transition-colors ${
                        quote.id === highlightQuoteId ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrint(quote)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Imprimir Orçamento"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(quote)}
                            className="p-2 text-[#0A7EC2] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar Orçamento"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                if (quote.precos_congelados) {
                                  const { error } = await supabase.rpc('unfreeze_quote_prices', {
                                    p_quote_id: quote.id
                                  });
                                  if (error) throw error;
                                  alert('Preços descongelados com sucesso!');
                                } else {
                                  const { error } = await supabase.rpc('freeze_quote_prices', {
                                    p_quote_id: quote.id
                                  });
                                  if (error) throw error;
                                  alert('Preços congelados com sucesso!');
                                }
                                loadData();
                              } catch (error) {
                                console.error('Erro ao congelar/descongelar:', error);
                                alert('Erro ao processar solicitação');
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              quote.precos_congelados
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title={quote.precos_congelados ? 'Descongelar Preços' : 'Congelar Preços'}
                          >
                            {quote.precos_congelados ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(quote.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Orçamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePaymentDialogOpen(quote)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Formas de Pagamento"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleQuoteExpansion(quote.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {expandedQuotes.has(quote.id) ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {quote.customers?.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {quote.customers?.person_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {quote.quote_items?.length || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-[#0A7EC2]">
                            R$ {(quote.total_value || 0).toFixed(2)}
                          </div>
                          {quote.precos_congelados && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 rounded-full" title="Preços Congelados">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span className="text-xs font-semibold text-amber-700">Congelado</span>
                            </div>
                          )}
                        </div>
                        {quote.payment_method && (
                          <div className="text-xs text-gray-500">
                            {getPaymentMethodLabel(quote.payment_method)}
                          </div>
                        )}
                        {quote.precos_congelados && quote.data_congelamento && (
                          <div className="text-xs text-amber-600 mt-1">
                            Desde: {new Date(quote.data_congelamento).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <select
                            value={quote.status}
                            onChange={(e) => handleStatusChange(quote.id, e.target.value as 'pending' | 'approved' | 'rejected')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 cursor-pointer ${getStatusColor(quote.status)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="pending">Pendente</option>
                            <option value="approved">Aprovado</option>
                            <option value="rejected">Rejeitado</option>
                          </select>
                          {quote.updated_at && quote.updated_at !== quote.created_at && (
                            <div className="text-xs text-gray-500">
                              Atualizado: {new Date(quote.updated_at).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedQuotes.has(quote.id) && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          {loadingQuoteDetails.has(quote.id) ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <span className="ml-3 text-gray-600">Carregando detalhes...</span>
                            </div>
                          ) : quote.quote_items && quote.quote_items.length > 0 ? (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-gray-700 mb-2">Itens do Orçamento:</h4>
                              {quote.quote_items.map((item, index) => {
                                const itemName = item.item_name ||
                                                 (item.item_type === 'product' ? item.products?.name :
                                                item.item_type === 'material' ? item.materials?.name :
                                                item.item_type === 'composition' ? item.compositions?.name :
                                                'Serviço de Mão de Obra');
                              return (
                                <div key={item.id || index} className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-gray-900">
                                      {itemName || 'Item sem nome'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Tipo: {item.item_type === 'product' ? 'Produto' :
                                             item.item_type === 'material' ? 'Insumo' :
                                             item.item_type === 'composition' ? 'Composição' : 'Mão de Obra'}
                                      {item.notes && ` | ${item.notes}`}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm text-gray-600">
                                      {Number(item.quantity).toFixed(2)} x R$ {item.proposed_price.toFixed(2)}
                                    </div>
                                    <div className="font-semibold text-[#0A7EC2]">
                                      R$ {(Number(item.quantity) * item.proposed_price).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              Nenhum item no orçamento
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {filteredQuotes.length > 20 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Exibindo {pagination.startIndex + 1} a {pagination.endIndex} de {filteredQuotes.length} orçamentos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={pagination.previousPage}
                    disabled={!pagination.canGoPrevious}
                    className={`px-3 py-1.5 rounded-lg border transition-colors ${
                      pagination.canGoPrevious
                        ? 'border-gray-300 hover:bg-gray-50 text-gray-700'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Anterior
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 3) {
                        pageNum = pagination.totalPages - 6 + i;
                      } else {
                        pageNum = pagination.currentPage - 3 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => pagination.goToPage(pageNum)}
                          className={`w-9 h-9 rounded-lg border transition-colors ${
                            pagination.currentPage === pageNum
                              ? 'bg-[#0A7EC2] text-white border-[#0A7EC2]'
                              : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={pagination.nextPage}
                    disabled={!pagination.canGoNext}
                    className={`px-3 py-1.5 rounded-lg border transition-colors ${
                      pagination.canGoNext
                        ? 'border-gray-300 hover:bg-gray-50 text-gray-700'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Próximo
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Por página:</label>
                  <select
                    value={pagination.pageSize}
                    onChange={(e) => pagination.setPageSize(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showPaymentDialog && selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-green-600" />
                Formas de Pagamento
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const customer = customers.find(c => c.id === selectedQuote.customer_id);
                    if (customer) {
                      setCreditManagerCustomer({ id: customer.id, name: customer.name });
                      setShowCreditManager(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  title="Gerenciar saldo do cliente"
                >
                  <Wallet className="w-4 h-4" />
                  Saldo do Cliente
                </button>
                <button
                  onClick={() => setShowPaymentDialog(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm font-semibold text-blue-900">
                  Valor Total do Orçamento: R$ {(selectedQuote.total_value || 0).toFixed(2)}
                </div>
              </div>

              {customerCreditBalance > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">
                        Saldo disponivel: R$ {customerCreditBalance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-green-700 mb-1">
                      Aplicar saldo neste orcamento (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={Math.min(customerCreditBalance, selectedQuote.total_value || 0)}
                      value={paymentData.credit_applied || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const maxCredit = Math.min(customerCreditBalance, selectedQuote.total_value || 0);
                        setPaymentData({ ...paymentData, credit_applied: Math.min(val, maxCredit) });
                      }}
                      className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm bg-white"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Método de Pagamento
                </label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                >
                  <option value="">Selecione um método</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                  <option value="bank_transfer">Transferência Bancária</option>
                  <option value="installments">Parcelado</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              {paymentData.payment_method === 'installments' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número de Parcelas
                    </label>
                    <input
                      type="number"
                      value={paymentData.installments || ''}
                      onChange={(e) => setPaymentData({ ...paymentData, installments: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor da Parcela (calculado automaticamente)
                    </label>
                    <input
                      type="text"
                      value={paymentData.installments > 0
                        ? `R$ ${((selectedQuote.total_value || 0) / paymentData.installments).toFixed(2)}`
                        : 'R$ 0,00'}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desconto (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentData.discount_percentage || ''}
                    onChange={(e) => {
                      const percentage = parseFloat(e.target.value) || 0;
                      const discountValue = (selectedQuote.total_value || 0) * (percentage / 100);
                      setPaymentData({
                        ...paymentData,
                        discount_percentage: percentage,
                        discount_value: discountValue
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desconto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentData.discount_value || ''}
                    onChange={(e) => {
                      const discountValue = parseFloat(e.target.value) || 0;
                      const percentage = ((discountValue / (selectedQuote.total_value || 1)) * 100);
                      setPaymentData({
                        ...paymentData,
                        discount_value: discountValue,
                        discount_percentage: percentage
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {(paymentData.discount_value > 0 || paymentData.credit_applied > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
                  {paymentData.discount_value > 0 && (
                    <div className="text-xs text-green-700">
                      Desconto: - R$ {paymentData.discount_value.toFixed(2)}
                    </div>
                  )}
                  {paymentData.credit_applied > 0 && (
                    <div className="text-xs text-green-700">
                      Saldo aplicado: - R$ {paymentData.credit_applied.toFixed(2)}
                    </div>
                  )}
                  <div className="text-sm font-bold text-green-900 border-t border-green-200 pt-1">
                    Valor Final: R$ {Math.max(0, (selectedQuote.total_value || 0) - paymentData.discount_value - paymentData.credit_applied).toFixed(2)}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações sobre Pagamento
                </label>
                <textarea
                  value={paymentData.payment_notes}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  rows={3}
                  placeholder="Informações adicionais sobre o pagamento..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSavePayment}
                  className="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Salvar Forma de Pagamento
                </button>
                <button
                  onClick={() => setShowPaymentDialog(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWorkLinkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                Vincular Orçamento à Obra
              </h3>
              <p className="text-gray-600 mt-2">
                Este cliente possui obras cadastradas. Deseja vincular os itens deste orçamento a uma obra?
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione a obra (opcional)
                </label>
                <select
                  value={selectedWorkId}
                  onChange={(e) => setSelectedWorkId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Não vincular a nenhuma obra</option>
                  {customerWorks.map((work) => (
                    <option key={work.id} value={work.id}>
                      {work.work_name} - {work.construction_type} - {work.status === 'em_andamento' ? 'Em Andamento' : 'Pausada'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Importante:</strong> Ao vincular este orçamento a uma obra, todos os itens e valores
                  serão automaticamente registrados na obra selecionada, permitindo um controle preciso dos
                  gastos da construção.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => handleWorkLinkDecision(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Continuar sem vincular
                </button>
                <button
                  onClick={() => handleWorkLinkDecision(true)}
                  disabled={!selectedWorkId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Vincular à Obra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStockCheckDialog && selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package2 className="w-6 h-6 text-[#0A7EC2]" />
                Verificação de Estoque - Aprovação de Orçamento
              </h3>
              <button
                onClick={handleCancelStockCheck}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Orçamento:</strong> {selectedQuote.customers?.name}
                  {selectedQuote.delivery_deadline && (
                    <span className="ml-4">
                      <strong>Prazo de Entrega:</strong> {new Date(selectedQuote.delivery_deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </p>
                {selectedQuote.delivery_deadline && (
                  <p className="text-xs text-blue-700 mt-2">
                    As ordens de produção serão criadas com prazo de 2 dias antes da entrega: {' '}
                    <strong>
                      {new Date(new Date(selectedQuote.delivery_deadline + 'T00:00:00').setDate(new Date(selectedQuote.delivery_deadline + 'T00:00:00').getDate() - 2)).toLocaleDateString('pt-BR')}
                    </strong>
                  </p>
                )}
              </div>

              {stockItemsNeedingProduction.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-900 font-semibold">
                    Todos os produtos possuem estoque suficiente!
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-900 font-semibold mb-2">
                      Os produtos abaixo precisam de produção:
                    </p>
                    <p className="text-xs text-yellow-800">
                      Selecione os produtos para os quais deseja gerar ordem de produção automaticamente.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {stockItemsNeedingProduction.map((item) => (
                      <div
                        key={item.productId}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleStockItemSelection(item.productId)}
                            className="mt-1 w-5 h-5 text-[#0A7EC2] rounded focus:ring-2 focus:ring-[#0A7EC2]"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{item.productName}</h4>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Necessário:</span>
                                <span className="ml-2 font-semibold text-blue-600">{item.quantityNeeded}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Em Estoque:</span>
                                <span className={`ml-2 font-semibold ${item.quantityInStock < item.quantityNeeded ? 'text-red-600' : 'text-green-600'}`}>
                                  {item.quantityInStock}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Mínimo:</span>
                                <span className="ml-2 font-semibold text-gray-700">{item.minimumStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Status:</span>
                                <span className={`ml-2 font-semibold ${item.quantityInStock < item.minimumStock ? 'text-red-600' : 'text-yellow-600'}`}>
                                  {item.quantityInStock < item.quantityNeeded
                                    ? 'Estoque insuficiente'
                                    : 'Abaixo do mínimo'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {stockItemsWithSufficientStock.length > 0 && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-semibold text-green-700 mb-2">
                      Produtos com estoque suficiente:
                    </p>
                  </div>
                  <div className="space-y-2">
                    {stockItemsWithSufficientStock.map((item) => (
                      <div
                        key={item.productId}
                        className="border border-green-200 bg-green-50 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-gray-900">{item.productName}</h4>
                          <div className="flex gap-4 text-sm">
                            <span className="text-gray-600">
                              Necessário: <strong className="text-blue-600">{item.quantityNeeded}</strong>
                            </span>
                            <span className="text-gray-600">
                              Em Estoque: <strong className="text-green-600">{item.quantityInStock}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={handleConfirmStockCheck}
                  className="flex-1 bg-[#0A7EC2] text-white px-6 py-3 rounded-lg hover:bg-[#085a8f] transition-colors flex items-center justify-center gap-2 font-semibold"
                >
                  <Package2 className="w-5 h-5" />
                  {selectedStockItemsCount > 0
                    ? `Gerar ${selectedStockItemsCount} Ordem(ns) e Aprovar`
                    : 'Aprovar sem Gerar Ordens'}
                </button>
                <button
                  onClick={handleCancelStockCheck}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreditManager && creditManagerCustomer && (
        <CustomerCreditManager
          customerId={creditManagerCustomer.id}
          customerName={creditManagerCustomer.name}
          onClose={() => { setShowCreditManager(false); setCreditManagerCustomer(null); }}
          onCreditChanged={() => {
            if (selectedQuote && selectedQuote.customer_id === creditManagerCustomer?.id) {
              supabase
                .from('customers')
                .select('credit_balance')
                .eq('id', creditManagerCustomer.id)
                .maybeSingle()
                .then(({ data }) => setCustomerCreditBalance(data?.credit_balance || 0));
            }
          }}
        />
      )}
    </div>
  );
}
