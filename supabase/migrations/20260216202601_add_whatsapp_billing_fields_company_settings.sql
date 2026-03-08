/*
  # Adicionar campos para cobrança via WhatsApp

  1. Alterações
    - Adicionar campo `pix_key` (texto) para armazenar chave PIX da empresa
    - Adicionar campo `bank_account` (texto) para armazenar dados bancários da empresa
    
  2. Propósito
    - Permitir envio de mensagens de cobrança via WhatsApp com informações de pagamento
    - Facilitar o recebimento de pagamentos pelos clientes

  3. Notas
    - Campos opcionais (nullable)
    - Campo `phone` já existe na tabela company_settings
*/

-- Adicionar campos para informações de pagamento
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS bank_account text;

-- Comentários explicativos
COMMENT ON COLUMN company_settings.pix_key IS 'Chave PIX da empresa (CPF, CNPJ, email, telefone ou chave aleatória)';
COMMENT ON COLUMN company_settings.bank_account IS 'Dados bancários completos da empresa (Banco, Agência, Conta)';
