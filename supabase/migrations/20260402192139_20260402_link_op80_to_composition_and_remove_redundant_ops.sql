/*
  # Vinculacao da OP #80 a sua composicao e remocao de OPs redundantes #77-#79

  ## O que este script faz
  1. Vincula a OP #80 a composicao "Portico pre moldado vao de 10,80 x 3,50m"
     para que ela seja exibida corretamente como OP de composicao na interface.
  2. Remove as OPs #77, #78, #79 que sao redundantes (criadas pelo trigger antigo,
     sao vazias e correspondem aos produtos filhos da composicao ja presente na OP #80).

  ## Seguranca
  - OP #80 tem 4 itens com producao = 0 — nao ha producao registrada, apenas itens cadastrados
  - OPs #77, #78, #79 tem 0 itens e producao = 0 — seguro remover
*/

-- Vincular OP #80 a composicao correspondente
UPDATE production_orders
SET
  composition_id   = '95b23057-1bb5-4f43-8354-3268be0e540d',
  composition_name = 'Portico pre moldado vao de 10,80 x 3,50m',
  product_id       = NULL
WHERE order_number = 80
  AND produced_quantity = 0;

-- Remover itens sem producao das OPs redundantes antes de excluir as ordens
DELETE FROM production_order_items
WHERE production_order_id IN (
  SELECT id FROM production_orders
  WHERE order_number IN (77, 78, 79)
    AND produced_quantity = 0
    AND status = 'open'
)
AND COALESCE(produced_quantity, 0) = 0;

-- Remover as OPs redundantes #77, #78, #79
DELETE FROM production_orders
WHERE order_number IN (77, 78, 79)
  AND produced_quantity = 0
  AND status = 'open';
