/*
  # Sistema de Histórico de Checklist

  ## Descrição
  Cria um sistema para rastrear mudanças nos itens do checklist dos projetos,
  registrando quando cada etapa foi concluída e por quem.

  ## Nova Tabela

  ### `engineering_project_stage_history`
  Histórico de mudanças de status das etapas do checklist
    - `id` (uuid, PK)
    - `stage_id` (uuid, FK) - Referência à etapa
    - `project_id` (uuid, FK) - Referência ao projeto
    - `old_status` - Status anterior
    - `new_status` - Novo status
    - `changed_by_employee_id` (uuid, FK) - Colaborador que fez a mudança
    - `changed_at` - Data/hora da mudança
    - `notes` - Observações sobre a mudança

  ## Segurança
  - RLS habilitado
  - Acesso público permitido
*/

-- Criar tabela de histórico de etapas
CREATE TABLE IF NOT EXISTS engineering_project_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES engineering_project_stages(id) ON DELETE CASCADE,
  project_id uuid REFERENCES engineering_projects(id) ON DELETE CASCADE,
  old_status text NOT NULL,
  new_status text NOT NULL,
  changed_by_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE engineering_project_stage_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
CREATE POLICY "Permitir SELECT público"
  ON engineering_project_stage_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir INSERT público"
  ON engineering_project_stage_history FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Permitir UPDATE público"
  ON engineering_project_stage_history FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir DELETE público"
  ON engineering_project_stage_history FOR DELETE
  TO public
  USING (true);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_stage_history_stage_id 
ON engineering_project_stage_history(stage_id);

CREATE INDEX IF NOT EXISTS idx_stage_history_project_id 
ON engineering_project_stage_history(project_id);

CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at 
ON engineering_project_stage_history(changed_at DESC);

-- Comentários
COMMENT ON TABLE engineering_project_stage_history IS 
'Histórico de mudanças de status das etapas do checklist dos projetos';

COMMENT ON COLUMN engineering_project_stage_history.stage_id IS 
'Referência à etapa do checklist';

COMMENT ON COLUMN engineering_project_stage_history.changed_by_employee_id IS 
'Colaborador que realizou a mudança de status';

COMMENT ON COLUMN engineering_project_stage_history.changed_at IS 
'Data e hora em que a mudança foi realizada';
