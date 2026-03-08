/*
  # Atualizar template PRAD com estrutura completa de IA

  1. Alterações
    - Atualiza o template PRAD com:
      - 12 seções estruturadas (ia_sections)
      - Perguntas de intake com seleção múltipla (ia_intake_questions)
      - Campos obrigatórios incluindo relatório fotográfico e geolocalização (ia_required_inputs)
      - Checklist completo (ia_checklist_items)
      - Regras da IA (ia_rules)
    
  2. Características
    - Relatório fotográfico georreferenciado obrigatório
    - Geolocalização/polígono KML obrigatório
    - Seleção rápida de técnicas de recuperação
    - Seleção rápida de indicadores de monitoramento
*/

-- Atualizar template PRAD com estrutura completa
UPDATE engineering_service_templates
SET 
  description = 'Projeto de Recuperação de Área Degradada com diagnóstico, plano de intervenção, monitoramento e relatório fotográfico georreferenciado.',
  
  -- 12 Seções estruturadas do documento
  ia_sections = '[
    {
      "order": 1,
      "title": "1. Identificação do Empreendimento e Responsável Técnico",
      "description": "Dados cadastrais do empreendedor, localização do imóvel, responsável técnico (CREA/CAU) e contatos",
      "type": "cadastral"
    },
    {
      "order": 2,
      "title": "2. Objetivo e Escopo do PRAD",
      "description": "Objetivo geral, justificativa da recuperação e escopo das intervenções propostas",
      "type": "text"
    },
    {
      "order": 3,
      "title": "3. Dados de Entrada e Caracterização da Área",
      "description": "Localização (coordenadas/KML), área degradada (ha), tipo de degradação, causas, situação legal, uso anterior e atual",
      "type": "data"
    },
    {
      "order": 4,
      "title": "4. Diagnóstico Ambiental",
      "description": "Caracterização do meio físico (solo, relevo, hidrologia), meio biótico (flora, fauna) e meio antrópico (uso do solo). Incluir relatório fotográfico georreferenciado",
      "type": "diagnostic"
    },
    {
      "order": 5,
      "title": "5. Avaliação de Riscos e Vulnerabilidades",
      "description": "Riscos ambientais identificados (erosão, assoreamento, contaminação) e vulnerabilidades locais",
      "type": "analysis"
    },
    {
      "order": 6,
      "title": "6. Plano de Intervenção e Técnicas de Recuperação",
      "description": "Detalhamento das técnicas selecionadas: bioengenharia, contenções, drenagem, revegetação, hidrossemeadura, etc. Incluir memorial descritivo e quantitativos",
      "type": "plan"
    },
    {
      "order": 7,
      "title": "7. Medidas Emergenciais (se aplicável)",
      "description": "Ações imediatas necessárias para estabilização da área ou contenção de riscos",
      "type": "emergency"
    },
    {
      "order": 8,
      "title": "8. Cronograma de Execução",
      "description": "Cronograma físico das atividades de recuperação (em meses ou anos)",
      "type": "schedule"
    },
    {
      "order": 9,
      "title": "9. Plano de Monitoramento e Indicadores",
      "description": "Indicadores selecionados (cobertura vegetal, estabilidade de taludes, qualidade da água, biodiversidade, erosão ativa), métodos de medição e frequência de monitoramento",
      "type": "monitoring"
    },
    {
      "order": 10,
      "title": "10. Custos Estimados",
      "description": "Orçamento estimado das intervenções e monitoramento",
      "type": "budget"
    },
    {
      "order": 11,
      "title": "11. Considerações Finais e Recomendações",
      "description": "Conclusões e recomendações técnicas",
      "type": "conclusion"
    },
    {
      "order": 12,
      "title": "12. Anexos",
      "description": "Relatório fotográfico georreferenciado, geolocalização/polígono KML, mapas, laudos, ART/RRT, outros documentos pertinentes",
      "type": "attachments"
    }
  ]'::jsonb,
  
  -- Perguntas de coleta com seleção rápida
  ia_intake_questions = '[
    {
      "key": "empreendedor_nome",
      "question": "Nome completo ou razão social do empreendedor/proprietário",
      "type": "text",
      "required": true
    },
    {
      "key": "empreendedor_cpf_cnpj",
      "question": "CPF ou CNPJ do empreendedor",
      "type": "text",
      "required": true
    },
    {
      "key": "localizacao_imovel",
      "question": "Endereço completo do imóvel (logradouro, município, UF)",
      "type": "text",
      "required": true
    },
    {
      "key": "responsavel_tecnico",
      "question": "Nome do responsável técnico",
      "type": "text",
      "required": true
    },
    {
      "key": "registro_profissional",
      "question": "Registro profissional (CREA/CAU)",
      "type": "text",
      "required": true
    },
    {
      "key": "area_degradada_ha",
      "question": "Área degradada (em hectares)",
      "type": "number",
      "required": true
    },
    {
      "key": "tipo_degradacao",
      "question": "Tipo de degradação (erosão, desmatamento, mineração, queimada, etc.)",
      "type": "text",
      "required": true
    },
    {
      "key": "causas_degradacao",
      "question": "Causas da degradação",
      "type": "text",
      "required": true
    },
    {
      "key": "situacao_legal",
      "question": "Situação legal (APP, RL, área de uso consolidado, etc.)",
      "type": "text",
      "required": true
    },
    {
      "key": "uso_anterior",
      "question": "Uso anterior da área",
      "type": "text",
      "required": false
    },
    {
      "key": "uso_atual",
      "question": "Uso atual da área",
      "type": "text",
      "required": false
    },
    {
      "key": "solo_caracterizacao",
      "question": "Caracterização do solo (tipo, textura, profundidade, permeabilidade)",
      "type": "text",
      "required": false
    },
    {
      "key": "relevo_declividade",
      "question": "Relevo e declividade média (%)",
      "type": "text",
      "required": false
    },
    {
      "key": "hidrologia",
      "question": "Caracterização hidrológica (cursos d''água, nascentes, drenagem)",
      "type": "text",
      "required": false
    },
    {
      "key": "vegetacao_remanescente",
      "question": "Descrição da vegetação remanescente (espécies, porte, cobertura)",
      "type": "text",
      "required": false
    },
    {
      "key": "fauna_observada",
      "question": "Fauna observada ou potencial",
      "type": "text",
      "required": false
    },
    {
      "key": "riscos_ambientais",
      "question": "Riscos ambientais identificados (erosão ativa, assoreamento, contaminação, etc.)",
      "type": "text",
      "required": false
    },
    {
      "key": "tecnicas_recuperacao",
      "question": "Selecione as técnicas de recuperação a incluir (múltipla escolha)",
      "type": "multiple_choice",
      "options": [
        "Bioengenharia (geomantas, paliçadas, fascinas)",
        "Contenções estruturais (muros, gabiões)",
        "Sistema de drenagem e controle de erosão",
        "Revegetação com espécies nativas",
        "Hidrossemeadura",
        "Correção e adubação do solo",
        "Isolamento da área",
        "Controle de espécies exóticas invasoras",
        "Outros"
      ],
      "required": true
    },
    {
      "key": "outras_tecnicas",
      "question": "Se selecionou ''Outros'', descreva as técnicas adicionais",
      "type": "text",
      "required": false
    },
    {
      "key": "especies_revegetacao",
      "question": "Liste as espécies nativas para revegetação (se aplicável)",
      "type": "text",
      "required": false
    },
    {
      "key": "medidas_emergenciais",
      "question": "Há necessidade de medidas emergenciais? Se sim, descreva.",
      "type": "text",
      "required": false
    },
    {
      "key": "cronograma_meses",
      "question": "Duração estimada do cronograma de execução (em meses)",
      "type": "number",
      "required": true
    },
    {
      "key": "indicadores_monitoramento",
      "question": "Selecione os indicadores de monitoramento (múltipla escolha)",
      "type": "multiple_choice",
      "options": [
        "Cobertura vegetal (%)",
        "Estabilidade de taludes",
        "Qualidade da água",
        "Biodiversidade (riqueza de espécies)",
        "Erosão ativa",
        "Taxa de sobrevivência de mudas",
        "Regeneração natural",
        "Outros"
      ],
      "required": true
    },
    {
      "key": "outros_indicadores",
      "question": "Se selecionou ''Outros'' em indicadores, descreva",
      "type": "text",
      "required": false
    },
    {
      "key": "frequencia_monitoramento",
      "question": "Frequência do monitoramento (ex: trimestral, semestral, anual)",
      "type": "text",
      "required": true
    },
    {
      "key": "custo_estimado",
      "question": "Custo estimado total do projeto (R$)",
      "type": "number",
      "required": false
    },
    {
      "key": "observacoes_gerais",
      "question": "Observações gerais ou informações adicionais",
      "type": "text",
      "required": false
    },
    {
      "key": "relatorio_fotografico",
      "question": "Anexe relatório fotográfico georreferenciado (obrigatório) - PDF com fotos e coordenadas",
      "type": "file",
      "accept": ".pdf,.jpg,.jpeg,.png,.zip",
      "required": true
    },
    {
      "key": "geolocalizacao_area",
      "question": "Anexe geolocalização/polígono KML ou shapefile da área (obrigatório)",
      "type": "file",
      "accept": ".kml,.kmz,.shp,.zip",
      "required": true
    }
  ]'::jsonb,
  
  -- Inputs obrigatórios
  ia_required_inputs = '[
    "empreendedor_nome",
    "empreendedor_cpf_cnpj",
    "localizacao_imovel",
    "responsavel_tecnico",
    "registro_profissional",
    "area_degradada_ha",
    "tipo_degradacao",
    "causas_degradacao",
    "situacao_legal",
    "tecnicas_recuperacao",
    "cronograma_meses",
    "indicadores_monitoramento",
    "frequencia_monitoramento",
    "relatorio_fotografico",
    "geolocalizacao_area"
  ]'::jsonb,
  
  -- Checklist de validação
  ia_checklist_items = '[
    "Relatório fotográfico georreferenciado anexado",
    "Geolocalização/polígono KML da área anexado",
    "Técnicas de recuperação selecionadas",
    "Indicadores de monitoramento selecionados",
    "Dados cadastrais do empreendedor completos",
    "Dados cadastrais do responsável técnico completos",
    "Área degradada quantificada (ha)",
    "Tipo e causas da degradação identificados",
    "Situação legal da área informada",
    "Cronograma de execução definido",
    "Frequência de monitoramento estabelecida"
  ]'::jsonb,
  
  -- Regras para a IA
  ia_rules = '[
    "Seguir rigorosamente o escopo estruturado com as 12 seções na ordem definida.",
    "Preencher cada seção com base nas respostas do usuário e nas seleções de técnicas e indicadores.",
    "Incluir o relatório fotográfico georreferenciado obrigatoriamente na seção 4 (Diagnóstico Ambiental) e na seção 12 (Anexos).",
    "Incluir a geolocalização/polígono KML obrigatoriamente na seção 3 (Dados de Entrada) e na seção 12 (Anexos).",
    "Na seção 6 (Plano de Intervenção), detalhar cada técnica de recuperação selecionada pelo usuário com memorial descritivo e, quando possível, quantitativos estimados.",
    "Na seção 9 (Plano de Monitoramento), detalhar cada indicador selecionado com método de medição, unidade e frequência.",
    "Se o usuário não selecionou alguma técnica ou indicador importante para o contexto, sugerir sua inclusão como recomendação na seção 11 (Considerações Finais).",
    "Não inventar dados técnicos não fornecidos pelo usuário. Quando um dado for essencial e estiver faltando, marcar explicitamente como ''PENDENTE - solicitar ao cliente''.",
    "Se medidas emergenciais foram indicadas, criar uma seção 7 dedicada. Caso contrário, omitir ou marcar como ''Não aplicável''.",
    "Descrever as fotos do relatório fotográfico na seção 4, indicando pontos de interesse e coordenadas geográficas.",
    "Gerar cronograma na seção 8 com base na duração informada, distribuindo as atividades de forma coerente (ex: preparação de terreno, plantio, monitoramento).",
    "Na seção 10 (Custos), se o usuário não forneceu orçamento detalhado, apresentar um orçamento estimado genérico ou marcar como ''A definir''.",
    "Utilizar linguagem técnica adequada para documentos ambientais e normas brasileiras (NBR, resoluções CONAMA, legislação estadual aplicável).",
    "Sempre referenciar a legislação ambiental pertinente (ex: Lei 12.651/2012 - Código Florestal, resoluções CONAMA sobre recuperação de áreas degradadas).",
    "Ao final, incluir assinatura do responsável técnico com nome, registro profissional e ART/RRT na seção de identificação ou anexos."
  ]'::jsonb,
  
  updated_at = now()

WHERE name ILIKE '%PRAD%';
