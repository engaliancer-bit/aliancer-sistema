/*
  # Correção de Estoque - Bloco de Vedação 14 com Encaixe

  ## Problema Identificado
  
  O estoque do produto "Bloco de vedação 14 com encaixe" está incorreto devido a:
  
  1. **Duplicatas em delivery_items** (mesmo delivery, mesmo produto, mesmo quote_item_id)
     - Hérica Dalmonte: 2 itens de 150 blocos (total: 300, correto: 150)
     - Obras e Construções Clem: 2 itens de 1200 blocos (total: 2400, correto: 1200)
     - Aderlei Rohden: 2 itens de 960 blocos (total: 1920, correto: 960)
  
  2. **Produto errado na entrega**
     - Vagner Frizon: entrega tem 1300 blocos de VEDAÇÃO
     - Mas orçamento é de 1300 blocos ESTRUTURAIS (produto diferente)
  
  ## Situação Atual
  
  - Produzido: 8.595 blocos
  - Reservado (com duplicatas): 7.900 blocos
  - Disponível: 695 blocos
  
  ## Situação Correta (Após Correção)
  
  ### Vendas Aprovadas COM entrega:
  - GS PEÇAS: 1.000 blocos (600 entregues + 400 pendentes)
  - Clem: 1.200 blocos
  - Hérica: 150 blocos
  - Aderlei (2º orçamento): 960 blocos
  **Subtotal:** 3.310 blocos
  
  ### Vendas Aprovadas SEM entrega (não criaremos agora):
  - Neide Dalla Pozza: 840 blocos
  - Aderlei (1º orçamento): 1.160 blocos (440 + 720)
  - Marcos Rother: 100 blocos
  - Sérgio Spaniol: 20 blocos
  **Subtotal:** 2.120 blocos
  
  **Total Real Vendido:** 5.430 blocos
  
  ## Estoque Final Correto
  
  - Produzido: 8.595 blocos
  - Reservado: 3.310 blocos (apenas com entregas criadas)
  - Disponível: 5.285 blocos
  
  ## Ações da Migração
  
  1. Remover 3 delivery_items duplicados
  2. Corrigir produto da entrega do Vagner Frizon (vedação → estrutural)
  3. Documentar todas as mudanças
*/

-- =====================================================
-- 1. REMOVER DUPLICATAS
-- =====================================================

-- Duplicata 1: Hérica Dalmonte (remover 2º item)
DELETE FROM delivery_items
WHERE id = 'ffa98779-0d5e-423a-ab81-ccbfae030461'
  AND delivery_id = 'a34bce0c-76b4-4755-a2d7-b9a26fe4a80f'
  AND product_id = 'e553c244-bebc-4252-82e5-501cfcafa4a2'
  AND quote_item_id = 'e8ed98d7-1620-4518-87f5-c0f21ac898a7'
  AND quantity = 150;

-- Duplicata 2: Obras e Construções Clem (remover 2º item)
DELETE FROM delivery_items
WHERE id = '4f1a3322-87b3-42f8-b554-eb017e738231'
  AND delivery_id = 'ce1eaac1-acc3-41d6-a188-88653a5606d4'
  AND product_id = 'e553c244-bebc-4252-82e5-501cfcafa4a2'
  AND quote_item_id = 'f213423e-006e-4210-add6-387702b4ce69'
  AND quantity = 1200;

-- Duplicata 3: Aderlei Rohden (remover item sem quote_item_id)
DELETE FROM delivery_items
WHERE id = 'eecb9d53-fdb5-48e6-819c-6b3a494eeb6c'
  AND delivery_id = '81b22d76-6d19-48d5-8457-01bf38b3aad8'
  AND product_id = 'e553c244-bebc-4252-82e5-501cfcafa4a2'
  AND quote_item_id IS NULL
  AND quantity = 960;

-- =====================================================
-- 2. CORRIGIR PRODUTO DO VAGNER FRIZON
-- =====================================================

-- O produto correto é "Bloco estrutural 14" (ID: 63c4bf41-a98c-4a81-ba4e-4b9c67129b89)
-- O quote_item_id correto é: 4a96f64b-7056-4086-81d2-7ef80f338b1b

UPDATE delivery_items
SET 
  product_id = '63c4bf41-a98c-4a81-ba4e-4b9c67129b89',
  quote_item_id = '4a96f64b-7056-4086-81d2-7ef80f338b1b',
  item_type = 'product'
WHERE id = 'b5b4b238-8deb-4109-8018-2128a3a0389b'
  AND delivery_id = '1fa07d9b-54f7-4053-9d49-d5dd7faa2f42'
  AND product_id = 'e553c244-bebc-4252-82e5-501cfcafa4a2'; -- produto antigo (vedação)

-- =====================================================
-- 3. ADICIONAR NOTAS EXPLICATIVAS NAS ENTREGAS
-- =====================================================

-- Hérica Dalmonte
UPDATE deliveries
SET notes = COALESCE(notes || E'\n\n', '') || 
  '✅ CORREÇÃO DE ESTOQUE (26/01/2026): Removida duplicata de 150 blocos de vedação.'
WHERE id = 'a34bce0c-76b4-4755-a2d7-b9a26fe4a80f';

-- Clem
UPDATE deliveries
SET notes = COALESCE(notes || E'\n\n', '') || 
  '✅ CORREÇÃO DE ESTOQUE (26/01/2026): Removida duplicata de 1.200 blocos de vedação.'
WHERE id = 'ce1eaac1-acc3-41d6-a188-88653a5606d4';

-- Aderlei Rohden
UPDATE deliveries
SET notes = COALESCE(notes || E'\n\n', '') || 
  '✅ CORREÇÃO DE ESTOQUE (26/01/2026): Removida duplicata de 960 blocos de vedação.'
WHERE id = '81b22d76-6d19-48d5-8457-01bf38b3aad8';

-- Vagner Frizon
UPDATE deliveries
SET notes = COALESCE(notes || E'\n\n', '') || 
  '✅ CORREÇÃO DE ESTOQUE (26/01/2026): Corrigido produto de "Bloco de vedação 14" para "Bloco estrutural 14" (conforme orçamento).'
WHERE id = '1fa07d9b-54f7-4053-9d49-d5dd7faa2f42';

-- =====================================================
-- 4. VERIFICAÇÃO FINAL
-- =====================================================

-- Criar view temporária para verificar resultado
DO $$
DECLARE
  v_total_producao numeric;
  v_total_reservado numeric;
  v_total_disponivel numeric;
BEGIN
  -- Calcular totais
  SELECT 
    COALESCE(SUM(p.quantity), 0)
  INTO v_total_producao
  FROM production p
  WHERE p.product_id = 'e553c244-bebc-4252-82e5-501cfcafa4a2'
    AND p.production_type = 'stock';

  SELECT 
    COALESCE(SUM(di.quantity), 0)
  INTO v_total_reservado
  FROM delivery_items di
  WHERE di.product_id = 'e553c244-bebc-4252-82e5-501cfcafa4a2';

  v_total_disponivel := v_total_producao - v_total_reservado;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL - Bloco de Vedação 14';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Produzido.......: % blocos', v_total_producao;
  RAISE NOTICE 'Reservado.......: % blocos', v_total_reservado;
  RAISE NOTICE 'Disponível......: % blocos', v_total_disponivel;
  RAISE NOTICE '========================================';
  
  IF v_total_reservado = 3310 THEN
    RAISE NOTICE '✅ CORREÇÃO APLICADA COM SUCESSO!';
  ELSE
    RAISE WARNING '⚠️  Total reservado inesperado. Esperado: 3310, Atual: %', v_total_reservado;
  END IF;
END $$;
