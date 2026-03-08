-- ============================================
-- QUERIES ÚTEIS - PORTAL DO CLIENTE
-- ============================================

-- ============================================
-- 1. DIAGNÓSTICO COMPLETO DE UM CLIENTE
-- ============================================

-- Substituir 'NOME_DO_CLIENTE' pelo nome real
SELECT
  c.id as cliente_id,
  c.name as cliente,
  c.phone,
  c.email,
  c.client_portal_enabled,
  c.last_access_at,
  COUNT(DISTINCT p.id) as total_imoveis,
  COUNT(DISTINCT pd.id) as total_documentos,
  COUNT(DISTINCT a.id) as total_anexos,
  COUNT(DISTINCT ep.id) as total_projetos,
  COUNT(DISTINCT cat.id) as total_tokens
FROM customers c
LEFT JOIN properties p ON c.id = p.customer_id AND p.client_access_enabled = true
LEFT JOIN property_documents pd ON p.id = pd.property_id
LEFT JOIN attachments a ON p.id = a.entity_id AND a.entity_type = 'property'
LEFT JOIN engineering_projects ep ON c.id = ep.customer_id AND ep.client_visible = true
LEFT JOIN customer_access_tokens cat ON c.id = cat.customer_id AND cat.is_active = true
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
GROUP BY c.id;

-- ============================================
-- 2. LISTAR TODOS OS TOKENS ATIVOS
-- ============================================

SELECT
  cat.id,
  cat.token,
  c.name as cliente,
  c.phone,
  cat.expires_at,
  cat.last_used_at,
  cat.is_active,
  CASE
    WHEN cat.expires_at < NOW() THEN '❌ Expirado'
    WHEN cat.expires_at < NOW() + INTERVAL '7 days' THEN '⚠️ Expira em breve'
    ELSE '✅ Válido'
  END as status
FROM customer_access_tokens cat
JOIN customers c ON cat.customer_id = c.id
WHERE cat.is_active = true
ORDER BY cat.created_at DESC;

-- ============================================
-- 3. HABILITAR PORTAL PARA CLIENTE
-- ============================================

-- Habilitar acesso ao portal
UPDATE customers
SET client_portal_enabled = true
WHERE name ILIKE '%NOME_DO_CLIENTE%';

-- ============================================
-- 4. HABILITAR TODOS OS IMÓVEIS DE UM CLIENTE
-- ============================================

UPDATE properties
SET
  client_access_enabled = true,
  share_documents = true
WHERE customer_id = (
  SELECT id FROM customers
  WHERE name ILIKE '%NOME_DO_CLIENTE%'
);

-- ============================================
-- 5. VER IMÓVEIS E STATUS DE ACESSO
-- ============================================

SELECT
  p.id,
  p.name as imovel,
  p.registration_number as matricula,
  p.municipality,
  p.state,
  p.area,
  p.client_access_enabled,
  p.share_documents,
  c.name as cliente,
  COUNT(pd.id) as total_documentos,
  COUNT(a.id) as total_anexos
FROM properties p
JOIN customers c ON p.customer_id = c.id
LEFT JOIN property_documents pd ON p.id = pd.property_id
LEFT JOIN attachments a ON p.id = a.entity_id AND a.entity_type = 'property'
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
GROUP BY p.id, p.name, p.registration_number, p.municipality, p.state, p.area,
         p.client_access_enabled, p.share_documents, c.name
ORDER BY p.name;

-- ============================================
-- 6. VER ANEXOS DE UM IMÓVEL ESPECÍFICO
-- ============================================

SELECT
  a.id,
  a.file_name,
  a.file_type,
  a.file_size,
  a.file_path,
  a.description,
  a.created_at,
  p.name as imovel
FROM attachments a
JOIN properties p ON a.entity_id = p.id
WHERE a.entity_type = 'property'
  AND p.name ILIKE '%NOME_DO_IMOVEL%'
ORDER BY a.created_at DESC;

-- ============================================
-- 7. ADICIONAR ANEXO MANUALMENTE (SE NECESSÁRIO)
-- ============================================

-- NOTA: Normalmente isso seria feito via interface de upload
-- Esta query é apenas para referência ou teste

INSERT INTO attachments (
  entity_type,
  entity_id,
  file_name,
  file_path,
  file_type,
  file_size,
  description
) VALUES (
  'property',
  'UUID_DO_IMOVEL_AQUI', -- Substitua pelo ID real
  'documento_teste.pdf',
  'property/UUID_DO_IMOVEL/documento_teste.pdf',
  'application/pdf',
  524288, -- Tamanho em bytes
  'Documento de teste para validação do portal'
);

-- ============================================
-- 8. DESATIVAR TOKEN DE ACESSO
-- ============================================

UPDATE customer_access_tokens
SET is_active = false
WHERE token = 'TOKEN_AQUI';

-- ============================================
-- 9. GERAR NOVO TOKEN MANUALMENTE
-- ============================================

-- Use a função RPC ao invés de INSERT manual
SELECT generate_customer_access_token(
  p_customer_id := 'UUID_DO_CLIENTE',
  p_phone_number := '61999999999',
  p_expires_in_days := 90
);

-- ============================================
-- 10. VER DOCUMENTOS VENCIDOS OU VENCENDO
-- ============================================

SELECT
  pd.id,
  pd.document_type,
  pd.expiration_date,
  p.name as imovel,
  c.name as cliente,
  CASE
    WHEN pd.expiration_date < CURRENT_DATE THEN '❌ Vencido'
    WHEN pd.expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN '⚠️ Vence em breve'
    ELSE '✅ Válido'
  END as status,
  CURRENT_DATE - pd.expiration_date as dias_vencido
FROM property_documents pd
JOIN properties p ON pd.property_id = p.id
JOIN customers c ON p.customer_id = c.id
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
  AND pd.expiration_date IS NOT NULL
ORDER BY pd.expiration_date;

-- ============================================
-- 11. VER PROJETOS VISÍVEIS NO PORTAL
-- ============================================

SELECT
  ep.id,
  ep.title,
  ep.service_type,
  ep.status,
  ep.progress_percentage,
  ep.current_phase,
  ep.estimated_completion_date,
  ep.client_visible,
  c.name as cliente,
  p.name as imovel
FROM engineering_projects ep
JOIN customers c ON ep.customer_id = c.id
LEFT JOIN properties p ON ep.property_id = p.id
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
  AND ep.client_visible = true
ORDER BY ep.created_at DESC;

-- ============================================
-- 12. VER NOTIFICAÇÕES DO CLIENTE
-- ============================================

SELECT
  cn.id,
  cn.type,
  cn.title,
  cn.message,
  cn.priority,
  cn.is_read,
  cn.created_at,
  cn.read_at,
  c.name as cliente
FROM client_notifications cn
JOIN customers c ON cn.customer_id = c.id
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
ORDER BY cn.created_at DESC
LIMIT 50;

-- ============================================
-- 13. CRIAR NOTIFICAÇÃO PARA CLIENTE
-- ============================================

SELECT create_client_notification(
  p_customer_id := 'UUID_DO_CLIENTE',
  p_type := 'geral',
  p_title := 'Novo Documento Disponível',
  p_message := 'Um novo documento foi adicionado ao seu imóvel. Acesse o portal para visualizar.',
  p_priority := 'normal'
);

-- ============================================
-- 14. VER SOLICITAÇÕES DE SERVIÇO
-- ============================================

SELECT
  sr.id,
  sr.service_type,
  sr.title,
  sr.description,
  sr.urgency,
  sr.status,
  sr.created_at,
  sr.response_notes,
  c.name as cliente,
  p.name as imovel
FROM service_requests sr
JOIN customers c ON sr.customer_id = c.id
LEFT JOIN properties p ON sr.property_id = p.id
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
ORDER BY sr.created_at DESC;

-- ============================================
-- 15. VER APROVAÇÕES PENDENTES
-- ============================================

SELECT
  sa.id,
  sa.title,
  sa.description,
  sa.estimated_value,
  sa.estimated_days,
  sa.status,
  sa.expires_at,
  sa.created_at,
  c.name as cliente,
  CASE
    WHEN sa.expires_at < NOW() THEN '❌ Expirado'
    WHEN sa.expires_at < NOW() + INTERVAL '3 days' THEN '⚠️ Expira em breve'
    ELSE '✅ Dentro do prazo'
  END as status_prazo
FROM service_approvals sa
JOIN customers c ON sa.customer_id = c.id
WHERE c.name ILIKE '%NOME_DO_CLIENTE%'
  AND sa.status = 'pendente'
ORDER BY sa.expires_at;

-- ============================================
-- 16. ESTATÍSTICAS GERAIS DO PORTAL
-- ============================================

SELECT
  COUNT(DISTINCT c.id) FILTER (WHERE c.client_portal_enabled = true) as clientes_ativos,
  COUNT(DISTINCT cat.id) FILTER (WHERE cat.is_active = true AND cat.expires_at > NOW()) as tokens_validos,
  COUNT(DISTINCT p.id) FILTER (WHERE p.client_access_enabled = true) as imoveis_compartilhados,
  COUNT(DISTINCT a.id) as total_anexos,
  COUNT(DISTINCT ep.id) FILTER (WHERE ep.client_visible = true) as projetos_visiveis,
  COUNT(DISTINCT cn.id) FILTER (WHERE NOT cn.is_read) as notificacoes_nao_lidas,
  COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'pendente') as aprovacoes_pendentes
FROM customers c
LEFT JOIN customer_access_tokens cat ON c.id = cat.customer_id
LEFT JOIN properties p ON c.id = p.customer_id
LEFT JOIN attachments a ON p.id = a.entity_id AND a.entity_type = 'property'
LEFT JOIN engineering_projects ep ON c.id = ep.customer_id
LEFT JOIN client_notifications cn ON c.id = cn.customer_id
LEFT JOIN service_approvals sa ON c.id = sa.customer_id;

-- ============================================
-- 17. LIMPAR TOKENS EXPIRADOS
-- ============================================

-- Desativar tokens expirados
UPDATE customer_access_tokens
SET is_active = false
WHERE expires_at < NOW()
  AND is_active = true;

-- Ver quantos foram desativados
SELECT COUNT(*) as tokens_desativados
FROM customer_access_tokens
WHERE expires_at < NOW()
  AND is_active = false;

-- ============================================
-- 18. VALIDAR TOKEN ESPECÍFICO
-- ============================================

SELECT validate_customer_token('TOKEN_AQUI');

-- ============================================
-- 19. BUSCAR CLIENTE POR TELEFONE
-- ============================================

SELECT
  c.id,
  c.name,
  c.phone,
  c.email,
  c.client_portal_enabled,
  COUNT(cat.id) FILTER (WHERE cat.is_active = true) as tokens_ativos
FROM customers c
LEFT JOIN customer_access_tokens cat ON c.id = cat.customer_id
WHERE c.phone LIKE '%999999999%' -- Substitua pelos últimos dígitos
GROUP BY c.id;

-- ============================================
-- 20. AUDITORIA DE ACESSOS
-- ============================================

SELECT
  cat.token,
  c.name as cliente,
  c.phone,
  cat.last_used_at,
  cat.created_at,
  EXTRACT(DAY FROM NOW() - cat.last_used_at) as dias_sem_acesso,
  CASE
    WHEN cat.last_used_at IS NULL THEN '❌ Nunca acessou'
    WHEN cat.last_used_at < NOW() - INTERVAL '30 days' THEN '⚠️ Inativo há mais de 30 dias'
    WHEN cat.last_used_at < NOW() - INTERVAL '7 days' THEN '⚠️ Não acessa há 7 dias'
    ELSE '✅ Ativo'
  END as status_uso
FROM customer_access_tokens cat
JOIN customers c ON cat.customer_id = c.id
WHERE cat.is_active = true
  AND cat.expires_at > NOW()
ORDER BY cat.last_used_at DESC NULLS LAST;

-- ============================================
-- FIM DAS QUERIES ÚTEIS
-- ============================================

-- LEMBRE-SE:
-- 1. Substitua 'NOME_DO_CLIENTE' pelos nomes reais
-- 2. Substitua 'UUID_DO_CLIENTE' e 'UUID_DO_IMOVEL' pelos IDs reais
-- 3. Ajuste filtros conforme necessário
-- 4. Use estas queries no Supabase SQL Editor
