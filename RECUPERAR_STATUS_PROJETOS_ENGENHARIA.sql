/*
  =============================================================================
  SCRIPT DE RECUPERACAO DE STATUS - PROJETOS DE ENGENHARIA
  =============================================================================

  OBJETIVO:
  Distribuir automaticamente os projetos de engenharia entre os status corretos
  com base em evidencias encontradas no banco de dados.

  REGRAS DE IDENTIFICACAO (em ordem de prioridade):
    1. registered_date IS NOT NULL               -> registrado
    2. car_rectification_requested = true         -> registrado
    3. actual_completion_date IS NOT NULL         -> finalizado
    4. exigency_description IS NOT NULL AND != '' -> em_exigencia
    5. 100% das etapas concluidas                 -> finalizado
    6. Pelo menos 1 etapa concluida ou em andamento -> em_desenvolvimento
    7. Sem nenhuma evidencia                       -> a_iniciar

  COMO USAR:
    PASSO 1: Execute o bloco "PREVIEW" para ver o que sera alterado (sem mudar nada)
    PASSO 2: Execute o bloco "BACKUP" para salvar o estado atual
    PASSO 3: Execute o bloco "EXECUCAO" para aplicar as mudancas
    PASSO 4: Se necessario, execute o bloco "ROLLBACK" para reverter

  =============================================================================
*/


-- =============================================================================
-- PASSO 1: PREVIEW - Visualize o que sera alterado (nao muda nada no banco)
-- =============================================================================

WITH stage_stats AS (
  SELECT
    project_id,
    COUNT(*) AS total_stages,
    COUNT(*) FILTER (WHERE status = 'concluida') AS completed_stages,
    COUNT(*) FILTER (WHERE status IN ('concluida', 'em_andamento')) AS started_stages
  FROM engineering_project_stages
  GROUP BY project_id
),
project_analysis AS (
  SELECT
    ep.id,
    ep.name AS project_name,
    ep.status AS status_atual,

    CASE
      WHEN ep.registered_date IS NOT NULL            THEN 'registrado'
      WHEN ep.car_rectification_requested = true     THEN 'registrado'
      WHEN ep.actual_completion_date IS NOT NULL      THEN 'finalizado'
      WHEN ep.exigency_description IS NOT NULL
           AND ep.exigency_description != ''          THEN 'em_exigencia'
      WHEN s.total_stages > 0
           AND s.completed_stages = s.total_stages    THEN 'finalizado'
      WHEN s.started_stages > 0                       THEN 'em_desenvolvimento'
      ELSE                                                 'a_iniciar'
    END AS status_sugerido,

    CASE
      WHEN ep.registered_date IS NOT NULL            THEN 'Regra 1: registered_date preenchida'
      WHEN ep.car_rectification_requested = true     THEN 'Regra 2: CAR rectification solicitada'
      WHEN ep.actual_completion_date IS NOT NULL      THEN 'Regra 3: actual_completion_date preenchida'
      WHEN ep.exigency_description IS NOT NULL
           AND ep.exigency_description != ''          THEN 'Regra 4: exigency_description preenchida'
      WHEN s.total_stages > 0
           AND s.completed_stages = s.total_stages    THEN 'Regra 5: 100% etapas concluidas'
      WHEN s.started_stages > 0                       THEN 'Regra 6: possui etapas iniciadas'
      ELSE                                                 'Regra 7: sem evidencias'
    END AS regra_aplicada,

    COALESCE(s.total_stages, 0) AS total_etapas,
    COALESCE(s.completed_stages, 0) AS etapas_concluidas,
    ep.registered_date,
    ep.actual_completion_date,
    ep.exigency_description
  FROM engineering_projects ep
  LEFT JOIN stage_stats s ON s.project_id = ep.id
)
SELECT
  status_atual,
  status_sugerido,
  regra_aplicada,
  COUNT(*) AS quantidade_projetos,
  STRING_AGG(project_name, ', ' ORDER BY project_name) AS exemplos
FROM project_analysis
GROUP BY status_atual, status_sugerido, regra_aplicada
ORDER BY status_sugerido, status_atual;


-- =============================================================================
-- PASSO 1b: CONTAGEM GERAL (resumo rapido para verificar totais)
-- =============================================================================

WITH stage_stats AS (
  SELECT
    project_id,
    COUNT(*) AS total_stages,
    COUNT(*) FILTER (WHERE status = 'concluida') AS completed_stages,
    COUNT(*) FILTER (WHERE status IN ('concluida', 'em_andamento')) AS started_stages
  FROM engineering_project_stages
  GROUP BY project_id
),
novo_status AS (
  SELECT
    CASE
      WHEN ep.registered_date IS NOT NULL            THEN 'registrado'
      WHEN ep.car_rectification_requested = true     THEN 'registrado'
      WHEN ep.actual_completion_date IS NOT NULL      THEN 'finalizado'
      WHEN ep.exigency_description IS NOT NULL
           AND ep.exigency_description != ''          THEN 'em_exigencia'
      WHEN s.total_stages > 0
           AND s.completed_stages = s.total_stages    THEN 'finalizado'
      WHEN s.started_stages > 0                       THEN 'em_desenvolvimento'
      ELSE                                                 'a_iniciar'
    END AS status_novo
  FROM engineering_projects ep
  LEFT JOIN stage_stats s ON s.project_id = ep.id
)
SELECT
  status_novo AS "Status Apos Recuperacao",
  COUNT(*) AS "Quantidade"
FROM novo_status
GROUP BY status_novo
ORDER BY
  CASE status_novo
    WHEN 'registrado'       THEN 1
    WHEN 'finalizado'       THEN 2
    WHEN 'entregue'         THEN 3
    WHEN 'em_exigencia'     THEN 4
    WHEN 'em_desenvolvimento' THEN 5
    WHEN 'em_correcao'      THEN 6
    WHEN 'a_iniciar'        THEN 7
  END;


-- =============================================================================
-- PASSO 2: BACKUP - Salva o estado atual antes de qualquer alteracao
-- =============================================================================

-- Criar tabela de backup (apaga se ja existir de uma execucao anterior)
DROP TABLE IF EXISTS engineering_projects_status_backup;

CREATE TABLE engineering_projects_status_backup AS
SELECT
  id,
  name,
  status AS status_original,
  registered_date,
  actual_completion_date,
  exigency_description,
  car_rectification_requested,
  now() AS backup_timestamp
FROM engineering_projects;

-- Confirmar backup
SELECT
  'BACKUP CRIADO COM SUCESSO' AS mensagem,
  COUNT(*) AS total_projetos_no_backup,
  now() AS horario_backup
FROM engineering_projects_status_backup;


-- =============================================================================
-- PASSO 3: EXECUCAO - Aplica a recuperacao de status
-- =============================================================================

WITH stage_stats AS (
  SELECT
    project_id,
    COUNT(*) AS total_stages,
    COUNT(*) FILTER (WHERE status = 'concluida') AS completed_stages,
    COUNT(*) FILTER (WHERE status IN ('concluida', 'em_andamento')) AS started_stages
  FROM engineering_project_stages
  GROUP BY project_id
),
status_calculado AS (
  SELECT
    ep.id,
    CASE
      WHEN ep.registered_date IS NOT NULL            THEN 'registrado'
      WHEN ep.car_rectification_requested = true     THEN 'registrado'
      WHEN ep.actual_completion_date IS NOT NULL      THEN 'finalizado'
      WHEN ep.exigency_description IS NOT NULL
           AND ep.exigency_description != ''          THEN 'em_exigencia'
      WHEN s.total_stages > 0
           AND s.completed_stages = s.total_stages    THEN 'finalizado'
      WHEN s.started_stages > 0                       THEN 'em_desenvolvimento'
      ELSE                                                 'a_iniciar'
    END AS novo_status
  FROM engineering_projects ep
  LEFT JOIN stage_stats s ON s.project_id = ep.id
)
UPDATE engineering_projects ep
SET
  status = sc.novo_status::engineering_project_status,
  updated_at = now()
FROM status_calculado sc
WHERE ep.id = sc.id
  AND ep.status::text != sc.novo_status;

-- Relatorio pos-execucao
SELECT
  status::text AS "Status Final",
  COUNT(*) AS "Quantidade"
FROM engineering_projects
GROUP BY status
ORDER BY
  CASE status::text
    WHEN 'registrado'         THEN 1
    WHEN 'finalizado'         THEN 2
    WHEN 'entregue'           THEN 3
    WHEN 'em_exigencia'       THEN 4
    WHEN 'em_desenvolvimento' THEN 5
    WHEN 'em_correcao'        THEN 6
    WHEN 'a_iniciar'          THEN 7
  END;


-- =============================================================================
-- PASSO 4: ROLLBACK - Reverta as alteracoes se necessario (executar SEPARADAMENTE)
-- =============================================================================

/*
  -- ATENCAO: Execute apenas se quiser DESFAZER as alteracoes
  -- Este bloco restaura o status original de todos os projetos

  UPDATE engineering_projects ep
  SET
    status = b.status_original::engineering_project_status,
    updated_at = now()
  FROM engineering_projects_status_backup b
  WHERE ep.id = b.id;

  SELECT
    'ROLLBACK EXECUTADO COM SUCESSO' AS mensagem,
    COUNT(*) AS projetos_restaurados
  FROM engineering_projects;
*/
