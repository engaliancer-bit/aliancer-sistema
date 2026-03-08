/*
  VALIDAÇÃO: Sistema de Custos Padronizados

  Queries para validar que o sistema está usando custo_unitario_materiais
  corretamente em todos os produtos e relatórios.
*/

-- ========================================================
-- 1. VERIFICAR PRODUTOS MENCIONADOS NO REQUISITO
-- ========================================================

SELECT
  'Produtos do Requisito' as teste,
  name,
  code,
  material_cost as custo_materiais,
  production_cost as custo_producao,
  custo_unitario_materiais,
  CASE
    WHEN custo_unitario_materiais IS NULL THEN '⚠️ NULL - Calcular memória!'
    WHEN custo_unitario_materiais = 0 THEN '⚠️ ZERO - Calcular memória!'
    WHEN custo_unitario_materiais > 0 THEN '✅ OK'
  END as status
FROM products
WHERE name ILIKE '%Pilar pré moldado 25x35 H 6,20%'
   OR name ILIKE '%Poste de cerca 10x10 x 2.00%'
   OR name ILIKE '%Base de escamoteador%'
ORDER BY name;

/*
ESPERADO:
- Pilar pré moldado 25x35 H 6,20: custo_unitario_materiais ≈ 647.07
- Poste de cerca 10x10 x 2.00: custo_unitario_materiais > 0 (não 0.95)
- Base de escamoteador: custo_unitario_materiais = 16.65
*/

-- ========================================================
-- 2. VERIFICAR TODOS OS PRODUTOS - RESUMO POR STATUS
-- ========================================================

SELECT
  'Resumo por Status' as teste,
  CASE
    WHEN custo_unitario_materiais IS NULL THEN '⚠️ NULL'
    WHEN custo_unitario_materiais = 0 THEN '⚠️ ZERO'
    WHEN custo_unitario_materiais > 0 AND custo_unitario_materiais < 1 THEN '⚠️ Muito baixo (< R$ 1)'
    WHEN custo_unitario_materiais >= 1 THEN '✅ OK'
  END as status,
  COUNT(*) as quantidade
FROM products
GROUP BY
  CASE
    WHEN custo_unitario_materiais IS NULL THEN '⚠️ NULL'
    WHEN custo_unitario_materiais = 0 THEN '⚠️ ZERO'
    WHEN custo_unitario_materiais > 0 AND custo_unitario_materiais < 1 THEN '⚠️ Muito baixo (< R$ 1)'
    WHEN custo_unitario_materiais >= 1 THEN '✅ OK'
  END
ORDER BY status;

/*
ESPERADO:
- Maioria dos produtos deve estar ✅ OK
- Se houver muitos NULL ou ZERO, precisa calcular memória de custos
*/

-- ========================================================
-- 3. LISTAR PRODUTOS SEM CUSTO CONFIGURADO
-- ========================================================

SELECT
  'Produtos SEM Custo' as teste,
  name,
  code,
  product_type,
  recipe_id,
  custo_unitario_materiais,
  material_cost,
  '⚠️ AÇÃO: Calcular "Memória de Cálculo" na tela de Produtos' as acao
FROM products
WHERE COALESCE(custo_unitario_materiais, 0) = 0
  AND product_type NOT IN ('ferragens_diversas') -- Ferragens podem ter custo zero
ORDER BY name
LIMIT 20;

/*
AÇÃO:
Para cada produto listado:
1. Abrir na tela de Produtos
2. Selecionar traço (recipe)
3. Configurar armaduras e acessórios
4. Clicar em "Calcular Memória de Custos"
5. Salvar o produto
*/

-- ========================================================
-- 4. COMPARAR custo_unitario_materiais vs material_cost
-- ========================================================

SELECT
  'Comparação de Custos' as teste,
  name,
  custo_unitario_materiais,
  material_cost,
  custo_unitario_materiais - material_cost as diferenca,
  CASE
    WHEN ABS(custo_unitario_materiais - COALESCE(material_cost, 0)) < 0.01
      THEN '✅ Iguais'
    WHEN custo_unitario_materiais IS NULL AND material_cost IS NULL
      THEN '⚠️ Ambos NULL'
    WHEN custo_unitario_materiais IS NULL
      THEN '⚠️ Falta custo_unitario'
    ELSE '❌ Divergentes'
  END as status
FROM products
WHERE COALESCE(material_cost, 0) > 0
ORDER BY ABS(custo_unitario_materiais - COALESCE(material_cost, 0)) DESC
LIMIT 20;

/*
ESPERADO:
- Produtos devem estar ✅ Iguais (diferença < 0.01)
- Se houver divergentes, executar: SELECT * FROM admin_recalcular_custos_produtos();
*/

-- ========================================================
-- 5. SIMULAR RELATÓRIO "RESUMO POR PRODUTO"
-- ========================================================

SELECT
  'Simulação Relatório' as teste,
  prod.name as produto,
  SUM(p.quantity) as quantidade_total,
  prod.custo_unitario_materiais as custo_unitario,
  SUM(p.quantity) * prod.custo_unitario_materiais as custo_total_calculado,
  COALESCE(prod.final_sale_price, prod.sale_price, 0) as preco_venda,
  SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0) as valor_venda_total,
  SUM(p.quantity) * COALESCE(prod.final_sale_price, prod.sale_price, 0) -
    SUM(p.quantity) * prod.custo_unitario_materiais as lucro_total
FROM production p
JOIN products prod ON prod.id = p.product_id
WHERE prod.name ILIKE '%Base de escamoteador 0.60 x 1.10%'
  AND p.production_date >= '2026-02-01'
  AND p.production_date <= '2026-02-05'
  AND (p.notes IS NULL OR p.notes NOT ILIKE '%ajuste de estoque%')
GROUP BY prod.id, prod.name, prod.custo_unitario_materiais, prod.sale_price, prod.final_sale_price;

/*
ESPERADO para Base de escamoteador (6 unidades em 03/02):
- quantidade_total = 6
- custo_unitario = 16.65
- custo_total_calculado = 99.90 (6 × 16.65)
- preco_venda = 80.59
- valor_venda_total = 483.54 (6 × 80.59)
- lucro_total = 383.64 (483.54 - 99.90)
*/

-- ========================================================
-- 6. VERIFICAR CONSISTÊNCIA DE DADOS
-- ========================================================

WITH verificacao AS (
  SELECT
    id,
    name,
    custo_unitario_materiais,
    material_cost,
    production_cost,
    CASE
      -- Cenário ideal: custo_unitario == material_cost
      WHEN ABS(COALESCE(custo_unitario_materiais, 0) - COALESCE(material_cost, 0)) < 0.01
        THEN '✅ Consistente'

      -- Cenário OK: custo_unitario preenchido mas material_cost zero
      WHEN custo_unitario_materiais > 0 AND COALESCE(material_cost, 0) = 0
        THEN '⚠️ OK (custo_unitario preenchido, material_cost zero)'

      -- Cenário ruim: custo_unitario zero mas material_cost preenchido
      WHEN COALESCE(custo_unitario_materiais, 0) = 0 AND material_cost > 0
        THEN '❌ INCONSISTENTE (falta custo_unitario)'

      -- Cenário ruim: ambos zerados
      WHEN COALESCE(custo_unitario_materiais, 0) = 0 AND COALESCE(material_cost, 0) = 0
        THEN '⚠️ Ambos zerados'

      -- Cenário ruim: valores muito diferentes
      ELSE '❌ Divergência significativa'
    END as status
  FROM products
)
SELECT
  'Consistência de Dados' as teste,
  status,
  COUNT(*) as quantidade,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) || '%' as percentual
FROM verificacao
GROUP BY status
ORDER BY
  CASE status
    WHEN '✅ Consistente' THEN 1
    WHEN '⚠️ OK (custo_unitario preenchido, material_cost zero)' THEN 2
    WHEN '⚠️ Ambos zerados' THEN 3
    WHEN '❌ INCONSISTENTE (falta custo_unitario)' THEN 4
    ELSE 5
  END;

/*
ESPERADO:
- ✅ Consistente: > 80%
- Se houver muitos ❌ INCONSISTENTE, executar:
  SELECT * FROM admin_recalcular_custos_produtos();
*/

-- ========================================================
-- 7. EXECUTAR RECÁLCULO (SE NECESSÁRIO)
-- ========================================================

/*
DESCOMENTE para executar recálculo de todos os produtos:

SELECT * FROM admin_recalcular_custos_produtos();

Isso irá:
1. Copiar material_cost para custo_unitario_materiais
2. Usar production_cost como fallback se material_cost estiver vazio
3. Retornar lista de produtos atualizados
4. Mostrar resumo no final
*/

-- ========================================================
-- 8. VALIDAÇÃO FINAL - PRODUTOS DO REQUISITO
-- ========================================================

SELECT
  'VALIDAÇÃO FINAL' as teste,
  name,
  custo_unitario_materiais,
  CASE
    WHEN name ILIKE '%Pilar pré moldado 25x35 H 6,20%' THEN
      CASE
        WHEN custo_unitario_materiais IS NULL OR custo_unitario_materiais = 0
          THEN '❌ FALHOU - Custo não configurado'
        WHEN custo_unitario_materiais BETWEEN 600 AND 700
          THEN '✅ OK - Custo esperado (≈647.07)'
        ELSE '⚠️ Custo divergente do esperado'
      END

    WHEN name ILIKE '%Poste de cerca 10x10 x 2.00%' THEN
      CASE
        WHEN custo_unitario_materiais IS NULL OR custo_unitario_materiais = 0
          THEN '❌ FALHOU - Custo não configurado'
        WHEN custo_unitario_materiais < 1
          THEN '❌ FALHOU - Custo muito baixo (< R$ 1)'
        ELSE '✅ OK - Custo > R$ 1'
      END

    WHEN name ILIKE '%Base de escamoteador%' THEN
      CASE
        WHEN custo_unitario_materiais IS NULL OR custo_unitario_materiais = 0
          THEN '❌ FALHOU - Custo não configurado'
        WHEN ABS(custo_unitario_materiais - 16.65) < 0.01
          THEN '✅ OK - Custo = 16.65'
        ELSE '⚠️ Custo divergente (esperado: 16.65)'
      END

    ELSE '⚠️ Produto não validado'
  END as resultado
FROM products
WHERE name ILIKE '%Pilar pré moldado 25x35 H 6,20%'
   OR name ILIKE '%Poste de cerca 10x10 x 2.00%'
   OR name ILIKE '%Base de escamoteador%'
ORDER BY name;

/*
TODOS OS PRODUTOS DEVEM MOSTRAR ✅ OK
*/

-- ========================================================
-- 9. PRODUTOS COM CUSTOS INTERMITENTES (0.79, 0.95, etc)
-- ========================================================

SELECT
  'Custos Suspeitos (< R$ 1)' as teste,
  name,
  code,
  custo_unitario_materiais,
  material_cost,
  production_cost,
  '⚠️ Custo muito baixo - Verificar configuração' as alerta
FROM products
WHERE custo_unitario_materiais > 0
  AND custo_unitario_materiais < 1
  AND product_type NOT IN ('ferragens_diversas')
ORDER BY custo_unitario_materiais;

/*
AÇÃO:
Se algum produto aparecer aqui com custo 0.79 ou 0.95:
1. Abrir o produto
2. Verificar se traço está correto
3. Verificar se armaduras estão configuradas
4. Recalcular "Memória de Cálculo"
5. Salvar novamente
*/

-- ========================================================
-- 10. ESTATÍSTICAS FINAIS
-- ========================================================

SELECT
  'ESTATÍSTICAS FINAIS' as categoria,
  '  ' as item,
  NULL::numeric as valor,
  '' as observacao
UNION ALL
SELECT
  '',
  'Total de produtos',
  COUNT(*),
  ''
FROM products
UNION ALL
SELECT
  '',
  '✅ Com custo configurado',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 1) || '%'
FROM products
WHERE custo_unitario_materiais > 0
UNION ALL
SELECT
  '',
  '⚠️ Sem custo (NULL ou 0)',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 1) || '%'
FROM products
WHERE COALESCE(custo_unitario_materiais, 0) = 0
UNION ALL
SELECT
  '',
  '📊 Custo médio dos produtos',
  ROUND(AVG(custo_unitario_materiais), 2),
  'R$'
FROM products
WHERE custo_unitario_materiais > 0
UNION ALL
SELECT
  '',
  '💰 Custo mais alto',
  ROUND(MAX(custo_unitario_materiais), 2),
  'R$'
FROM products
WHERE custo_unitario_materiais > 0
UNION ALL
SELECT
  '',
  '💵 Custo mais baixo (> 0)',
  ROUND(MIN(custo_unitario_materiais), 2),
  'R$'
FROM products
WHERE custo_unitario_materiais > 0;

/*
SUCESSO SE:
- ✅ Com custo > 80%
- ⚠️ Sem custo < 20%
- Custos fazem sentido para os produtos
*/
