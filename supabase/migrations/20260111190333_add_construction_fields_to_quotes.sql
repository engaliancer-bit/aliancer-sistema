/*
  # Adicionar Campos de Obra aos Orçamentos

  1. Alterações
    - Adiciona campos para detalhar orçamentos de construção:
      - `quote_type`: tipo do orçamento (obra fechada ou somente materiais)
      - `structure_type`: tipo de estrutura (casa, galpão, pavimentação, outros)
      - `structure_description`: descrição personalizada da estrutura
      - `square_meters`: metragem quadrada da edificação
      - `permit_count`: número de alvarás necessários
  
  2. Notas
    - Campos são opcionais para manter compatibilidade com orçamentos existentes
    - quote_type tem valores: 'complete_construction' ou 'materials_only'
    - structure_type permite categorização pré-definida ou personalizada
*/

-- Adicionar campos de obra à tabela quotes
DO $$
BEGIN
  -- Campo para tipo de orçamento (obra fechada ou somente materiais)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_type'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_type text CHECK (quote_type IN ('complete_construction', 'materials_only'));
  END IF;

  -- Campo para tipo de estrutura
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'structure_type'
  ) THEN
    ALTER TABLE quotes ADD COLUMN structure_type text;
  END IF;

  -- Campo para descrição personalizada da estrutura
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'structure_description'
  ) THEN
    ALTER TABLE quotes ADD COLUMN structure_description text DEFAULT '';
  END IF;

  -- Campo para metragem quadrada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'square_meters'
  ) THEN
    ALTER TABLE quotes ADD COLUMN square_meters numeric(10,2) DEFAULT 0;
  END IF;

  -- Campo para número de alvarás
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'permit_count'
  ) THEN
    ALTER TABLE quotes ADD COLUMN permit_count integer DEFAULT 0;
  END IF;
END $$;