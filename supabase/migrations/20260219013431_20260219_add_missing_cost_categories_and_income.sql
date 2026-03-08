/*
  # Adicionar Categorias de Custo e Receita Faltantes

  1. Alteracoes
    - Atualizar constraint para incluir novos tipos (transport, income_*)
    - Adicionar novas categorias de despesa e receita

  2. Novas Categorias de Despesa
    - `Aluguel` (type: utilities) - Aluguel de instalacoes
    - `Combustivel` (type: transport) - Gastos com combustivel
    - `Conta a Pagar` (type: administrative) - Contas diversas a pagar
    - `Manutencao Geral` (type: maintenance) - Manutencao geral de instalacoes
    - `Outras Despesas` (type: administrative) - Despesas nao categorizadas
    - `Transporte/Frete` (type: transport) - Gastos com transporte e frete

  3. Novas Categorias de Receita
    - `Venda de Produtos` (type: income_sales) - Vendas da fabrica
    - `Servicos de Engenharia` (type: income_services) - Projetos de engenharia
    - `Servicos de Muck` (type: income_muck) - Prestacao de servicos de muck
    - `Venda Construtora` (type: income_construction) - Vendas da construtora
    - `Outras Receitas` (type: income_other) - Receitas diversas

  4. Seguranca
    - Verificar existencia antes de inserir para evitar duplicatas
*/

-- 1. Atualizar constraint para incluir novos tipos
ALTER TABLE cost_categories DROP CONSTRAINT IF EXISTS cost_categories_type_check;
ALTER TABLE cost_categories ADD CONSTRAINT cost_categories_type_check 
CHECK (type = ANY (ARRAY[
  -- Tipos de despesa existentes
  'direct_production'::text, 
  'direct_resale'::text, 
  'administrative'::text, 
  'personnel'::text, 
  'taxes'::text, 
  'equipment'::text, 
  'maintenance'::text, 
  'ppe'::text, 
  'utilities'::text, 
  'prolabore'::text,
  -- Novos tipos de despesa
  'transport'::text,
  -- Novos tipos de receita
  'income_sales'::text,
  'income_services'::text,
  'income_muck'::text,
  'income_construction'::text,
  'income_other'::text
]));

-- 2. Inserir categorias faltantes
DO $$
BEGIN
  -- Aluguel
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Aluguel') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Aluguel', 'utilities', 'Aluguel de galpoes, escritorios e instalacoes');
  END IF;
  
  -- Combustivel
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Combustivel') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Combustivel', 'transport', 'Gastos com combustivel para veiculos e maquinas');
  END IF;
  
  -- Conta a Pagar
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Conta a Pagar') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Conta a Pagar', 'administrative', 'Contas diversas pendentes de pagamento');
  END IF;
  
  -- Manutencao Geral
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Manutencao Geral') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Manutencao Geral', 'maintenance', 'Manutencao de instalacoes, predios e infraestrutura');
  END IF;
  
  -- Outras Despesas
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Outras Despesas') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Outras Despesas', 'administrative', 'Despesas diversas nao categorizadas');
  END IF;
  
  -- Transporte/Frete
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Transporte/Frete') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Transporte/Frete', 'transport', 'Gastos com transporte de materiais e frete');
  END IF;
  
  -- Venda de Produtos (receita)
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Venda de Produtos') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Venda de Produtos', 'income_sales', 'Receitas de vendas de produtos da fabrica');
  END IF;
  
  -- Servicos de Engenharia (receita)
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Servicos de Engenharia') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Servicos de Engenharia', 'income_services', 'Receitas de projetos e servicos de engenharia');
  END IF;
  
  -- Servicos de Muck (receita)
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Servicos de Muck') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Servicos de Muck', 'income_muck', 'Receitas de prestacao de servicos de muck/terraplenagem');
  END IF;
  
  -- Venda Construtora (receita)
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Venda Construtora') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Venda Construtora', 'income_construction', 'Receitas de vendas e servicos da construtora');
  END IF;
  
  -- Outras Receitas
  IF NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = 'Outras Receitas') THEN
    INSERT INTO cost_categories (name, type, description)
    VALUES ('Outras Receitas', 'income_other', 'Receitas diversas nao categorizadas');
  END IF;
END $$;
