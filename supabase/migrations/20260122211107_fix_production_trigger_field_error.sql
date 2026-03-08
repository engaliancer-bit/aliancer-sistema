/*
  # Correção do Trigger de Entrega Automática

  ## Problema Identificado
  O trigger `auto_create_delivery_on_production_complete` está tentando acessar campos 
  `produced_quantity` e `total_quantity` na tabela `production`, mas esses campos não existem.
  Esses campos existem apenas na tabela `production_order_items`.

  ## Solução
  1. Remover o trigger incorreto da tabela `production`
  2. Recriar a função do trigger para trabalhar corretamente apenas quando necessário
  3. A lógica de entregas automáticas deve ser baseada nos itens das ordens de produção,
     não em registros individuais de produção

  ## Alterações
  - Remove trigger `trigger_auto_create_delivery_on_production_complete` da tabela production
  - Recria a função para evitar erros futuros caso seja chamada incorretamente
*/

-- Remover o trigger problemático da tabela production
DROP TRIGGER IF EXISTS trigger_auto_create_delivery_on_production_complete ON production;

-- Recriar a função do trigger para não causar erro, mas sem lógica ativa
-- (mantemos a função para compatibilidade com código existente)
CREATE OR REPLACE FUNCTION auto_create_delivery_on_production_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Função mantida apenas para compatibilidade
  -- A lógica de criação automática de entregas não se aplica 
  -- a registros individuais da tabela production
  RETURN NEW;
END;
$$;
