-- ========================================
-- QUERIES DE TESTE - Sistema IA Projetos
-- ========================================

-- 1. CRIAR JOB DE TESTE
-- ========================================

-- Exemplo 1: Job básico
SELECT create_project_ia_job(
  p_project_id := (SELECT id FROM engineering_projects LIMIT 1),
  p_template_id := (SELECT id FROM ai_document_templates WHERE ia_enabled = true LIMIT 1),
  p_briefing := 'Gerar laudo técnico completo de vistoria estrutural do imóvel. Incluir análise de patologias visíveis, estado de conservação e recomendações técnicas.'
);

-- Exemplo 2: Job com respostas de intake
SELECT create_project_ia_job(
  p_project_id := (SELECT id FROM engineering_projects LIMIT 1),
  p_template_id := (SELECT id FROM ai_document_templates WHERE ia_enabled = true LIMIT 1),
  p_briefing := 'Laudo de vistoria para perícia judicial',
  p_intake_answers := jsonb_build_object(
    'q1', 'Residencial',
    'q2', 'Avaliação de patologias para processo judicial',
    'q3', true,
    'q4', '2026-02-11',
    'q5', true,
    'q6', 'Foram identificadas trincas nas paredes externas e infiltração no teto do banheiro'
  )
);

-- ========================================
-- 2. LISTAR JOBS
-- ========================================

-- Todos os jobs com detalhes
SELECT * FROM project_ia_jobs_detail
ORDER BY created_at DESC
LIMIT 10;

-- Jobs de um projeto específico
SELECT * FROM project_ia_jobs_detail
WHERE project_id = 'seu-uuid-aqui'
ORDER BY created_at DESC;

-- Jobs por status
SELECT
  status,
  COUNT(*) as total,
  AVG(progress) as progresso_medio
FROM project_ia_jobs
GROUP BY status
ORDER BY total DESC;

-- Jobs pendentes de processamento
SELECT * FROM project_ia_jobs_detail
WHERE status = 'pending'
ORDER BY created_at;

-- Jobs em processamento
SELECT
  id,
  project_name,
  template_name,
  progress,
  current_section,
  started_at,
  (EXTRACT(EPOCH FROM (now() - started_at)) / 60)::integer as minutos_processando
FROM project_ia_jobs_detail
WHERE status = 'processing'
ORDER BY started_at;

-- Jobs completados hoje
SELECT * FROM project_ia_jobs_detail
WHERE status = 'completed'
AND completed_at >= CURRENT_DATE
ORDER BY completed_at DESC;

-- Jobs com erro
SELECT
  id,
  project_name,
  template_name,
  error_message,
  created_at
FROM project_ia_jobs_detail
WHERE status = 'failed'
ORDER BY created_at DESC;

-- ========================================
-- 3. SIMULAR PROCESSAMENTO DE JOB
-- ========================================

-- Marcar como processando
UPDATE project_ia_jobs
SET
  status = 'processing',
  started_at = now(),
  progress = 0
WHERE id = 'seu-job-uuid-aqui'
AND status = 'pending';

-- Atualizar progresso (simular)
UPDATE project_ia_jobs
SET
  progress = 25,
  current_section = '1. Identificação'
WHERE id = 'seu-job-uuid-aqui';

UPDATE project_ia_jobs
SET
  progress = 50,
  current_section = '2. Objeto da Vistoria'
WHERE id = 'seu-job-uuid-aqui';

UPDATE project_ia_jobs
SET
  progress = 75,
  current_section = '3. Diagnóstico'
WHERE id = 'seu-job-uuid-aqui';

-- ========================================
-- 4. CRIAR OUTPUT
-- ========================================

-- Inserir output completo (primeira versão)
INSERT INTO project_ia_outputs (
  job_id,
  output_markdown,
  executive_summary,
  pending_items,
  generated_by
) VALUES (
  'seu-job-uuid-aqui',

  -- Markdown do documento
  E'# Laudo Técnico de Vistoria Estrutural\n\n## 1. Identificação\n\n**Solicitante:** [A COMPLETAR: nome do solicitante]\n**Imóvel:** Residência unifamiliar\n**Endereço:** [A COMPLETAR: endereço completo]\n\n## 2. Objeto da Vistoria\n\nVistoria técnica para avaliação do estado de conservação da edificação e identificação de patologias visíveis.\n\n## 3. Metodologia\n\nInspeção visual conforme ABNT NBR 16747:2020 - Inspeção predial.\n\n## 4. Inspeção Visual\n\nForam observadas as seguintes manifestações patológicas:\n- Trincas nas paredes externas (fachada norte)\n- Infiltração no teto do banheiro\n- Desplacamento de pintura na área externa\n\n## 5. Diagnóstico\n\nAs trincas observadas indicam possível movimentação da fundação. A infiltração no banheiro sugere falha na impermeabilização.\n\n**Gravidade:** Médio\n**Urgência:** Recomenda-se intervenção em até 6 meses\n\n## 6. Conclusões e Recomendações\n\n### Conclusões\nA edificação apresenta patologias de gravidade média que requerem intervenção.\n\n### Recomendações\n1. Realizar investigação da fundação\n2. Refazer impermeabilização do banheiro\n3. [A COMPLETAR: orçamento das intervenções]\n\n## 7. Responsável Técnico\n\n**Nome:** [A COMPLETAR: nome do engenheiro]\n**CREA:** [A COMPLETAR: número do CREA]\n**Data:** 11/02/2026',

  -- Resumo executivo
  'Laudo técnico identificou patologias de gravidade média na edificação, incluindo trincas estruturais e infiltrações. Recomenda-se intervenção em até 6 meses para evitar agravamento dos problemas.',

  -- Lista de pendências (JSONB)
  jsonb_build_array(
    jsonb_build_object(
      'section', '1. Identificação',
      'item', 'nome do solicitante',
      'description', 'Incluir nome completo do solicitante do laudo'
    ),
    jsonb_build_object(
      'section', '1. Identificação',
      'item', 'endereço completo',
      'description', 'Incluir endereço completo do imóvel vistoriado'
    ),
    jsonb_build_object(
      'section', '6. Conclusões',
      'item', 'orçamento das intervenções',
      'description', 'Incluir orçamento estimado para as intervenções recomendadas'
    ),
    jsonb_build_object(
      'section', '7. Responsável Técnico',
      'item', 'nome do engenheiro',
      'description', 'Incluir nome completo do engenheiro responsável'
    ),
    jsonb_build_object(
      'section', '7. Responsável Técnico',
      'item', 'número do CREA',
      'description', 'Incluir número de registro no CREA'
    )
  ),

  -- Generated by (deixar null para usar trigger com auth.uid())
  NULL
);

-- Criar segunda versão (revisada)
INSERT INTO project_ia_outputs (
  job_id,
  output_markdown,
  executive_summary,
  pending_items,
  generated_by
)
SELECT
  job_id,
  REPLACE(output_markdown, '[A COMPLETAR: nome do solicitante]', 'João Silva'),
  executive_summary,
  pending_items - 0, -- Remove primeiro item da lista
  generated_by
FROM project_ia_outputs
WHERE job_id = 'seu-job-uuid-aqui'
AND version = 1;

-- ========================================
-- 5. CONSULTAR OUTPUTS
-- ========================================

-- Último output de um job
SELECT * FROM get_latest_output('seu-job-uuid-aqui');

-- Todas as versões de um job
SELECT
  version,
  created_at,
  word_count,
  section_count,
  placeholders_count,
  reviewed_by IS NOT NULL as foi_revisado
FROM project_ia_outputs
WHERE job_id = 'seu-job-uuid-aqui'
ORDER BY version DESC;

-- Output com detalhes
SELECT * FROM project_ia_outputs_detail
WHERE job_id = 'seu-job-uuid-aqui'
ORDER BY version DESC;

-- Outputs por projeto
SELECT
  j.project_name,
  o.version,
  o.word_count,
  o.placeholders_count,
  o.created_at
FROM project_ia_outputs o
INNER JOIN project_ia_jobs j ON j.id = o.job_id
WHERE j.project_id = 'seu-projeto-uuid-aqui'
ORDER BY o.created_at DESC;

-- Estatísticas de outputs
SELECT
  COUNT(*) as total_outputs,
  COUNT(DISTINCT job_id) as total_jobs,
  AVG(word_count) as media_palavras,
  AVG(section_count) as media_secoes,
  AVG(placeholders_count) as media_pendencias,
  SUM(CASE WHEN placeholders_count = 0 THEN 1 ELSE 0 END) as outputs_completos,
  SUM(CASE WHEN placeholders_count > 0 THEN 1 ELSE 0 END) as outputs_com_pendencias
FROM project_ia_outputs;

-- ========================================
-- 6. GERENCIAR ARQUIVOS
-- ========================================

-- Registrar arquivo anexado
INSERT INTO project_ia_job_files (
  job_id,
  storage_path,
  file_name,
  mime_type,
  file_size,
  uploaded_by
) VALUES (
  'seu-job-uuid-aqui',
  'seu-job-uuid-aqui/planta.pdf',
  'planta.pdf',
  'application/pdf',
  1024768,
  auth.uid()
);

-- Listar arquivos de um job
SELECT
  file_name,
  mime_type,
  ROUND(file_size / 1024.0 / 1024.0, 2) as tamanho_mb,
  created_at
FROM project_ia_job_files
WHERE job_id = 'seu-job-uuid-aqui'
ORDER BY created_at DESC;

-- Arquivos por tipo
SELECT
  CASE
    WHEN mime_type LIKE 'image/%' THEN 'Imagem'
    WHEN mime_type = 'application/pdf' THEN 'PDF'
    WHEN mime_type LIKE '%document%' THEN 'Documento'
    ELSE 'Outro'
  END as tipo,
  COUNT(*) as quantidade,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as tamanho_total_mb
FROM project_ia_job_files
GROUP BY tipo
ORDER BY quantidade DESC;

-- ========================================
-- 7. ESTATÍSTICAS GERAIS
-- ========================================

-- Resumo do sistema
SELECT
  (SELECT COUNT(*) FROM project_ia_jobs) as total_jobs,
  (SELECT COUNT(*) FROM project_ia_jobs WHERE status = 'completed') as jobs_completos,
  (SELECT COUNT(*) FROM project_ia_jobs WHERE status = 'pending') as jobs_pendentes,
  (SELECT COUNT(*) FROM project_ia_jobs WHERE status = 'processing') as jobs_processando,
  (SELECT COUNT(*) FROM project_ia_jobs WHERE status = 'failed') as jobs_falhos,
  (SELECT COUNT(*) FROM project_ia_outputs) as total_outputs,
  (SELECT COUNT(*) FROM project_ia_job_files) as total_arquivos,
  (SELECT ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) FROM project_ia_job_files) as tamanho_arquivos_mb;

-- Jobs por template
SELECT
  t.name as template,
  t.ia_doc_type as tipo,
  COUNT(j.id) as total_jobs,
  COUNT(CASE WHEN j.status = 'completed' THEN 1 END) as completos,
  AVG(j.processing_time_seconds) as tempo_medio_segundos
FROM project_ia_jobs j
INNER JOIN ai_document_templates t ON t.id = j.template_id
GROUP BY t.id, t.name, t.ia_doc_type
ORDER BY total_jobs DESC;

-- Jobs por cliente
SELECT
  c.name as cliente,
  COUNT(j.id) as total_jobs,
  COUNT(o.id) as total_outputs,
  SUM(o.word_count) as total_palavras_geradas
FROM project_ia_jobs j
INNER JOIN customers c ON c.id = j.customer_id
LEFT JOIN project_ia_outputs o ON o.job_id = j.id
GROUP BY c.id, c.name
ORDER BY total_jobs DESC;

-- Performance de processamento
SELECT
  DATE(completed_at) as data,
  COUNT(*) as jobs_completos,
  AVG(processing_time_seconds) as tempo_medio_seg,
  MIN(processing_time_seconds) as tempo_minimo_seg,
  MAX(processing_time_seconds) as tempo_maximo_seg,
  SUM(tokens_used) as total_tokens
FROM project_ia_jobs
WHERE status = 'completed'
AND completed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(completed_at)
ORDER BY data DESC;

-- ========================================
-- 8. LIMPEZA E MANUTENÇÃO
-- ========================================

-- Deletar job de teste (cascade deleta files e outputs)
DELETE FROM project_ia_jobs
WHERE briefing LIKE '%TESTE%'
AND created_at < now() - INTERVAL '1 hour';

-- Deletar jobs muito antigos com erro
DELETE FROM project_ia_jobs
WHERE status = 'failed'
AND created_at < now() - INTERVAL '90 days';

-- Listar jobs órfãos (projeto deletado)
SELECT * FROM project_ia_jobs
WHERE project_id NOT IN (SELECT id FROM engineering_projects);

-- Reprocessar job falhado
UPDATE project_ia_jobs
SET
  status = 'pending',
  error_message = NULL,
  progress = 0,
  started_at = NULL
WHERE id = 'seu-job-uuid-aqui'
AND status = 'failed';

-- ========================================
-- 9. VALIDAÇÕES
-- ========================================

-- Verificar integridade dos jobs
SELECT
  'Jobs sem projeto' as tipo,
  COUNT(*) as quantidade
FROM project_ia_jobs
WHERE project_id NOT IN (SELECT id FROM engineering_projects)
UNION ALL
SELECT
  'Jobs sem template',
  COUNT(*)
FROM project_ia_jobs
WHERE template_id NOT IN (SELECT id FROM ai_document_templates)
UNION ALL
SELECT
  'Jobs sem cliente',
  COUNT(*)
FROM project_ia_jobs
WHERE customer_id NOT IN (SELECT id FROM customers)
UNION ALL
SELECT
  'Outputs sem job',
  COUNT(*)
FROM project_ia_outputs
WHERE job_id NOT IN (SELECT id FROM project_ia_jobs)
UNION ALL
SELECT
  'Arquivos sem job',
  COUNT(*)
FROM project_ia_job_files
WHERE job_id NOT IN (SELECT id FROM project_ia_jobs);

-- Verificar jobs com progresso inconsistente
SELECT * FROM project_ia_jobs
WHERE status = 'completed'
AND progress < 100;

SELECT * FROM project_ia_jobs
WHERE status = 'processing'
AND started_at IS NULL;

-- Verificar outputs sem placeholders sendo calculados
SELECT
  id,
  version,
  placeholders_count,
  count_placeholders(output_markdown) as real_count
FROM project_ia_outputs
WHERE placeholders_count != count_placeholders(output_markdown);

-- ========================================
-- 10. EXEMPLOS DE USO COMPLETO
-- ========================================

-- Workflow completo: criar job e processar
DO $$
DECLARE
  v_job_id uuid;
  v_output_id uuid;
BEGIN
  -- 1. Criar job
  SELECT create_project_ia_job(
    (SELECT id FROM engineering_projects LIMIT 1),
    (SELECT id FROM ai_document_templates WHERE ia_enabled = true LIMIT 1),
    'Laudo técnico de teste',
    '{"q1": "Residencial"}'::jsonb
  ) INTO v_job_id;

  RAISE NOTICE 'Job criado: %', v_job_id;

  -- 2. Marcar como processando
  UPDATE project_ia_jobs
  SET status = 'processing', started_at = now()
  WHERE id = v_job_id;

  -- 3. Criar output
  INSERT INTO project_ia_outputs (
    job_id,
    output_markdown,
    executive_summary,
    pending_items
  ) VALUES (
    v_job_id,
    '# Documento de Teste\n\nConteúdo aqui.',
    'Resumo de teste',
    '[]'::jsonb
  )
  RETURNING id INTO v_output_id;

  RAISE NOTICE 'Output criado: %', v_output_id;
  RAISE NOTICE 'Job automaticamente marcado como completed!';
END $$;
