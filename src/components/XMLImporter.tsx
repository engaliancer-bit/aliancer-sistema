import { useState } from 'react';
import { Upload, X, Check, AlertCircle, Package, Tag, Lock, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ItemCategory = 'insumo' | 'servico' | 'manutencao' | 'investimento';

interface Supplier {
  id: string;
  name: string;
  cnpj: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost?: number;
  price_locked?: boolean;
}

interface PriceChangeReview {
  materialId: string;
  materialName: string;
  currentPrice: number;
  newPrice: number;
  currentUnit: string;
  newUnit: string;
  isLocked: boolean;
  approved: boolean;
}

interface NFItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  mappedMaterialId?: string;
  createNew?: boolean;
  category: ItemCategory;
}

interface NFPayment {
  dueDate: string;
  amount: number;
}

interface NFData {
  invoiceNumber: string;
  invoiceSeries: string;
  invoiceKey: string;
  invoiceDate: string;
  supplierCNPJ: string;
  supplierName: string;
  totalAmount: number;
  items: NFItem[];
  payments: NFPayment[];
}

interface Props {
  materials: Material[];
  suppliers: Supplier[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function XMLImporter({ materials, suppliers, onSuccess, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [nfData, setNfData] = useState<NFData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [priceReviews, setPriceReviews] = useState<PriceChangeReview[]>([]);
  const [showPriceReview, setShowPriceReview] = useState(false);

  const parseXML = async (xmlText: string): Promise<NFData | null> => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      const getElementText = (parent: Element | Document, tagName: string): string => {
        const element = parent.getElementsByTagName(tagName)[0];
        return element?.textContent?.trim() || '';
      };

      const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
      if (!infNFe) {
        throw new Error('XML inválido: tag infNFe não encontrada');
      }

      const ide = infNFe.getElementsByTagName('ide')[0];
      const emit = infNFe.getElementsByTagName('emit')[0];
      const total = infNFe.getElementsByTagName('total')[0];
      const ICMSTot = total?.getElementsByTagName('ICMSTot')[0];

      const invoiceNumber = getElementText(ide, 'nNF');
      const invoiceSeries = getElementText(ide, 'serie');
      const invoiceKey = infNFe.getAttribute('Id')?.replace('NFe', '') || '';
      const invoiceDate = getElementText(ide, 'dhEmi').split('T')[0];

      const supplierCNPJ = getElementText(emit, 'CNPJ');
      const supplierName = getElementText(emit, 'xNome');

      const totalAmount = parseFloat(getElementText(ICMSTot, 'vNF'));

      const detElements = xmlDoc.getElementsByTagName('det');
      const items: NFItem[] = [];

      for (let i = 0; i < detElements.length; i++) {
        const det = detElements[i];
        const prod = det.getElementsByTagName('prod')[0];

        const code = getElementText(prod, 'cProd');
        const description = getElementText(prod, 'xProd');
        const quantity = parseFloat(getElementText(prod, 'qCom'));
        const unit = getElementText(prod, 'uCom');
        const unitPrice = parseFloat(getElementText(prod, 'vUnCom'));
        const totalPrice = parseFloat(getElementText(prod, 'vProd'));

        items.push({
          code,
          description,
          quantity,
          unit,
          unitPrice,
          totalPrice,
          category: 'insumo',
        });
      }

      const payments: NFPayment[] = [];
      const dupElements = xmlDoc.getElementsByTagName('dup');

      if (dupElements.length > 0) {
        for (let i = 0; i < dupElements.length; i++) {
          const dup = dupElements[i];
          const dueDate = getElementText(dup, 'dVenc');
          const amount = parseFloat(getElementText(dup, 'vDup'));

          if (dueDate && amount) {
            payments.push({ dueDate, amount });
          }
        }
      } else {
        payments.push({ dueDate: invoiceDate, amount: totalAmount });
      }

      return {
        invoiceNumber,
        invoiceSeries,
        invoiceKey,
        invoiceDate,
        supplierCNPJ,
        supplierName,
        totalAmount,
        items,
        payments,
      };
    } catch (err: any) {
      console.error('Erro ao parsear XML:', err);
      throw new Error(`Erro ao processar XML: ${err.message}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const text = await selectedFile.text();
      const parsed = await parseXML(text);

      if (parsed) {
        setNfData(parsed);

        const matchingSupplier = suppliers.find(
          s => s.cnpj?.replace(/\D/g, '') === parsed.supplierCNPJ?.replace(/\D/g, '')
        );

        if (matchingSupplier) {
          setSelectedSupplierId(matchingSupplier.id);
        }

        parsed.items.forEach(item => {
          const matchingMaterial = materials.find(
            m => m.name.toLowerCase().includes(item.description.toLowerCase().substring(0, 20)) ||
                 item.description.toLowerCase().includes(m.name.toLowerCase())
          );
          if (matchingMaterial) {
            item.mappedMaterialId = matchingMaterial.id;
          }
        });
      }
    } catch (err: any) {
      setError(err.message);
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const buildPriceReviews = async (): Promise<PriceChangeReview[]> => {
    if (!nfData) return [];
    const reviews: PriceChangeReview[] = [];

    const insumoItems = nfData.items.filter(item => item.category === 'insumo' && item.mappedMaterialId);

    for (const item of insumoItems) {
      const { data: mat } = await supabase
        .from('materials')
        .select('id, name, unit, unit_cost, price_locked')
        .eq('id', item.mappedMaterialId!)
        .maybeSingle();

      if (mat && (mat.unit_cost !== item.unitPrice || mat.unit !== item.unit)) {
        reviews.push({
          materialId: mat.id,
          materialName: mat.name,
          currentPrice: mat.unit_cost || 0,
          newPrice: item.unitPrice,
          currentUnit: mat.unit,
          newUnit: item.unit,
          isLocked: mat.price_locked || false,
          approved: !(mat.price_locked),
        });
      }
    }

    const autoItems = nfData.items.filter(
      item => item.category === 'insumo' && !item.mappedMaterialId && !item.createNew
    );
    for (const item of autoItems) {
      const { data: mat } = await supabase
        .from('materials')
        .select('id, name, unit, unit_cost, price_locked')
        .ilike('name', item.description.trim())
        .maybeSingle();

      if (mat && (mat.unit_cost !== item.unitPrice || mat.unit !== item.unit)) {
        reviews.push({
          materialId: mat.id,
          materialName: mat.name,
          currentPrice: mat.unit_cost || 0,
          newPrice: item.unitPrice,
          currentUnit: mat.unit,
          newUnit: item.unit,
          isLocked: mat.price_locked || false,
          approved: !(mat.price_locked),
        });
      }
    }

    return reviews;
  };

  const handlePreImport = async () => {
    if (!nfData) return;
    setLoading(true);
    setError(null);
    try {
      const reviews = await buildPriceReviews();
      if (reviews.length > 0) {
        setPriceReviews(reviews);
        setShowPriceReview(true);
      } else {
        await executeImport({});
      }
    } catch (err: any) {
      setError(`Erro ao verificar precos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPriceReview = async () => {
    setShowPriceReview(false);
    const approvedMap: Record<string, boolean> = {};
    priceReviews.forEach(r => { approvedMap[r.materialId] = r.approved; });
    await executeImport(approvedMap);
  };

  const handleImport = async () => {
    await handlePreImport();
  };

  const executeImport = async (approvedPriceUpdates: Record<string, boolean>) => {
    if (!nfData) return;

    console.log('=== INICIANDO IMPORTAÇÃO ===');
    console.log('Total de itens:', nfData.items.length);
    console.log('Itens por categoria:', {
      insumo: nfData.items.filter(i => i.category === 'insumo').length,
      servico: nfData.items.filter(i => i.category === 'servico').length,
      manutencao: nfData.items.filter(i => i.category === 'manutencao').length,
      investimento: nfData.items.filter(i => i.category === 'investimento').length,
    });

    setLoading(true);
    setError(null);

    // Contadores para resumo
    let insumosNovos = 0;
    let insumosAtualizados = 0;
    let fornecedorCriado = false;

    try {
      // Verificar se a nota fiscal já foi importada
      const { data: existingPurchase } = await supabase
        .from('purchases')
        .select('id, invoice_number, invoice_series, invoice_date')
        .eq('invoice_key', nfData.invoiceKey)
        .maybeSingle();

      if (existingPurchase) {
        setError(
          `Esta nota fiscal já foi importada anteriormente!\n` +
          `NF: ${existingPurchase.invoice_number}/${existingPurchase.invoice_series} - ` +
          `Data: ${new Date(existingPurchase.invoice_date).toLocaleDateString()}`
        );
        setLoading(false);
        return;
      }

      // Verificar/criar fornecedor automaticamente
      let finalSupplierId = selectedSupplierId;

      if (!finalSupplierId && nfData.supplierCNPJ && nfData.supplierName) {
        console.log('🔍 Verificando se fornecedor existe no banco...');
        console.log('  - CNPJ:', nfData.supplierCNPJ);
        console.log('  - Nome:', nfData.supplierName);

        // Buscar fornecedor pelo CNPJ
        const { data: existingSupplier } = await supabase
          .from('suppliers')
          .select('id, name, cnpj')
          .eq('cnpj', nfData.supplierCNPJ.replace(/\D/g, ''))
          .maybeSingle();

        if (existingSupplier) {
          console.log('✓ Fornecedor encontrado:', existingSupplier.name);
          finalSupplierId = existingSupplier.id;
          setSelectedSupplierId(existingSupplier.id);
        } else {
          console.log('✨ Fornecedor não encontrado, criando automaticamente...');

          // Criar novo fornecedor
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert({
              name: nfData.supplierName.trim(),
              cnpj: nfData.supplierCNPJ.replace(/\D/g, ''),
              email: null,
              phone: null,
            })
            .select()
            .single();

          if (supplierError) {
            console.error('❌ Erro ao criar fornecedor:', supplierError);
            throw new Error(`Erro ao criar fornecedor: ${supplierError.message}`);
          }

          console.log('✅ Fornecedor criado com sucesso!');
          console.log('  - ID:', newSupplier.id);
          console.log('  - Nome:', newSupplier.name);
          console.log('  - CNPJ:', newSupplier.cnpj);

          finalSupplierId = newSupplier.id;
          setSelectedSupplierId(newSupplier.id);
          fornecedorCriado = true;
        }
      }

      console.log('Criando registro de compra...');
      const firstDueDate = nfData.payments.length > 0 ? nfData.payments[0].dueDate : null;

      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          invoice_number: nfData.invoiceNumber,
          invoice_series: nfData.invoiceSeries,
          invoice_key: nfData.invoiceKey,
          invoice_date: nfData.invoiceDate,
          supplier_id: finalSupplierId || null,
          total_amount: nfData.totalAmount,
          due_date: firstDueDate,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;
      console.log('Compra criada com ID:', purchase.id);

      console.log('Criando contas a pagar...');
      if (finalSupplierId && nfData.payments.length > 0) {
        const payableAccounts = nfData.payments.map((payment, index) => ({
          purchase_id: purchase.id,
          supplier_id: finalSupplierId,
          description: `NF ${nfData.invoiceNumber}/${nfData.invoiceSeries} - ${nfData.supplierName}${nfData.payments.length > 1 ? ` - Parcela ${index + 1}/${nfData.payments.length}` : ''}`,
          installment_number: index + 1,
          total_installments: nfData.payments.length,
          amount: payment.amount,
          due_date: payment.dueDate,
          payment_status: 'pending'
        }));

        const { error: payableError } = await supabase
          .from('payable_accounts')
          .insert(payableAccounts);

        if (payableError) {
          console.error('Erro ao criar contas a pagar:', payableError);
        } else {
          console.log(`${payableAccounts.length} conta(s) a pagar criada(s)`);
        }
      }

      // Fase 1: Buscar/criar todos os materiais em paralelo
      const materialProcessingPromises = nfData.items
        .filter(item => item.category === 'insumo' && (item.createNew || !item.mappedMaterialId))
        .map(async (item) => {
          console.log(`\nProcessando insumo: ${item.description}`);

          try {
            const { data: existingMaterial, error: searchError } = await supabase
              .from('materials')
              .select('id, name, unit, unit_cost')
              .ilike('name', item.description.trim())
              .maybeSingle();

            if (searchError) {
              throw new Error(`Erro ao buscar insumo "${item.description}": ${searchError.message}`);
            }

            if (existingMaterial) {
              console.log(`✓ Insumo já existe (ID: ${existingMaterial.id}), verificando permissão de atualização...`);
              const priceChanged = existingMaterial.unit_cost !== item.unitPrice || existingMaterial.unit !== item.unit;
              const canUpdatePrice = !priceChanged || approvedPriceUpdates[existingMaterial.id] === true;

              if (canUpdatePrice) {
                const updateFields: Record<string, any> = {
                  imported_at: new Date().toISOString(),
                  nfe_key: nfData.invoiceKey,
                };
                if (priceChanged) {
                  updateFields.unit_cost = item.unitPrice;
                  updateFields.unit = item.unit;
                  updateFields.price_updated_at = new Date().toISOString();
                  updateFields.price_updated_by_source = 'nfe_import';

                  await supabase.from('material_price_history').insert({
                    material_id: existingMaterial.id,
                    old_unit_cost: existingMaterial.unit_cost,
                    new_unit_cost: item.unitPrice,
                    old_unit: existingMaterial.unit,
                    new_unit: item.unit,
                    source: 'nfe_import',
                    nfe_key: nfData.invoiceKey,
                    notes: `NF ${nfData.invoiceNumber}/${nfData.invoiceSeries}`,
                  });
                }

                const { error: updateError } = await supabase
                  .from('materials')
                  .update(updateFields)
                  .eq('id', existingMaterial.id);

                if (updateError) throw new Error(`Erro ao atualizar insumo: ${updateError.message}`);
                console.log(`✓ Insumo atualizado (preco ${canUpdatePrice && priceChanged ? 'alterado' : 'mantido'})`);
              } else {
                console.log(`⚠ Preco do insumo ${existingMaterial.id} nao alterado (preco travado ou nao aprovado)`);
                await supabase.from('material_price_history').insert({
                  material_id: existingMaterial.id,
                  old_unit_cost: existingMaterial.unit_cost,
                  new_unit_cost: item.unitPrice,
                  old_unit: existingMaterial.unit,
                  new_unit: item.unit,
                  source: 'nfe_import',
                  nfe_key: nfData.invoiceKey,
                  notes: `NF ${nfData.invoiceNumber}/${nfData.invoiceSeries} - alteracao rejeitada pelo usuario`,
                });
              }

              insumosAtualizados++;
              return { item, materialId: existingMaterial.id };
            } else {
              console.log('Criando novo insumo:', item.description);
              const { data: newMaterial, error: materialError } = await supabase
                .from('materials')
                .insert({
                  name: item.description.trim(),
                  unit: item.unit,
                  unit_cost: item.unitPrice,
                  import_status: 'imported_pending',
                  imported_at: new Date().toISOString(),
                  nfe_key: nfData.invoiceKey,
                })
                .select()
                .single();

              if (materialError) {
                if (materialError.code === '23505') {
                  throw new Error(`O insumo "${item.description}" já existe no sistema.`);
                }
                throw new Error(`Erro ao criar insumo: ${materialError.message}`);
              }

              console.log('✓ Novo insumo criado com ID:', newMaterial.id);
              insumosNovos++;
              return { item, materialId: newMaterial.id };
            }
          } catch (error: any) {
            console.error(`❌ Erro ao processar ${item.description}:`, error.message);
            throw error;
          }
        });

      const materialResults = await Promise.all(materialProcessingPromises);
      const materialMap = new Map(materialResults.map(r => [r.item.description, r.materialId]));

      // Fase 2: Processar todos os itens de forma otimizada
      for (const item of nfData.items) {
        console.log(`\n--- Processando item: ${item.description} (${item.category}) ---`);
        let materialId = item.mappedMaterialId;

        // Se foi processado na fase 1, usar o ID mapeado
        if (item.category === 'insumo' && materialMap.has(item.description)) {
          materialId = materialMap.get(item.description);
        }

        // Criar registro do item de compra com a categoria
        console.log('Criando purchase_item...');
        const { data: purchaseItem, error: itemError } = await supabase
          .from('purchase_items')
          .insert({
            purchase_id: purchase.id,
            material_id: materialId || null,
            product_code: item.code,
            product_description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
            item_category: item.category,
          })
          .select()
          .single();

        if (itemError) {
          console.error('❌ Erro ao criar purchase_item:', {
            erro: itemError.message,
            code: itemError.code,
            details: itemError.details,
            hint: itemError.hint,
            dados: {
              purchase_id: purchase.id,
              material_id: materialId,
              product_code: item.code,
              product_description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unitPrice,
              total_price: item.totalPrice,
              item_category: item.category
            }
          });
          throw new Error(`Erro ao criar item de compra "${item.description}": ${itemError.message}${itemError.details ? ` - ${itemError.details}` : ''}${itemError.hint ? ` (${itemError.hint})` : ''}`);
        }
        console.log('✓ purchase_item criado com sucesso (ID:', purchaseItem.id, ')');

        // Processar baseado na categoria
        if (item.category === 'insumo' && materialId) {
          // Insumo: criar movimento de material
          console.log(`Registrando entrada de estoque para material ID ${materialId}...`);
          const { error: movementError } = await supabase
            .from('material_movements')
            .insert({
              material_id: materialId,
              movement_type: 'entrada',
              quantity: item.quantity,
              notes: `Compra NF ${nfData.invoiceNumber}/${nfData.invoiceSeries}`,
              movement_date: nfData.invoiceDate,
            });

          if (movementError) {
            console.error('❌ Erro ao criar movimento de material:', {
              erro: movementError.message,
              code: movementError.code,
              details: movementError.details,
              hint: movementError.hint,
              dados: {
                material_id: materialId,
                movement_type: 'entrada',
                quantity: item.quantity,
                movement_date: nfData.invoiceDate
              }
            });
            throw new Error(`Erro ao registrar entrada de estoque para "${item.description}": ${movementError.message}`);
          }
          console.log(`✓ Entrada de estoque registrada: ${item.quantity} ${item.unit}`);

          const canUpdate = approvedPriceUpdates[materialId] !== false;
          if (canUpdate) {
            console.log(`Confirmando custo unitário para R$ ${item.unitPrice}...`);
            await supabase.from('materials').update({
              unit_cost: item.unitPrice,
              price_updated_at: new Date().toISOString(),
              price_updated_by_source: 'nfe_import',
            }).eq('id', materialId);
            console.log('✓ Custo unitário confirmado');
          } else {
            console.log(`⚠ Custo unitário nao atualizado para ${materialId} (rejeitado na revisao)`);
          }
        } else if (item.category === 'investimento') {
          console.log('Criando ativo para item:', item.description);
          console.log('purchase_item_id:', purchaseItem.id);

          const { data: assetData, error: assetError } = await supabase
            .from('assets')
            .insert({
              name: item.description,
              description: `Código: ${item.code} - Quantidade: ${item.quantity} ${item.unit}`,
              purchase_item_id: purchaseItem.id,
              acquisition_date: nfData.invoiceDate,
              acquisition_value: item.totalPrice,
              current_value: item.totalPrice,
              status: 'ativo',
              notes: `NF ${nfData.invoiceNumber}/${nfData.invoiceSeries}`,
            })
            .select()
            .single();

          if (assetError) {
            console.error('Erro ao criar ativo:', assetError);
            throw assetError;
          }
          console.log('Ativo criado com sucesso:', assetData);

          // Criar registro de despesa em cash_flow para investimento
          let equipmentCategory = await supabase
            .from('cost_categories')
            .select('id')
            .eq('name', 'Equipamentos e Patrimônio')
            .maybeSingle();

          // Fallback: buscar primeira categoria de equipamento se não encontrar a específica
          if (!equipmentCategory.data) {
            console.warn('Categoria "Equipamentos e Patrimônio" não encontrada, usando primeira categoria disponível');
            equipmentCategory = await supabase
              .from('cost_categories')
              .select('id')
              .eq('type', 'equipment')
              .limit(1)
              .maybeSingle();
          }

          const { error: cashFlowError } = await supabase
            .from('cash_flow')
            .insert({
              date: nfData.invoiceDate,
              type: 'expense',
              category: 'Investimento/Patrimônio',
              description: `${item.description} - NF ${nfData.invoiceNumber}/${nfData.invoiceSeries}`,
              amount: item.totalPrice,
              purchase_id: purchase.id,
              cost_category_id: equipmentCategory.data?.id || null,
              reference: `${item.code}`,
              notes: `Quantidade: ${item.quantity} ${item.unit}`,
              business_unit: 'factory',
            });

          if (cashFlowError) {
            console.error('Erro ao criar cash_flow para investimento:', cashFlowError);
            throw cashFlowError;
          }
          console.log('Despesa de investimento registrada no cash_flow');
        } else if (item.category === 'manutencao') {
          // Criar registro de despesa em cash_flow para manutenção
          console.log('Criando despesa de manutenção para:', item.description);

          let maintenanceCategory = await supabase
            .from('cost_categories')
            .select('id')
            .eq('name', 'Manutenção de Máquinas')
            .maybeSingle();

          // Fallback: buscar primeira categoria de manutenção se não encontrar a específica
          if (!maintenanceCategory.data) {
            console.warn('Categoria "Manutenção de Máquinas" não encontrada, usando primeira categoria disponível');
            maintenanceCategory = await supabase
              .from('cost_categories')
              .select('id')
              .eq('type', 'maintenance')
              .limit(1)
              .maybeSingle();
          }

          const { error: cashFlowError } = await supabase
            .from('cash_flow')
            .insert({
              date: nfData.invoiceDate,
              type: 'expense',
              category: 'Manutenção',
              description: `${item.description} - NF ${nfData.invoiceNumber}/${nfData.invoiceSeries}`,
              amount: item.totalPrice,
              purchase_id: purchase.id,
              cost_category_id: maintenanceCategory.data?.id || null,
              reference: `${item.code}`,
              notes: `Quantidade: ${item.quantity} ${item.unit}`,
              business_unit: 'factory',
            });

          if (cashFlowError) {
            console.error('Erro ao criar cash_flow para manutenção:', cashFlowError);
            throw cashFlowError;
          }
          console.log('Despesa de manutenção registrada no cash_flow');
        } else if (item.category === 'servico') {
          // Criar registro de despesa em cash_flow para serviços
          console.log('Criando despesa de serviço para:', item.description);

          let adminCategory = await supabase
            .from('cost_categories')
            .select('id')
            .eq('name', 'Despesas Administrativas')
            .maybeSingle();

          // Fallback: buscar primeira categoria administrativa se não encontrar a específica
          if (!adminCategory.data) {
            console.warn('Categoria "Despesas Administrativas" não encontrada, usando primeira categoria disponível');
            adminCategory = await supabase
              .from('cost_categories')
              .select('id')
              .eq('type', 'administrative')
              .limit(1)
              .maybeSingle();
          }

          const { error: cashFlowError } = await supabase
            .from('cash_flow')
            .insert({
              date: nfData.invoiceDate,
              type: 'expense',
              category: 'Serviço',
              description: `${item.description} - NF ${nfData.invoiceNumber}/${nfData.invoiceSeries}`,
              amount: item.totalPrice,
              purchase_id: purchase.id,
              cost_category_id: adminCategory.data?.id || null,
              reference: `${item.code}`,
              notes: `Quantidade: ${item.quantity} ${item.unit}`,
              business_unit: 'factory',
            });

          if (cashFlowError) {
            console.error('Erro ao criar cash_flow para serviço:', cashFlowError);
            throw cashFlowError;
          }
          console.log('Despesa de serviço registrada no cash_flow');
        }
      }

      console.log('=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');
      const summary = {
        totalItems: nfData.items.length,
        insumos: nfData.items.filter(i => i.category === 'insumo').length,
        servicos: nfData.items.filter(i => i.category === 'servico').length,
        manutencao: nfData.items.filter(i => i.category === 'manutencao').length,
        investimentos: nfData.items.filter(i => i.category === 'investimento').length,
        insumosNovos,
        insumosAtualizados,
      };
      console.log('Resumo:', summary);

      alert(
        `✅ Compra importada com sucesso!\n\n` +
        (fornecedorCriado ? `🏢 Novo fornecedor cadastrado: ${nfData.supplierName}\n\n` : '') +
        `📦 Total de itens: ${summary.totalItems}\n\n` +
        `📊 Categorias:\n` +
        `  • Insumos: ${summary.insumos}${summary.insumos > 0 ? ` (${insumosNovos} novos, ${insumosAtualizados} atualizados)` : ''}\n` +
        `  • Serviços: ${summary.servicos}\n` +
        `  • Manutenção: ${summary.manutencao}\n` +
        `  • Investimentos/Patrimônio: ${summary.investimentos}`
      );
      onSuccess();
    } catch (err: any) {
      console.error('=== ERRO NA IMPORTAÇÃO ===');
      console.error('Erro completo:', err);
      console.error('Stack trace:', err.stack);
      setError(`Erro ao importar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateItemMapping = (index: number, materialId: string, createNew: boolean = false) => {
    if (!nfData) return;

    const updatedItems = [...nfData.items];
    updatedItems[index].mappedMaterialId = createNew ? undefined : materialId;
    updatedItems[index].createNew = createNew;
    setNfData({ ...nfData, items: updatedItems });
  };

  const updateItemCategory = (index: number, category: ItemCategory) => {
    if (!nfData) return;

    const updatedItems = [...nfData.items];
    updatedItems[index].category = category;
    setNfData({ ...nfData, items: updatedItems });
  };

  const setAllItemsCategory = (category: ItemCategory) => {
    if (!nfData) return;

    const updatedItems = nfData.items.map(item => ({
      ...item,
      category,
    }));
    setNfData({ ...nfData, items: updatedItems });
  };

  const getCategoryLabel = (category: ItemCategory) => {
    const labels = {
      insumo: 'Insumo',
      servico: 'Serviço',
      manutencao: 'Manutenção',
      investimento: 'Investimento/Patrimônio',
    };
    return labels[category];
  };

  const getCategoryColor = (category: ItemCategory) => {
    const colors = {
      insumo: 'bg-blue-100 text-blue-800 border-blue-300',
      servico: 'bg-purple-100 text-purple-800 border-purple-300',
      manutencao: 'bg-orange-100 text-orange-800 border-orange-300',
      investimento: 'bg-green-100 text-green-800 border-green-300',
    };
    return colors[category];
  };

  if (showPriceReview) {
    const lockedCount = priceReviews.filter(r => r.isLocked).length;
    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-amber-500 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Revisao de Alteracoes de Preco
            </h2>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <p className="text-sm text-gray-700">
              A importacao desta NF-e afetaria os precos de <strong>{priceReviews.length}</strong> insumo(s) cadastrado(s).
              {lockedCount > 0 && (
                <span className="text-red-600 font-medium"> {lockedCount} insumo(s) com preco travado serao ignorados automaticamente.</span>
              )}
            </p>
            <div className="space-y-3">
              {priceReviews.map((r) => (
                <div key={r.materialId} className={`border rounded-lg p-4 ${r.isLocked ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {r.isLocked && <Lock className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span className="font-medium text-sm text-gray-900">{r.materialName}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div>
                          <span className="text-gray-500">Atual: </span>
                          <span className="font-medium">{fmtBRL(r.currentPrice)} / {r.currentUnit}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">NF-e: </span>
                          <span className={`font-medium ${r.newPrice > r.currentPrice ? 'text-red-600' : 'text-green-600'}`}>
                            {fmtBRL(r.newPrice)} / {r.newUnit}
                          </span>
                          {r.newUnit !== r.currentUnit && (
                            <span className="ml-1 text-amber-600 text-[10px] font-semibold">(UNIDADE DIFERENTE)</span>
                          )}
                        </div>
                      </div>
                      {r.isLocked && (
                        <p className="text-xs text-red-600 mt-1 font-medium">Preco travado — alteracao bloqueada</p>
                      )}
                    </div>
                    {!r.isLocked && (
                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={r.approved}
                          onChange={e => setPriceReviews(prev =>
                            prev.map(p => p.materialId === r.materialId ? { ...p, approved: e.target.checked } : p)
                          )}
                          className="w-4 h-4 rounded text-amber-500 accent-amber-500"
                        />
                        <span className="text-xs text-gray-700">Atualizar</span>
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => setShowPriceReview(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirmPriceReview}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirmar e Importar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-6 h-6" />
            Importar XML de NF-e
          </h2>
          <button onClick={onCancel} className="text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!nfData ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <label className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-800 font-medium">
                    Clique para selecionar o arquivo XML
                  </span>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Selecione o arquivo XML da nota fiscal eletrônica (NF-e)
                </p>
              </div>

              {loading && (
                <div className="text-center text-gray-600">
                  Processando XML...
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">Erro ao processar XML</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Dados da Nota Fiscal</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Número:</span>
                    <p className="font-medium">{nfData.invoiceNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Série:</span>
                    <p className="font-medium">{nfData.invoiceSeries}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Data:</span>
                    <p className="font-medium">{new Date(nfData.invoiceDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor Total:</span>
                    <p className="font-medium">R$ {nfData.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-gray-600">Fornecedor:</span>
                  <p className="font-medium">{nfData.supplierName} - {nfData.supplierCNPJ}</p>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o fornecedor no sistema</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.cnpj ? `- ${s.cnpj}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Itens da Nota ({nfData.items.length})
                </h3>

                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Marcar todos os itens como:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setAllItemsCategory('insumo')}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Insumo
                    </button>
                    <button
                      onClick={() => setAllItemsCategory('servico')}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Serviço
                    </button>
                    <button
                      onClick={() => setAllItemsCategory('manutencao')}
                      className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Manutenção
                    </button>
                    <button
                      onClick={() => setAllItemsCategory('investimento')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Investimento/Patrimônio
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {nfData.items.map((item, index) => (
                    <div key={index} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.description}</p>
                            <p className="text-sm text-gray-600">
                              Código: {item.code} | {item.quantity} {item.unit} × R$ {item.unitPrice.toFixed(4)}
                            </p>
                            <p className="text-sm font-medium text-blue-600">
                              Total: R$ {item.totalPrice.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getCategoryColor(item.category)}`}>
                              {getCategoryLabel(item.category)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Categoria:
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) => updateItemCategory(index, e.target.value as ItemCategory)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="insumo">Insumo</option>
                              <option value="servico">Serviço</option>
                              <option value="manutencao">Manutenção</option>
                              <option value="investimento">Investimento/Patrimônio</option>
                            </select>
                          </div>

                          {item.category === 'insumo' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Vincular ao insumo:
                              </label>
                              <div className="flex gap-2">
                                <select
                                  value={item.mappedMaterialId || ''}
                                  onChange={(e) => updateItemMapping(index, e.target.value, false)}
                                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                  disabled={item.createNew}
                                >
                                  <option value="">Selecione ou crie novo</option>
                                  {materials.map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.unit})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => updateItemMapping(index, '', !item.createNew)}
                                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                                    item.createNew
                                      ? 'bg-green-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                  title={item.createNew ? 'Criar novo insumo' : 'Criar novo insumo'}
                                >
                                  {item.createNew ? <Check className="w-4 h-4" /> : 'Novo'}
                                </button>
                              </div>
                              {item.createNew && (
                                <p className="text-xs text-green-600 mt-1">
                                  Novo insumo será criado automaticamente
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-800">Erro</p>
                    <p className="text-sm text-red-600 mt-1 whitespace-pre-line">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {nfData && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center gap-2"
            >
              {loading ? (
                <>Importando...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Importar Compra
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
