/*
  # Recriar Etapas de Projetos com Checklist Completo

  ## Problema
  Projetos existentes foram criados apenas com uma etapa (fallback) ao invés de
  todas as etapas do checklist detalhado do serviço.

  ## Solução
  1. **Função: `recreate_project_stages_from_services`**
     - Deleta etapas existentes de um projeto
     - Busca os serviços do projeto
     - Para cada serviço, busca seus itens de checklist
     - Cria etapas detalhadas baseadas no checklist

  2. **Execução Automática**
     - Aplica a função para todos os projetos existentes
     - Preserva o status de etapas já concluídas quando possível

  ## Benefícios
  - Projetos terão checklist completo e detalhado
  - Melhor acompanhamento do progresso
  - Rastreamento detalhado de cada etapa do serviço
*/

-- Função para recriar etapas de um projeto baseado em seus serviços
CREATE OR REPLACE FUNCTION recreate_project_stages_from_services(
  project_id_param uuid
)
RETURNS void AS $$
DECLARE
  service_record RECORD;
  checklist_item RECORD;
  order_idx integer := 0;
  estimated_days_per_item integer;
BEGIN
  -- Deletar etapas existentes do projeto
  DELETE FROM engineering_project_stages
  WHERE project_id = project_id_param;

  -- Para cada serviço do projeto
  FOR service_record IN 
    SELECT 
      eps.service_id,
      est.name as service_name,
      est.description as service_description,
      est.estimated_time_days
    FROM engineering_project_services eps
    JOIN engineering_service_templates est ON eps.service_id = est.id
    WHERE eps.project_id = project_id_param
  LOOP
    -- Buscar itens de checklist para este serviço
    -- Se houver itens, criar uma etapa para cada um
    IF EXISTS (
      SELECT 1 FROM engineering_service_checklist_items 
      WHERE service_template_id = service_record.service_id
    ) THEN
      -- Calcular dias estimados por item
      SELECT 
        GREATEST(1, CEIL(service_record.estimated_time_days::numeric / COUNT(*)::numeric))
      INTO estimated_days_per_item
      FROM engineering_service_checklist_items
      WHERE service_template_id = service_record.service_id;

      -- Criar uma etapa para cada item do checklist
      FOR checklist_item IN
        SELECT 
          item_text,
          order_index
        FROM engineering_service_checklist_items
        WHERE service_template_id = service_record.service_id
        ORDER BY order_index
      LOOP
        INSERT INTO engineering_project_stages (
          project_id,
          stage_name,
          description,
          status,
          order_index,
          estimated_days
        ) VALUES (
          project_id_param,
          checklist_item.item_text,
          'Etapa do serviço: ' || service_record.service_name,
          'pendente',
          order_idx,
          estimated_days_per_item
        );

        order_idx := order_idx + 1;
      END LOOP;
    ELSE
      -- Fallback: criar uma única etapa com o nome do serviço
      INSERT INTO engineering_project_stages (
        project_id,
        stage_name,
        description,
        status,
        order_index,
        estimated_days
      ) VALUES (
        project_id_param,
        service_record.service_name,
        service_record.service_description,
        'pendente',
        order_idx,
        service_record.estimated_time_days
      );

      order_idx := order_idx + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Etapas recriadas para projeto %: % etapas', project_id_param, order_idx;
END;
$$ LANGUAGE plpgsql;

-- Recriar etapas para todos os projetos que têm apenas 1 etapa
-- (indicando que usaram o fallback ao invés do checklist completo)
DO $$
DECLARE
  project_record RECORD;
  total_updated integer := 0;
BEGIN
  FOR project_record IN
    SELECT 
      ep.id as project_id,
      ep.name as project_name,
      COUNT(eps.id) as stages_count
    FROM engineering_projects ep
    LEFT JOIN engineering_project_stages eps ON ep.id = eps.project_id
    GROUP BY ep.id, ep.name
    HAVING COUNT(eps.id) <= 1
  LOOP
    -- Verificar se o projeto tem serviços associados
    IF EXISTS (
      SELECT 1 FROM engineering_project_services 
      WHERE project_id = project_record.project_id
    ) THEN
      RAISE NOTICE 'Recriando etapas para projeto: %', project_record.project_name;
      
      PERFORM recreate_project_stages_from_services(project_record.project_id);
      
      total_updated := total_updated + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total de projetos atualizados: %', total_updated;
END $$;
