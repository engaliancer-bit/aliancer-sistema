/*
  # Remover Entradas de Cash Flow quando Vendas são Canceladas

  1. Problema
    - Quando vendas são canceladas ou recebíveis são desmarcados de "pago", as entradas no cash_flow permanecem
    - Isso causa inconsistências no relatório de fluxo de caixa
    - Total de receitas fica incorreto

  2. Solução
    - Criar trigger para deletar cash_flow quando recebível volta de "pago" para outro status
    - Criar trigger para deletar todos os cash_flow vinculados quando uma venda é deletada
    - Manter integridade referencial entre recebíveis e cash_flow

  3. Comportamento
    - Quando recebível muda de "pago" para outro status: deleta entrada no cash_flow
    - Quando venda é deletada: deleta todas as entradas de cash_flow vinculadas aos recebíveis
    - Mantém logs para auditoria
*/

-- Função para remover cash_flow quando recebível é desmarcado como pago
CREATE OR REPLACE FUNCTION public.delete_cash_flow_on_receivable_unpaid()
RETURNS TRIGGER AS $$
BEGIN
  -- Se status mudou de 'pago' para outro status
  IF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    
    -- Deletar entrada do cash_flow se existir
    IF OLD.cash_flow_id IS NOT NULL THEN
      DELETE FROM public.cash_flow
      WHERE id = OLD.cash_flow_id;
      
      RAISE NOTICE 'Cash flow % deletado - recebível % mudou de pago para %', 
        OLD.cash_flow_id, OLD.id, NEW.status;
    END IF;
    
    -- Limpar referência do cash_flow_id
    NEW.cash_flow_id := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para deleção automática de cash_flow
DROP TRIGGER IF EXISTS trigger_delete_cash_flow_on_unpaid ON public.receivables;
CREATE TRIGGER trigger_delete_cash_flow_on_unpaid
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_cash_flow_on_receivable_unpaid();

-- Função para remover todos os cash_flow vinculados quando venda é deletada
CREATE OR REPLACE FUNCTION public.delete_cash_flow_on_sale_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_cash_flow_count integer;
BEGIN
  -- Deletar todos os cash_flow vinculados aos recebíveis desta venda
  WITH deleted_flows AS (
    DELETE FROM public.cash_flow
    WHERE id IN (
      SELECT cash_flow_id 
      FROM public.receivables 
      WHERE venda_id = OLD.id 
        AND cash_flow_id IS NOT NULL
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cash_flow_count FROM deleted_flows;
  
  RAISE NOTICE 'Venda % deletada. % movimentos de caixa removidos', OLD.id, v_cash_flow_count;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para deleção de cash_flow quando venda é removida
DROP TRIGGER IF EXISTS trigger_delete_cash_flow_on_sale_deletion ON public.unified_sales;
CREATE TRIGGER trigger_delete_cash_flow_on_sale_deletion
  BEFORE DELETE ON public.unified_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_cash_flow_on_sale_deletion();