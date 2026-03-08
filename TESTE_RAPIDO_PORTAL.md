# Teste Rápido - Portal do Cliente (Smartphone)

## 🎯 Objetivo
Testar se o portal funciona perfeitamente no smartphone Android e se os anexos são exibidos.

---

## ✅ Checklist de Teste

### Passo 1: Gerar Link de Acesso

1. Abra o sistema no PC
2. Vá em: **Escritório de Engenharia** → **Portal do Cliente**
3. Selecione um cliente da lista
4. Clique em **"Gerar Token de Acesso"**
5. ✅ **Verificar:** Token foi gerado com sucesso

---

### Passo 2: Enviar pelo WhatsApp

1. Clique no botão verde **"Enviar pelo WhatsApp"**
2. ✅ **Verificar:** WhatsApp abre automaticamente
3. ✅ **Verificar:** Mensagem aparece pronta com o link
4. Envie a mensagem para **seu próprio número** (teste)

**Mensagem esperada:**
```
Olá! Você tem acesso ao Portal do Cliente.

🔗 Clique no link abaixo para acessar:
https://seusite.com/?portal=abc123xyz...

📱 Este link funciona em qualquer dispositivo
(celular, tablet ou computador).

Se tiver dificuldades, entre em contato conosco.
```

---

### Passo 3: Testar no Smartphone

1. Pegue seu **smartphone Android**
2. Abra o WhatsApp e encontre a mensagem
3. **Clique no link azul**
4. ✅ **VERIFICAR:**
   - [ ] Link abre automaticamente no navegador
   - [ ] Não mostra erro de "navegador incompatível"
   - [ ] Portal carrega e mostra tela de boas-vindas

---

### Passo 4: Verificar Acesso aos Imóveis

1. No portal, clique na aba **"Imóveis"**
2. ✅ **VERIFICAR:**
   - [ ] Lista de imóveis aparece
   - [ ] Não fica em tela branca
   - [ ] Informações dos imóveis são exibidas

**Se não aparecer nenhum imóvel:**
- Isso significa que o cliente não tem imóveis cadastrados
- Ou os imóveis não estão com `client_access_enabled = true`
- Vá para o Passo 5 para habilitar

---

### Passo 5: Habilitar Acesso aos Imóveis (se necessário)

Execute no **Supabase SQL Editor**:

```sql
-- Ver todos os imóveis do cliente
SELECT
  p.id,
  p.name,
  p.client_access_enabled,
  c.name as cliente
FROM properties p
JOIN customers c ON p.customer_id = c.id
WHERE c.name ILIKE '%NOME_DO_CLIENTE%';

-- Habilitar acesso para todos os imóveis do cliente
UPDATE properties
SET
  client_access_enabled = true,
  share_documents = true
WHERE customer_id = (
  SELECT id FROM customers
  WHERE name ILIKE '%NOME_DO_CLIENTE%'
);
```

**Depois:**
- Volte ao portal do cliente no celular
- Atualize a página (puxe para baixo)
- Os imóveis devem aparecer agora

---

### Passo 6: Ver Documentos e Anexos

1. Clique em um imóvel
2. Clique no botão **"Ver Documentos"**
3. ✅ **VERIFICAR:**
   - [ ] Seção "Documentos Cadastrais" aparece
   - [ ] Seção "Arquivos e Anexos" aparece

**Se não aparecer anexos:**
- É esperado se não houver anexos cadastrados
- Deve mostrar: "Nenhum arquivo anexado"
- Vá para o Passo 7 para adicionar anexo de teste

---

### Passo 7: Adicionar Anexo de Teste (Opcional)

**No sistema admin:**

1. Vá em **Imóveis**
2. Selecione o imóvel do cliente
3. Procure opção de **"Anexos"** ou **"Upload"**
4. Faça upload de um arquivo (PDF ou imagem)

**Depois:**
- Volte ao portal do cliente
- Clique em "Ver Documentos" novamente
- O anexo deve aparecer agora

---

### Passo 8: Testar Download (se houver anexos)

1. Na seção "Arquivos e Anexos"
2. Clique no botão **"Download"** (ícone ↓)
3. ✅ **VERIFICAR:**
   - [ ] Arquivo começa a baixar
   - [ ] Nome do arquivo está correto
   - [ ] Arquivo abre corretamente

---

### Passo 9: Testar Navegação

1. Teste todas as abas do portal:
   - [ ] **Início** - Dashboard com resumo
   - [ ] **Imóveis** - Lista de propriedades
   - [ ] **Projetos** - Projetos em andamento
   - [ ] **Serviços** - Solicitações e aprovações
   - [ ] **Notificações** - Alertas e avisos

2. ✅ **VERIFICAR:**
   - [ ] Todas as abas carregam corretamente
   - [ ] Não há erros no console (F12)
   - [ ] Interface está responsiva no celular

---

### Passo 10: Testar Logout e Re-acesso

1. Clique no botão **"Sair"** no canto superior
2. ✅ **VERIFICAR:**
   - [ ] Volta para tela de login
   - [ ] Token não está mais ativo

3. **Clique novamente no link do WhatsApp**
4. ✅ **VERIFICAR:**
   - [ ] Portal abre automaticamente
   - [ ] Não pede para inserir código
   - [ ] Token foi recuperado do link

---

## 🐛 Se Algo Não Funcionar

### Console do Navegador (DEBUG)

1. No smartphone, abra o Chrome
2. Digite na barra: `chrome://inspect`
3. Conecte o celular no PC via USB
4. Abra DevTools e veja console

**OU**

1. Acesse o portal no PC
2. Pressione **F12**
3. Vá na aba **Console**
4. Clique no link do portal
5. Veja os logs:

```
✅ Logs esperados (FUNCIONANDO):
🔍 Verificando Portal do Cliente
✅ Token encontrado via portal param: abc123...
🔵 Portal do Cliente detectado!
✅ Token válido! Cliente: Nome do Cliente
📦 Propriedades carregadas: [...]

❌ Logs de erro (PROBLEMA):
❌ Nenhum token encontrado
❌ Erro ao validar token
❌ Erro ao carregar propriedades
```

### Problemas Comuns

#### Problema 1: "Navegador não compatível"
**Causa:** Está usando URL antiga
**Solução:** Gere novo token (cria URL nova automaticamente)

#### Problema 2: Imóveis não aparecem
**Causa:** Imóveis não habilitados para acesso
**Solução:** Execute SQL do Passo 5

#### Problema 3: Anexos não aparecem
**Causa:** Não existem anexos cadastrados
**Solução:** É comportamento esperado. Adicione anexo de teste.

#### Problema 4: Token inválido
**Causa:** Token expirou (90 dias)
**Solução:** Gere novo token

---

## ✅ Resultado Esperado Final

Ao final do teste, você deve conseguir:

- [x] Abrir portal pelo smartphone sem erros
- [x] Visualizar lista de imóveis
- [x] Ver documentos cadastrais
- [x] Ver anexos (se houver)
- [x] Baixar arquivos anexados
- [x] Navegar entre todas as abas
- [x] Fazer logout e re-login automático

---

## 📸 Screenshots para Validar

Tire screenshots de:

1. **WhatsApp** - Mensagem com link
2. **Portal aberto no celular** - Tela inicial
3. **Lista de imóveis** - Mostrando propriedades
4. **Documentos expandidos** - Seção de anexos visível
5. **Console (F12)** - Logs de sucesso

---

## 🎉 Teste Concluído com Sucesso!

Se todos os checkboxes estão marcados, o sistema está **100% funcional** e pronto para uso em produção!

**Próximos passos:**
1. Testar com cliente real
2. Coletar feedback
3. Adicionar mais funcionalidades conforme necessário

---

**Dúvidas?** Consulte o arquivo `CORRECOES_PORTAL_COMPLETO.md` para documentação detalhada.
