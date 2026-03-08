/*
  # Adicionar classificação de tipo aos anexos de documentos IA

  ## Descrição
  Permite classificar os arquivos anexados a um job de IA, indicando
  o que cada arquivo representa. Isso facilita o processamento pela IA
  e a organização dos documentos finais.

  ## Alterações
  1. Adicionar campo `file_type` em project_ia_job_files
     - Tipo: ENUM com opções específicas
     - Valores: foto_area_degradada, poligono_imovel, area_prad, 
                relatorio_fotografico, geolocalizacao_kml, outros
  
  2. Adicionar campo `coordinates` para fotos georreferenciadas
     - Latitude e longitude quando disponível
  
  3. Adicionar campo `order_index` para ordenação das fotos no relatório

  ## Segurança
  - RLS já configurado na tabela project_ia_job_files
*/

-- Criar enum para tipo de arquivo
DO $$ BEGIN
  CREATE TYPE ia_file_type AS ENUM (
    'foto_area_degradada',
    'poligono_imovel', 
    'area_prad',
    'relatorio_fotografico_completo',
    'geolocalizacao_kml',
    'mapa_localizacao',
    'laudo_tecnico',
    'art_rrt',
    'outros'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Adicionar campos de classificação
ALTER TABLE project_ia_job_files
ADD COLUMN IF NOT EXISTS file_type ia_file_type DEFAULT 'outros',
ADD COLUMN IF NOT EXISTS coordinates JSONB,
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Comentários
COMMENT ON COLUMN project_ia_job_files.file_type IS 
'Classificação do tipo de arquivo para processamento pela IA';

COMMENT ON COLUMN project_ia_job_files.coordinates IS 
'Coordenadas geográficas da foto (latitude, longitude) quando disponível';

COMMENT ON COLUMN project_ia_job_files.order_index IS 
'Índice de ordenação para relatórios fotográficos';

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_job_files_type 
ON project_ia_job_files(job_id, file_type);
