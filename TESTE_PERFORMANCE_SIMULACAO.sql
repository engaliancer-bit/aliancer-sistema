/*
  # TESTE DE PERFORMANCE COM DADOS SIMULADOS

  Este script insere 100+ registros de teste para validar as otimizações de performance.

  ATENÇÃO: Execute em ambiente de TESTE apenas!
*/

-- ========================================
-- 1. INSERIR 100 CLIENTES DE TESTE
-- ========================================

DO $$
DECLARE
  i INTEGER;
  random_cpf TEXT;
  random_city TEXT;
  cities TEXT[] := ARRAY['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso'];
BEGIN
  FOR i IN 1..100 LOOP
    -- Gerar CPF aleatório
    random_cpf := LPAD((10000000000 + i)::TEXT, 11, '0');

    -- Cidade aleatória
    random_city := cities[1 + floor(random() * 5)::int];

    INSERT INTO customers (name, cpf, person_type, street, neighborhood, city, email, phone)
    VALUES (
      'Cliente Teste ' || i,
      random_cpf,
      'pf',
      'Rua Teste ' || i,
      'Bairro ' || (i % 10),
      random_city,
      'cliente' || i || '@teste.com',
      '(63) 9' || LPAD(i::TEXT, 8, '0')
    )
    ON CONFLICT (cpf) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Inseridos 100 clientes de teste';
END $$;

-- ========================================
-- 2. INSERIR 150 MATERIAIS DE TESTE
-- ========================================

DO $$
DECLARE
  i INTEGER;
  random_brand TEXT;
  brands TEXT[] := ARRAY['Gerdau', 'ArcelorMittal', 'Votorantim', 'CSN', 'Aço Verde'];
BEGIN
  FOR i IN 1..150 LOOP
    random_brand := brands[1 + floor(random() * 5)::int];

    INSERT INTO materials (name, description, unit, brand, unit_cost, resale_enabled)
    VALUES (
      'Material Teste ' || i,
      'Descrição do material teste ' || i,
      CASE (i % 4)
        WHEN 0 THEN 'kg'
        WHEN 1 THEN 'm'
        WHEN 2 THEN 'un'
        ELSE 'm²'
      END,
      random_brand,
      10.50 + (i * 0.5),
      (i % 3 = 0)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Inseridos 150 materiais de teste';
END $$;

-- ========================================
-- 3. INSERIR 120 PRODUTOS DE TESTE
-- ========================================

DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..120 LOOP
    INSERT INTO products (
      code,
      name,
      unit,
      final_sale_price,
      simple_registration_mode
    )
    VALUES (
      'PROD-' || LPAD(i::TEXT, 4, '0'),
      'Produto Teste ' || i,
      CASE (i % 3)
        WHEN 0 THEN 'un'
        WHEN 1 THEN 'm'
        ELSE 'm²'
      END,
      100.00 + (i * 2),
      true
    )
    ON CONFLICT (code) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Inseridos 120 produtos de teste';
END $$;

-- ========================================
-- 4. INSERIR 80 IMÓVEIS DE TESTE
-- ========================================

DO $$
DECLARE
  i INTEGER;
  customer_id_var UUID;
  property_type_var TEXT;
  municipalities TEXT[] := ARRAY['Palmas', 'Araguaína', 'Gurupi', 'Porto Nacional', 'Paraíso do Tocantins'];
BEGIN
  FOR i IN 1..80 LOOP
    -- Pegar um cliente aleatório
    SELECT id INTO customer_id_var
    FROM customers
    WHERE name LIKE 'Cliente Teste%'
    ORDER BY random()
    LIMIT 1;

    -- Alternar entre rural e urbano
    property_type_var := CASE (i % 2) WHEN 0 THEN 'rural' ELSE 'urban' END;

    INSERT INTO properties (
      customer_id,
      property_type,
      name,
      registration_number,
      municipality,
      state
    )
    VALUES (
      customer_id_var,
      property_type_var,
      'Imóvel Teste ' || i,
      'MAT-' || LPAD(i::TEXT, 6, '0'),
      municipalities[1 + floor(random() * 5)::int],
      'TO'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Inseridos 80 imóveis de teste';
END $$;

-- ========================================
-- 5. INSERIR 60 ORÇAMENTOS DE TESTE
-- ========================================

DO $$
DECLARE
  i INTEGER;
  customer_id_var UUID;
BEGIN
  FOR i IN 1..60 LOOP
    -- Pegar um cliente aleatório
    SELECT id INTO customer_id_var
    FROM customers
    WHERE name LIKE 'Cliente Teste%'
    ORDER BY random()
    LIMIT 1;

    INSERT INTO quotes (
      customer_id,
      status,
      total_value,
      delivery_deadline,
      construction_type
    )
    VALUES (
      customer_id_var,
      CASE (i % 4)
        WHEN 0 THEN 'pending'
        WHEN 1 THEN 'approved'
        WHEN 2 THEN 'rejected'
        ELSE 'completed'
      END,
      5000.00 + (i * 100),
      CURRENT_DATE + (i || ' days')::INTERVAL,
      CASE (i % 2) WHEN 0 THEN 'obra' ELSE null END
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Inseridos 60 orçamentos de teste';
END $$;

-- ========================================
-- 6. ATUALIZAR ESTATÍSTICAS
-- ========================================

ANALYZE customers;
ANALYZE materials;
ANALYZE products;
ANALYZE properties;
ANALYZE quotes;

-- ========================================
-- 7. VERIFICAR DADOS INSERIDOS
-- ========================================

SELECT
  'Clientes' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE name LIKE 'Cliente Teste%') as testes
FROM customers

UNION ALL

SELECT
  'Materiais' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE name LIKE 'Material Teste%') as testes
FROM materials

UNION ALL

SELECT
  'Produtos' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE name LIKE 'Produto Teste%') as testes
FROM products

UNION ALL

SELECT
  'Imóveis' as tabela,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE name LIKE 'Imóvel Teste%') as testes
FROM properties

UNION ALL

SELECT
  'Orçamentos' as tabela,
  COUNT(*) as total,
  COUNT(*) as testes
FROM quotes;

-- ========================================
-- 8. TESTAR PERFORMANCE DE BUSCA
-- ========================================

-- Teste 1: Busca de cliente por nome (com índice)
EXPLAIN ANALYZE
SELECT * FROM customers WHERE LOWER(name) LIKE '%teste 50%';

-- Teste 2: Busca de material por marca (com índice)
EXPLAIN ANALYZE
SELECT * FROM materials WHERE brand = 'Gerdau';

-- Teste 3: Busca de produto por código (com índice)
EXPLAIN ANALYZE
SELECT * FROM products WHERE code = 'PROD-0050';

-- Teste 4: Busca de imóveis por município (com índice)
EXPLAIN ANALYZE
SELECT * FROM properties WHERE municipality = 'Palmas';

-- Teste 5: Busca de orçamentos por cliente e status (com índice composto)
EXPLAIN ANALYZE
SELECT * FROM quotes
WHERE customer_id = (SELECT id FROM customers LIMIT 1)
AND status = 'pending';

-- ========================================
-- 9. LIMPAR DADOS DE TESTE (OPCIONAL)
-- ========================================

/*
-- Descomente as linhas abaixo para REMOVER os dados de teste

DELETE FROM quotes
WHERE customer_id IN (
  SELECT id FROM customers WHERE name LIKE 'Cliente Teste%'
);

DELETE FROM properties
WHERE customer_id IN (
  SELECT id FROM customers WHERE name LIKE 'Cliente Teste%'
);

DELETE FROM customers WHERE name LIKE 'Cliente Teste%';
DELETE FROM materials WHERE name LIKE 'Material Teste%';
DELETE FROM products WHERE name LIKE 'Produto Teste%';

-- Atualizar estatísticas após limpeza
ANALYZE customers;
ANALYZE materials;
ANALYZE products;
ANALYZE properties;
ANALYZE quotes;

SELECT 'Dados de teste removidos com sucesso!' as resultado;
*/
