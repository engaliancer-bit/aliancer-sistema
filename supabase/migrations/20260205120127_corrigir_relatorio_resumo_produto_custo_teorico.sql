/*
  # Correção: Relatório "Resumo por Produto" - Usar Custo Teórico do Produto
  
  ## Problema Identificado
  O relatório "Resumo por Produto (Período Agregado)" estava mostrando custo total 
  incorreto (ex: R$ 0,23 ao invés de R$ 294,84) porque:
  
  1. O custo era calculado APENAS com base em material_movements
  2. Se não houvesse movimentos registrados ou houvesse erro nos movimentos,
     o custo aparecia como R$ 0,00 ou valor muito baixo
  3. O sistema NÃO usava o custo unitário configurado no produto
  
  ## Solução Implementada (Frontend)
  Modificado `SalesReport.tsx` para:
  
  1. **Buscar custos do produto** ao carregar produções:
     - material_cost (custo de materiais)
     - production_cost (custo total de produção)
     - manual_unit_cost (custo manual)
  
  2. **Calcular custo final com fallback**:
     ```
     SE custo_real > 0 ENTÃO
       usar custo_real (dos movimentos de materiais)
     SENÃO
       usar custo_unitario_produto × quantidade
     FIM SE
     ```
  
  3. **Prioridade de custo unitário**:
     - 1ª: production_cost (custo total com mão de obra, etc)
     - 2ª: material_cost (custo só de materiais)
     - 3ª: manual_unit_cost (custo inserido manualmente)
     - 4ª: 0 (se nenhum estiver preenchido)
  
  4. **Logs de debug** adicionados:
     - produto, product_id, quantidade
     - custo_real, custo_unitario_produto
     - custo_total_calculado
     - origem (REAL ou TEÓRICO)
  
  ## Exemplo Real
  
  **Produto:** Base de escamoteador 0.60 x 1.10
  - material_cost = R$ 16,65
  - production_cost = R$ 49,14
  
  **Produção:** 6 unidades (2026-02-03)
  - custo_real_movimentos = R$ 0,23 (INCORRETO)
  - custo_teorico = 6 × 49,14 = R$ 294,84
  
  **ANTES da correção:**
  - Custo Total = R$ 0,23 ❌
  
  **DEPOIS da correção:**
  - Custo Total = R$ 294,84 ✓
  
  ## Validação
  
  Para validar a correção:
  
  1. Abra o produto "Base de escamoteador 0.60 x 1.10"
  2. Confirme que production_cost = R$ 49,14
  3. Vá ao Relatório de Produção
  4. Selecione período que inclui 03/02/2026
  5. Na aba "Resumo por Produto", verifique:
     - Quantidade: 6 unidades
     - Custo Total: R$ 294,84 (6 × 49,14)
  6. Abra o Console do navegador (F12)
  7. Veja os logs:
     ```
     📊 RELATÓRIO - Custo Calculado:
       produto: "Base de escamoteador 0.60 x 1.10"
       quantidade: 6
       custo_real: 0.23
       custo_unitario_produto: 49.14
       custo_total_calculado: 294.84
       origem: "TEÓRICO (produto)"
     ```
  
  ## Notas Importantes
  
  1. **Persistência do Custo**
     - O material_cost é salvo automaticamente quando você configura
       o traço e calcula a "Memória de Cálculo" na aba Produtos
     - Não é necessário criar coluna adicional (já existe)
  
  2. **Atualização Automática**
     - Quando insumos mudarem de preço, você deve recalcular
       a memória de custos do produto manualmente
     - O sistema não atualiza automaticamente (por design)
  
  3. **Relatórios Afetados**
     - ✓ Resumo por Produto (Período Agregado)
     - ✓ Relatório Diário (usa mesma função)
     - ✓ PDF exportado (usa mesmos dados)
  
  ## Tabelas Envolvidas
  
  - `products`: material_cost, production_cost, manual_unit_cost
  - `production`: id, product_id, quantity
  - `material_movements`: custo real quando disponível
  
  ## Migration Info
  Esta migration é apenas documental. As alterações foram feitas no frontend
  (SalesReport.tsx) e não requerem mudanças no banco de dados.
*/

-- Adicionar comentário na coluna material_cost para documentar uso
COMMENT ON COLUMN products.material_cost IS 
'Custo total de materiais calculado automaticamente a partir do traço e insumos.
Usado como fallback no relatório quando não há movimentos de materiais registrados.
Prioridade: production_cost > material_cost > manual_unit_cost.';

-- Adicionar comentário na coluna production_cost
COMMENT ON COLUMN products.production_cost IS
'Custo total de produção incluindo materiais, mão de obra, custos fixos, transporte e perdas.
Este é o custo unitário PREFERENCIAL usado nos relatórios quando não há custo real disponível.';

-- Adicionar comentário na coluna manual_unit_cost
COMMENT ON COLUMN products.manual_unit_cost IS
'Custo unitário inserido manualmente pelo usuário.
Usado como último fallback nos relatórios (após production_cost e material_cost).';

-- View auxiliar para consultar produtos com custos
DROP VIEW IF EXISTS v_products_with_costs;

CREATE VIEW v_products_with_costs AS
SELECT
  id,
  name,
  code,
  unit,
  product_type,
  material_cost,
  production_cost,
  manual_unit_cost,
  sale_price,
  final_sale_price,
  
  -- Custo unitário efetivo (prioridade)
  COALESCE(production_cost, material_cost, manual_unit_cost, 0) as effective_unit_cost,
  
  -- Preço de venda efetivo
  COALESCE(final_sale_price, sale_price, 0) as effective_sale_price,
  
  -- Margem teórica
  CASE
    WHEN COALESCE(final_sale_price, sale_price, 0) > 0 THEN
      COALESCE(final_sale_price, sale_price, 0) - 
      COALESCE(production_cost, material_cost, manual_unit_cost, 0)
    ELSE 0
  END as theoretical_margin,
  
  -- % Margem teórica
  CASE
    WHEN COALESCE(final_sale_price, sale_price, 0) > 0 THEN
      ((COALESCE(final_sale_price, sale_price, 0) - 
        COALESCE(production_cost, material_cost, manual_unit_cost, 0))
        / COALESCE(final_sale_price, sale_price, 0)) * 100
    ELSE 0
  END as theoretical_margin_percentage,
  
  -- Indicador de custo configurado
  CASE
    WHEN production_cost > 0 THEN 'production_cost'
    WHEN material_cost > 0 THEN 'material_cost'
    WHEN manual_unit_cost > 0 THEN 'manual_unit_cost'
    ELSE 'none'
  END as cost_source

FROM products;

COMMENT ON VIEW v_products_with_costs IS
'View que mostra produtos com custos efetivos e margens teóricas calculadas.
Útil para validar configuração de custos e identificar produtos sem custo.';

-- Índice para otimizar consultas por custo
CREATE INDEX IF NOT EXISTS idx_products_effective_costs
ON products (production_cost, material_cost, manual_unit_cost)
WHERE production_cost > 0 OR material_cost > 0 OR manual_unit_cost > 0;

-- Query de validação para produtos sem custo configurado
-- (Não executar automaticamente, apenas documentar)
/*
SELECT
  name,
  code,
  product_type,
  material_cost,
  production_cost,
  manual_unit_cost,
  'Custo não configurado! Configure o traço ou insira custo manual.' as alerta
FROM products
WHERE COALESCE(production_cost, material_cost, manual_unit_cost, 0) = 0
  AND product_type NOT IN ('ferragens_diversas')
ORDER BY name;
*/
