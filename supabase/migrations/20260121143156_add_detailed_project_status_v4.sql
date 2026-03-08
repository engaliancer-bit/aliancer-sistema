/*
  # Adicionar Status Detalhados aos Projetos de Engenharia

  ## Descrição
  Expande o sistema de status dos projetos de engenharia para incluir estados mais detalhados
  do ciclo de vida do projeto, especialmente relacionados ao processo de aprovação e registro.

  ## Mudanças
  1. Adiciona novos status ao enum `engineering_project_status`:
     - a_iniciar: Projeto aguardando início
     - em_desenvolvimento: Projeto em desenvolvimento
     - em_correcao: Projeto em processo de correção
     - finalizado: Projeto finalizado internamente
     - entregue: Projeto entregue ao cliente/órgão
     - em_exigencia: Projeto com exigências/pendências a resolver
     - registrado: Projeto aprovado e registrado oficialmente

  2. Remove status antigos menos detalhados (em_planejamento, em_andamento, concluido, cancelado)

  3. Adiciona campos auxiliares:
     - exigency_description: Descrição das exigências quando status for "em_exigencia"
     - registered_date: Data de registro oficial
     - car_rectification_requested: Indica se foi solicitada retificação do CAR

  ## Ordenação Especial
  Projetos "em_exigencia" devem aparecer no topo das listagens com destaque visual.
*/

-- Dropar constraints existentes relacionadas ao status
DO $$ 
BEGIN
    -- Tentar dropar check constraints que possam existir
    ALTER TABLE engineering_projects DROP CONSTRAINT IF EXISTS engineering_projects_status_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Remover o default da coluna status
ALTER TABLE engineering_projects 
ALTER COLUMN status DROP DEFAULT;

-- Converter a coluna para text
ALTER TABLE engineering_projects 
ALTER COLUMN status TYPE text;

-- Dropar o enum antigo
DROP TYPE IF EXISTS engineering_project_status CASCADE;

-- Criar novo enum com status detalhados
CREATE TYPE engineering_project_status AS ENUM (
  'a_iniciar',
  'em_desenvolvimento',
  'em_correcao',
  'finalizado',
  'entregue',
  'em_exigencia',
  'registrado'
);

-- Atualizar valores existentes para os novos status
UPDATE engineering_projects
SET status = CASE status
  WHEN 'em_planejamento' THEN 'a_iniciar'
  WHEN 'em_andamento' THEN 'em_desenvolvimento'
  WHEN 'concluido' THEN 'finalizado'
  WHEN 'cancelado' THEN 'a_iniciar'
  ELSE 'a_iniciar'
END;

-- Converter coluna para o novo enum
ALTER TABLE engineering_projects 
ALTER COLUMN status TYPE engineering_project_status 
USING status::engineering_project_status;

-- Definir valor padrão
ALTER TABLE engineering_projects 
ALTER COLUMN status SET DEFAULT 'a_iniciar'::engineering_project_status;

-- Adicionar novos campos auxiliares
ALTER TABLE engineering_projects
ADD COLUMN IF NOT EXISTS exigency_description text DEFAULT '',
ADD COLUMN IF NOT EXISTS registered_date timestamptz,
ADD COLUMN IF NOT EXISTS car_rectification_requested boolean DEFAULT false;

-- Criar índice para melhor performance na ordenação
CREATE INDEX IF NOT EXISTS idx_projects_status_priority 
ON engineering_projects(status, created_at DESC);

-- Comentários explicativos
COMMENT ON COLUMN engineering_projects.status IS 
'Status do projeto: a_iniciar, em_desenvolvimento, em_correcao, finalizado, entregue, em_exigencia, registrado';

COMMENT ON COLUMN engineering_projects.exigency_description IS 
'Descrição das exigências quando o projeto está com status em_exigencia';

COMMENT ON COLUMN engineering_projects.registered_date IS 
'Data em que o projeto foi oficialmente registrado';

COMMENT ON COLUMN engineering_projects.car_rectification_requested IS 
'Indica se foi solicitada a retificação do CAR após o registro';
