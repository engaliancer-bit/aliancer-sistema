/*
  # Remover Triggers e Funções Obsoletas

  ## Problema
  Após consolidar as colunas duplicadas (project_name -> name, total_value -> grand_total),
  alguns triggers ainda tentam acessar as colunas antigas que não existem mais:
  - sync_grand_total_with_total_value - referencia total_value (removida)
  - sync_project_name_with_name - referencia project_name (removida)

  ## Solução
  Remover os triggers e funções obsoletas que não são mais necessárias.

  ## Notas
  - As colunas agora são únicas e não precisam mais de sincronização
  - O trigger calculate_project_balance continua funcionando normalmente
*/

-- Remover trigger e função de sincronização de total_value
DROP TRIGGER IF EXISTS sync_grand_total_trigger ON engineering_projects;
DROP FUNCTION IF EXISTS sync_grand_total_with_total_value();

-- Remover trigger e função de sincronização de project_name
DROP TRIGGER IF EXISTS sync_project_name_trigger ON engineering_projects;
DROP FUNCTION IF EXISTS sync_project_name_with_name();