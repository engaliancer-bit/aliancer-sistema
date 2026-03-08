/*
  # Adicionar Rastreamento de Importação aos Insumos
  
  1. Alterações na Tabela `materials`
    - `import_status` (text) - Status do insumo: 'manual' (cadastrado manualmente), 'imported_pending' (importado e precisa revisão), 'imported_reviewed' (importado e revisado)
    - `imported_at` (timestamptz) - Data/hora da importação
    - `nfe_key` (text) - Chave da NFe de origem (para referência)
  
  2. Descrição
    - Permite rastrear quais insumos foram importados de XML
    - Marca insumos importados como pendentes de revisão até que o usuário configure revenda
    - Mantém registro da origem do insumo
*/

-- Adicionar campos de rastreamento de importação
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS import_status text DEFAULT 'manual' CHECK (import_status IN ('manual', 'imported_pending', 'imported_reviewed')),
ADD COLUMN IF NOT EXISTS imported_at timestamptz,
ADD COLUMN IF NOT EXISTS nfe_key text;