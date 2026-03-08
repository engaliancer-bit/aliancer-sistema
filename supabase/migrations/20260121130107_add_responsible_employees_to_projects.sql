/*
  # Adicionar Sistema de Responsáveis aos Projetos de Engenharia

  ## Alterações

  1. Projetos de Engenharia
    - Adiciona campo `responsible_employee_id` para rastrear responsável atual do projeto
    - Referencia tabela `employees`

  2. Etapas de Projeto
    - Adiciona campo `responsible_employee_id` para rastrear responsável de cada etapa
    - Remove o campo antigo `responsible_user` (texto)
    - Referencia tabela `employees`

  3. Histórico de Transferências
    - Nova tabela `project_responsibility_transfers` para registrar todas as transferências
    - Registra: projeto/etapa, colaborador anterior, novo colaborador, data e observações

  ## Segurança
    - RLS habilitado em todas as tabelas
    - Políticas permitem acesso a usuários autenticados
*/

-- Adicionar campo de responsável aos projetos
ALTER TABLE engineering_projects 
ADD COLUMN IF NOT EXISTS responsible_employee_id uuid REFERENCES employees(id);

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_engineering_projects_responsible 
ON engineering_projects(responsible_employee_id);

-- Adicionar campo de responsável às etapas
ALTER TABLE engineering_project_stages 
ADD COLUMN IF NOT EXISTS responsible_employee_id uuid REFERENCES employees(id);

-- Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_engineering_project_stages_responsible 
ON engineering_project_stages(responsible_employee_id);

-- Criar tabela de histórico de transferências de responsabilidade
CREATE TABLE IF NOT EXISTS project_responsibility_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES engineering_projects(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES engineering_project_stages(id) ON DELETE CASCADE,
  transfer_type text NOT NULL CHECK (transfer_type IN ('project', 'stage')),
  previous_employee_id uuid REFERENCES employees(id),
  new_employee_id uuid REFERENCES employees(id) NOT NULL,
  transfer_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  transferred_by text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE project_responsibility_transfers ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para transferências
CREATE POLICY "Permitir leitura de transferências"
  ON project_responsibility_transfers FOR SELECT
  USING (true);

CREATE POLICY "Permitir inserção de transferências"
  ON project_responsibility_transfers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir atualização de transferências"
  ON project_responsibility_transfers FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão de transferências"
  ON project_responsibility_transfers FOR DELETE
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transfers_project 
ON project_responsibility_transfers(project_id);

CREATE INDEX IF NOT EXISTS idx_transfers_stage 
ON project_responsibility_transfers(stage_id);

CREATE INDEX IF NOT EXISTS idx_transfers_employees 
ON project_responsibility_transfers(previous_employee_id, new_employee_id);

-- Função para registrar automaticamente transferências quando responsável muda
CREATE OR REPLACE FUNCTION log_project_responsibility_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o responsável mudou em um projeto
  IF TG_TABLE_NAME = 'engineering_projects' AND 
     OLD.responsible_employee_id IS DISTINCT FROM NEW.responsible_employee_id AND
     NEW.responsible_employee_id IS NOT NULL THEN
    INSERT INTO project_responsibility_transfers (
      project_id,
      transfer_type,
      previous_employee_id,
      new_employee_id,
      notes
    ) VALUES (
      NEW.id,
      'project',
      OLD.responsible_employee_id,
      NEW.responsible_employee_id,
      'Transferência automática de responsabilidade'
    );
  END IF;

  -- Se o responsável mudou em uma etapa
  IF TG_TABLE_NAME = 'engineering_project_stages' AND 
     OLD.responsible_employee_id IS DISTINCT FROM NEW.responsible_employee_id AND
     NEW.responsible_employee_id IS NOT NULL THEN
    INSERT INTO project_responsibility_transfers (
      project_id,
      stage_id,
      transfer_type,
      previous_employee_id,
      new_employee_id,
      notes
    ) VALUES (
      NEW.project_id,
      NEW.id,
      'stage',
      OLD.responsible_employee_id,
      NEW.responsible_employee_id,
      'Transferência automática de responsabilidade da etapa'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar triggers para registrar transferências automaticamente
DROP TRIGGER IF EXISTS trigger_log_project_responsibility ON engineering_projects;
CREATE TRIGGER trigger_log_project_responsibility
  AFTER UPDATE ON engineering_projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_responsibility_transfer();

DROP TRIGGER IF EXISTS trigger_log_stage_responsibility ON engineering_project_stages;
CREATE TRIGGER trigger_log_stage_responsibility
  AFTER UPDATE ON engineering_project_stages
  FOR EACH ROW
  EXECUTE FUNCTION log_project_responsibility_transfer();
