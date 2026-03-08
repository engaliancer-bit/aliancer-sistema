-- EXEMPLO DE VALIDAÇÃO DO CÁLCULO PROPORCIONAL
-- Execute esta query para validar o cálculo de consumo de materiais

-- Exemplo com o produto "Poste de cerca 10x10cm x 2.50m"
-- Peso: 52,44 kg | Receita: TCP AL001 (6,9814 kg total)
-- Produção: 10 peças

WITH produto_exemplo AS (
  SELECT
    p.id,
    p.name,
    p.total_weight as peso_produto,
    p.recipe_id,
    r.name as receita_nome
  FROM products p
  JOIN recipes r ON p.recipe_id = r.id
  WHERE p.name = 'Poste de cerca 10x10cm x 2.50m'
),
receita_total AS (
  SELECT
    recipe_id,
    SUM(quantity) as peso_total_receita
  FROM recipe_items
  WHERE recipe_id = (SELECT recipe_id FROM produto_exemplo)
  GROUP BY recipe_id
),
calculo AS (
  SELECT
    pe.name as produto,
    pe.peso_produto,
    pe.receita_nome,
    rt.peso_total_receita,
    (pe.peso_produto / rt.peso_total_receita) as fator_multiplicador,
    m.name as material,
    ri.quantity as quantidade_receita,
    -- Consumo por 1 peça
    (pe.peso_produto / rt.peso_total_receita) * ri.quantity as consumo_unitario,
    -- Consumo para 10 peças
    (pe.peso_produto / rt.peso_total_receita) * ri.quantity * 10 as consumo_10_pecas,
    -- Custo unitário
    m.unit_cost as custo_unitario,
    -- Custo total para 10 peças
    ((pe.peso_produto / rt.peso_total_receita) * ri.quantity * 10) * m.unit_cost as custo_total_10_pecas,
    m.unit
  FROM produto_exemplo pe
  CROSS JOIN receita_total rt
  JOIN recipe_items ri ON ri.recipe_id = pe.recipe_id
  JOIN materials m ON m.id = ri.material_id
)
SELECT
  '══════════════════════════════════════════════════════════════' as separador,
  produto,
  peso_produto || ' kg' as peso_produto,
  receita_nome,
  peso_total_receita || ' kg' as peso_receita,
  ROUND(fator_multiplicador::numeric, 4) as fator_multiplicador,
  '──────────────────────────────────────────────────────────────' as separador2,
  material,
  quantidade_receita || ' ' || unit as qtd_na_receita,
  ROUND(consumo_unitario::numeric, 4) || ' ' || unit as consumo_por_peca,
  ROUND(consumo_10_pecas::numeric, 2) || ' ' || unit as consumo_10_pecas,
  '──────────────────────────────────────────────────────────────' as separador3,
  'R$ ' || ROUND(custo_unitario::numeric, 2) as custo_unit_material,
  'R$ ' || ROUND(custo_total_10_pecas::numeric, 2) as custo_total_material_10_pecas
FROM calculo
ORDER BY quantidade_receita DESC;

-- TOTALIZADORES
SELECT
  '══════════════════════════════════════════════════════════════' as separador,
  'TOTAIS PARA 10 PEÇAS' as descricao,
  '══════════════════════════════════════════════════════════════' as separador2
UNION ALL
SELECT
  'Peso Total dos Produtos' as tipo,
  ROUND((SELECT peso_produto FROM produto_exemplo) * 10, 2) || ' kg' as valor,
  '(10 peças × ' || (SELECT peso_produto FROM produto_exemplo) || ' kg)' as calculo
UNION ALL
SELECT
  'Consumo Total de Materiais' as tipo,
  ROUND(SUM((pe.peso_produto / rt.peso_total_receita) * ri.quantity * 10)::numeric, 2) || ' kg' as valor,
  '(deve ser igual ao peso total)' as nota
FROM produto_exemplo pe
CROSS JOIN (SELECT recipe_id, SUM(quantity) as peso_total_receita FROM recipe_items WHERE recipe_id = (SELECT recipe_id FROM produto_exemplo) GROUP BY recipe_id) rt
JOIN recipe_items ri ON ri.recipe_id = pe.recipe_id
UNION ALL
SELECT
  'Custo Total de Insumos' as tipo,
  'R$ ' || ROUND(SUM(((pe.peso_produto / rt.peso_total_receita) * ri.quantity * 10) * m.unit_cost)::numeric, 2) as valor,
  '(soma de todos os materiais)' as nota
FROM produto_exemplo pe
CROSS JOIN (SELECT recipe_id, SUM(quantity) as peso_total_receita FROM recipe_items WHERE recipe_id = (SELECT recipe_id FROM produto_exemplo) GROUP BY recipe_id) rt
JOIN recipe_items ri ON ri.recipe_id = pe.recipe_id
JOIN materials m ON m.id = ri.material_id;

-- VERIFICAÇÃO: O consumo total de materiais DEVE ser igual ao peso total dos produtos
-- Se não for igual, há erro no cálculo!

/*
RESULTADO ESPERADO PARA "POSTE DE CERCA 10X10CM X 2.50M" (10 PEÇAS):

Fator Multiplicador: 7,5114 (52,44 kg ÷ 6,9814 kg)

CONSUMO POR PEÇA:
- Cimento: 7,51 kg
- Areia média: 18,78 kg
- Pedrisco: 26,06 kg
- Aditivo: 0,09 kg
TOTAL: 52,44 kg ✓

CONSUMO PARA 10 PEÇAS:
- Cimento: 75,11 kg
- Areia média: 187,78 kg
- Pedrisco: 260,65 kg
- Aditivo: 0,86 kg
TOTAL: 524,40 kg ✓ (10 × 52,44 kg)
*/
