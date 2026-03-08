-- TESTE: Verificar Importação de XML e UPSERT de Insumos

-- 1. Criar insumo de teste (simular que já existe)
INSERT INTO materials (name, unit, unit_cost, import_status)
VALUES ('CIMENTO CP-II-F-40', 'SC', 42.50, 'active')
ON CONFLICT (name) DO UPDATE SET unit_cost = 42.50
RETURNING id, name, unit_cost;

-- Anotar o ID retornado: _________________


-- 2. Verificar insumos existentes antes da importação
SELECT
  id,
  name,
  unit,
  TO_CHAR(unit_cost, 'FM999999990.00') as custo_unit,
  import_status,
  TO_CHAR(imported_at, 'DD/MM/YYYY HH24:MI') as data_importacao
FROM materials
WHERE name ILIKE '%CIMENTO%'
ORDER BY name;


-- 3. Após importar XML, verificar se o preço foi atualizado
SELECT
  id,
  name,
  unit,
  TO_CHAR(unit_cost, 'FM999999990.00') as custo_unit,
  import_status,
  nfe_key,
  TO_CHAR(imported_at, 'DD/MM/YYYY HH24:MI') as data_importacao
FROM materials
WHERE name ILIKE '%CIMENTO%'
ORDER BY imported_at DESC;

-- RESULTADO ESPERADO:
-- O mesmo ID do passo 1, mas com unit_cost ATUALIZADO
-- nfe_key preenchida com a chave da nota
-- imported_at atualizado


-- 4. Verificar se a compra foi criada
SELECT
  p.id,
  p.invoice_number,
  p.invoice_series,
  TO_CHAR(p.invoice_date, 'DD/MM/YYYY') as data_nf,
  p.invoice_key,
  s.name as fornecedor,
  TO_CHAR(p.total_amount, 'FM999999990.00') as valor_total,
  TO_CHAR(p.created_at, 'DD/MM/YYYY HH24:MI') as importado_em
FROM purchases p
LEFT JOIN suppliers s ON s.id = p.supplier_id
ORDER BY p.created_at DESC
LIMIT 5;


-- 5. Verificar itens da compra
SELECT
  pi.id,
  pi.product_description,
  pi.quantity,
  pi.unit,
  TO_CHAR(pi.unit_price, 'FM999999990.0000') as preco_unit,
  TO_CHAR(pi.total_price, 'FM999999990.00') as preco_total,
  pi.item_category,
  m.name as insumo_vinculado
FROM purchase_items pi
LEFT JOIN materials m ON m.id = pi.material_id
WHERE pi.purchase_id = (
  SELECT id FROM purchases ORDER BY created_at DESC LIMIT 1
)
ORDER BY pi.id;


-- 6. Verificar movimentos de estoque criados
SELECT
  mm.id,
  m.name as material,
  mm.movement_type,
  mm.quantity,
  m.unit,
  TO_CHAR(mm.movement_date, 'DD/MM/YYYY') as data_movimento,
  mm.notes
FROM material_movements mm
INNER JOIN materials m ON m.id = mm.material_id
WHERE mm.movement_type = 'entrada'
  AND mm.movement_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY mm.movement_date DESC, mm.created_at DESC
LIMIT 10;


-- 7. Verificar estoque atual dos insumos importados
SELECT
  m.name as material,
  m.unit,
  COALESCE(
    (SELECT SUM(
      CASE
        WHEN mm.movement_type = 'entrada' THEN mm.quantity
        WHEN mm.movement_type = 'saida' THEN -mm.quantity
        ELSE 0
      END
    )
    FROM material_movements mm
    WHERE mm.material_id = m.id),
    0
  ) as estoque_atual,
  TO_CHAR(m.unit_cost, 'FM999999990.00') as custo_unit,
  TO_CHAR(imported_at, 'DD/MM/YYYY') as ultima_importacao
FROM materials m
WHERE m.imported_at IS NOT NULL
  AND m.imported_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY m.imported_at DESC;


-- 8. Verificar contas a pagar criadas
SELECT
  pa.id,
  pa.description,
  TO_CHAR(pa.amount, 'FM999999990.00') as valor,
  TO_CHAR(pa.due_date, 'DD/MM/YYYY') as vencimento,
  pa.payment_status,
  pa.installment_number,
  pa.total_installments,
  s.name as fornecedor
FROM payable_accounts pa
INNER JOIN suppliers s ON s.id = pa.supplier_id
WHERE pa.purchase_id = (
  SELECT id FROM purchases ORDER BY created_at DESC LIMIT 1
)
ORDER BY pa.installment_number;


-- 9. Teste de UPSERT manual (simular o que o código faz)
DO $$
DECLARE
  v_material_id UUID;
  v_existing_material RECORD;
BEGIN
  -- Buscar material existente (case-insensitive)
  SELECT id, name, unit, unit_cost
  INTO v_existing_material
  FROM materials
  WHERE name ILIKE 'CIMENTO CP-II-F-40'
  LIMIT 1;

  IF FOUND THEN
    RAISE NOTICE '✓ Material existe: % (ID: %)', v_existing_material.name, v_existing_material.id;
    RAISE NOTICE '  Preço atual: R$ %', v_existing_material.unit_cost;

    -- Atualizar preço
    UPDATE materials
    SET unit_cost = 48.90,
        imported_at = NOW(),
        nfe_key = 'TESTE_MANUAL'
    WHERE id = v_existing_material.id;

    RAISE NOTICE '  Preço atualizado para: R$ 48.90';
    v_material_id := v_existing_material.id;
  ELSE
    RAISE NOTICE 'Material não existe, criando...';

    INSERT INTO materials (name, unit, unit_cost, import_status, imported_at, nfe_key)
    VALUES ('CIMENTO CP-II-F-40', 'SC', 48.90, 'imported_pending', NOW(), 'TESTE_MANUAL')
    RETURNING id INTO v_material_id;

    RAISE NOTICE '✓ Material criado (ID: %)', v_material_id;
  END IF;

  RAISE NOTICE 'Material final ID: %', v_material_id;
END $$;


-- 10. Verificar resultado do teste manual
SELECT
  id,
  name,
  unit,
  TO_CHAR(unit_cost, 'FM999999990.00') as custo_unit,
  import_status,
  nfe_key,
  TO_CHAR(imported_at, 'DD/MM/YYYY HH24:MI:SS') as data_importacao
FROM materials
WHERE name ILIKE '%CIMENTO%'
  AND nfe_key = 'TESTE_MANUAL'
ORDER BY imported_at DESC;


-- 11. Limpar dados de teste (CUIDADO!)
-- DESCOMENTE APENAS SE QUISER LIMPAR OS TESTES
/*
DELETE FROM material_movements
WHERE notes LIKE '%TESTE_MANUAL%';

DELETE FROM materials
WHERE nfe_key = 'TESTE_MANUAL';
*/


-- 12. Estatísticas de importação
SELECT
  COUNT(*) as total_materiais_importados,
  COUNT(CASE WHEN imported_at >= CURRENT_DATE THEN 1 END) as importados_hoje,
  COUNT(CASE WHEN imported_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as importados_semana,
  COUNT(CASE WHEN import_status = 'imported_pending' THEN 1 END) as pendentes_validacao,
  TO_CHAR(MAX(imported_at), 'DD/MM/YYYY HH24:MI') as ultima_importacao
FROM materials
WHERE imported_at IS NOT NULL;
