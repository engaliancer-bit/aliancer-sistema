-- DIAGNÓSTICO: Resumo de Produção do Dia

-- 1. Verificar produções de hoje
SELECT
  'Total de produções hoje' as descricao,
  COUNT(*) as quantidade
FROM production
WHERE production_date = CURRENT_DATE;

-- 2. Verificar production_items de hoje
SELECT
  'Total de production_items hoje' as descricao,
  COUNT(*) as quantidade
FROM production_items pi
INNER JOIN production p ON p.id = pi.production_id
WHERE p.production_date = CURRENT_DATE;

-- 3. Verificar produções SEM production_items
SELECT
  'Produções sem production_items' as descricao,
  COUNT(*) as quantidade
FROM production p
WHERE p.production_date = CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM production_items pi
    WHERE pi.production_id = p.id
  );

-- 4. Verificar estrutura de custos_no_momento
SELECT
  p.id,
  p.product_id,
  p.quantity,
  p.production_date,
  jsonb_typeof(p.custos_no_momento) as tipo_custos,
  jsonb_typeof(p.custos_no_momento->'materials') as tipo_materials,
  (SELECT COUNT(*) FROM jsonb_each(p.custos_no_momento->'materials')) as qtd_materials,
  EXISTS (SELECT 1 FROM production_items WHERE production_id = p.id) as tem_items
FROM production p
WHERE p.production_date = CURRENT_DATE
ORDER BY p.created_at DESC
LIMIT 5;

-- 5. Testar extract_production_items_from_custos manualmente
-- (Comentar/descomentar conforme necessário)
-- SELECT extract_production_items_from_custos(
--   '<ID_DA_PRODUCAO>'::uuid,
--   (SELECT custos_no_momento FROM production WHERE id = '<ID_DA_PRODUCAO>')
-- );

-- 6. Verificar resultado da função get_resumo_producao_dia
SELECT * FROM get_resumo_producao_dia(CURRENT_DATE);

-- 7. Verificar resumo de produtos
SELECT * FROM get_resumo_produtos_dia(CURRENT_DATE);
