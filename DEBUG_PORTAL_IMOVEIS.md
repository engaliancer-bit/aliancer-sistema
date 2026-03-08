# Debug do Portal do Cliente - Aba de Imóveis

## Problema Relatado
Ao clicar na aba de imóveis no portal do cliente, a página fica em branco.

## Melhorias Implementadas

### 1. Logs Detalhados no Console
Agora o sistema registra informações completas no console do navegador:
- ✅ Carregamento de propriedades
- ✅ Erros de query no Supabase
- ✅ Quantidade de imóveis encontrados
- ✅ Status de carregamento de documentos

### 2. Indicadores Visuais
- ✅ Spinner de loading ao carregar imóveis
- ✅ Mensagem clara quando não há imóveis
- ✅ Botão "Fechar" para colapsar documentos
- ✅ Estado de loading nos botões
- ✅ Indicador de documentos vencidos/vencendo

### 3. Tratamento de Erros
- ✅ Captura e exibe erros de forma clara
- ✅ Alertas quando falha carregar documentos
- ✅ Mensagens explicativas para cada situação

## Como Testar

### Passo 1: Verificar Console do Navegador
1. Acesse o portal do cliente
2. Abra as Ferramentas do Desenvolvedor (F12)
3. Vá na aba "Console"
4. Clique na aba "Imóveis"
5. Observe os logs:
   - `🔄 Carregando dados do cliente: [ID]`
   - `📦 Propriedades carregadas: [array]`
   - `✅ Propriedades processadas: [array]`

### Passo 2: Verificar se Cliente Tem Imóveis Cadastrados

Execute esta query no Supabase SQL Editor:

```sql
-- Verificar se o cliente tem imóveis cadastrados
SELECT
  c.name as cliente,
  p.name as imovel,
  p.client_access_enabled,
  p.municipality,
  p.state
FROM customers c
LEFT JOIN properties p ON c.id = p.customer_id
WHERE c.id = 'COLE_O_ID_DO_CLIENTE_AQUI';
```

### Passo 3: Verificar Políticas RLS

Execute no Supabase SQL Editor:

```sql
-- Listar políticas RLS da tabela properties
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'properties';
```

### Passo 4: Habilitar Acesso do Cliente ao Imóvel

Se o imóvel existir mas não aparecer, execute:

```sql
-- Habilitar acesso ao portal para um imóvel específico
UPDATE properties
SET
  client_access_enabled = true,
  share_documents = true
WHERE id = 'COLE_O_ID_DO_IMOVEL_AQUI';
```

### Passo 5: Criar um Imóvel de Teste

Se o cliente não tiver imóveis, crie um de teste:

```sql
-- Criar um imóvel de teste para o cliente
INSERT INTO properties (
  customer_id,
  property_type,
  name,
  registration_number,
  municipality,
  state,
  area,
  client_access_enabled,
  share_documents
) VALUES (
  'COLE_O_ID_DO_CLIENTE_AQUI',
  'rural',
  'Fazenda Teste',
  '12345',
  'Brasília',
  'DF',
  100.00,
  true,
  true
);
```

## Possíveis Causas do Problema

### 1. Cliente Não Tem Imóveis Cadastrados
**Sintoma**: Mensagem "Nenhum imóvel disponível"
**Solução**: Cadastre imóveis para este cliente no admin

### 2. Imóveis Não Estão Habilitados para Acesso
**Sintoma**: Cliente tem imóveis no admin, mas não aparecem no portal
**Solução**: Execute a query do Passo 4 para habilitar

### 3. Erro de Permissão RLS
**Sintoma**: Console mostra erro "permission denied" ou similar
**Solução**: Verifique se as políticas públicas estão ativas

### 4. Token Inválido ou Cliente Errado
**Sintoma**: Carrega mas não encontra dados
**Solução**: Gere um novo token de acesso

## Logs Esperados (Funcionando Corretamente)

```
🟢 ClientPortal: Iniciando validação de token
📍 URL completa: https://seusite.com/?client_portal=true&token=xxx
✅ Token encontrado via query params: xxxx...
🔍 Validando token: xxxxxxxxxxxx...
📦 Resposta da validação: {data: Array(1), error: null}
✅ Token válido! Cliente: Nome do Cliente
🔄 Carregando dados do cliente: cliente-uuid
📦 Propriedades carregadas: [{...}] Erro: null
✅ Propriedades processadas: [{id: "...", name: "...", ...}]
```

## Logs de Erro (Problema Identificado)

### Sem Imóveis:
```
🔄 Carregando dados do cliente: cliente-uuid
📦 Propriedades carregadas: [] Erro: null
✅ Propriedades processadas: []
```

### Erro RLS:
```
📦 Propriedades carregadas: null Erro: {message: "permission denied for table properties"}
❌ Erro ao carregar propriedades: {message: "..."}
```

## Interface Melhorada

### Estado de Loading
- Mostra spinner enquanto carrega
- Desabilita botões durante carregamento
- Texto "Carregando..." nos botões

### Estado Vazio
- Ícone de imóvel em cinza
- Mensagem: "Nenhum imóvel disponível"
- Orientação: "Entre em contato com o escritório"

### Estado com Dados
- Cards de imóveis com todas as informações
- Botão "Ver Documentos" / "Fechar"
- Lista de documentos com status visual
- Badges de "Vencido" e "Vence em breve"

## Próximos Passos

1. Acesse o portal e abra o console (F12)
2. Clique na aba "Imóveis"
3. Envie screenshot dos logs do console
4. Informe qual mensagem aparece na tela:
   - "Carregando imóveis..."
   - "Nenhum imóvel disponível"
   - Ou se aparece algum erro específico

Com essas informações poderemos identificar exatamente qual é o problema e resolvê-lo!
