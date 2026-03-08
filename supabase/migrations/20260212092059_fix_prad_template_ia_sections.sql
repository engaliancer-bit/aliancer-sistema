/*
  # Correção: Sincronizar configuração IA do template PRAD

  ## Problema
  O template PRAD em `ai_document_templates` estava com `ia_sections` vazio ([]),
  causando geração de documentos sem conteúdo técnico (apenas cabeçalho e anexos).
  
  A configuração completa existia em `engineering_service_templates` mas não
  estava sincronizada com `ai_document_templates`.

  ## Solução
  Copiar campos IA de `engineering_service_templates` para `ai_document_templates`:
  - ia_sections (12 seções estruturadas)
  - ia_intake_questions (29 perguntas)
  - ia_rules (15 regras de geração)
  
  ## Resultado
  Template PRAD agora tem estrutura completa para gerar documentos técnicos
  com diagnóstico, plano de intervenção, cronograma e monitoramento.
  
  ## Segurança
  - Apenas atualiza campos de configuração
  - Não afeta RLS ou dados de usuários
*/

-- Sincronizar configuração IA do template PRAD
UPDATE ai_document_templates
SET 
  -- Copiar 12 seções estruturadas
  ia_sections = (
    SELECT ia_sections 
    FROM engineering_service_templates 
    WHERE name ILIKE '%PRAD%' 
    LIMIT 1
  ),
  
  -- Copiar 29 perguntas de intake
  ia_intake_questions = (
    SELECT ia_intake_questions 
    FROM engineering_service_templates 
    WHERE name ILIKE '%PRAD%' 
    LIMIT 1
  ),
  
  -- Atualizar guia de estilo
  ia_style_guide = 'Tom técnico e profissional. Linguagem clara e objetiva conforme padrões da Aliancer Engenharia. Seguir rigorosamente as 12 seções estruturadas do PRAD. Incluir obrigatoriamente relatório fotográfico georreferenciado e geolocalização KML.',
  
  -- Copiar regras de geração
  ia_rules = (
    SELECT ia_rules 
    FROM engineering_service_templates 
    WHERE name ILIKE '%PRAD%' 
    LIMIT 1
  ),
  
  updated_at = now()
  
WHERE name ILIKE '%PRAD%';

-- Verificar resultado
DO $$
DECLARE
  v_sections_count integer;
  v_questions_count integer;
BEGIN
  SELECT 
    jsonb_array_length(ia_sections),
    jsonb_array_length(ia_intake_questions)
  INTO v_sections_count, v_questions_count
  FROM ai_document_templates
  WHERE name ILIKE '%PRAD%'
  LIMIT 1;
  
  RAISE NOTICE 'Template PRAD atualizado: % seções, % perguntas', v_sections_count, v_questions_count;
  
  IF v_sections_count != 12 OR v_questions_count != 29 THEN
    RAISE EXCEPTION 'Erro: template não foi atualizado corretamente';
  END IF;
END $$;
