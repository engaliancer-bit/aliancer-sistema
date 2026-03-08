/*
  # Adicionar Campos de Revenda aos Insumos
  
  1. Alterações na Tabela `materials`
    - `resale_enabled` (boolean) - Indica se o insumo pode ser revendido
    - `resale_tax_percentage` (decimal) - Porcentagem de impostos na revenda
    - `resale_margin_percentage` (decimal) - Porcentagem de margem de lucro na revenda
  
  2. Descrição
    - Permite cadastrar insumos que são comprados e revendidos diretamente
    - Calcula automaticamente o preço de venda sugerido baseado em custo + impostos + margem
    - Permite que insumos apareçam nos orçamentos junto com produtos
*/

-- Adicionar campos de revenda à tabela materials
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS resale_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS resale_tax_percentage decimal(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS resale_margin_percentage decimal(5,2) DEFAULT 0;