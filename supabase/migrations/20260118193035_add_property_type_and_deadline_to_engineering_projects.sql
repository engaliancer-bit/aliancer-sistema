/*
  # Adicionar Tipo de Imóvel e Campos de Vencimento aos Projetos de Engenharia

  ## Visão Geral
  Adiciona campos complementares necessários para o gerenciamento completo de projetos:
  - Tipo de imóvel (rural/urbano)
  - Campo de vencimento (has_deadline)
  - Campo de data de vencimento (deadline_date)
  - Aprovação/Status de aprovação

  ## Mudanças
  1. Adicionar enum para tipo de imóvel
  2. Adicionar campo property_type à tabela engineering_projects
  3. Adicionar campos de vencimento
  4. Adicionar campo de aprovação

  ## Segurança
  - Políticas RLS já existentes cobrem os novos campos
*/

-- Enum para tipo de imóvel
DO $$ BEGIN
  CREATE TYPE property_type_enum AS ENUM (
    'rural',
    'urbano'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar coluna de tipo de imóvel se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_projects' 
    AND column_name = 'property_type'
  ) THEN
    ALTER TABLE engineering_projects 
    ADD COLUMN property_type property_type_enum DEFAULT 'urbano';
  END IF;
END $$;

-- Adicionar coluna has_deadline se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_projects' 
    AND column_name = 'has_deadline'
  ) THEN
    ALTER TABLE engineering_projects 
    ADD COLUMN has_deadline boolean DEFAULT false;
  END IF;
END $$;

-- Adicionar coluna deadline_date se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_projects' 
    AND column_name = 'deadline_date'
  ) THEN
    ALTER TABLE engineering_projects 
    ADD COLUMN deadline_date date;
  END IF;
END $$;

-- Adicionar coluna approval_status se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'engineering_projects' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE engineering_projects 
    ADD COLUMN approval_status text DEFAULT 'pendente';
  END IF;
END $$;

-- Adicionar constraint para deadline_date quando has_deadline é true
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_deadline_when_required'
    AND table_name = 'engineering_projects'
  ) THEN
    ALTER TABLE engineering_projects 
    ADD CONSTRAINT check_deadline_when_required 
    CHECK (
      (has_deadline = false) OR 
      (has_deadline = true AND deadline_date IS NOT NULL)
    );
  END IF;
END $$;

-- Criar índice para consultas de projetos com vencimento
CREATE INDEX IF NOT EXISTS idx_engineering_projects_deadline 
ON engineering_projects(has_deadline, deadline_date) 
WHERE has_deadline = true;

-- Criar índice para consultas de projetos por tipo de propriedade
CREATE INDEX IF NOT EXISTS idx_engineering_projects_property_type 
ON engineering_projects(property_type);

-- Comentários para documentação
COMMENT ON COLUMN engineering_projects.property_type IS 'Tipo de imóvel: rural ou urbano';
COMMENT ON COLUMN engineering_projects.has_deadline IS 'Indica se o projeto possui data de vencimento';
COMMENT ON COLUMN engineering_projects.deadline_date IS 'Data de vencimento do projeto (obrigatória se has_deadline=true)';
COMMENT ON COLUMN engineering_projects.approval_status IS 'Status de aprovação do projeto: pendente, aprovado, rejeitado';