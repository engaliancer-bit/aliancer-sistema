/*
  # Correção: Valores zerados em engineering_project_services

  ## Problema Identificado
  Serviços associados aos projetos foram criados com `actual_value = 0` e `suggested_value = 0`,
  mesmo quando o template tinha um valor definido (ex: LAUDO APP com fees = 280,00).

  ## Causa
  No momento da criação do projeto, o valor dos honorários do template não foi 
  corretamente transferido para o serviço.

  ## Solução
  Atualizar os serviços que têm valor 0 mas cujo template tem um valor definido.

  ## Exemplo
  Serviço: LAUDO APP no projeto "LAUDO APP MILTON"
  - Antes: actual_value = 0, suggested_value = 0
  - Template fees: 280.00
  - Depois: actual_value = 280.00, suggested_value = 280.00
*/

-- Atualizar serviços com valores zerados usando os valores dos templates
UPDATE engineering_project_services eps
SET 
  suggested_value = est.fees,
  actual_value = est.fees
FROM engineering_service_templates est
WHERE eps.service_id = est.id
  AND eps.actual_value = 0
  AND eps.suggested_value = 0
  AND est.fees > 0;

-- Recalcular total_actual_value dos projetos afetados
UPDATE engineering_projects ep
SET total_actual_value = (
  SELECT COALESCE(SUM(actual_value), 0)
  FROM engineering_project_services
  WHERE project_id = ep.id
)
WHERE ep.id IN (
  SELECT DISTINCT project_id
  FROM engineering_project_services
  WHERE actual_value > 0
);

-- Recalcular grand_total (se for igual a 0 e houver serviços)
UPDATE engineering_projects ep
SET grand_total = (
  SELECT COALESCE(SUM(actual_value), 0)
  FROM engineering_project_services
  WHERE project_id = ep.id
)
WHERE ep.grand_total = 0
  AND EXISTS (
    SELECT 1
    FROM engineering_project_services
    WHERE project_id = ep.id
      AND actual_value > 0
  );
