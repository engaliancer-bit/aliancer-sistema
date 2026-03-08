/*
  # Corrigir Foreign Key de cash_flow.purchase_id e Criar Registros Retroativos
  
  1. Problema Identificado
    - cash_flow.purchase_id aponta para tabela "pending_purchases" (vazia e obsoleta)
    - Deveria apontar para tabela "purchases" (onde ficam as importações XML)
    - Isso impede a criação de cash_flow para despesas de XML
    
  2. Correções
    - Remove foreign key incorreta
    - Cria foreign key correta apontando para "purchases"
    - Cria registros retroativos de cash_flow para todas as compras XML existentes
    
  3. Itens Afetados
    - Todos os itens de purchase_items com categoria: manutencao, servico, investimento
    - Que ainda não possuem registro em cash_flow
*/

-- 1. Remover foreign key incorreta
ALTER TABLE cash_flow 
DROP CONSTRAINT IF EXISTS cash_flow_purchase_id_fkey;

-- 2. Adicionar foreign key correta apontando para "purchases"
ALTER TABLE cash_flow 
ADD CONSTRAINT cash_flow_purchase_id_fkey 
FOREIGN KEY (purchase_id) 
REFERENCES purchases(id) 
ON DELETE CASCADE;

-- 3. Criar cash_flow para itens de manutenção sem registro
INSERT INTO cash_flow (
  date,
  type,
  category,
  description,
  amount,
  purchase_id,
  cost_category_id,
  reference,
  notes,
  business_unit,
  created_at
)
SELECT 
  p.invoice_date,
  'expense',
  'Manutenção',
  pi.product_description || ' - NF ' || p.invoice_number || COALESCE('/' || p.invoice_series, ''),
  pi.total_price,
  p.id,
  (SELECT id FROM cost_categories WHERE name = 'Manutenção de Máquinas' LIMIT 1),
  pi.product_code,
  'Quantidade: ' || pi.quantity || ' ' || pi.unit,
  'factory',
  NOW()
FROM purchase_items pi
JOIN purchases p ON pi.purchase_id = p.id
LEFT JOIN cash_flow cf ON cf.purchase_id = p.id AND cf.reference = pi.product_code
WHERE pi.item_category = 'manutencao'
  AND cf.id IS NULL;

-- 4. Criar cash_flow para itens de serviço sem registro
INSERT INTO cash_flow (
  date,
  type,
  category,
  description,
  amount,
  purchase_id,
  cost_category_id,
  reference,
  notes,
  business_unit,
  created_at
)
SELECT 
  p.invoice_date,
  'expense',
  'Serviço',
  pi.product_description || ' - NF ' || p.invoice_number || COALESCE('/' || p.invoice_series, ''),
  pi.total_price,
  p.id,
  (SELECT id FROM cost_categories WHERE name = 'Despesas Administrativas' LIMIT 1),
  pi.product_code,
  'Quantidade: ' || pi.quantity || ' ' || pi.unit,
  'factory',
  NOW()
FROM purchase_items pi
JOIN purchases p ON pi.purchase_id = p.id
LEFT JOIN cash_flow cf ON cf.purchase_id = p.id AND cf.reference = pi.product_code
WHERE pi.item_category = 'servico'
  AND cf.id IS NULL;

-- 5. Criar cash_flow para itens de investimento sem registro
INSERT INTO cash_flow (
  date,
  type,
  category,
  description,
  amount,
  purchase_id,
  cost_category_id,
  reference,
  notes,
  business_unit,
  created_at
)
SELECT 
  p.invoice_date,
  'expense',
  'Investimento/Patrimônio',
  pi.product_description || ' - NF ' || p.invoice_number || COALESCE('/' || p.invoice_series, ''),
  pi.total_price,
  p.id,
  (SELECT id FROM cost_categories WHERE name = 'Equipamentos e Patrimônio' LIMIT 1),
  pi.product_code,
  'Quantidade: ' || pi.quantity || ' ' || pi.unit,
  'factory',
  NOW()
FROM purchase_items pi
JOIN purchases p ON pi.purchase_id = p.id
LEFT JOIN cash_flow cf ON cf.purchase_id = p.id AND cf.reference = pi.product_code
WHERE pi.item_category = 'investimento'
  AND cf.id IS NULL;
