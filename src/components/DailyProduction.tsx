import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ClipboardList, Calendar, Package, QrCode, FileText } from 'lucide-react';
import { supabase, Product, Production } from '../lib/supabase';
import ProductionLabel from './ProductionLabel';
import { calculateProductionCosts, materialCostsToMovements } from '../lib/productionCosts';

interface ProductionWithProduct extends Production {
  products?: Product;
  production_order_id?: string;
  production_type?: 'stock' | 'order';
}

interface ProductionOrder {
  id: string;
  item_id: string | null; // Pode ser null para ordens antigas sem itens
  order_number: number;
  product_id: string;
  total_quantity: number;
  produced_quantity: number;
  remaining_quantity: number;
  customers?: { name: string };
  products?: { name: string };
  is_legacy?: boolean; // Indica se é ordem antiga (sem items)
}

interface LabelData {
  productName: string;
  quantity: number;
  unit: string;
  productionDate: string;
  recipeName: string;
  orderNumber?: number;
  customerName?: string;
  qrToken: string;
}

interface MaterialConsumption {
  material_name: string;
  total_quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

interface DailyFinancialSummary {
  totalMaterialCost: number;
  totalRevenue: number;
  profit: number;
  profitMargin: number;
}

interface ProductionSummary {
  product_id: string;
  product_name: string;
  product_code?: string;
  total_quantity: number;
  unit: string;
  production_count: number;
  unit_price: number;
  total_revenue: number;
  total_cost: number;
  unit_cost: number;
  profit: number;
  profit_margin: number;
}

export default function DailyProduction() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productions, setProductions] = useState<ProductionWithProduct[]>([]);
  const [openOrders, setOpenOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    production_date: new Date().toISOString().split('T')[0],
    production_type: 'stock' as 'stock' | 'order',
    production_order_id: '',
    production_order_item_id: '',
    notes: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [showLabel, setShowLabel] = useState(false);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [materialConsumption, setMaterialConsumption] = useState<MaterialConsumption[]>([]);
  const [showConsumption, setShowConsumption] = useState(false);
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  const [financialSummary, setFinancialSummary] = useState<DailyFinancialSummary | null>(null);
  const [productionSummary, setProductionSummary] = useState<ProductionSummary[]>([]);

  useEffect(() => {
    loadData();
  }, [filterDate]);

  useEffect(() => {
    if (formData.production_type === 'order' && formData.product_id) {
      loadOpenOrders();
    } else {
      setOpenOrders([]);
    }
  }, [formData.production_type, formData.product_id]);

  const loadData = async () => {
    try {
      const [productsRes, productionsRes] = await Promise.all([
        supabase.from('products').select('id, code, name, unit, recipe_id, sale_price, product_type, total_weight').order('name').limit(500),
        supabase
          .from('production')
          .select('id, product_id, quantity, production_date, production_type, production_order_id, production_order_item_id, notes, created_at, products(id, code, name, unit, recipe_id, sale_price, product_type, total_weight)')
          .eq('production_date', filterDate)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (productionsRes.error) throw productionsRes.error;

      setProducts(productsRes.data || []);
      setProductions(productionsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadOpenOrders = async () => {
    try {
      const selectedProductId = formData.product_id;
      console.log('Carregando ordens abertas (modelo novo e legado) para produto:', selectedProductId);

      // MODELO NOVO: Buscar ordens com itens em production_order_items
      const { data: ordersData, error: ordersError } = await supabase
        .from('production_orders')
        .select('id, order_number, customer_id, product_id, total_quantity, produced_quantity, remaining_quantity, customers(name), products(name)')
        .in('status', ['open', 'in_progress']);

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        console.log('Nenhuma ordem aberta encontrada');
        setOpenOrders([]);
        return;
      }

      const orderIds = ordersData.map(o => o.id);

      // Buscar itens dessas ordens (modelo novo)
      const { data: itemsData, error: itemsError } = await supabase
        .from('production_order_items')
        .select('id, production_order_id, product_id, quantity, produced_quantity, products(name)')
        .in('production_order_id', orderIds);

      if (itemsError) throw itemsError;

      const formattedOrders: ProductionOrder[] = [];

      // MODELO NOVO: Adicionar itens de production_order_items
      const itemsFormatted = (itemsData || [])
        .filter(item => {
          const remainingQty = item.quantity - item.produced_quantity;
          const matchesProduct = !selectedProductId || item.product_id === selectedProductId;
          return remainingQty > 0 && matchesProduct;
        })
        .map(item => {
          const order = ordersData.find(o => o.id === item.production_order_id);
          return {
            id: item.production_order_id,
            item_id: item.id,
            order_number: order?.order_number || 0,
            product_id: item.product_id || '',
            total_quantity: item.quantity,
            produced_quantity: item.produced_quantity,
            remaining_quantity: item.quantity - item.produced_quantity,
            customers: order?.customers || null,
            products: item.products,
            is_legacy: false,
          };
        });

      formattedOrders.push(...itemsFormatted);

      // MODELO LEGADO: Adicionar ordens antigas que tem product_id direto e não tem itens
      const legacyOrders = ordersData
        .filter(order => {
          // Só incluir se:
          // 1. Tem product_id direto (modelo antigo)
          // 2. NÃO tem itens correspondentes em production_order_items
          // 3. Ainda tem quantidade restante
          // 4. Corresponde ao produto selecionado
          const hasProductId = !!order.product_id;
          const hasItems = itemsData?.some(item => item.production_order_id === order.id);
          const hasRemaining = order.remaining_quantity > 0;
          const matchesProduct = !selectedProductId || order.product_id === selectedProductId;
          return hasProductId && !hasItems && hasRemaining && matchesProduct;
        })
        .map(order => ({
          id: order.id,
          item_id: null, // Ordem legada não tem item
          order_number: order.order_number,
          product_id: order.product_id || '',
          total_quantity: order.total_quantity,
          produced_quantity: order.produced_quantity,
          remaining_quantity: order.remaining_quantity,
          customers: order.customers || null,
          products: order.products || null,
          is_legacy: true,
        }));

      formattedOrders.push(...legacyOrders);

      // Ordenar por número da ordem (mais recente primeiro)
      formattedOrders.sort((a, b) => b.order_number - a.order_number);

      console.log('=== DEBUG ORDENS ABERTAS ===');
      console.log('Produto selecionado:', selectedProductId);
      console.log('Total de ordens encontradas:', formattedOrders.length);
      console.log('Ordens modelo novo (com itens):', itemsFormatted.length);
      console.log('Ordens modelo legado (sem itens):', legacyOrders.length);
      if (formattedOrders.length === 0) {
        console.warn('⚠️ NENHUMA ORDEM ENCONTRADA PARA ESTE PRODUTO');
        console.log('Total de ordens abertas (sem filtro):', ordersData.length);
        console.log('Total de itens (sem filtro):', itemsData?.length || 0);
      }
      console.log('Detalhes das ordens:', formattedOrders);
      console.log('==========================');

      setOpenOrders(formattedOrders);
    } catch (error) {
      console.error('Erro ao carregar ordens abertas:', error);
      setOpenOrders([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_id || !formData.quantity || parseFloat(formData.quantity) <= 0) {
      alert('Preencha todos os campos obrigatórios corretamente');
      return;
    }

    if (formData.production_type === 'order' && !formData.production_order_id) {
      alert('Selecione uma ordem de produção');
      return;
    }

    try {
      const productionDateFormatted = formData.production_date.split('T')[0];

      const data = {
        product_id: formData.product_id,
        quantity: parseFloat(formData.quantity),
        production_date: productionDateFormatted,
        production_type: formData.production_type,
        production_order_id: formData.production_type === 'order' && formData.production_order_id ? formData.production_order_id : null,
        production_order_item_id: formData.production_type === 'order' && formData.production_order_item_id ? formData.production_order_item_id : null,
        notes: formData.notes,
      };

      console.log('=== DADOS DE PRODUÇÃO A SEREM SALVOS ===');
      console.log('Data formatada:', productionDateFormatted);
      console.log('Dados completos:', data);
      console.log('=======================================');

      if (editingId) {
        const { error } = await supabase
          .from('production')
          .update(data)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const product = products.find(p => p.id === formData.product_id);
        const productName = product?.name || 'produto';
        const productUnit = product?.unit || 'un';

        console.log('Calculando custos de produção...');
        const costs = await calculateProductionCosts(
          formData.product_id,
          (product as any)?.recipe_id || null,
          parseFloat(formData.quantity),
          (product as any)?.product_type,
          (product as any)?.total_weight
        );

        console.log('Custos calculados:', costs);

        const movements = materialCostsToMovements(
          costs,
          productionDateFormatted,
          productName,
          parseFloat(formData.quantity),
          productUnit
        );

        console.log('Criando produção atomicamente com', movements.length, 'movimentos de materiais...');

        const rpcPayload = {
          p_product_id: formData.product_id,
          p_recipe_id: (product as any)?.recipe_id || null,
          p_quantity: parseFloat(formData.quantity),
          p_production_date: productionDateFormatted,
          p_employee_id: null,
          p_production_order_item_id: formData.production_type === 'order' && formData.production_order_item_id ? formData.production_order_item_id : null,
          p_production_type: formData.production_type,
          p_notes: formData.notes,
          p_custos: costs,
          p_material_movements: movements
        };

        console.log('=== PAYLOAD ENVIADO PARA create_production_atomic ===');
        console.log('p_product_id:', rpcPayload.p_product_id);
        console.log('p_recipe_id:', rpcPayload.p_recipe_id);
        console.log('p_quantity:', rpcPayload.p_quantity);
        console.log('p_production_date:', rpcPayload.p_production_date);
        console.log('p_production_type:', rpcPayload.p_production_type);
        console.log('p_production_order_item_id:', rpcPayload.p_production_order_item_id);
        console.log('p_notes:', rpcPayload.p_notes);
        console.log('p_custos:', rpcPayload.p_custos);
        console.log('p_material_movements (count):', rpcPayload.p_material_movements.length);
        console.log('=============================================');

        const { data: productionId, error: rpcError } = await supabase.rpc(
          'create_production_atomic',
          rpcPayload
        );

        if (rpcError) {
          console.error('======= ERRO AO CRIAR PRODUÇÃO =======');
          console.error('Erro completo:', rpcError);
          console.error('Mensagem:', rpcError?.message);
          console.error('Detalhes:', rpcError?.details);
          console.error('Hint:', rpcError?.hint);
          console.error('Código:', rpcError?.code);
          console.error('Payload enviado:', rpcPayload);
          console.error('====================================');
          throw rpcError;
        }

        console.log('✓ Produção criada com sucesso! ID:', productionId);

        let recipeName = 'Traço não especificado';
        if (product?.recipe_id) {
          const { data: recipeData } = await supabase
            .from('recipes')
            .select('name')
            .eq('id', product.recipe_id)
            .maybeSingle();

          if (recipeData) {
            recipeName = recipeData.name;
          }
        }

        const qrToken = `${crypto.randomUUID()}-${Date.now()}`;
        const { error: trackingError } = await supabase
          .from('product_tracking')
          .insert([{
            qr_token: qrToken,
            production_id: productionId,
            production_order_id: formData.production_type === 'order' ? formData.production_order_id : null,
            product_id: formData.product_id,
            recipe_name: recipeName,
            quantity: parseFloat(formData.quantity),
            production_date: productionDateFormatted,
          }]);

        if (trackingError) {
          console.error('Erro ao criar rastreamento:', trackingError);
        }

        let orderNumber: number | undefined;
        let customerName: string | undefined;

        if (formData.production_type === 'order' && formData.production_order_id) {
          const order = openOrders.find(o => o.id === formData.production_order_id);
          if (order) {
            orderNumber = order.order_number;
            customerName = order.customers?.name;
          }
        }

        const newLabelData = {
          productName: productName,
          quantity: parseFloat(formData.quantity),
          unit: productUnit,
          productionDate: productionDateFormatted,
          recipeName: recipeName,
          orderNumber: orderNumber,
          customerName: customerName,
          qrToken: qrToken,
        };

        console.log('Gerando etiqueta com dados:', newLabelData);
        setLabelData(newLabelData);
        setShowLabel(true);

        // Atualizar progresso da ordem de produção
        if (formData.production_type === 'order' && formData.production_order_id) {
          const order = openOrders.find(o =>
            o.item_id ? o.item_id === formData.production_order_item_id : o.id === formData.production_order_id
          );

          if (order) {
            const quantityProduced = parseFloat(formData.quantity);

            // MODELO NOVO: Ordem com itens (production_order_items)
            if (order.item_id && formData.production_order_item_id) {
              console.log('Atualizando item de ordem (modelo novo)...');
              const newProducedQuantity = order.produced_quantity + quantityProduced;

              const { error: itemError } = await supabase
                .from('production_order_items')
                .update({
                  produced_quantity: newProducedQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', formData.production_order_item_id);

              if (itemError) throw itemError;

              // Recalcular status da ordem baseado em todos os itens
              const { data: allItems, error: allItemsError } = await supabase
                .from('production_order_items')
                .select('quantity, produced_quantity')
                .eq('production_order_id', order.id);

              if (allItemsError) throw allItemsError;

              if (allItems) {
                const allCompleted = allItems.every(item => item.produced_quantity >= item.quantity);
                const hasProduction = allItems.some(item => item.produced_quantity > 0);

                let newOrderStatus = 'open';
                if (allCompleted) {
                  newOrderStatus = 'completed';
                } else if (hasProduction) {
                  newOrderStatus = 'in_progress';
                }

                const totalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);
                const totalProduced = allItems.reduce((sum, item) => sum + item.produced_quantity, 0);

                const { error: orderError } = await supabase
                  .from('production_orders')
                  .update({
                    produced_quantity: totalProduced,
                    remaining_quantity: Math.max(0, totalQuantity - totalProduced),
                    status: newOrderStatus,
                    updated_at: new Date().toISOString(),
                    ...(newOrderStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
                  })
                  .eq('id', order.id);

                if (orderError) throw orderError;
              }

            // MODELO LEGADO: Ordem antiga sem itens (product_id direto)
            } else if (order.is_legacy) {
              console.log('Atualizando ordem legada (sem itens)...');
              const newProducedQuantity = order.produced_quantity + quantityProduced;
              const newRemainingQuantity = Math.max(0, order.total_quantity - newProducedQuantity);

              let newOrderStatus = 'in_progress';
              if (newRemainingQuantity === 0) {
                newOrderStatus = 'completed';
              }

              const { error: orderError } = await supabase
                .from('production_orders')
                .update({
                  produced_quantity: newProducedQuantity,
                  remaining_quantity: newRemainingQuantity,
                  status: newOrderStatus,
                  updated_at: new Date().toISOString(),
                  ...(newOrderStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
                })
                .eq('id', order.id);

              if (orderError) {
                console.error('Erro ao atualizar ordem legada:', orderError);
                throw orderError;
              }

              console.log('✓ Ordem legada atualizada:', {
                ordem: order.order_number,
                produzido_antes: order.produced_quantity,
                produzido_agora: quantityProduced,
                produzido_total: newProducedQuantity,
                restante: newRemainingQuantity,
                novo_status: newOrderStatus
              });
            }
          }
        }
      }

      if (!editingId) {
        await loadData();
      } else {
        setFormData({
          product_id: '',
          quantity: '',
          production_date: filterDate,
          production_type: 'stock',
          production_order_id: '',
          production_order_item_id: '',
          notes: '',
        });
        setEditingId(null);
        loadData();
      }
    } catch (error: any) {
      console.error('======= ERRO AO SALVAR PRODUÇÃO =======');
      console.error('Erro completo:', error);
      console.error('Mensagem:', error?.message);
      console.error('Detalhes:', error?.details);
      console.error('Hint:', error?.hint);
      console.error('Código:', error?.code);
      console.error('Data selecionada:', formData.production_date);
      console.error('Dados do formulário:', formData);
      console.error('========================================');
      alert(`Erro ao salvar produção: ${error?.message || 'Erro desconhecido'}\n${error?.details || ''}\n${error?.hint || ''}`);
    }
  };

  const handleEdit = (production: ProductionWithProduct) => {
    setFormData({
      product_id: production.product_id,
      quantity: production.quantity.toString(),
      production_date: production.production_date,
      production_type: production.production_type || 'stock',
      production_order_id: production.production_order_id || '',
      production_order_item_id: (production as any).production_order_item_id || '',
      notes: production.notes,
    });
    setEditingId(production.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      const { error } = await supabase
        .from('production')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao excluir produção:', error);
      alert('Erro ao excluir produção');
    }
  };

  const handleCancel = () => {
    setFormData({
      product_id: '',
      quantity: '',
      production_date: filterDate,
      production_type: 'stock',
      production_order_id: '',
      production_order_item_id: '',
      notes: '',
    });
    setEditingId(null);
  };

  const handleGenerateLabel = async (production: ProductionWithProduct) => {
    try {
      const { data: trackingData, error: trackingError } = await supabase
        .from('product_tracking')
        .select('id, production_id, qr_token, recipe_name')
        .eq('production_id', production.id)
        .maybeSingle();

      if (trackingError) throw trackingError;

      if (trackingData) {
        let orderNumber: number | undefined;
        let customerName: string | undefined;

        if (production.production_order_id) {
          const { data: orderData } = await supabase
            .from('production_orders')
            .select('order_number, customers(name)')
            .eq('id', production.production_order_id)
            .maybeSingle();

          if (orderData) {
            orderNumber = orderData.order_number;
            customerName = orderData.customers?.name;
          }
        }

        setLabelData({
          productName: production.products?.name || 'Produto',
          quantity: parseFloat(production.quantity.toString()),
          unit: production.products?.unit || 'un',
          productionDate: production.production_date,
          recipeName: trackingData.recipe_name,
          orderNumber: orderNumber,
          customerName: customerName,
          qrToken: trackingData.qr_token,
        });
        setShowLabel(true);
      } else {
        alert('Etiqueta não encontrada para esta produção');
      }
    } catch (error) {
      console.error('Erro ao gerar etiqueta:', error);
      alert('Erro ao gerar etiqueta');
    }
  };

  const getTotalProduction = () => {
    return productions.reduce((sum, p) => sum + parseFloat(p.quantity.toString()), 0);
  };

  const generateConsumptionSummary = async () => {
    setLoadingConsumption(true);
    setShowConsumption(false);

    try {
      console.log('Gerando resumo de produção do dia:', filterDate);

      // Usar nova RPC otimizada
      const { data: materialReport, error: materialError } = await supabase.rpc(
        'get_resumo_producao_dia',
        { p_data: filterDate }
      );

      if (materialError) {
        console.error('Erro na RPC get_resumo_producao_dia:', materialError);
        throw new Error(`Erro ao buscar consumo de insumos: ${materialError.message}${materialError.details ? ` - ${materialError.details}` : ''}`);
      }

      // Verificar se há produções no dia
      if (!materialReport || materialReport.length === 0) {
        console.log('Nenhum consumo de insumo encontrado para a data:', filterDate);
        setMaterialConsumption([]);
        setProductionSummary([]);
        setFinancialSummary(null);
        setShowConsumption(true);
        alert(`Sem produções registradas para ${filterDate}.\n\nVerifique se há produções cadastradas nesta data.`);
        return;
      }

      console.log(`Consumo encontrado: ${materialReport.length} materiais (fonte: ${materialReport[0]?.source || 'desconhecida'})`);

      const consumptionArray = (materialReport || []).map((item: any) => ({
        material_name: item.material_name,
        total_quantity: parseFloat(item.total_quantity || 0),
        unit: item.unit || '',
        unit_cost: parseFloat(item.avg_unit_cost || 0),
        total_cost: parseFloat(item.total_cost || 0)
      }));

      const totalMaterialCost = consumptionArray.reduce((sum: number, item: any) => sum + item.total_cost, 0);

      const productionsForRevenue = productions.filter(
        p => !p.notes || !p.notes.toLowerCase().includes('ajuste de estoque')
      );

      let totalRevenue = 0;

      for (const production of productionsForRevenue) {
        const { data: productData } = await supabase
          .from('products')
          .select('final_sale_price, sale_price')
          .eq('id', production.product_id)
          .maybeSingle();

        if (productData) {
          const price = productData.final_sale_price || productData.sale_price || 0;
          const revenue = parseFloat(production.quantity.toString()) * parseFloat(price);
          totalRevenue += revenue;
        }
      }

      const profit = totalRevenue - totalMaterialCost;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      // Buscar resumo de produtos usando RPC otimizada
      console.log('Buscando resumo de produtos...');
      const { data: productsReport, error: productsError } = await supabase.rpc(
        'get_resumo_produtos_dia',
        { p_data: filterDate }
      );

      if (productsError) {
        console.error('Erro na RPC get_resumo_produtos_dia:', productsError);
        throw new Error(`Erro ao buscar resumo de produtos: ${productsError.message}`);
      }

      const productionSummaryArray = (productsReport || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_code: item.product_code || '',
        total_quantity: parseFloat(item.total_quantity || 0),
        unit: item.unit || 'un',
        production_count: parseInt(item.production_count || 0),
        unit_price: parseFloat(item.unit_price || 0),
        total_revenue: parseFloat(item.total_revenue || 0),
        total_cost: parseFloat(item.total_cost || 0),
        unit_cost: parseFloat(item.unit_cost || 0),
        profit: parseFloat(item.profit || 0),
        profit_margin: parseFloat(item.profit_margin || 0)
      }));

      console.log('✓ Relatório gerado com sucesso!', {
        materiais: consumptionArray.length,
        produtos: productionSummaryArray.length,
        custoTotal: totalMaterialCost.toFixed(2),
        receita: totalRevenue.toFixed(2)
      });

      setMaterialConsumption(consumptionArray);
      setProductionSummary(productionSummaryArray);
      setFinancialSummary({
        totalMaterialCost,
        totalRevenue,
        profit,
        profitMargin,
      });
      setShowConsumption(true);
    } catch (error: any) {
      console.error('ERRO ao gerar resumo:', error);

      // Mostrar erro detalhado para o usuário
      const errorMessage = error.message || 'Erro desconhecido ao gerar resumo';
      const errorDetails = error.details || error.hint || '';

      alert(
        `Erro ao gerar resumo do dia:\n\n${errorMessage}\n\n` +
        (errorDetails ? `Detalhes: ${errorDetails}\n\n` : '') +
        `Data selecionada: ${filterDate}\n\n` +
        `Verifique o console (F12) para mais informações.`
      );

      // Limpar estado em caso de erro
      setShowConsumption(false);
    } finally {
      setLoadingConsumption(false);
    }
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
      {showLabel && labelData && (
        <ProductionLabel
          productionData={labelData}
          onClose={() => {
            setShowLabel(false);
            setLabelData(null);
            setFormData({
              product_id: '',
              quantity: '',
              production_date: filterDate,
              production_type: 'stock',
              production_order_id: '',
              production_order_item_id: '',
              notes: '',
            });
            setEditingId(null);
          }}
        />
      )}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ClipboardList className="w-6 h-6" />
          {editingId ? 'Editar Produção' : 'Registrar Produção'}
        </h2>

        {products.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
            Cadastre produtos primeiro para registrar a produção
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produto *
                  {formData.production_type === 'order' && !formData.production_order_item_id && !formData.production_order_id && (
                    <span className="text-xs text-gray-500 ml-2">(selecione o produto para ver as ordens disponíveis)</span>
                  )}
                  {formData.production_type === 'order' && (formData.production_order_item_id || formData.production_order_id) && (
                    <span className="text-xs text-gray-500 ml-2">(definido pela ordem selecionada)</span>
                  )}
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value, production_order_id: '', production_order_item_id: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                  disabled={formData.production_type === 'order' && (formData.production_order_item_id || formData.production_order_id) ? true : false}
                >
                  <option value="">Selecione um produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.0000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da Produção *
              </label>
              <input
                type="date"
                value={formData.production_date}
                onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Produção *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="stock"
                    checked={formData.production_type === 'stock'}
                    onChange={(e) => setFormData({ ...formData, production_type: e.target.value as 'stock' | 'order', production_order_id: '', production_order_item_id: '' })}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm text-gray-700">Para Estoque</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="order"
                    checked={formData.production_type === 'order'}
                    onChange={(e) => setFormData({ ...formData, production_type: e.target.value as 'stock' | 'order' })}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm text-gray-700">Para Ordem de Produção</span>
                </label>
              </div>
            </div>

            {formData.production_type === 'order' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordem de Produção *
                </label>
                {openOrders.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    Nenhuma ordem de produção aberta para o produto selecionado
                  </div>
                ) : (
                  <select
                    value={formData.production_order_item_id || formData.production_order_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Encontrar ordem pelo item_id ou pelo order_id (para ordens legadas)
                      const selectedOrder = openOrders.find(o =>
                        o.item_id === value || o.id === value
                      );

                      if (selectedOrder) {
                        setFormData({
                          ...formData,
                          production_order_item_id: selectedOrder.item_id || '',
                          production_order_id: selectedOrder.id,
                          product_id: selectedOrder.product_id
                        });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione a ordem de produção</option>
                    {openOrders.map((order) => (
                      <option
                        key={order.item_id || order.id}
                        value={order.item_id || order.id}
                      >
                        OP #{order.order_number} - {order.products?.name || 'Sem produto'} - {order.customers?.name || 'Sem cliente'} - Faltam {order.remaining_quantity} de {order.total_quantity}
                        {order.is_legacy && ' (Ordem legada)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Observações sobre a produção"
                rows={2}
              />
            </div>

            {formData.production_type === 'order' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <strong>Atenção:</strong> Esta produção será vinculada a uma ordem e não será somada ao estoque de produtos.
                    A quantidade produzida será subtraída do total restante da ordem.
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {editingId ? 'Atualizar' : 'Registrar'}
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
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Produção do Dia
          </h3>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {productions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhuma produção registrada para esta data
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observações
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productions.map((production) => (
                    <tr key={production.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {production.products?.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {production.products?.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {parseFloat(production.quantity.toString()).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {production.production_type === 'order' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
                            <Package className="w-3 h-3" />
                            Ordem
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Estoque
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {production.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleGenerateLabel(production)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="Gerar Etiqueta"
                        >
                          <QrCode className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleEdit(production)}
                          className="text-green-600 hover:text-green-900 mr-3"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDelete(production.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-gray-600">Volume Total Produzido: </span>
                  <span className="text-xl font-bold text-green-600">{getTotalProduction().toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Total de registros: </span>
                  <span className="text-lg font-bold text-gray-900">{productions.length}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showConsumption && productionSummary.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Resumo de Produção por Produto</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Unitário
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Custo Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Custo Unit.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lucro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margem
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productionSummary.map((summary, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {summary.product_name}
                      </div>
                      {summary.product_code && (
                        <div className="text-xs text-gray-500">
                          Código: {summary.product_code}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {summary.total_quantity.toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 4,
                        })} {summary.unit} • {summary.production_count} {summary.production_count === 1 ? 'registro' : 'registros'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-base font-bold text-blue-600">
                        {summary.total_quantity.toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {summary.unit_price.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {summary.total_revenue.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-red-600">
                        {summary.total_cost.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-700">
                        {summary.unit_cost.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {summary.profit.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-semibold ${summary.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {summary.profit_margin.toLocaleString('pt-BR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td className="px-6 py-4 text-left text-sm text-gray-700">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-blue-600">
                      {productionSummary.reduce((sum, s) => sum + s.total_quantity, 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-green-600">
                      {productionSummary.reduce((sum, s) => sum + s.total_revenue, 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-red-600">
                      {productionSummary.reduce((sum, s) => sum + s.total_cost, 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className={`text-sm font-bold ${
                      productionSummary.reduce((sum, s) => sum + s.profit, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {productionSummary.reduce((sum, s) => sum + s.profit, 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-gray-700">
                      {productionSummary.length} {productionSummary.length === 1 ? 'produto' : 'produtos'}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <strong>Nota:</strong> Este resumo agrega todas as produções do dia selecionado por produto, somando as quantidades de múltiplos registros.
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Consumo de Insumos</h3>
          </div>
          <button
            onClick={generateConsumptionSummary}
            disabled={loadingConsumption || productions.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {loadingConsumption ? 'Gerando...' : 'Gerar Resumo do Dia'}
          </button>
        </div>

        {showConsumption && (
          <>
            {materialConsumption.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <p className="text-lg font-medium">Nenhum consumo de insumo encontrado</p>
                  <p className="text-sm mt-2">
                    Não há registros de produção para {filterDate} ou os custos não foram calculados.
                  </p>
                </div>
                <button
                  onClick={generateConsumptionSummary}
                  disabled={loadingConsumption}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {loadingConsumption ? 'Tentando...' : 'Tentar Novamente'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Insumo
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantidade Consumida
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unidade
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Unitário
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materialConsumption.map((consumption, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {consumption.material_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-semibold text-green-600">
                            {consumption.total_quantity.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {consumption.unit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-700">
                            {consumption.unit_cost.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-semibold text-red-600">
                            {consumption.total_cost.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-right text-sm text-gray-700">
                        CUSTO TOTAL DE INSUMOS:
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-base font-bold text-red-600">
                          {financialSummary?.totalMaterialCost.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {financialSummary && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="text-sm text-red-600 font-medium mb-1">Custo Total de Insumos</div>
                      <div className="text-2xl font-bold text-red-700">
                        {financialSummary.totalMaterialCost.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-blue-600 font-medium mb-1">Receita de Vendas (Preço de Tabela)</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {financialSummary.totalRevenue.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </div>

                    <div className={`rounded-lg p-4 border ${
                      financialSummary.profit >= 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className={`text-sm font-medium mb-1 ${
                        financialSummary.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Resultado Financeiro
                        <span className="ml-2 text-xs">
                          ({financialSummary.profitMargin.toFixed(1)}% margem)
                        </span>
                      </div>
                      <div className={`text-2xl font-bold ${
                        financialSummary.profit >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {financialSummary.profit.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <strong>Total de insumos diferentes consumidos:</strong> {materialConsumption.length}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    <strong>Nota:</strong> A receita considera o preço de tabela dos produtos. O custo considera apenas insumos diretos (não inclui mão de obra, energia, depreciação, etc.).
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!showConsumption && (
          <div className="text-center py-8 text-gray-500">
            Clique em "Gerar Resumo do Dia" para visualizar o consumo total de insumos da data selecionada
          </div>
        )}
      </div>
    </div>
  );
}
