/*
  # Corrigir Unidade de Ferro para Metros
  
  1. Problema Identificado
    - Materiais de ferro cadastrados com unidade "BR" ou "barra"
    - Cada barra tem 12 metros (unit_length_meters = 12)
    - As movimentações estão sendo registradas em METROS (correto)
    - Mas aparece como se fossem BARRAS (errado)
    - Exemplo: 429 metros aparece como "429 BR" = 5.148 metros reais!
  
  2. Solução
    - Mudar unidade dos materiais de ferro de "BR/barra" para "metros"
    - Ajustar estoque atual multiplicando por 12 (converter barras em metros)
    - Ajustar movimentações históricas de hoje
  
  3. Materiais Afetados
    - CA-60 5.0 MM R12(30 BR)
    - CA-60 4.2 MM R12M(50 BR)
    - CA-50 (todos os diâmetros)
    - Outros com unit_length_meters preenchido
*/

-- 1. ATUALIZAR UNIDADE DOS MATERIAIS DE FERRO PARA METROS
UPDATE materials
SET unit = 'metros'
WHERE (unit = 'BR' OR unit = 'barra')
  AND unit_length_meters IS NOT NULL
  AND unit_length_meters > 0;

-- 2. ATUALIZAR ESTOQUE ATUAL (converter barras em metros)
-- Criar view temporária do estoque atual
CREATE TEMP TABLE estoque_atual_barras AS
SELECT 
  m.id as material_id,
  m.name,
  m.unit_length_meters,
  COALESCE(SUM(CASE WHEN mm.movement_type = 'entrada' THEN mm.quantity ELSE -mm.quantity END), 0) as estoque_em_barras
FROM materials m
LEFT JOIN material_movements mm ON mm.material_id = m.id
WHERE m.unit = 'metros'
  AND m.unit_length_meters IS NOT NULL
  AND m.unit_length_meters > 0
GROUP BY m.id, m.name, m.unit_length_meters;

-- 3. CRIAR MOVIMENTAÇÕES DE AJUSTE PARA CONVERTER BARRAS EM METROS
-- Para cada material, criar uma entrada que converte o estoque
INSERT INTO material_movements (
  material_id,
  quantity,
  movement_type,
  movement_date,
  notes
)
SELECT 
  material_id,
  estoque_em_barras * (unit_length_meters - 1),
  'entrada',
  CURRENT_DATE,
  'Ajuste de unidade: conversão de barras para metros (estoque × ' || unit_length_meters || ' metros/barra)'
FROM estoque_atual_barras
WHERE estoque_em_barras > 0;

-- 4. LIMPAR TABELA TEMPORÁRIA
DROP TABLE estoque_atual_barras;

-- 5. CRIAR FUNÇÃO PARA EXIBIR ESTOQUE EM BARRAS (para referência)
CREATE OR REPLACE FUNCTION get_iron_stock_in_bars()
RETURNS TABLE (
  material_name text,
  stock_in_meters numeric,
  meters_per_bar numeric,
  stock_in_bars numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.name,
    COALESCE(SUM(CASE WHEN mm.movement_type = 'entrada' THEN mm.quantity ELSE -mm.quantity END), 0) as stock_meters,
    m.unit_length_meters,
    ROUND((COALESCE(SUM(CASE WHEN mm.movement_type = 'entrada' THEN mm.quantity ELSE -mm.quantity END), 0) / m.unit_length_meters)::numeric, 2) as stock_bars
  FROM materials m
  LEFT JOIN material_movements mm ON mm.material_id = m.id
  WHERE m.unit = 'metros'
    AND m.unit_length_meters IS NOT NULL
    AND m.unit_length_meters > 0
  GROUP BY m.id, m.name, m.unit_length_meters
  ORDER BY m.name;
END;
$$ LANGUAGE plpgsql;
