/*
  # Sistema de pré-preenchimento inteligente para PRAD

  ## Descrição
  Cria sistema que preenche automaticamente dados do PRAD baseado em:
  - Dados do cliente (nome, CPF/CNPJ, endereço)
  - Dados do imóvel (localização, matrícula)
  - Responsável técnico da empresa
  - Inferência de bioma baseada no município
  - Inferência de tipo de degradação baseada no briefing

  ## Alterações
  1. Funções para mapear município → bioma
  2. Funções para inferir dados do briefing
  3. Função para obter responsável técnico padrão
  4. View com dados pré-preenchidos do projeto

  ## Segurança
  - Funções públicas para uso na Edge Function
  - View com RLS herdado das tabelas base
*/

-- Função para mapear município de SC → bioma
CREATE OR REPLACE FUNCTION get_bioma_from_municipio(municipio TEXT)
RETURNS TEXT AS $$
BEGIN
  IF municipio ILIKE ANY(ARRAY[
    '%Bom Jesus%', '%Lages%', '%São Joaquim%', 
    '%Urubici%', '%Urupema%', '%Painel%'
  ]) THEN
    RETURN 'Mata Atlântica (Floresta Ombrófila Mista)';
  ELSIF municipio ILIKE '%Florianópolis%' OR municipio ILIKE '%litoral%' THEN
    RETURN 'Mata Atlântica (Floresta Ombrófila Densa)';
  ELSE
    RETURN 'Mata Atlântica';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para inferir tipo de degradação do briefing
CREATE OR REPLACE FUNCTION infer_degradation_type_from_briefing(briefing TEXT)
RETURNS TEXT AS $$
DECLARE
  degradation_types TEXT[] := '{}';
BEGIN
  IF briefing ILIKE '%supressão%' OR briefing ILIKE '%supressao%' THEN
    degradation_types := array_append(degradation_types, 'Supressão de vegetação nativa');
  END IF;
  
  IF briefing ILIKE '%erosão%' OR briefing ILIKE '%erosao%' THEN
    degradation_types := array_append(degradation_types, 'Erosão');
  END IF;
  
  IF briefing ILIKE '%desmatamento%' THEN
    degradation_types := array_append(degradation_types, 'Desmatamento');
  END IF;
  
  IF briefing ILIKE '%mineração%' OR briefing ILIKE '%mineracao%' THEN
    degradation_types := array_append(degradation_types, 'Mineração');
  END IF;
  
  IF briefing ILIKE '%queimada%' THEN
    degradation_types := array_append(degradation_types, 'Queimada');
  END IF;
  
  IF briefing ILIKE '%conversão%' OR briefing ILIKE '%conversao%' THEN
    degradation_types := array_append(degradation_types, 'Conversão de uso do solo');
  END IF;
  
  IF array_length(degradation_types, 1) > 0 THEN
    RETURN array_to_string(degradation_types, ', ');
  ELSE
    RETURN 'Degradação ambiental';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para inferir causas da degradação do briefing
CREATE OR REPLACE FUNCTION infer_degradation_causes_from_briefing(briefing TEXT)
RETURNS TEXT AS $$
DECLARE
  causes TEXT[] := '{}';
BEGIN
  IF briefing ILIKE '%supressão%' OR briefing ILIKE '%supressao%' THEN
    causes := array_append(causes, 'Remoção de cobertura vegetal nativa');
  END IF;
  
  IF briefing ILIKE '%agricultura%' OR briefing ILIKE '%agrícola%' THEN
    causes := array_append(causes, 'Atividade agrícola');
  END IF;
  
  IF briefing ILIKE '%pecuária%' OR briefing ILIKE '%pecuaria%' THEN
    causes := array_append(causes, 'Atividade pecuária');
  END IF;
  
  IF briefing ILIKE '%construção%' OR briefing ILIKE '%construcao%' OR briefing ILIKE '%obra%' THEN
    causes := array_append(causes, 'Construção civil');
  END IF;
  
  IF briefing ILIKE '%estrada%' OR briefing ILIKE '%via%' OR briefing ILIKE '%acesso%' THEN
    causes := array_append(causes, 'Abertura de vias de acesso');
  END IF;
  
  IF array_length(causes, 1) > 0 THEN
    RETURN array_to_string(causes, '; ');
  ELSE
    RETURN 'Ação antrópica';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para inferir situação legal baseada no briefing
CREATE OR REPLACE FUNCTION infer_legal_situation_from_briefing(briefing TEXT)
RETURNS TEXT AS $$
BEGIN
  IF briefing ILIKE '%APP%' THEN
    RETURN 'Área de Preservação Permanente (APP)';
  ELSIF briefing ILIKE '%reserva legal%' OR briefing ILIKE '%RL%' THEN
    RETURN 'Reserva Legal (RL)';
  ELSIF briefing ILIKE '%uso consolidado%' THEN
    RETURN 'Área de uso consolidado';
  ELSIF briefing ILIKE '%regularização%' OR briefing ILIKE '%regularizacao%' THEN
    RETURN 'Área em processo de regularização ambiental';
  ELSE
    RETURN 'Área rural com necessidade de recuperação ambiental';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função auxiliar para pegar responsável técnico padrão
CREATE OR REPLACE FUNCTION get_default_technical_responsible()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT elem INTO result
  FROM company_settings,
       LATERAL jsonb_array_elements(technical_responsibles) elem
  WHERE (elem->>'is_default')::boolean = true
  LIMIT 1;
  
  IF result IS NULL THEN
    SELECT technical_responsibles->0 INTO result
    FROM company_settings
    WHERE technical_responsibles IS NOT NULL
      AND jsonb_array_length(technical_responsibles) > 0
    LIMIT 1;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- View com dados pré-preenchidos para PRAD
CREATE OR REPLACE VIEW prad_prefilled_data AS
SELECT
  ep.id as project_id,
  ep.name as project_name,
  ep.property_id,
  ep.customer_id,
  
  -- Dados do cliente
  c.name as customer_name,
  c.cpf as customer_document,
  c.person_type,
  TRIM(COALESCE(
    NULLIF(c.street, '') || ', ' || NULLIF(c.neighborhood, '') || ', ' || NULLIF(c.city, ''),
    NULLIF(c.street, '') || ', ' || NULLIF(c.city, ''),
    NULLIF(c.city, ''),
    ''
  )) as customer_address,
  c.city as customer_city,
  c.phone,
  c.email,
  c.marital_status_type,
  c.spouse_name,
  c.spouse_cpf,
  
  -- Dados do imóvel
  p.name as property_name,
  p.registration_number,
  p.property_type,
  p.municipality as property_municipality,
  p.state as property_state,
  p.ccir,
  p.car_receipt_code,
  p.municipal_registration,
  p.itr_cib,
  
  -- Inferência de bioma
  get_bioma_from_municipio(p.municipality) as bioma,
  
  -- Estado para inferir legislação
  CASE 
    WHEN p.state = 'SC' THEN 'Santa Catarina - Legislação: Lei 14.675/2009 (Código Ambiental de SC)'
    WHEN p.state = 'PR' THEN 'Paraná'
    WHEN p.state = 'RS' THEN 'Rio Grande do Sul'
    ELSE p.state
  END as state_with_legislation,
  
  -- Responsável técnico padrão
  get_default_technical_responsible() as default_technical_responsible,
  
  -- Todos responsáveis técnicos disponíveis
  (SELECT technical_responsibles FROM company_settings WHERE technical_responsibles IS NOT NULL LIMIT 1) as available_technical_responsibles
  
FROM engineering_projects ep
INNER JOIN customers c ON ep.customer_id = c.id
INNER JOIN properties p ON ep.property_id = p.id
WHERE ep.id IS NOT NULL;

COMMENT ON VIEW prad_prefilled_data IS 
'View que retorna dados pré-preenchidos para geração de PRAD, incluindo inferências automáticas de bioma, legislação e tipo de degradação';

GRANT SELECT ON prad_prefilled_data TO anon, authenticated;
