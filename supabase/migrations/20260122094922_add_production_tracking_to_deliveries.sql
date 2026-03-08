/*
  # Adicionar Rastreamento de Produção nas Entregas

  ## Descrição
  Esta migration adiciona funcionalidade para rastrear quais registros de produção
  de ordem foram utilizados nas entregas. Quando uma entrega for confirmada/fechada,
  os produtos de ordem de produção utilizados serão automaticamente removidos do estoque.

  ## Alterações

  1. Nova Coluna
     - Adiciona `production_id` (uuid) à tabela `delivery_items`
     - Referencia a tabela `production` para rastrear qual produção específica foi entregue

  2. Trigger Automático
     - Cria função `delete_delivered_production_orders()`
     - Quando uma entrega muda status para 'closed':
       - Busca todos os delivery_items dessa entrega que têm production_id
       - Exclui os registros de production que têm production_order_id (produtos de ordem)
       - Mantém registros de production sem production_order_id (estoque normal)

  3. Segurança
     - Mantém as políticas RLS existentes

  ## Comportamento
  - Quando confirmar carregamento de entrega: produtos de ordem de produção são removidos do estoque
  - Produtos normais (sem ordem de produção) continuam no estoque normalmente
  - A exclusão ocorre apenas quando status muda para 'closed'
*/

-- Adicionar campo production_id à tabela delivery_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_items' AND column_name = 'production_id'
  ) THEN
    ALTER TABLE delivery_items ADD COLUMN production_id uuid REFERENCES production(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_delivery_items_production_id ON delivery_items(production_id);

-- Adicionar comentário na coluna
COMMENT ON COLUMN delivery_items.production_id IS
  'Referência ao registro de production utilizado nesta entrega. Usado para rastrear produtos de ordem de produção.';

-- Criar função para excluir produtos de ordem de produção quando entrega for fechada
CREATE OR REPLACE FUNCTION delete_delivered_production_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se o status mudou para 'closed'
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN

    -- Excluir registros de production que:
    -- 1. Têm production_order_id (são de ordem de produção)
    -- 2. Estão referenciados nos delivery_items desta entrega
    DELETE FROM production
    WHERE id IN (
      SELECT di.production_id
      FROM delivery_items di
      WHERE di.delivery_id = NEW.id
        AND di.production_id IS NOT NULL
    )
    AND production_order_id IS NOT NULL;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para executar a função quando delivery for atualizado
DROP TRIGGER IF EXISTS trigger_delete_delivered_production_orders ON deliveries;
CREATE TRIGGER trigger_delete_delivered_production_orders
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION delete_delivered_production_orders();

-- Adicionar comentário na função
COMMENT ON FUNCTION delete_delivered_production_orders() IS
  'Remove automaticamente produtos de ordem de produção do estoque quando uma entrega é confirmada (status=closed)';