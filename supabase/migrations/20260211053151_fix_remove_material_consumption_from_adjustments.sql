/*
  # Remover Consumo de Insumos de Ajustes de Estoque
  
  ## Problema
  Produções do tipo 'adjustment' (ajustes de estoque) ainda possuem movimentações
  de material vinculadas, o que consome indevidamente o estoque de insumos.
  
  Ajustes de estoque são correções administrativas/migrações de dados e não devem
  consumir insumos, pois não representam produções reais.
  
  ## Exemplo Identificado
  - Produção: Paver retangular 10x20x06 (13.916 unidades)
  - Tipo: adjustment (ajuste de estoque)
  - Movimentações: 5 saídas de materiais indevidamente registradas
  
  ## Solução
  Deletar TODAS as movimentações de material (saídas) vinculadas a produções
  do tipo 'adjustment'. Isso restaurará automaticamente o estoque dos insumos.
  
  ## Materiais que serão restaurados
  - Areia industrial: 62.343,68 kg
  - Areia média: 53.298,28 kg
  - CIMENTO OBRAS ESPECIAIS: 13.916 kg
  - CQ Plast PM 9000: 34,79 kg
  - Pedrisco: 22.404,76 kg
  
  ## Segurança
  - Apenas deleta movimentações de SAÍDA (consumo)
  - Apenas de produções marcadas como 'adjustment'
  - Não afeta produções normais ('stock' ou 'order')
*/

-- Deletar todas as movimentações de material vinculadas a ajustes de estoque
-- Isso restaurará automaticamente o estoque dos insumos
DELETE FROM material_movements
WHERE production_id IN (
  SELECT id FROM production WHERE production_type = 'adjustment'
)
AND movement_type = 'saida';

-- Adicionar comentário explicativo para futura referência
COMMENT ON CONSTRAINT production_type_check ON production IS 
'Tipos: stock (produção em estoque), order (ordem de produção), adjustment (ajuste manual - NÃO consome insumos)';
