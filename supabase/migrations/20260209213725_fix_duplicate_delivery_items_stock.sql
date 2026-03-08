/*
  # Correção: Itens Duplicados em Entregas Causando Estoque Negativo
  
  ## Problema Identificado
  
  Várias entregas contêm **itens duplicados** do mesmo produto, fazendo o estoque
  ser descontado em dobro (ou mais). Isso resulta em saldo negativo incorreto.
  
  ### Exemplo: Poste de cerca 10x10cm x 2.00m
  - Entrega `81b22d76-6d19-48d5-8457-01bf38b3aad8` tem 2 itens do mesmo produto
  - Item 1: 25 postes SEM orçamento
  - Item 2: 25 postes COM orçamento  
  - **Total descontado: 50 postes (deveria ser 25!)**
  
  ### Produtos Afetados
  - Bloco estrutural 14: -480 unidades indevidas
  - Bloco estrutural 14 fino acabamento: -360 unidades indevidas
  - Viga/poste 14x14x 3.00m: -32 unidades indevidas
  - Viga/poste 14x14x 2,25: -28 unidades indevidas
  - **Poste de cerca 10x10cm x 2.00m: -25 unidades indevidas**
  - Pilar pré moldado de 25 x 35 - H 6,20: -24 unidades indevidas
  - E outros...
  
  ## Solução Implementada
  
  1. **Remover itens duplicados**
     - Mantém o item mais relevante (COM quote_item_id quando possível)
     - Remove os demais duplicados
  
  2. **Adicionar constraint único**
     - Previne futuras duplicações
     - Um produto só pode aparecer UMA vez por entrega
  
  ## Impacto
  
  Após a correção, os estoques negativos serão corrigidos automaticamente.
*/

-- =====================================================
-- 1. BACKUP DOS ITENS QUE SERÃO REMOVIDOS
-- =====================================================

CREATE TABLE IF NOT EXISTS delivery_items_removed_backup (
  id uuid,
  delivery_id uuid,
  product_id uuid,
  quantity decimal(10,2),
  loaded_quantity decimal(10,2),
  quote_item_id uuid,
  composition_id uuid,
  created_at timestamptz,
  removed_at timestamptz DEFAULT now(),
  reason text
);

-- Backup dos itens que serão removidos
INSERT INTO delivery_items_removed_backup (
  id, delivery_id, product_id, quantity, loaded_quantity, 
  quote_item_id, composition_id, created_at, reason
)
SELECT 
  di.id,
  di.delivery_id,
  di.product_id,
  di.quantity,
  di.loaded_quantity,
  di.quote_item_id,
  di.composition_id,
  di.created_at,
  'Item duplicado removido automaticamente - Mantido o item com quote_item_id' as reason
FROM delivery_items di
WHERE di.id IN (
  -- IDs específicos dos itens duplicados para remover
  'c70e6e76-4e8e-4697-9a2d-2807b95ad8d8',  -- Poste de cerca 2.00m (SEM orçamento)
  '0bde6379-c763-47ed-943f-ad2fa8a28df3',  -- Bloco vedação 14
  '16789fe3-91ee-4d4f-acfe-072f49ec12cf',  -- Bloco estrutural 14
  'e29395a7-cf6c-4107-ab52-454999b44246',  -- Bloco estrutural 14 fino
  '6ed9f8eb-481f-4970-a208-40e94431af3f',  -- Pilar 18x25
  'a0bc8b8d-4f29-4e71-be72-98852567182c',  -- Pilar 25x35 (1)
  'c042c483-8440-4fe0-a36e-12fdd1337332',  -- Pilar 25x35 (2)
  'f89ec09a-3f27-49f9-8471-dad42d3d5369',  -- Pilar 25x35 (3)
  '784ca415-8e9a-40ff-b798-b4fd5c1be1d7',  -- Poste cerca 2.50m
  'dc22eccb-387f-46a9-b92d-b1649ce97245',  -- Viga 14x14x2,25
  'c664fad4-1de0-4d4f-b987-edd9b268a61f',  -- Viga 14x14x3.00
  '9350c725-f209-4f72-9ea7-48db548f3f77'   -- Vigota treliçada
);

-- =====================================================
-- 2. REMOVER ITENS DUPLICADOS
-- =====================================================

DELETE FROM delivery_items
WHERE id IN (
  'c70e6e76-4e8e-4697-9a2d-2807b95ad8d8',  -- Poste de cerca 2.00m (25 un)
  '0bde6379-c763-47ed-943f-ad2fa8a28df3',  -- Bloco vedação 14 (440 un)
  '16789fe3-91ee-4d4f-acfe-072f49ec12cf',  -- Bloco estrutural 14 (480 un)
  'e29395a7-cf6c-4107-ab52-454999b44246',  -- Bloco estrutural 14 fino (360 un)
  '6ed9f8eb-481f-4970-a208-40e94431af3f',  -- Pilar 18x25 (2 un)
  'a0bc8b8d-4f29-4e71-be72-98852567182c',  -- Pilar 25x35 (6 un)
  'c042c483-8440-4fe0-a36e-12fdd1337332',  -- Pilar 25x35 (9 un)
  'f89ec09a-3f27-49f9-8471-dad42d3d5369',  -- Pilar 25x35 (9 un)
  '784ca415-8e9a-40ff-b798-b4fd5c1be1d7',  -- Poste cerca 2.50m (5 un)
  'dc22eccb-387f-46a9-b92d-b1649ce97245',  -- Viga 14x14x2,25 (28 un)
  'c664fad4-1de0-4d4f-b987-edd9b268a61f',  -- Viga 14x14x3.00 (32 un)
  '9350c725-f209-4f72-9ea7-48db548f3f77'   -- Vigota treliçada (10 un)
);

-- =====================================================
-- 3. ADICIONAR CONSTRAINT PARA PREVENIR DUPLICAÇÕES
-- =====================================================

-- Criar índice único para garantir que um produto aparece apenas uma vez por entrega
DO $$
BEGIN
  -- Primeiro, verificar se já existe o constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'delivery_items_unique_product_per_delivery'
  ) THEN
    -- Criar índice único parcial (apenas para deliveries ativas)
    CREATE UNIQUE INDEX delivery_items_unique_product_per_delivery
    ON delivery_items (delivery_id, product_id)
    WHERE composition_id IS NULL;  -- Apenas para produtos diretos, não composições
  END IF;
END $$;

-- =====================================================
-- 4. FUNÇÃO PARA DETECTAR DUPLICAÇÕES FUTURAS
-- =====================================================

CREATE OR REPLACE FUNCTION check_delivery_item_duplicates()
RETURNS trigger AS $$
BEGIN
  -- Verificar se já existe um item com mesmo produto nesta entrega
  IF EXISTS (
    SELECT 1
    FROM delivery_items di
    WHERE di.delivery_id = NEW.delivery_id
      AND di.product_id = NEW.product_id
      AND di.composition_id IS NULL
      AND di.id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Produto já existe nesta entrega. Não é permitido adicionar o mesmo produto duas vezes.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação
DROP TRIGGER IF EXISTS trigger_check_delivery_item_duplicates ON delivery_items;
CREATE TRIGGER trigger_check_delivery_item_duplicates
  BEFORE INSERT OR UPDATE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION check_delivery_item_duplicates();

-- =====================================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE delivery_items_removed_backup IS 
  'Backup de itens de entrega removidos devido a duplicação.
   Contém histórico de itens duplicados que causavam desconto em dobro no estoque.';

COMMENT ON FUNCTION check_delivery_item_duplicates() IS
  'Previne a criação de itens duplicados do mesmo produto em uma entrega.
   Um produto só pode aparecer uma vez por entrega (exceto quando parte de composições).';

-- =====================================================
-- 6. RELATÓRIO DE CORREÇÃO
-- =====================================================

DO $$
DECLARE
  v_removed_count integer;
  v_total_units decimal;
BEGIN
  SELECT COUNT(*), SUM(quantity) INTO v_removed_count, v_total_units
  FROM delivery_items_removed_backup
  WHERE removed_at >= now() - interval '1 minute';
  
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'CORREÇÃO DE ITENS DUPLICADOS CONCLUÍDA';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Itens removidos: %', v_removed_count;
  RAISE NOTICE 'Total de unidades corrigidas: %', v_total_units;
  RAISE NOTICE '';
  RAISE NOTICE 'Os estoques agora refletem a quantidade real entregue.';
  RAISE NOTICE 'Constraint adicionado para prevenir futuras duplicações.';
  RAISE NOTICE '=================================================';
END $$;
