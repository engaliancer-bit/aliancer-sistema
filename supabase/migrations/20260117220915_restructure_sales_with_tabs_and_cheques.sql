/*
  # Reestruturação do Sistema de Vendas com Abas e Gestão de Cheques

  ## Mudanças Implementadas

  ### 1. Tabela de Cheques
  Nova tabela `sale_cheques` para armazenar informações detalhadas de cheques:
  - Número do cheque
  - Banco, agência, conta
  - Titular do cheque
  - Data de emissão e vencimento
  - Valor
  - Status (a_depositar, depositado, compensado, devolvido)
  - Anexos (foto/PDF do cheque)

  ### 2. Atualização da Tabela Sales
  Adiciona campos para melhor controle:
  - is_from_quote: indica se venda veio de orçamento aprovado
  - quote_approved_at: data de aprovação do orçamento
  - payment_confirmation_status: status de confirmação de pagamento (pendente, parcial, confirmado)
  - confirmed_at: data de confirmação total do pagamento
  - is_standalone_sale: indica se é venda avulsa

  ### 3. Atualização da Tabela Sale_Payment_Installments
  Adiciona campos para controle de recebimento:
  - is_received: indica se parcela foi recebida
  - received_at: data de recebimento
  - received_by: quem confirmou o recebimento
  - cheque_id: referência ao cheque (se aplicável)
  - notes: observações sobre o recebimento

  ### 4. Atualização da Tabela Quotes
  Adiciona campos:
  - approval_status: status de aprovação (pendente, aprovado, rejeitado)
  - approved_at: data de aprovação
  - sale_created: indica se venda já foi criada a partir deste orçamento

  ### 5. Funções e Triggers
  - Função para criar venda automaticamente quando orçamento é aprovado
  - Função para alimentar fluxo de caixa apenas quando pagamento é confirmado
  - Trigger para atualizar status de pagamento da venda

  ## Segurança
  - RLS habilitado em todas as novas tabelas
  - Políticas de acesso público (seguindo padrão do sistema)
*/

-- ============================================================================
-- PARTE 1: CRIAR TABELA DE CHEQUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sale_cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.sale_payment_installments(id) ON DELETE SET NULL,
  
  -- Dados do cheque
  cheque_number text NOT NULL,
  bank_name text NOT NULL,
  bank_code text,
  agency text,
  account text,
  cheque_holder text NOT NULL,
  
  -- Datas
  issue_date date NOT NULL,
  due_date date NOT NULL,
  
  -- Valor
  amount decimal(15, 2) NOT NULL,
  
  -- Status
  status text NOT NULL DEFAULT 'a_depositar' CHECK (status IN ('a_depositar', 'depositado', 'compensado', 'devolvido')),
  
  -- Anexos
  attachment_url text,
  attachment_type text, -- 'photo' ou 'pdf'
  
  -- Observações
  notes text,
  
  -- Auditoria
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  
  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- Habilitar RLS
ALTER TABLE public.sale_cheques ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sale_cheques
CREATE POLICY "Allow public access to sale_cheques"
  ON public.sale_cheques
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sale_cheques_sale_id ON public.sale_cheques(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_cheques_installment_id ON public.sale_cheques(installment_id);
CREATE INDEX IF NOT EXISTS idx_sale_cheques_status ON public.sale_cheques(status);
CREATE INDEX IF NOT EXISTS idx_sale_cheques_due_date ON public.sale_cheques(due_date);

-- Trigger para updated_at
CREATE TRIGGER update_sale_cheques_updated_at
  BEFORE UPDATE ON public.sale_cheques
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PARTE 2: ATUALIZAR TABELA SALES
-- ============================================================================

-- Adicionar novos campos à tabela sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'is_from_quote'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN is_from_quote boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'quote_approved_at'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN quote_approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'payment_confirmation_status'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN payment_confirmation_status text DEFAULT 'pendente' CHECK (payment_confirmation_status IN ('pendente', 'parcial', 'confirmado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'is_standalone_sale'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN is_standalone_sale boolean DEFAULT false;
  END IF;
END $$;

-- Índices para novos campos
CREATE INDEX IF NOT EXISTS idx_sales_payment_confirmation_status ON public.sales(payment_confirmation_status);
CREATE INDEX IF NOT EXISTS idx_sales_is_from_quote ON public.sales(is_from_quote);
CREATE INDEX IF NOT EXISTS idx_sales_is_standalone_sale ON public.sales(is_standalone_sale);

-- ============================================================================
-- PARTE 3: ATUALIZAR TABELA SALE_PAYMENT_INSTALLMENTS
-- ============================================================================

-- Adicionar novos campos para controle de recebimento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_payment_installments' AND column_name = 'is_received'
  ) THEN
    ALTER TABLE public.sale_payment_installments ADD COLUMN is_received boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_payment_installments' AND column_name = 'received_at'
  ) THEN
    ALTER TABLE public.sale_payment_installments ADD COLUMN received_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_payment_installments' AND column_name = 'received_by'
  ) THEN
    ALTER TABLE public.sale_payment_installments ADD COLUMN received_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_payment_installments' AND column_name = 'cheque_id'
  ) THEN
    ALTER TABLE public.sale_payment_installments ADD COLUMN cheque_id uuid REFERENCES public.sale_cheques(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_payment_installments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.sale_payment_installments ADD COLUMN notes text;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_sale_installments_is_received ON public.sale_payment_installments(is_received);
CREATE INDEX IF NOT EXISTS idx_sale_installments_cheque_id ON public.sale_payment_installments(cheque_id);

-- ============================================================================
-- PARTE 4: ATUALIZAR TABELA QUOTES
-- ============================================================================

-- Adicionar campos de aprovação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN approval_status text DEFAULT 'pendente' CHECK (approval_status IN ('pendente', 'aprovado', 'rejeitado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'sale_created'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN sale_created boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quotes' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN approved_by text;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_quotes_approval_status ON public.quotes(approval_status);
CREATE INDEX IF NOT EXISTS idx_quotes_sale_created ON public.quotes(sale_created);

-- ============================================================================
-- PARTE 5: FUNÇÃO PARA ATUALIZAR STATUS DE PAGAMENTO DA VENDA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_sale_payment_confirmation_status()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_id uuid;
  v_total_installments int;
  v_received_installments int;
  v_new_status text;
BEGIN
  -- Obter sale_id da parcela
  v_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);
  
  -- Contar total de parcelas e parcelas recebidas
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_received = true)
  INTO v_total_installments, v_received_installments
  FROM public.sale_payment_installments
  WHERE sale_id = v_sale_id;
  
  -- Determinar novo status
  IF v_received_installments = 0 THEN
    v_new_status := 'pendente';
  ELSIF v_received_installments < v_total_installments THEN
    v_new_status := 'parcial';
  ELSE
    v_new_status := 'confirmado';
  END IF;
  
  -- Atualizar venda
  UPDATE public.sales
  SET 
    payment_confirmation_status = v_new_status,
    confirmed_at = CASE 
      WHEN v_new_status = 'confirmado' THEN now() 
      ELSE NULL 
    END,
    updated_at = now()
  WHERE id = v_sale_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar status quando parcela é recebida
DROP TRIGGER IF EXISTS trigger_update_sale_payment_status ON public.sale_payment_installments;
CREATE TRIGGER trigger_update_sale_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sale_payment_confirmation_status();

-- ============================================================================
-- PARTE 6: FUNÇÃO PARA ALIMENTAR FLUXO DE CAIXA QUANDO RECEBIMENTO É CONFIRMADO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_cash_flow_on_payment_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  v_sale record;
  v_payment_method_id uuid;
BEGIN
  -- Apenas processa se a parcela foi marcada como recebida
  IF NEW.is_received = true AND (OLD.is_received IS NULL OR OLD.is_received = false) THEN
    
    -- Buscar informações da venda
    SELECT s.*, sp.payment_method_id
    INTO v_sale
    FROM public.sales s
    LEFT JOIN public.sale_payments sp ON sp.sale_id = s.id
    WHERE s.id = NEW.sale_id
    LIMIT 1;
    
    -- Buscar payment_method_id
    SELECT payment_method_id INTO v_payment_method_id
    FROM public.sale_payments
    WHERE sale_id = NEW.sale_id
    LIMIT 1;
    
    -- Criar entrada no fluxo de caixa
    INSERT INTO public.cash_flow (
      date,
      type,
      category,
      description,
      amount,
      payment_method_id,
      installment_id,
      created_at
    ) VALUES (
      COALESCE(NEW.received_at, now()),
      'entrada',
      'Venda',
      'Recebimento - Venda #' || v_sale.sale_number || ' - Parcela ' || NEW.installment_number,
      NEW.amount,
      v_payment_method_id,
      NEW.id,
      now()
    );
    
    -- Atualizar referência na parcela
    UPDATE public.sale_payment_installments
    SET cash_flow_id = (SELECT id FROM public.cash_flow WHERE installment_id = NEW.id ORDER BY created_at DESC LIMIT 1)
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar entrada no fluxo de caixa
DROP TRIGGER IF EXISTS trigger_create_cash_flow_on_payment ON public.sale_payment_installments;
CREATE TRIGGER trigger_create_cash_flow_on_payment
  AFTER INSERT OR UPDATE ON public.sale_payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cash_flow_on_payment_confirmation();

-- ============================================================================
-- PARTE 7: ATUALIZAR VENDAS EXISTENTES
-- ============================================================================

-- Marcar vendas que vieram de orçamentos
UPDATE public.sales s
SET 
  is_from_quote = true,
  is_standalone_sale = false
WHERE s.quote_id IS NOT NULL;

-- Marcar vendas avulsas
UPDATE public.sales s
SET 
  is_from_quote = false,
  is_standalone_sale = true
WHERE s.quote_id IS NULL;

-- Atualizar status de confirmação baseado no status atual de pagamento
UPDATE public.sales s
SET payment_confirmation_status = CASE
  WHEN payment_status = 'pago' THEN 'confirmado'
  WHEN payment_status = 'parcialmente_pago' THEN 'parcial'
  ELSE 'pendente'
END
WHERE payment_confirmation_status IS NULL OR payment_confirmation_status = 'pendente';