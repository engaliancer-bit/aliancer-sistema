/*
  # Popular template_id em projetos existentes

  ## Objetivo
  Preencher o campo `template_id` em projetos que foram criados com apenas 1 serviço,
  mas não tinham o template_id definido.

  ## Lógica
  1. Identifica projetos sem template_id
  2. Verifica se têm apenas 1 serviço associado
  3. Define o template_id como sendo o service_id daquele serviço

  ## Exemplo
  Projeto: "LAUDO APP MILTON"
  - Antes: template_id = null
  - Serviço: "LAUDO APP" (id: 994e9ea3-fbce-49a1-9c8c-5d28c40f55a6)
  - Depois: template_id = 994e9ea3-fbce-49a1-9c8c-5d28c40f55a6

  ## Benefícios
  - Facilita filtros por template
  - Melhora relatórios gerenciais
  - Mantém consistência no banco
*/

-- Atualizar projetos que têm apenas 1 serviço e não têm template_id
UPDATE engineering_projects ep
SET template_id = (
  SELECT eps.service_id
  FROM engineering_project_services eps
  WHERE eps.project_id = ep.id
  LIMIT 1
)
WHERE ep.template_id IS NULL
  AND (
    SELECT COUNT(*)
    FROM engineering_project_services eps
    WHERE eps.project_id = ep.id
  ) = 1;
