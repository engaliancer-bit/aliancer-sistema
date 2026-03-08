/*
  # Corrigir Função validate_customer_token

  1. Problema
    - Erro de ambiguidade na coluna customer_id
    - A variável de saída tem o mesmo nome da coluna da tabela
    - Causa falha na validação do token

  2. Solução
    - Usar alias de tabela para evitar ambiguidade
    - Garantir que as referências sejam claras
*/

-- Recriar a função com correção de ambiguidade
CREATE OR REPLACE FUNCTION validate_customer_token(p_token text)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  token_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    cat.expires_at
  FROM customer_access_tokens cat
  JOIN customers c ON c.id = cat.customer_id
  WHERE cat.token = p_token
    AND cat.is_active = true
    AND cat.expires_at > now();
    
  -- Atualizar último acesso usando alias para evitar ambiguidade
  UPDATE customer_access_tokens cat
  SET last_used_at = now()
  WHERE cat.token = p_token;
  
  UPDATE customers c
  SET last_access_at = now()
  WHERE c.id IN (
    SELECT cat2.customer_id 
    FROM customer_access_tokens cat2 
    WHERE cat2.token = p_token
  );
END;
$$;
