/*
  # Atualizar Função de Criação de Etapas para Incluir Responsável

  ## Descrição
  Atualiza a função `recreate_project_stages_from_services` para copiar o responsável
  pré-definido dos itens do checklist do template para as etapas do projeto.

  ## Mudanças
  - Adiciona o campo `responsible_employee_id` na query que busca itens do checklist
  - Insere o `responsible_employee_id` ao criar as etapas do projeto
  - Mantém compatibilidade com templates antigos sem responsável definido

  ## Benefícios
  - Responsáveis são automaticamente atribuídos às etapas do projeto
  - Colaboradores sabem suas atribuições desde o início
  - Reduz trabalho manual de configuração
*/

-- Atualizar função para incluir responsável ao criar etapas
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
          order_index,
          responsible_employee_id
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
          estimated_days,
          responsible_employee_id
        ) VALUES (
          project_id_param,
          checklist_item.item_text,
          'Etapa do serviço: ' || service_record.service_name,
          'pendente',
          order_idx,
          estimated_days_per_item,
          checklist_item.responsible_employee_id
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
        estimated_days,
        responsible_employee_id
      ) VALUES (
        project_id_param,
        service_record.service_name,
        service_record.service_description,
        'pendente',
        order_idx,
        service_record.estimated_time_days,
        NULL
      );

      order_idx := order_idx + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Etapas recriadas para projeto %: % etapas', project_id_param, order_idx;
END;
$$ LANGUAGE plpgsql;
