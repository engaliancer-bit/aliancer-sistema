/*
  # Adicionar perguntas faltantes ao template PRAD
  
  1. Alterações
    - Adiciona perguntas para telefone, email, município, documentos do imóvel
    - Adiciona perguntas para bioma, estado, legislação
    - Adiciona perguntas para conselho e especialidade do responsável técnico
    - Mantém ordem lógica das perguntas
    
  2. Objetivo
    - Permitir pré-preenchimento de mais campos automaticamente
    - Melhorar experiência do usuário
*/

UPDATE engineering_service_templates
SET ia_intake_questions = jsonb_set(
  ia_intake_questions,
  '{2}',
  '{
    "key": "empreendedor_telefone",
    "type": "text",
    "question": "Telefone do empreendedor",
    "required": false
  }'::jsonb,
  true
)
WHERE document_type = 'prad';

UPDATE engineering_service_templates
SET ia_intake_questions = jsonb_set(
  ia_intake_questions,
  '{3}',
  '{
    "key": "empreendedor_email",
    "type": "text",
    "question": "E-mail do empreendedor",
    "required": false
  }'::jsonb,
  true
)
WHERE document_type = 'prad';

-- Inserir perguntas após localizacao_imovel (posição 4)
UPDATE engineering_service_templates
SET ia_intake_questions = ia_intake_questions || '[
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
  }
]'::jsonb
WHERE document_type = 'prad';

-- Adicionar perguntas após registro_profissional
UPDATE engineering_service_templates
SET ia_intake_questions = ia_intake_questions || '[
  {
    "key": "conselho_classe",
    "type": "text",
    "question": "Conselho de classe (CREA/CAU)",
    "required": false
  },
  {
    "key": "especialidade_tecnico",
    "type": "text",
    "question": "Especialidade do responsável técnico",
    "required": false
  }
]'::jsonb
WHERE document_type = 'prad';

-- Adicionar perguntas de contexto ambiental
UPDATE engineering_service_templates
SET ia_intake_questions = ia_intake_questions || '[
  {
    "key": "bioma",
    "type": "text",
    "question": "Bioma onde está localizado o imóvel",
    "required": false
  },
  {
    "key": "legislacao_aplicavel",
    "type": "text",
    "question": "Legislação ambiental aplicável",
    "required": false
  }
]'::jsonb
WHERE document_type = 'prad';