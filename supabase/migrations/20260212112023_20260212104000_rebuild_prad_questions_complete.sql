/*
  # Reconstruir perguntas do template PRAD com campos pré-preenchíveis
  
  1. Alterações
    - Reconstrói array completo de perguntas
    - Adiciona campos para telefone, email, município, documentos
    - Adiciona campos para responsável técnico completo
    - Adiciona campos para bioma e legislação
    - Mantém ordem lógica: dados básicos → localização → documentos → responsável → técnico
    
  2. Objetivo
    - Permitir pré-preenchimento automático de 17 campos
    - Melhorar experiência do usuário
*/

UPDATE engineering_service_templates
SET ia_intake_questions = '[
  {
    "key": "empreendedor_nome",
    "type": "text",
    "question": "Nome completo ou razão social do empreendedor/proprietário",
    "required": true
  },
  {
    "key": "empreendedor_cpf_cnpj",
    "type": "text",
    "question": "CPF ou CNPJ do empreendedor",
    "required": true
  },
  {
    "key": "empreendedor_telefone",
    "type": "text",
    "question": "Telefone do empreendedor",
    "required": false
  },
  {
    "key": "empreendedor_email",
    "type": "text",
    "question": "E-mail do empreendedor",
    "required": false
  },
  {
    "key": "localizacao_imovel",
    "type": "text",
    "question": "Endereço completo do imóvel (logradouro, município, UF)",
    "required": true
  },
  {
    "key": "municipio",
    "type": "text",
    "question": "Município do imóvel",
    "required": true
  },
  {
    "key": "estado",
    "type": "text",
    "question": "Estado (UF)",
    "required": true
  },
  {
    "key": "matricula_imovel",
    "type": "text",
    "question": "Matrícula do imóvel",
    "required": false
  },
  {
    "key": "ccir",
    "type": "text",
    "question": "CCIR (Certificado de Cadastro de Imóvel Rural)",
    "required": false
  },
  {
    "key": "car",
    "type": "text",
    "question": "CAR (Cadastro Ambiental Rural)",
    "required": false
  },
  {
    "key": "itr",
    "type": "text",
    "question": "ITR/CIB (Imposto Territorial Rural)",
    "required": false
  },
  {
    "key": "bioma",
    "type": "text",
    "question": "Bioma onde está localizado o imóvel",
    "required": false
  },
  {
    "key": "legislacao_aplicavel",
    "type": "text",
    "question": "Legislação ambiental aplicável (estadual/municipal)",
    "required": false
  },
  {
    "key": "responsavel_tecnico",
    "type": "text",
    "question": "Nome do responsável técnico",
    "required": true
  },
  {
    "key": "registro_profissional",
    "type": "text",
    "question": "Número do registro profissional",
    "required": true
  },
  {
    "key": "conselho_classe",
    "type": "text",
    "question": "Conselho de classe (CREA/CAU/etc)",
    "required": false
  },
  {
    "key": "especialidade_tecnico",
    "type": "text",
    "question": "Especialidade do responsável técnico",
    "required": false
  },
  {
    "key": "area_degradada_ha",
    "type": "number",
    "question": "Área degradada (em hectares)",
    "required": true
  },
  {
    "key": "tipo_degradacao",
    "type": "text",
    "question": "Tipo de degradação (erosão, desmatamento, mineração, queimada, etc.)",
    "required": true
  },
  {
    "key": "causas_degradacao",
    "type": "text",
    "question": "Causas da degradação",
    "required": true
  },
  {
    "key": "situacao_legal",
    "type": "text",
    "question": "Situação legal (APP, RL, área de uso consolidado, etc.)",
    "required": true
  },
  {
    "key": "uso_anterior",
    "type": "text",
    "question": "Uso anterior da área",
    "required": false
  },
  {
    "key": "uso_atual",
    "type": "text",
    "question": "Uso atual da área",
    "required": false
  },
  {
    "key": "solo_caracterizacao",
    "type": "text",
    "question": "Caracterização do solo (tipo, textura, profundidade, permeabilidade)",
    "required": false
  },
  {
    "key": "relevo_declividade",
    "type": "text",
    "question": "Relevo e declividade média (%)",
    "required": false
  },
  {
    "key": "hidrologia",
    "type": "text",
    "question": "Caracterização hidrológica (cursos d água, nascentes, drenagem)",
    "required": false
  },
  {
    "key": "vegetacao_remanescente",
    "type": "text",
    "question": "Descrição da vegetação remanescente (espécies, porte, cobertura)",
    "required": false
  },
  {
    "key": "fauna_observada",
    "type": "text",
    "question": "Fauna observada ou potencial",
    "required": false
  },
  {
    "key": "riscos_ambientais",
    "type": "text",
    "question": "Riscos ambientais identificados (erosão ativa, assoreamento, contaminação, etc.)",
    "required": false
  },
  {
    "key": "tecnicas_recuperacao",
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
    "question": "Selecione as técnicas de recuperação a incluir (múltipla escolha)",
    "required": true
  },
  {
    "key": "outras_tecnicas",
    "type": "text",
    "question": "Se selecionou Outros, descreva as técnicas adicionais",
    "required": false
  },
  {
    "key": "especies_revegetacao",
    "type": "text",
    "question": "Liste as espécies nativas para revegetação (se aplicável)",
    "required": false
  },
  {
    "key": "medidas_emergenciais",
    "type": "text",
    "question": "Há necessidade de medidas emergenciais? Se sim, descreva.",
    "required": false
  },
  {
    "key": "cronograma_meses",
    "type": "number",
    "question": "Duração estimada do cronograma de execução (em meses)",
    "required": true
  },
  {
    "key": "indicadores_monitoramento",
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
    "question": "Selecione os indicadores de monitoramento (múltipla escolha)",
    "required": true
  },
  {
    "key": "outros_indicadores",
    "type": "text",
    "question": "Se selecionou Outros em indicadores, descreva",
    "required": false
  },
  {
    "key": "frequencia_monitoramento",
    "type": "text",
    "question": "Frequência do monitoramento (ex: trimestral, semestral, anual)",
    "required": true
  },
  {
    "key": "custo_estimado",
    "type": "number",
    "question": "Custo estimado total do projeto (R$)",
    "required": false
  },
  {
    "key": "observacoes_gerais",
    "type": "text",
    "question": "Observações gerais ou informações adicionais",
    "required": false
  },
  {
    "key": "relatorio_fotografico",
    "type": "file",
    "accept": ".pdf,.jpg,.jpeg,.png,.zip",
    "question": "Anexe relatório fotográfico georreferenciado (obrigatório) - PDF com fotos e coordenadas",
    "required": true
  },
  {
    "key": "geolocalizacao_area",
    "type": "file",
    "accept": ".kml,.kmz,.shp,.zip",
    "question": "Anexe geolocalização/polígono KML ou shapefile da área (obrigatório)",
    "required": true
  }
]'::jsonb
WHERE document_type = 'prad';