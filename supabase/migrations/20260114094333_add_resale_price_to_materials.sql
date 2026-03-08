/*
  # Adicionar Campo de Preço de Revenda aos Insumos

  1. Alterações na Tabela `materials`
    - `resale_price` (decimal) - Preço final de venda calculado para revenda
    
  2. Descrição
    - Armazena o preço de venda calculado automaticamente
    - Baseado em: (unit_cost * package_size) + impostos + margem
    - Fórmula: package_value * (1 + tax%) * (1 + margin%)
    - Atualizado automaticamente quando resale_enabled = true
    
  3. Notas
    - O campo é opcional e pode ser recalculado dinamicamente
    - Facilita consultas e relatórios de preços de revenda
    - Usado em orçamentos quando o insumo é marcado para revenda
*/

-- Adicionar campo de preço de revenda
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS resale_price decimal(10,2) DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN materials.resale_price IS 'Preço final de venda calculado: (custo_embalagem * (1 + impostos/100) * (1 + margem/100))';
