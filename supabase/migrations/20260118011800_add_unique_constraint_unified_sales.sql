/*
  # Adicionar Constraint Única para Prevenir Vendas Duplicadas
  
  1. Problema Identificado
    - Sistema possui mecanismo de proteção via campo `sale_created`
    - Porém, não há constraint de banco garantindo unicidade
    - Em caso de condições de corrida, duplicatas podem ser criadas
  
  2. Análise Atual
    - Trigger `auto_create_sale_from_quote()` verifica `sale_created = false`
    - Trigger é `BEFORE UPDATE`, então marca `sale_created = true` antes de salvar
    - Sistema já está funcionando corretamente (não há duplicatas no momento)
  
  3. Solução Preventiva
    - Adicionar constraint UNIQUE na tabela `unified_sales`
    - Garante que cada orçamento (origem_id + origem_tipo) só pode ter uma venda
    - Proteção adicional em nível de banco de dados
  
  4. Benefícios
    - Proteção contra condições de corrida
    - Segurança adicional em caso de bugs futuros
    - Erro explícito se tentar criar venda duplicada
*/

-- Primeiro, verificar se já existem duplicatas (não deveria haver)
DO $$
DECLARE
  v_duplicates_count integer;
BEGIN
  SELECT COUNT(*) INTO v_duplicates_count
  FROM (
    SELECT origem_tipo, origem_id, COUNT(*) as cnt
    FROM unified_sales
    GROUP BY origem_tipo, origem_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF v_duplicates_count > 0 THEN
    RAISE EXCEPTION 'Foram encontradas % vendas duplicadas. Execute limpeza antes de adicionar constraint.', v_duplicates_count;
  END IF;
END $$;

-- Adicionar constraint única para prevenir duplicatas
ALTER TABLE unified_sales 
DROP CONSTRAINT IF EXISTS unique_unified_sales_origem;

ALTER TABLE unified_sales
ADD CONSTRAINT unique_unified_sales_origem 
UNIQUE (origem_tipo, origem_id);

-- Adicionar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_unified_sales_origem 
ON unified_sales(origem_tipo, origem_id);

-- Comentário explicativo
COMMENT ON CONSTRAINT unique_unified_sales_origem ON unified_sales IS 
'Garante que cada orçamento (origem_id + origem_tipo) só pode ter uma única venda associada';
