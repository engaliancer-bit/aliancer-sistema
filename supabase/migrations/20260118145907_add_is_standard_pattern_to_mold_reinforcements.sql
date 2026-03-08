/*
  # Adicionar campo is_standard_pattern para armaduras padrão

  1. Alterações na tabela mold_reinforcements
    - Adiciona coluna `is_standard_pattern` (boolean) para marcar qual estribo transversal é o padrão
    - Adiciona índice para melhorar performance de consultas
    - Adiciona constraint para garantir apenas um padrão por fôrma

  2. Segurança
    - Mantém políticas RLS existentes
*/

-- Adicionar coluna is_standard_pattern à tabela mold_reinforcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mold_reinforcements' AND column_name = 'is_standard_pattern'
  ) THEN
    ALTER TABLE mold_reinforcements ADD COLUMN is_standard_pattern boolean DEFAULT false;
  END IF;
END $$;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_mold_reinforcements_standard_pattern 
ON mold_reinforcements(mold_id, is_standard_pattern) 
WHERE is_standard_pattern = true AND type = 'transversal';

-- Adicionar constraint para garantir apenas um padrão por fôrma
-- (usando índice único parcial)
DROP INDEX IF EXISTS unique_standard_pattern_per_mold;
CREATE UNIQUE INDEX unique_standard_pattern_per_mold 
ON mold_reinforcements(mold_id) 
WHERE is_standard_pattern = true AND type = 'transversal';