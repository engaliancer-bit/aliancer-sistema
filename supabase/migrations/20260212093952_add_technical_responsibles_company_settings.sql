/*
  # Adicionar responsáveis técnicos à configuração da empresa

  ## Descrição
  Permite cadastrar múltiplos responsáveis técnicos (engenheiros, arquitetos)
  com seus respectivos registros profissionais (CREA, CAU, etc.) na
  configuração da empresa. Estes responsáveis poderão ser selecionados
  ao gerar documentos técnicos como PRAD.

  ## Alterações
  1. Adicionar campo `technical_responsibles` em company_settings
     - Array de objetos JSONB contendo:
       - id: UUID único
       - name: Nome completo
       - registration: Registro profissional (CREA/CAU + número)
       - council: Conselho (CREA-SC, CAU-BR, etc)
       - specialty: Especialidade/área de atuação
       - is_default: Se é o responsável padrão

  ## Segurança
  - Apenas administradores podem modificar
  - RLS já configurado na tabela company_settings
*/

-- Adicionar campo de responsáveis técnicos
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS technical_responsibles JSONB DEFAULT '[]'::jsonb;

-- Inserir exemplo de responsável técnico (se não houver nenhum)
DO $$
BEGIN
  UPDATE company_settings
  SET technical_responsibles = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Responsável Técnico (Configurar)',
      'registration', 'CREA 000000-0',
      'council', 'CREA-SC',
      'specialty', 'Engenharia Civil',
      'is_default', true
    )
  )
  WHERE technical_responsibles = '[]'::jsonb 
    OR technical_responsibles IS NULL;
END $$;

-- Criar índice para busca
CREATE INDEX IF NOT EXISTS idx_company_settings_technical_responsibles 
ON company_settings USING gin(technical_responsibles);

-- Comentário
COMMENT ON COLUMN company_settings.technical_responsibles IS 
'Lista de responsáveis técnicos da empresa com registros profissionais (CREA, CAU, etc) que podem assinar documentos técnicos';
