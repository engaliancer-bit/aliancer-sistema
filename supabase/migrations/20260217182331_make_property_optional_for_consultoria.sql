/*
  # Tornar Imóvel Opcional para Projetos de Consultoria

  ## Descrição
  Permite criar projetos de engenharia sem vínculo com imóvel, especialmente para
  projetos de consultoria que não estão relacionados a um imóvel específico.

  ## Alterações

  ### Tabela `engineering_projects`
  - Remove constraint NOT NULL do campo `property_id`
  - Permite projetos sem imóvel vinculado
  - Mantém integridade referencial quando imóvel existe

  ## Impacto
  - Projetos de consultoria podem ser criados sem selecionar imóvel
  - Projetos relacionados a imóveis continuam funcionando normalmente
  - Views e queries existentes continuam funcionando (property_id pode ser NULL)

  ## Segurança
  - Nenhuma alteração nas políticas RLS
  - Mantém todas as permissões existentes
*/

-- Remover constraint NOT NULL do campo property_id na tabela engineering_projects
DO $$
BEGIN
  -- Verificar se a coluna existe e é NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'engineering_projects'
    AND column_name = 'property_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Tornar property_id opcional
    ALTER TABLE engineering_projects ALTER COLUMN property_id DROP NOT NULL;
    
    RAISE NOTICE 'Campo property_id agora é opcional em engineering_projects';
  ELSE
    RAISE NOTICE 'Campo property_id já é opcional';
  END IF;
END $$;

-- Adicionar comentário explicativo
COMMENT ON COLUMN engineering_projects.property_id IS 'ID do imóvel relacionado (NULL para projetos de consultoria sem imóvel específico)';

-- Atualizar view v_projects_to_collect para lidar com property_id NULL
DROP VIEW IF EXISTS v_projects_to_collect;

CREATE OR REPLACE VIEW v_projects_to_collect AS
SELECT 
  ep.id,
  ep.name as project_name,
  c.name as customer_name,
  c.id as customer_id,
  (ep.grand_total - ep.total_received) as balance_due,
  ep.grand_total,
  ep.total_received
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
WHERE ep.status NOT IN ('finalizado', 'entregue', 'registrado')
  AND (ep.grand_total - ep.total_received) > 0
ORDER BY balance_due DESC;

-- Comentário na view
COMMENT ON VIEW v_projects_to_collect IS 'View de projetos com saldo a cobrar (suporta projetos com ou sem imóvel)';

-- Criar índice para melhorar performance de consultas com property_id NULL
CREATE INDEX IF NOT EXISTS idx_engineering_projects_without_property 
  ON engineering_projects(customer_id, status) 
  WHERE property_id IS NULL;

COMMENT ON INDEX idx_engineering_projects_without_property IS 'Índice para projetos de consultoria sem imóvel vinculado';
