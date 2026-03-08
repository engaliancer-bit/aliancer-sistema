/*
  # Adicionar coluna de data de conclusão real aos projetos

  ## Problema
  A interface TypeScript define `actual_completion_date` mas a coluna não existe na tabela
  `engineering_projects`, causando erro ao tentar marcar um projeto como concluído.

  ## Solução
  1. **Adicionar coluna `actual_completion_date`**
     - Tipo: DATE
     - Permite NULL (será preenchida apenas quando o projeto for concluído)
     - Armazena a data real em que o projeto foi concluído

  ## Benefícios
  - Permite rastrear quando projetos foram realmente finalizados
  - Diferencia entre data estimada e data real de conclusão
  - Corrige erro ao marcar projeto como concluído
*/

-- Adicionar coluna de data de conclusão real
ALTER TABLE engineering_projects 
ADD COLUMN IF NOT EXISTS actual_completion_date DATE;

-- Adicionar comentário explicativo
COMMENT ON COLUMN engineering_projects.actual_completion_date IS 
  'Data em que o projeto foi realmente concluído (diferente da data estimada)';
