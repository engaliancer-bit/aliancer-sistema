import React, { useState, useEffect, useRef } from 'react';
import { Truck, Plus, X, Package, AlertCircle, Save, CheckCircle, Edit2, Trash2, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useHorizontalKeyboardScroll } from '../hooks/useHorizontalKeyboardScroll';
import DeliveryItemsLoader from './DeliveryItemsLoader';

interface Quote {
  id: string;
  customer_id: string;
  status: string;
  total_value: number;
  created_at: string;
  customers?: {
    name: string;
  };
}

interface QuoteItem {
  id: string;
  quote_id: string;
  item_type: 'product' | 'material' | 'composition';
  product_id?: string;
  material_id?: string;
  composition_id?: string;
  quantity: number;
  proposed_price: number;
  products?: { name: string; code?: string };
  materials?: { name: string };
  compositions?: { name: string };
}

interface CompositionItem {
  id: string;
  composition_id: string;
  product_id: string;
  quantity: number;
  products: { name: string; code?: string };
}

interface LoadedItem {
  type: 'quote_item' | 'additional';
  quote_item_id?: string;
  product_id?: string;
  material_id?: string;
  composition_id?: string;
  production_id?: string;
  name: string;
  quantity: number;
  unit_price?: number;
  is_from_composition?: boolean;
  parent_composition_name?: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Delivery {
  id: string;
  delivery_date: string;
  auto_created?: boolean;
  quote_id?: string;
  customer_id?: string;
  status: 'open' | 'in_progress' | 'closed';
  vehicle_info?: string;
  driver_name?: string;
  notes?: string;
  quotes?: Quote;
  customers?: Customer;
}

export default function Deliveries() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [expandedCompositions, setExpandedCompositions] = useState<Set<string>>(new Set());
  const [compositionItems, setCompositionItems] = useState<{ [key: string]: CompositionItem[] }>({});
  const [loadedItems, setLoadedItems] = useState<LoadedItem[]>([]);
  const [currentDelivery, setCurrentDelivery] = useState<Delivery | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showAddAdditional, setShowAddAdditional] = useState(false);
  const [additionalProductId, setAdditionalProductId] = useState('');
  const [additionalQuantity, setAdditionalQuantity] = useState(1);
  const [additionalPrice, setAdditionalPrice] = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [orderProducts, setOrderProducts] = useState<any[]>([]);
  const [selectedProductionId, setSelectedProductionId] = useState<string>('');
  const [openDeliveryInDb, setOpenDeliveryInDb] = useState<Delivery | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set());
  const [deliveryItems, setDeliveryItems] = useState<{ [key: string]: any[] }>({});
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: number }>({});

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useHorizontalKeyboardScroll(tableContainerRef);

  useEffect(() => {
    loadQuotes();
    loadDeliveries();
    loadProducts();
    loadMaterials();
    loadOrderProducts();
    checkOpenDeliveryInDatabase();
  }, []);

  useEffect(() => {
    if (selectedQuoteId) {
      loadQuoteItems(selectedQuoteId);
    }
  }, [selectedQuoteId]);

  useEffect(() => {
    if (currentDelivery) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        saveToLocalStorage(currentDelivery, loadedItems);
      }, 500);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [vehicleInfo, driverName, notes, currentDelivery, loadedItems]);

  const checkOpenDeliveryInDatabase = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        customers (
          id,
          name
        ),
        quotes (
          id,
          total_value,
          customers (name)
        )
      `)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (!error && data) {
      setOpenDeliveryInDb(data);
    } else {
      setOpenDeliveryInDb(null);
    }
  };

  const loadQuotes = async () => {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customers (name)
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading quotes:', error);
      return;
    }

    setQuotes(data || []);
  };

  const loadQuoteItems = async (quoteId: string) => {
    const { data, error } = await supabase
      .from('quote_items')
      .select(`
        *,
        products (name, code),
        materials (name),
        compositions (name)
      `)
      .eq('quote_id', quoteId);

    if (error) {
      console.error('Error loading quote items:', error);
      return;
    }

    setQuoteItems(data || []);

    for (const item of data || []) {
      if (item.item_type === 'composition' && item.composition_id) {
        await loadCompositionItems(item.composition_id);
      }
    }
  };

  const loadCompositionItems = async (compositionId: string) => {
    const { data, error } = await supabase
      .from('composition_items')
      .select(`
        *,
        products (name, code)
      `)
      .eq('composition_id', compositionId);

    if (error) {
      console.error('Error loading composition items:', error);
      return;
    }

    setCompositionItems(prev => ({
      ...prev,
      [compositionId]: data || []
    }));
  };

  const loadDeliveries = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        customers (
          id,
          name
        ),
        quotes (
          id,
          total_value,
          customers (name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading deliveries:', error);
      return;
    }

    setDeliveries(data || []);
  };

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (!error) {
      setProducts(data || []);
    }
  };

  const loadMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name');

    if (!error) {
      setMaterials(data || []);
    }
  };

  const loadOrderProducts = async () => {
    const { data, error } = await supabase
      .from('production')
      .select(`
        id,
        product_id,
        quantity,
        production_date,
        notes,
        production_order_id,
        production_orders (order_number),
        products (name, code, unit)
      `)
      .not('production_order_id', 'is', null)
      .order('production_date', { ascending: false });

    if (!error && data) {
      setOrderProducts(data);
    }
  };

  const toggleComposition = (compositionId: string) => {
    const newExpanded = new Set(expandedCompositions);
    if (newExpanded.has(compositionId)) {
      newExpanded.delete(compositionId);
    } else {
      newExpanded.add(compositionId);
    }
    setExpandedCompositions(newExpanded);
  };

  const startNewDelivery = async () => {
    if (!selectedQuoteId) {
      alert('Selecione um orçamento para iniciar a entrega');
      return;
    }

    const { data: existingOpenDelivery } = await supabase
      .from('deliveries')
      .select('id')
      .eq('status', 'open')
      .eq('quote_id', selectedQuoteId)
      .maybeSingle();

    if (existingOpenDelivery) {
      alert('Já existe uma entrega em aberto para este orçamento. Continue o carregamento ou finalize a entrega atual.');
      return;
    }

    try {
      // 1. Criar entrega com status 'open'
      const deliveryData: any = {
        status: 'open',
        quote_id: selectedQuoteId,
        vehicle_info: vehicleInfo,
        driver_name: driverName,
        notes: notes
      };

      const { data: delivery, error: deliveryError } = await supabase
        .from('deliveries')
        .insert([deliveryData])
        .select()
        .single();

      if (deliveryError) {
        console.error('Error creating delivery:', deliveryError);
        alert('Erro ao criar entrega: ' + deliveryError.message);
        return;
      }

      // 2. Buscar itens do orçamento
      const { data: quoteItemsData, error: quoteItemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          products (name, code, unit),
          materials (name, unit),
          compositions (name)
        `)
        .eq('quote_id', selectedQuoteId);

      if (quoteItemsError) {
        console.error('Error loading quote items:', quoteItemsError);
        alert('Erro ao carregar itens do orçamento');
        return;
      }

      // 3. Expandir composições e criar delivery_items
      const deliveryItemsToInsert: any[] = [];

      for (const quoteItem of quoteItemsData || []) {
        if (quoteItem.item_type === 'composition' && quoteItem.composition_id) {
          // Buscar itens da composição
          const { data: compItems, error: compError } = await supabase
            .from('composition_items')
            .select(`
              *,
              products (name, code, unit),
              materials (name, unit),
              services:engineering_service_templates (name),
              compositions:parent_composition:compositions (name)
            `)
            .eq('composition_id', quoteItem.composition_id);

          if (!compError && compItems) {
            for (const compItem of compItems) {
              const totalQuantity = compItem.quantity * quoteItem.quantity;

              deliveryItemsToInsert.push({
                delivery_id: delivery.id,
                item_type: compItem.item_type,
                product_id: compItem.product_id,
                material_id: compItem.material_id,
                composition_id: compItem.composition_id,
                service_id: compItem.service_id,
                quantity: totalQuantity,
                loaded_quantity: 0,
                item_name: compItem.products?.name || compItem.materials?.name || compItem.compositions?.name || compItem.services?.name,
                is_from_composition: true,
                parent_composition_name: quoteItem.compositions?.name
              });
            }
          }
        } else {
          // Item simples (produto, material, etc)
          deliveryItemsToInsert.push({
            delivery_id: delivery.id,
            item_type: quoteItem.item_type,
            product_id: quoteItem.product_id,
            material_id: quoteItem.material_id,
            composition_id: quoteItem.composition_id,
            quantity: quoteItem.quantity,
            loaded_quantity: 0,
            item_name: quoteItem.products?.name || quoteItem.materials?.name || quoteItem.compositions?.name,
            is_from_composition: false
          });
        }
      }

      // 4. Inserir delivery_items
      if (deliveryItemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('delivery_items')
          .insert(deliveryItemsToInsert);

        if (insertError) {
          console.error('Error inserting delivery items:', insertError);
          alert('Erro ao criar itens da entrega: ' + insertError.message);
          return;
        }
      }

      // 5. Carregar os itens criados
      await loadDeliveryItems(delivery.id);

      // 6. Atualizar estado
      setCurrentDelivery(delivery);
      await loadDeliveries();

      alert('Entrega iniciada! Marque os itens conforme forem carregados.');
    } catch (err) {
      console.error('Unexpected error starting delivery:', err);
      alert('Erro inesperado ao iniciar entrega');
    }
  };

  const saveToLocalStorage = (delivery: Delivery | null, items: LoadedItem[]) => {
    if (delivery) {
      localStorage.setItem('openDelivery', JSON.stringify({
        delivery,
        items,
        vehicleInfo,
        driverName,
        notes,
        quoteId: selectedQuoteId
      }));
    } else {
      localStorage.removeItem('openDelivery');
    }
  };

  const addItemToLoad = (item: QuoteItem, quantity: number) => {
    if (quantity <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }

    const itemName = item.products?.name || item.materials?.name || item.item_name || 'Item';

    const newItem: LoadedItem = {
      type: 'quote_item',
      quote_item_id: item.id,
      product_id: item.product_id,
      material_id: item.material_id,
      composition_id: item.composition_id,
      name: itemName,
      quantity: quantity
    };

    const updated = [...loadedItems, newItem];
    setLoadedItems(updated);
    alert(`${quantity}x ${itemName} adicionado à carga`);
  };

  const addCompositionItemToLoad = (compItem: CompositionItem, parentComposition: QuoteItem, quantity: number) => {
    if (quantity <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }

    const newItem: LoadedItem = {
      type: 'quote_item',
      quote_item_id: parentComposition.id,
      product_id: compItem.product_id,
      name: compItem.products.name,
      quantity: quantity,
      is_from_composition: true,
      parent_composition_name: parentComposition.compositions?.name
    };

    const updated = [...loadedItems, newItem];
    setLoadedItems(updated);
    alert(`${quantity}x ${compItem.products.name} adicionado à carga`);
  };

  const handleAddAdditional = async () => {
    // Se selecionou um produto de ordem de produção
    if (selectedProductionId) {
      const orderProduct = orderProducts.find(op => op.id === selectedProductionId);
      if (!orderProduct) {
        alert('Produto de ordem não encontrado');
        return;
      }

      const maxQuantity = parseFloat(orderProduct.quantity);
      if (additionalQuantity <= 0 || additionalQuantity > maxQuantity) {
        alert(`Quantidade deve estar entre 1 e ${maxQuantity}`);
        return;
      }

      const newItem: LoadedItem = {
        type: 'additional',
        product_id: orderProduct.product_id,
        production_id: orderProduct.id,
        name: `${orderProduct.products?.name || 'Produto'} - OP #${orderProduct.production_orders?.order_number || ''}`,
        quantity: additionalQuantity,
        unit_price: additionalPrice
      };

      const updated = [...loadedItems, newItem];
      setLoadedItems(updated);

      setShowAddAdditional(false);
      setAdditionalProductId('');
      setSelectedProductionId('');
      setAdditionalQuantity(1);
      setAdditionalPrice(0);

      // Recarregar produtos de ordem após adicionar
      await loadOrderProducts();

      alert(`${orderProduct.products?.name} da Ordem de Produção adicionado à carga`);
      return;
    }

    // Fluxo normal para produtos/materiais comuns
    if (!additionalProductId) {
      alert('Selecione um produto ou material');
      return;
    }

    if (additionalQuantity <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }

    const product = products.find(p => p.id === additionalProductId);
    const material = materials.find(m => m.id === additionalProductId);
    const itemName = product?.name || material?.name || 'Item Adicional';

    const newItem: LoadedItem = {
      type: 'additional',
      product_id: product?.id,
      material_id: material?.id,
      name: itemName,
      quantity: additionalQuantity,
      unit_price: additionalPrice
    };

    const updated = [...loadedItems, newItem];
    setLoadedItems(updated);
    setShowAddAdditional(false);
    setAdditionalProductId('');
    setAdditionalQuantity(1);
    setAdditionalPrice(0);
    alert(`Item adicional ${itemName} adicionado à carga`);
  };

  const removeLoadedItem = (index: number) => {
    const updated = loadedItems.filter((_, i) => i !== index);
    setLoadedItems(updated);
  };

  const startEditItem = (index: number) => {
    setEditingItemIndex(index);
    setEditingItem(loadedItems[index]);
    setEditQuantity(String(loadedItems[index].quantity));
    setShowEditModal(true);
  };

  const saveEditItem = () => {
    if (editingItemIndex === null) return;

    const quantity = parseFloat(editQuantity.replace(',', '.'));

    if (isNaN(quantity) || quantity <= 0) {
      alert('Digite uma quantidade válida maior que zero');
      return;
    }

    // Limitar a 2 casas decimais
    const quantityRounded = Math.round(quantity * 100) / 100;

    const updated = [...loadedItems];
    updated[editingItemIndex].quantity = quantityRounded;
    setLoadedItems(updated);

    setEditingItemIndex(null);
    setEditQuantity('');
    setShowEditModal(false);
    setEditingItem(null);
  };

  const cancelEditItem = () => {
    setEditingItemIndex(null);
    setEditQuantity('');
    setShowEditModal(false);
    setEditingItem(null);
  };

  const toggleItemLoaded = async (deliveryItemId: string, currentLoadedQty: number, totalQuantity: number) => {
    try {
      // Se já está carregado, desmarcar (zerar)
      // Se não está carregado, marcar como totalmente carregado
      const newLoadedQuantity = currentLoadedQty >= totalQuantity ? 0 : totalQuantity;

      const { error } = await supabase
        .from('delivery_items')
        .update({
          loaded_quantity: newLoadedQuantity,
          loaded_at: newLoadedQuantity > 0 ? new Date().toISOString() : null
        })
        .eq('id', deliveryItemId);

      if (error) {
        console.error('Error updating loaded quantity:', error);
        alert('Erro ao atualizar item: ' + error.message);
        return;
      }

      // Recarregar itens da entrega
      if (currentDelivery) {
        await loadDeliveryItems(currentDelivery.id);
        await loadDeliveries();
      }
    } catch (err) {
      console.error('Unexpected error toggling item loaded:', err);
      alert('Erro ao atualizar item');
    }
  };

  const updateItemLoadedQuantity = async (deliveryItemId: string, loadedQuantity: number) => {
    try {
      const { error } = await supabase
        .from('delivery_items')
        .update({
          loaded_quantity: loadedQuantity,
          loaded_at: loadedQuantity > 0 ? new Date().toISOString() : null
        })
        .eq('id', deliveryItemId);

      if (error) {
        console.error('Error updating loaded quantity:', error);
        alert('Erro ao atualizar quantidade: ' + error.message);
        return;
      }

      // Recarregar itens da entrega
      if (currentDelivery) {
        await loadDeliveryItems(currentDelivery.id);
        await loadDeliveries();
      }
    } catch (err) {
      console.error('Unexpected error updating loaded quantity:', err);
      alert('Erro ao atualizar quantidade');
    }
  };

  const handleCloseLoad = async () => {
    if (!currentDelivery) {
      alert('Nenhuma entrega em aberto');
      return;
    }

    try {
      // Verificar se todos os itens foram totalmente carregados
      const { data: deliveryItems, error } = await supabase
        .from('delivery_items')
        .select('quantity, loaded_quantity')
        .eq('delivery_id', currentDelivery.id);

      if (error) throw error;

      // Verificar se há algum item não totalmente carregado
      const hasPartialItems = deliveryItems?.some(item =>
        parseFloat(item.loaded_quantity) < parseFloat(item.quantity)
      );

      if (!hasPartialItems) {
        // Todos os itens foram carregados - finalizar automaticamente
        const { error: updateError } = await supabase
          .from('deliveries')
          .update({
            vehicle_info: vehicleInfo,
            driver_name: driverName,
            notes: notes,
            status: 'closed'
          })
          .eq('id', currentDelivery.id);

        if (updateError) {
          console.error('Error finishing delivery:', updateError);
          alert('Erro ao finalizar entrega: ' + updateError.message);
          return;
        }

        // Limpar estado local
        setCurrentDelivery(null);
        setLoadedItems([]);
        setShowNewDelivery(false);
        setSelectedQuoteId('');
        setVehicleInfo('');
        setDriverName('');
        setNotes('');
        localStorage.removeItem('openDelivery');

        // Recarregar lista
        await loadDeliveries();

        alert('Entrega finalizada com sucesso! Todos os itens foram entregues.');
        return;
      }

      // Há itens parcialmente carregados - mostrar confirmação
      setShowConfirmation(true);
    } catch (err) {
      console.error('Error checking delivery items:', err);
      alert('Erro ao verificar itens da entrega');
    }
  };

  const confirmCloseLoad = async () => {
    if (!currentDelivery) return;

    try {
      // Atualizar apenas as informações da entrega (não mudar status - o trigger fará isso)
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          vehicle_info: vehicleInfo,
          driver_name: driverName,
          notes: notes
        })
        .eq('id', currentDelivery.id);

      if (updateError) {
        console.error('Error updating delivery:', updateError);
        alert('Erro ao salvar informações da entrega');
        return;
      }

      // Limpar estado local
      setCurrentDelivery(null);
      setLoadedItems([]);
      setShowNewDelivery(false);
      setShowConfirmation(false);
      setSelectedQuoteId('');
      setVehicleInfo('');
      setDriverName('');
      setNotes('');

      // Recarregar lista
      await loadDeliveries();

      alert('Carregamento salvo! A entrega permanecerá em aberto até que todos os itens sejam carregados.');
    } catch (err) {
      console.error('Unexpected error closing load:', err);
      alert('Erro ao fechar carregamento');
    }
  };

  const confirmFinishDeliveryManually = async () => {
    if (!currentDelivery) return;

    if (!confirm('Deseja finalizar esta entrega mesmo sem carregar todos os itens? Os itens não carregados não serão entregues.')) {
      return;
    }

    try {
      // Atualizar informações e forçar status como 'closed'
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          vehicle_info: vehicleInfo,
          driver_name: driverName,
          notes: notes,
          status: 'closed'
        })
        .eq('id', currentDelivery.id);

      if (updateError) {
        console.error('Error finishing delivery:', updateError);
        alert('Erro ao finalizar entrega: ' + updateError.message);
        return;
      }

      // Limpar estado local
      setCurrentDelivery(null);
      setLoadedItems([]);
      setShowNewDelivery(false);
      setShowConfirmation(false);
      setSelectedQuoteId('');
      setVehicleInfo('');
      setDriverName('');
      setNotes('');

      // Recarregar lista
      await loadDeliveries();

      alert('Entrega finalizada com sucesso!');
    } catch (err) {
      console.error('Unexpected error finishing delivery:', err);
      alert('Erro ao finalizar entrega');
    }
  };

  const confirmPartialDelivery = async () => {
    if (!currentDelivery) return;

    if (!confirm('Confirmar carregamento parcial? \n\nO sistema irá:\n1. Fechar esta entrega com os itens carregados\n2. Criar automaticamente uma nova entrega com os itens restantes\n\nDeseja continuar?')) {
      return;
    }

    try {
      // Atualizar informações da entrega
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          vehicle_info: vehicleInfo,
          driver_name: driverName,
          notes: notes
        })
        .eq('id', currentDelivery.id);

      if (updateError) {
        console.error('Error updating delivery:', updateError);
        alert('Erro ao salvar informações da entrega');
        return;
      }

      // Chamar função PostgreSQL para confirmar entrega parcial
      const { data, error } = await supabase
        .rpc('confirm_partial_delivery', {
          p_delivery_id: currentDelivery.id
        });

      if (error) {
        console.error('Error confirming partial delivery:', error);
        alert('Erro ao confirmar entrega parcial: ' + error.message);
        return;
      }

      // Limpar estado local
      setCurrentDelivery(null);
      setLoadedItems([]);
      setShowNewDelivery(false);
      setShowConfirmation(false);
      setSelectedQuoteId('');
      setVehicleInfo('');
      setDriverName('');
      setNotes('');

      // Recarregar lista
      await loadDeliveries();

      if (data) {
        alert(`Carregamento parcial confirmado com sucesso!\n\nNova entrega criada para os itens restantes.\nID da nova entrega: ${data}`);
      } else {
        alert('Entrega finalizada completamente! Todos os itens foram carregados.');
      }
    } catch (err) {
      console.error('Unexpected error confirming partial delivery:', err);
      alert('Erro ao confirmar entrega parcial');
    }
  };

  const handleContinueDelivery = async (delivery: Delivery) => {
    // Carregar delivery_items da entrega
    await loadDeliveryItems(delivery.id);

    // Configurar estado
    setCurrentDelivery(delivery);
    setSelectedQuoteId(delivery.quote_id || '');
    setVehicleInfo(delivery.vehicle_info || '');
    setDriverName(delivery.driver_name || '');
    setNotes(delivery.notes || '');
    setShowNewDelivery(true);
  };

  const handleRevertDelivery = async (deliveryId: string) => {
    if (!confirm('Deseja estornar esta entrega? Ela voltará para o status de aguardando carregamento.')) {
      return;
    }

    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'open' })
      .eq('id', deliveryId);

    if (error) {
      console.error('Error reverting delivery:', error);
      alert('Erro ao estornar entrega');
      return;
    }

    const saved = localStorage.getItem('openDelivery');
    if (saved) {
      const openDelivery = JSON.parse(saved);
      if (openDelivery.delivery?.id === deliveryId) {
        localStorage.removeItem('openDelivery');
        setCurrentDelivery(null);
        setLoadedItems([]);
        setShowNewDelivery(false);
      }
    }

    await loadDeliveries();
    await checkOpenDeliveryInDatabase();
    alert('Entrega estornada com sucesso! Agora está aguardando para ser carregada.');
  };

  const handleDeleteDelivery = async (deliveryId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta entrega? Esta ação não pode ser desfeita.')) {
      return;
    }

    const { error: itemsError } = await supabase
      .from('delivery_items')
      .delete()
      .eq('delivery_id', deliveryId);

    if (itemsError) {
      console.error('Error deleting delivery items:', itemsError);
      alert('Erro ao excluir itens da entrega');
      return;
    }

    const { error: deliveryError } = await supabase
      .from('deliveries')
      .delete()
      .eq('id', deliveryId);

    if (deliveryError) {
      console.error('Error deleting delivery:', deliveryError);
      alert('Erro ao excluir entrega');
      return;
    }

    const saved = localStorage.getItem('openDelivery');
    if (saved) {
      const openDelivery = JSON.parse(saved);
      if (openDelivery.delivery?.id === deliveryId) {
        localStorage.removeItem('openDelivery');
        setCurrentDelivery(null);
        setLoadedItems([]);
        setShowNewDelivery(false);
      }
    }

    await loadDeliveries();
    await checkOpenDeliveryInDatabase();
    alert('Entrega excluída com sucesso!');
  };

  const getItemName = (item: QuoteItem) => {
    if (item.products) return item.products.name;
    if (item.materials) return item.materials.name;
    if (item.compositions) return item.compositions.name;
    return 'Item desconhecido';
  };

  const loadDeliveryItems = async (deliveryId: string) => {
    setLoadingItems(prev => new Set(prev).add(deliveryId));

    try {
      // 1. Buscar delivery_items
      const { data: deliveryItemsData, error: deliveryItemsError } = await supabase
        .from('delivery_items')
        .select(`
          *,
          products (name, code),
          materials (name, unit)
        `)
        .eq('delivery_id', deliveryId);

      if (deliveryItemsError) {
        console.error('Error loading delivery items:', deliveryItemsError);
        alert('Erro ao carregar itens da entrega: ' + deliveryItemsError.message);
        setDeliveryItems(prev => ({ ...prev, [deliveryId]: [] }));
        return;
      }

      // Se não há delivery_items, buscar do orçamento
      if (!deliveryItemsData || deliveryItemsData.length === 0) {
        const { data: delivery } = await supabase
          .from('deliveries')
          .select('quote_id')
          .eq('id', deliveryId)
          .maybeSingle();

        if (!delivery?.quote_id) {
          setDeliveryItems(prev => ({ ...prev, [deliveryId]: [] }));
          return;
        }

        // Buscar itens do orçamento
        const { data: quoteItems } = await supabase
          .from('quote_items')
          .select(`*, products (name, code), materials (name), compositions (name)`)
          .eq('quote_id', delivery.quote_id);

        // OTIMIZAÇÃO: Coletar todos os IDs de composições primeiro
        const compositionIds = quoteItems
          ?.filter(qi => qi.item_type === 'composition' && qi.composition_id)
          .map(qi => qi.composition_id) || [];

        // Buscar TODOS os composition_items de uma vez
        const { data: allCompositionItems } = compositionIds.length > 0
          ? await supabase
              .from('composition_items')
              .select(`*, products (name, code), materials (name, unit)`)
              .in('composition_id', compositionIds)
          : { data: [] };

        // Criar mapa de composition_items por composition_id
        const compositionItemsMap = new Map();
        allCompositionItems?.forEach(ci => {
          if (!compositionItemsMap.has(ci.composition_id)) {
            compositionItemsMap.set(ci.composition_id, []);
          }
          compositionItemsMap.get(ci.composition_id).push(ci);
        });

        // Coletar TODOS os product_ids e material_ids
        const productIds = new Set();
        const materialIds = new Set();

        quoteItems?.forEach(qi => {
          if (qi.item_type === 'product' && qi.product_id) {
            productIds.add(qi.product_id);
          }
        });

        allCompositionItems?.forEach(ci => {
          if (ci.item_type === 'product' && ci.product_id) productIds.add(ci.product_id);
          if (ci.item_type === 'material' && ci.material_id) materialIds.add(ci.material_id);
        });

        // Buscar TODOS os estoques de uma vez
        const [productsStock, materialsStock] = await Promise.all([
          productIds.size > 0
            ? supabase
                .from('product_stock_view')
                .select('product_id, available_stock')
                .in('product_id', Array.from(productIds))
            : { data: [] },
          materialIds.size > 0
            ? supabase
                .from('material_stock_view')
                .select('material_id, current_stock')
                .in('material_id', Array.from(materialIds))
            : { data: [] }
        ]);

        // Criar mapas de estoque
        const productStockMap = new Map(
          productsStock.data?.map(ps => [ps.product_id, ps.available_stock]) || []
        );
        const materialStockMap = new Map(
          materialsStock.data?.map(ms => [ms.material_id, ms.current_stock]) || []
        );

        // Processar itens com dados em memória (sem queries adicionais)
        const expandedItems: any[] = [];

        for (const quoteItem of quoteItems || []) {
          if (quoteItem.item_type === 'composition' && quoteItem.composition_id) {
            const compositionItems = compositionItemsMap.get(quoteItem.composition_id) || [];

            for (const compItem of compositionItems) {
              const totalNeeded = Number(quoteItem.quantity) * Number(compItem.quantity);

              if (compItem.item_type === 'product' && compItem.product_id) {
                const availableStock = productStockMap.get(compItem.product_id) || 0;
                const stockStatus = availableStock >= totalNeeded ? 'Suficiente' :
                  availableStock > 0 ? 'Parcial' : 'Indisponível';

                expandedItems.push({
                  id: `comp_${compItem.id}`,
                  item_type: 'product',
                  product_id: compItem.product_id,
                  quantity: totalNeeded,
                  products: compItem.products,
                  item_name: compItem.products?.name,
                  is_from_composition: true,
                  parent_composition_name: quoteItem.compositions?.name,
                  available_stock: availableStock,
                  stock_status: stockStatus,
                  notes: `Composição: ${quoteItem.compositions?.name} (${quoteItem.quantity}x) → ${compItem.quantity} por unidade = ${totalNeeded} necessários | Estoque: ${availableStock} un.`
                });
              } else if (compItem.item_type === 'material' && compItem.material_id) {
                const availableStock = materialStockMap.get(compItem.material_id) || 0;
                const stockStatus = availableStock >= totalNeeded ? 'Suficiente' :
                  availableStock > 0 ? 'Parcial' : 'Indisponível';

                expandedItems.push({
                  id: `comp_${compItem.id}`,
                  item_type: 'material',
                  material_id: compItem.material_id,
                  quantity: totalNeeded,
                  materials: compItem.materials,
                  item_name: compItem.materials?.name,
                  is_from_composition: true,
                  parent_composition_name: quoteItem.compositions?.name,
                  available_stock: availableStock,
                  stock_status: stockStatus,
                  notes: `Composição: ${quoteItem.compositions?.name} (${quoteItem.quantity}x) → ${compItem.quantity} ${compItem.materials?.unit || 'un.'} por unidade = ${totalNeeded} ${compItem.materials?.unit || 'un.'} necessários | Estoque: ${availableStock} ${compItem.materials?.unit || 'un.'}`
                });
              } else if (compItem.item_type === 'equipment' || compItem.item_type === 'service' || compItem.item_type === 'labor') {
                const itemTypeName = compItem.item_type === 'equipment' ? 'Equipamento' :
                  compItem.item_type === 'service' ? 'Serviço' : 'Mão de Obra';

                expandedItems.push({
                  id: `comp_${compItem.id}`,
                  item_type: compItem.item_type,
                  quantity: totalNeeded,
                  item_name: compItem.description || `${itemTypeName} da composição`,
                  is_from_composition: true,
                  parent_composition_name: quoteItem.compositions?.name,
                  stock_status: 'N/A',
                  notes: `Composição: ${quoteItem.compositions?.name} (${quoteItem.quantity}x) → ${compItem.quantity} por unidade = ${totalNeeded} necessários`
                });
              }
            }
          } else {
            if (quoteItem.item_type === 'product' && quoteItem.product_id) {
              const availableStock = productStockMap.get(quoteItem.product_id) || 0;
              const totalNeeded = Number(quoteItem.quantity);
              const stockStatus = availableStock >= totalNeeded ? 'Suficiente' :
                availableStock > 0 ? 'Parcial' : 'Indisponível';

              expandedItems.push({
                ...quoteItem,
                item_name: quoteItem.products?.name,
                available_stock: availableStock,
                stock_status: stockStatus,
                notes: `Necessário: ${totalNeeded} un. | Estoque: ${availableStock} un.`
              });
            } else {
              expandedItems.push({
                ...quoteItem,
                item_name: quoteItem.products?.name || quoteItem.materials?.name || 'Item'
              });
            }
          }
        }

        setDeliveryItems(prev => ({ ...prev, [deliveryId]: expandedItems }));
      } else {
        // OTIMIZAÇÃO: Coletar IDs e buscar estoques em batch
        const productIds = deliveryItemsData
          .filter(item => item.item_type === 'product' && item.product_id)
          .map(item => item.product_id);

        const materialIds = deliveryItemsData
          .filter(item => item.item_type === 'material' && item.material_id)
          .map(item => item.material_id);

        const compositionIds = deliveryItemsData
          .filter(item => item.composition_id)
          .map(item => item.composition_id);

        const [productsStock, materialsStock, compositions] = await Promise.all([
          productIds.length > 0
            ? supabase.from('product_stock_view').select('product_id, available_stock').in('product_id', productIds)
            : { data: [] },
          materialIds.length > 0
            ? supabase.from('material_stock_view').select('material_id, current_stock').in('material_id', materialIds)
            : { data: [] },
          compositionIds.length > 0
            ? supabase.from('compositions').select('id, name').in('id', compositionIds)
            : { data: [] }
        ]);

        const productStockMap = new Map(productsStock.data?.map(ps => [ps.product_id, ps.available_stock]) || []);
        const materialStockMap = new Map(materialsStock.data?.map(ms => [ms.material_id, ms.current_stock]) || []);
        const compositionMap = new Map(compositions.data?.map(c => [c.id, c.name]) || []);

        const enrichedItems = deliveryItemsData.map(item => {
          let enrichedItem = { ...item };

          if (item.item_type === 'product' && item.product_id) {
            const availableStock = productStockMap.get(item.product_id) || 0;
            const totalNeeded = Number(item.quantity);
            const stockStatus = availableStock >= totalNeeded ? 'Suficiente' :
              availableStock > 0 ? 'Parcial' : 'Indisponível';

            enrichedItem = {
              ...enrichedItem,
              available_stock: availableStock,
              stock_status: stockStatus
            };
          } else if (item.item_type === 'material' && item.material_id) {
            const availableStock = materialStockMap.get(item.material_id) || 0;
            const totalNeeded = Number(item.quantity);
            const stockStatus = availableStock >= totalNeeded ? 'Suficiente' :
              availableStock > 0 ? 'Parcial' : 'Indisponível';

            enrichedItem = {
              ...enrichedItem,
              available_stock: availableStock,
              stock_status: stockStatus
            };
          }

          if (item.composition_id) {
            enrichedItem = {
              ...enrichedItem,
              is_from_composition: true,
              parent_composition_name: compositionMap.get(item.composition_id) || 'Composição'
            };
          }

          return enrichedItem;
        });

        setDeliveryItems(prev => ({ ...prev, [deliveryId]: enrichedItems }));
      }
    } catch (err) {
      console.error('Unexpected error loading delivery items:', err);
      setDeliveryItems(prev => ({ ...prev, [deliveryId]: [] }));
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(deliveryId);
        return newSet;
      });
    }
  };

  const toggleDeliveryExpansion = async (deliveryId: string) => {
    const newExpanded = new Set(expandedDeliveries);
    if (newExpanded.has(deliveryId)) {
      newExpanded.delete(deliveryId);
    } else {
      newExpanded.add(deliveryId);
      await loadDeliveryItems(deliveryId);
    }
    setExpandedDeliveries(newExpanded);
  };

  const filteredDeliveries = React.useMemo(() => {
    if (!deliveries) return [];
    if (activeTab === 'open') {
      return deliveries.filter(d => d.status === 'open' || d.status === 'in_progress');
    }
    return deliveries.filter(d => d.status === activeTab);
  }, [deliveries, activeTab]);

  return (
    <div className="space-y-6 overflow-y-auto max-h-screen pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-8 w-8" />
            Entregas
          </h2>
          <p className="text-gray-600 mt-1">Gerencie as entregas de pedidos aprovados</p>
          <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Entregas são criadas automaticamente ao aprovar orçamentos com estoque disponível
          </p>
        </div>
        <button
          onClick={() => {
            if (openDeliveryInDb && !currentDelivery) {
              handleContinueDelivery(openDeliveryInDb);
            } else {
              setShowNewDelivery(true);
            }
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {openDeliveryInDb && !currentDelivery ? 'Continuar Entrega' : 'Nova Entrega'}
        </button>
      </div>

      {openDeliveryInDb && !showNewDelivery && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 text-lg mb-1">Carregamento em Progresso</h3>
              <p className="text-yellow-800 mb-2">
                Cliente: <span className="font-semibold">
                  {openDeliveryInDb.customers?.name || openDeliveryInDb.quotes?.customers?.name || '-'}
                </span>
              </p>
              <p className="text-yellow-700 text-sm mb-3">
                Você precisa finalizar, estornar ou excluir este carregamento antes de iniciar outro.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleContinueDelivery(openDeliveryInDb)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                  Continuar Carregamento
                </button>
                <button
                  onClick={() => handleRevertDelivery(openDeliveryInDb.id)}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Undo2 className="h-4 w-4" />
                  Estornar
                </button>
                <button
                  onClick={() => handleDeleteDelivery(openDeliveryInDb.id)}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewDelivery && (
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h3 className="text-xl font-bold text-gray-900">
              {currentDelivery ? 'Carregar Produtos' : 'Iniciar Nova Entrega'}
            </h3>
            <button
              onClick={() => {
                if (currentDelivery && loadedItems.length > 0) {
                  if (confirm('Existe uma carga em aberto. Os dados serão salvos. Deseja continuar?')) {
                    setShowNewDelivery(false);
                  }
                } else {
                  setShowNewDelivery(false);
                  setCurrentDelivery(null);
                  setLoadedItems([]);
                }
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {!currentDelivery ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione o Orçamento Aprovado
                </label>
                <select
                  value={selectedQuoteId}
                  onChange={(e) => setSelectedQuoteId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Selecione...</option>
                  {quotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.customers?.name} - R$ {quote.total_value?.toFixed(2)} - {new Date(quote.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Veículo
                  </label>
                  <input
                    type="text"
                    value={vehicleInfo}
                    onChange={(e) => setVehicleInfo(e.target.value)}
                    placeholder="Ex: Caminhão ABC-1234"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motorista
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Nome do motorista"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Observações sobre a entrega..."
                />
              </div>

              <button
                onClick={startNewDelivery}
                disabled={!selectedQuoteId}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Truck className="h-5 w-5" />
                Iniciar Carregamento
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cabeçalho com dados do cliente */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-300">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentDelivery.customers?.name || currentDelivery.quotes?.customers?.name || 'Cliente não identificado'}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Veículo:</span>
                    <span className="ml-2 font-semibold text-gray-900">{vehicleInfo || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Motorista:</span>
                    <span className="ml-2 font-semibold text-gray-900">{driverName || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Data:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {new Date(currentDelivery.delivery_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3">
                <button
                  onClick={handleCloseLoad}
                  className="flex-1 bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-semibold text-lg shadow-lg"
                >
                  <Save className="h-6 w-6" />
                  Salvar e Fechar Carga
                </button>
              </div>

              {/* Lista de itens para carregamento */}
              {deliveryItems[currentDelivery.id] && deliveryItems[currentDelivery.id].length > 0 ? (
                <DeliveryItemsLoader
                  deliveryId={currentDelivery.id}
                  items={deliveryItems[currentDelivery.id]}
                  onToggleItem={toggleItemLoaded}
                  onUpdateQuantity={updateItemLoadedQuantity}
                />
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 p-6 rounded flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                  <p className="text-yellow-800 font-medium">Carregando itens...</p>
                </div>
              )}

              {/* Informações editáveis da entrega */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Informações da Entrega</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Veículo
                    </label>
                    <input
                      type="text"
                      value={vehicleInfo}
                      onChange={(e) => setVehicleInfo(e.target.value)}
                      placeholder="Ex: Caminhão ABC-1234"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motorista
                    </label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Nome do motorista"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Observações sobre a entrega..."
                  />
                </div>
              </div>

              {false && quoteItems.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">ANTIGO - Itens do Orçamento</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {quoteItems.map((item) => (
                    <div key={item.id} className="border rounded-lg">
                      <div className="bg-gray-50 p-4">
                        {item.item_type === 'composition' && item.composition_id ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => toggleComposition(item.composition_id!)}
                                className="flex items-center gap-2 text-left flex-1"
                              >
                                {expandedCompositions.has(item.composition_id) ? (
                                  <ChevronDown className="h-5 w-5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5" />
                                )}
                                <span className="font-medium text-gray-900">{getItemName(item)}</span>
                                <span className="text-sm text-gray-600">(Composição)</span>
                              </button>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={itemQuantities[`qty-comp-${item.id}`] || 1}
                                  onChange={(e) => setItemQuantities({
                                    ...itemQuantities,
                                    [`qty-comp-${item.id}`]: parseFloat(e.target.value) || 1
                                  })}
                                  className="w-20 px-2 py-1 border rounded"
                                />
                                <button
                                  onClick={() => {
                                    const qty = itemQuantities[`qty-comp-${item.id}`] || 1;
                                    addItemToLoad(item, qty);
                                  }}
                                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                                >
                                  Carregar
                                </button>
                              </div>
                            </div>
                            {expandedCompositions.has(item.composition_id) && compositionItems[item.composition_id] && (
                              <div className="ml-7 mt-2 space-y-2 border-l-2 border-blue-300 pl-4">
                                {compositionItems[item.composition_id].map((compItem) => (
                                  <div key={compItem.id} className="bg-white p-3 rounded flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-sm">{compItem.products.name}</div>
                                      <div className="text-xs text-gray-600">
                                        Qtd por unidade: {compItem.quantity}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={itemQuantities[`qty-${compItem.id}`] || 1}
                                        onChange={(e) => setItemQuantities({
                                          ...itemQuantities,
                                          [`qty-${compItem.id}`]: parseFloat(e.target.value) || 1
                                        })}
                                        className="w-20 px-2 py-1 border rounded text-sm"
                                      />
                                      <button
                                        onClick={() => {
                                          const qty = itemQuantities[`qty-${compItem.id}`] || 1;
                                          addCompositionItemToLoad(compItem, item, qty);
                                        }}
                                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                                      >
                                        Carregar
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{getItemName(item)}</div>
                              <div className="text-sm text-gray-600">
                                Quantidade: {item.quantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={itemQuantities[`qty-${item.id}`] || 1}
                                onChange={(e) => setItemQuantities({
                                  ...itemQuantities,
                                  [`qty-${item.id}`]: parseFloat(e.target.value) || 1
                                })}
                                className="w-20 px-2 py-1 border rounded"
                              />
                              <button
                                onClick={() => {
                                  const qty = itemQuantities[`qty-${item.id}`] || 1;
                                  addItemToLoad(item, qty);
                                }}
                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                              >
                                Carregar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {false && loadedItems.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Itens Carregados ({loadedItems.length})</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loadedItems.map((item, index) => (
                      <div key={index} className={`rounded-lg p-4 flex items-center justify-between ${
                        item.type === 'additional' ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'
                      }`}>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {item.name}
                            {item.type === 'additional' && (
                              <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded">
                                ADICIONAL
                              </span>
                            )}
                            {item.is_from_composition && (
                              <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                                da {item.parent_composition_name}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">Quantidade: {item.quantity}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditItem(index)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeLoadedItem(index)}
                            className="text-red-600 hover:text-red-700"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAddAdditional && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-md w-full my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Adicionar Item Extra</h3>
              <button
                onClick={() => {
                  setShowAddAdditional(false);
                  setAdditionalProductId('');
                  setSelectedProductionId('');
                  setAdditionalQuantity(1);
                  setAdditionalPrice(0);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Produtos de Ordem de Produção */}
              {orderProducts.length > 0 && (
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Produtos de Ordem de Produção
                  </label>
                  <select
                    value={selectedProductionId}
                    onChange={(e) => {
                      setSelectedProductionId(e.target.value);
                      setAdditionalProductId('');
                      const selected = orderProducts.find(op => op.id === e.target.value);
                      if (selected) {
                        setAdditionalQuantity(parseFloat(selected.quantity));
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Selecione...</option>
                    {orderProducts.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.products?.name || 'Produto'} - OP #{op.production_orders?.order_number || ''} ({parseFloat(op.quantity).toFixed(2)} {op.products?.unit || 'un'})
                      </option>
                    ))}
                  </select>
                  {selectedProductionId && (
                    <p className="text-xs text-blue-600 mt-1">
                      Este produto será removido do estoque de ordem de produção após confirmação da entrega
                    </p>
                  )}
                </div>
              )}

              {/* Produtos/Materiais Comuns */}
              {!selectedProductionId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Produto/Material
                    </label>
                    <select
                      value={additionalProductId}
                      onChange={(e) => {
                        setAdditionalProductId(e.target.value);
                        setSelectedProductionId('');
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Selecione...</option>
                      <optgroup label="Produtos">
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Materiais">
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preço Unitário
                    </label>
                    <input
                      type="number"
                      value={additionalPrice}
                      onChange={(e) => setAdditionalPrice(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade
                </label>
                <input
                  type="number"
                  value={additionalQuantity}
                  onChange={(e) => setAdditionalQuantity(parseFloat(e.target.value) || 0)}
                  min="0.01"
                  max={selectedProductionId ? parseFloat(orderProducts.find(op => op.id === selectedProductionId)?.quantity || '0') : undefined}
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <button
                onClick={handleAddAdditional}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Confirmar Carregamento</h3>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-700 mb-2">
              Escolha como deseja proceder com este carregamento:
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                <strong>Salvar e Continuar:</strong> Salva o progresso atual. A entrega ficará aberta para carregar mais itens depois.
              </p>
              <p className="text-sm text-blue-900 mt-2">
                <strong>Finalizar Agora:</strong> Fecha a entrega definitivamente, mesmo que nem todos os itens tenham sido carregados.
              </p>
            </div>
            <p className="text-gray-700 mb-4 font-medium">
              Itens carregados até o momento:
            </p>
            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
              {loadedItems.map((item, index) => (
                <div key={index} className={`p-3 rounded-lg ${
                  item.type === 'additional' ? 'bg-orange-50' : 'bg-green-50'
                }`}>
                  <div className="font-medium">
                    {item.name}
                    {item.type === 'additional' && (
                      <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded">
                        ADICIONAL
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Quantidade: {item.quantity}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmPartialDelivery}
                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 font-semibold"
              >
                <Truck className="h-5 w-5" />
                Confirmar Carregamento Parcial
              </button>
              <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg border border-purple-200">
                <p className="font-medium text-purple-800 mb-1">⚡ Carregamento Parcial:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Fecha esta entrega com os itens carregados</li>
                  <li>Cria automaticamente nova entrega com os itens restantes</li>
                  <li>Ideal para quando o caminhão não comporta todos os itens</li>
                </ul>
              </div>
              <div className="border-t pt-3">
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={confirmCloseLoad}
                    className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Save className="h-5 w-5" />
                    Salvar e Continuar Depois
                  </button>
                  <button
                    onClick={confirmFinishDeliveryManually}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Finalizar Entrega Agora
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmation(false)}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                <X className="h-5 w-5" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Entregas</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('open')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'open'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Pendentes ({deliveries.filter(d => d.status === 'open' || d.status === 'in_progress').length})
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'closed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Finalizadas ({deliveries.filter(d => d.status === 'closed').length})
            </button>
          </div>
        </div>
        <div
          ref={tableContainerRef}
          className="bg-white rounded-lg shadow overflow-x-auto overflow-y-visible"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin'
          }}
        >
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Itens</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeliveries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-gray-400" />
                      <p className="text-lg">
                        {activeTab === 'open' ? 'Nenhuma entrega em aberto' : 'Nenhuma entrega finalizada'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredDeliveries.map((delivery) => (
                <React.Fragment key={delivery.id}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleDeliveryExpansion(delivery.id)}
                        className="p-3 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors touch-manipulation"
                        title={activeTab === 'closed' ? 'Ver itens entregues' : 'Ver itens da entrega'}
                      >
                        {expandedDeliveries.has(delivery.id) ? (
                          <ChevronDown className="h-6 w-6" />
                        ) : (
                          <ChevronRight className="h-6 w-6" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {delivery.status === 'open' && (
                          <button
                            onClick={() => handleContinueDelivery(delivery)}
                            className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            title="Iniciar carregamento"
                          >
                            <Truck className="h-4 w-4" />
                          </button>
                        )}
                        {delivery.status === 'in_progress' && (
                          <button
                            onClick={() => handleContinueDelivery(delivery)}
                            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Continuar carregamento"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {delivery.status === 'in_progress' && (
                          <button
                            onClick={() => handleRevertDelivery(delivery.id)}
                            className="p-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                            title="Estornar para aguardando"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDelivery(delivery.id)}
                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="Excluir entrega"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(delivery.delivery_date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {delivery.customers?.name || delivery.quotes?.customers?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {delivery.vehicle_info || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {delivery.driver_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          delivery.status === 'closed'
                            ? 'bg-green-100 text-green-800'
                            : delivery.status === 'in_progress'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {delivery.status === 'closed' ? 'Finalizada' :
                           delivery.status === 'in_progress' ? 'Em Progresso' : 'Aguardando'}
                        </span>
                        {delivery.auto_created && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Auto
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedDeliveries.has(delivery.id) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            {activeTab === 'closed' ? 'Itens Entregues:' : 'Itens da Entrega:'}
                          </h4>
                          {loadingItems.has(delivery.id) ? (
                            <div className="bg-white p-8 rounded border border-gray-200 flex flex-col items-center justify-center gap-3">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <p className="text-gray-600">Carregando itens...</p>
                            </div>
                          ) : deliveryItems[delivery.id] && Array.isArray(deliveryItems[delivery.id]) && deliveryItems[delivery.id].length > 0 ? (
                            <div className="space-y-2">
                              {deliveryItems[delivery.id].map((item, index) => {
                                const itemName = item.item_name ||
                                                 (item.products?.name) ||
                                                 (item.materials?.name) ||
                                                 (item.compositions?.name) ||
                                                 'Item sem nome';
                                const itemCode = item.products?.code || '';
                                const itemUnit = item.materials?.unit || 'un';

                                // Determinar cor de borda baseado no estoque
                                let borderColor = 'border-gray-200';
                                let bgColor = 'bg-white';
                                let stockBadgeColor = 'bg-gray-100 text-gray-700';

                                if (item.stock_status === 'Suficiente') {
                                  borderColor = 'border-green-300';
                                  bgColor = 'bg-green-50';
                                  stockBadgeColor = 'bg-green-100 text-green-800';
                                } else if (item.stock_status === 'Parcial') {
                                  borderColor = 'border-yellow-300';
                                  bgColor = 'bg-yellow-50';
                                  stockBadgeColor = 'bg-yellow-100 text-yellow-800';
                                } else if (item.stock_status === 'Indisponível') {
                                  borderColor = 'border-red-300';
                                  bgColor = 'bg-red-50';
                                  stockBadgeColor = 'bg-red-100 text-red-800';
                                } else if (item.stock_status === 'N/A') {
                                  borderColor = 'border-blue-200';
                                  bgColor = 'bg-blue-50';
                                  stockBadgeColor = 'bg-blue-100 text-blue-800';
                                }

                                return (
                                  <div key={index} className={`${bgColor} p-4 rounded border ${borderColor} hover:shadow-md transition-all`}>
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div className="font-medium text-gray-900">
                                            {itemName}
                                            {itemCode && <span className="text-gray-500 text-sm ml-2">({itemCode})</span>}
                                          </div>
                                          {item.is_from_composition && (
                                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                              📦 Composição: {item.parent_composition_name}
                                            </span>
                                          )}
                                          {item.stock_status && (
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${stockBadgeColor}`}>
                                              {item.stock_status}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">
                                          Tipo: {item.item_type === 'product' ? 'Produto' :
                                                 item.item_type === 'material' ? 'Insumo' :
                                                 item.item_type === 'equipment' ? 'Equipamento' :
                                                 item.item_type === 'service' ? 'Serviço' :
                                                 item.item_type === 'labor' ? 'Mão de Obra' : 'Composição'}
                                        </div>
                                        {item.available_stock !== undefined && item.stock_status !== 'N/A' && (
                                          <div className="text-sm font-medium text-gray-700 mt-1">
                                            📊 Estoque disponível: <span className="text-blue-600">{item.available_stock} {itemUnit}</span>
                                          </div>
                                        )}
                                        {item.notes && (
                                          <div className="text-sm text-gray-600 mt-2 bg-white bg-opacity-50 p-2 rounded">
                                            {item.notes}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <div className="font-semibold text-blue-600 text-lg">
                                          {item.quantity} {itemUnit}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                          Necessário
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded flex flex-col items-center gap-2">
                              <AlertCircle className="h-8 w-8 text-yellow-600" />
                              <p className="text-yellow-800 font-medium">Nenhum item encontrado nesta entrega</p>
                              <p className="text-yellow-700 text-sm text-center">
                                Esta entrega pode ter sido criada sem itens ou os itens foram removidos.
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição de Quantidade */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Editar Quantidade
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item: {editingItem.name}
                </label>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Digite a quantidade a ser carregada:
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editQuantity}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Permitir apenas números, vírgula e ponto
                    if (/^[\d,\.]*$/.test(value)) {
                      setEditQuantity(value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveEditItem();
                    } else if (e.key === 'Escape') {
                      cancelEditItem();
                    }
                  }}
                  className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 27 ou 27,5"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Use vírgula ou ponto para decimais (máximo 2 casas)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveEditItem}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  Salvar
                </button>
                <button
                  onClick={cancelEditItem}
                  className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <X className="h-5 w-5" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
