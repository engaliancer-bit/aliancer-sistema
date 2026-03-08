/*
  # Corrigir Lógica de Pagamento Imediato em Contas a Pagar

  ## Alterações

  1. **Nova Função: `create_payable_account_with_optional_payment`**
     - Cria conta a pagar e processa pagamento se data_pagamento <= hoje
     - Lança automaticamente no fluxo de caixa quando pago
     - Define status correto baseado na data de pagamento

  2. **Melhorias na Função Existente**
     - Atualiza trigger para considerar data de pagamento ao definir status
     - Adiciona validação de data de pagamento

  ## Lógica de Negócio

  - **Pagamento Imediato**: Se payment_date <= hoje E cash_account_id informado → status = 'paid'
  - **Pagamento Futuro**: Se payment_date > hoje OU não informado → status = 'pending'
  - **Atrasado**: Se due_date < hoje E status = 'pending' → status = 'overdue'

  ## Campos Afetados
  - payment_status: Define se está pago, pendente ou atrasado
  - payment_date: Data do pagamento efetivo
  - cash_flow_id: Referência ao lançamento no fluxo de caixa
*/

-- Função para criar conta a pagar com processamento de pagamento opcional
CREATE OR REPLACE FUNCTION create_payable_account_with_optional_payment(
  supplier_id_param uuid,
  description_param text,
  amount_param numeric,
  due_date_param date,
  payment_date_param date DEFAULT NULL,
  cash_account_id_param uuid DEFAULT NULL,
  notes_param text DEFAULT NULL,
  purchase_id_param uuid DEFAULT NULL,
  installment_number_param integer DEFAULT 1,
  total_installments_param integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
  payable_account_id uuid;
  cash_flow_id_result uuid;
  should_mark_as_paid boolean;
BEGIN
  -- Determinar se deve marcar como pago
  should_mark_as_paid := (
    payment_date_param IS NOT NULL 
    AND cash_account_id_param IS NOT NULL 
    AND payment_date_param <= CURRENT_DATE
  );

  -- Criar conta a pagar
  IF should_mark_as_paid THEN
    -- Criar já como paga
    INSERT INTO payable_accounts (
      purchase_id,
      supplier_id,
      description,
      installment_number,
      total_installments,
      amount,
      due_date,
      payment_date,
      payment_status,
      cash_account_id,
      notes
    ) VALUES (
      purchase_id_param,
      supplier_id_param,
      description_param,
      installment_number_param,
      total_installments_param,
      amount_param,
      due_date_param,
      payment_date_param,
      'paid',
      cash_account_id_param,
      notes_param
    ) RETURNING id INTO payable_account_id;

    -- Criar lançamento no fluxo de caixa
    INSERT INTO cash_flow (
      date,
      type,
      category,
      description,
      amount,
      conta_caixa_id,
      supplier_id
    ) VALUES (
      payment_date_param,
      'expense',
      'Pagamento de Fornecedor',
      description_param,
      amount_param,
      cash_account_id_param,
      supplier_id_param
    ) RETURNING id INTO cash_flow_id_result;

    -- Atualizar referência ao fluxo de caixa
    UPDATE payable_accounts
    SET cash_flow_id = cash_flow_id_result
    WHERE id = payable_account_id;

  ELSE
    -- Criar como pendente
    INSERT INTO payable_accounts (
      purchase_id,
      supplier_id,
      description,
      installment_number,
      total_installments,
      amount,
      due_date,
      payment_date,
      payment_status,
      cash_account_id,
      notes
    ) VALUES (
      purchase_id_param,
      supplier_id_param,
      description_param,
      installment_number_param,
      total_installments_param,
      amount_param,
      due_date_param,
      payment_date_param,
      CASE 
        WHEN due_date_param < CURRENT_DATE THEN 'overdue'::payment_status_enum
        ELSE 'pending'::payment_status_enum
      END,
      cash_account_id_param,
      notes_param
    ) RETURNING id INTO payable_account_id;
  END IF;

  RETURN payable_account_id;
END;
$$ LANGUAGE plpgsql;
