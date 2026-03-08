/*
  # Adicionar tipos de custos indiretos e novas categorias

  1. Alterações
    - Adiciona novos tipos ao check constraint: 'utilities', 'prolabore'
    - Cria novas categorias de custo:
      - Energia Elétrica (utilities)
      - Água e Esgoto (utilities)
      - Pro Labore (prolabore)
    
  2. Classificação
    - Custos Diretos: direct_production, personnel
    - Custos Indiretos: administrative, equipment, maintenance, utilities, prolabore, taxes, ppe
*/

-- Remover constraint antigo
ALTER TABLE cost_categories DROP CONSTRAINT IF EXISTS cost_categories_type_check;

-- Adicionar novo constraint com os tipos adicionais
ALTER TABLE cost_categories ADD CONSTRAINT cost_categories_type_check 
  CHECK (type IN (
    'direct_production',
    'direct_resale', 
    'administrative',
    'personnel',
    'taxes',
    'equipment',
    'maintenance',
    'ppe',
    'utilities',
    'prolabore'
  ));

-- Inserir novas categorias de custos indiretos
INSERT INTO cost_categories (name, type, description, is_active)
VALUES 
  ('Energia Elétrica', 'utilities', 'Consumo de energia elétrica da empresa', true),
  ('Água e Esgoto', 'utilities', 'Consumo de água e serviços de esgoto', true),
  ('Pro Labore', 'prolabore', 'Retirada dos sócios e proprietários', true)
ON CONFLICT DO NOTHING;
