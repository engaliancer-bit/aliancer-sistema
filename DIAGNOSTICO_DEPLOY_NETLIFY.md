# Diagnóstico e Solução de Deploy no Netlify

**Data:** 11 de Fevereiro de 2026
**Status:** ✅ Problemas corrigidos - Pronto para deploy

---

## ⚠️ Problemas Identificados e Corrigidos

### 1. Headers HTTP Muito Restritivos ✅ CORRIGIDO

**Problema:**
O arquivo `public/_headers` continha headers CORS muito restritivos que bloqueavam recursos:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Esses headers podem causar:
- Falha no carregamento de recursos externos
- Bloqueio de fontes web
- Problemas com CDNs
- Incompatibilidade com Supabase

**Solução aplicada:**
✅ Headers problemáticos removidos de `public/_headers`
✅ Mantidos apenas headers de segurança essenciais

### 2. Configuração do Tailwind CSS ✅ CORRIGIDO

**Problema:**
Warning sobre formato antigo do Tailwind v2.x:
```
warn - The `purge`/`content` options have changed
```

**Solução aplicada:**
✅ Simplificada configuração do `tailwind.config.js`
✅ Formato moderno e limpo

### 3. Build Local ✅ FUNCIONANDO

**Status atual:**
```
✓ built in 15.92s
Total: 20 chunks
Sem erros, sem warnings
```

---

## 🔍 Como Verificar o Deploy no Netlify

### Passo 1: Verificar Variáveis de Ambiente

No painel do Netlify, verifique se estas variáveis estão configuradas:

**Site settings → Environment variables**

```bash
# OBRIGATÓRIAS
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui

# OPCIONAIS (já configuradas no netlify.toml)
NODE_VERSION=20
NODE_OPTIONS=--max-old-space-size=4096
CI=true
```

⚠️ **IMPORTANTE:** As variáveis devem começar com `VITE_` para serem acessíveis no frontend.

### Passo 2: Verificar Configuração de Build

**Site settings → Build & deploy → Build settings**

Devem estar configurados:

```toml
Base directory: (vazio ou /)
Build command: npm run build
Publish directory: dist
```

### Passo 3: Verificar Status do Deploy

**Deploys → [último deploy]**

**3.1. Se estiver "Building":**
- ⏳ Aguarde a conclusão
- ⏱️ Tempo normal: 2-5 minutos
- 📊 Monitore os logs em tempo real

**3.2. Se estiver "Failed":**
- 📋 Abra os logs completos
- 🔍 Procure por:
  - `Error:` ou `ERROR:`
  - `Module not found`
  - `Environment variable`
  - `Permission denied`

**3.3. Se estiver "Published":**
- ✅ Deploy concluído!
- 🌐 Abra a URL do site
- 🧪 Teste a aplicação

### Passo 4: Verificar Logs do Deploy

**Se o deploy falhou, verifique:**

```bash
# Seção "Dependency installation"
# Deve mostrar: npm install
# Procure por erros de instalação

# Seção "Build"
# Deve mostrar: npm run build
# Procure por erros de compilação

# Seção "Deploy"
# Deve mostrar: Uploading files
# Procure por erros de upload
```

---

## 🚨 Erros Comuns e Soluções

### Erro 1: "Environment variable not defined"

**Sintoma:**
```
Error: VITE_SUPABASE_URL is not defined
```

**Solução:**
1. Vá em **Site settings → Environment variables**
2. Adicione as variáveis faltantes
3. Clique em **Trigger deploy** → **Deploy site**

### Erro 2: "Module not found"

**Sintoma:**
```
Error: Cannot find module '@supabase/supabase-js'
```

**Solução:**
1. Verifique se `package-lock.json` está no repositório
2. Force um novo deploy: **Trigger deploy** → **Clear cache and deploy site**

### Erro 3: "Build exceeded time limit"

**Sintoma:**
```
Error: Build timed out after 15 minutes
```

**Solução:**
1. Verifique se `NODE_OPTIONS=--max-old-space-size=4096` está configurado
2. Se necessário, aumente o timeout:
   - **Site settings → Build & deploy → Build settings**
   - **Edit settings → Timeout: 30 minutes**

### Erro 4: "Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE"

**Sintoma:**
Site carrega mas recursos não aparecem, console mostra erros CORS

**Solução:**
✅ Já corrigido! Headers COEP/COOP foram removidos

### Erro 5: "Deploy succeeded but site shows blank page"

**Sintoma:**
Deploy sucesso mas site não abre

**Solução:**
1. Abra o console do navegador (F12)
2. Procure por erros JavaScript
3. Verifique se variáveis de ambiente estão corretas
4. Limpe cache do navegador (Ctrl+Shift+R)

---

## ✅ Checklist de Deploy

Use este checklist antes de fazer deploy:

### Preparação Local
- [x] Build local funciona sem erros
- [x] Build local funciona sem warnings
- [x] Variáveis de ambiente no `.env` estão corretas
- [x] Todas as migrations do Supabase aplicadas

### Configuração Netlify
- [ ] Repositório conectado ao Netlify
- [ ] Branch principal configurado (main/master)
- [ ] Variáveis de ambiente configuradas
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Build settings corretos
  - [ ] Build command: `npm run build`
  - [ ] Publish directory: `dist`

### Após Deploy
- [ ] Deploy concluído sem erros
- [ ] Site abre no navegador
- [ ] Login funciona
- [ ] Supabase conecta corretamente
- [ ] Sem erros no console do navegador

---

## 📊 Monitoramento do Build

### Logs que Indicam Sucesso

```bash
✓ Dependency installation
  npm install completed in 45s

✓ Build script
  > sistema-gestao@1.0.0 build
  > tsc && vite build
  ✓ 1829 modules transformed
  ✓ built in 15.92s

✓ Deploy
  ✓ Uploading 21 new files
  ✓ Deploy successful
  ✓ Site is live
```

### Tempos Normais

| Fase | Tempo Esperado |
|------|----------------|
| Clone repository | 10-30s |
| Install dependencies | 30-90s |
| Build | 15-30s |
| Deploy | 10-30s |
| **TOTAL** | **2-3 minutos** |

⚠️ **Se passar de 5 minutos, pode haver problema**

---

## 🔧 Comandos Úteis no Netlify CLI

Se você tem o Netlify CLI instalado:

```bash
# Instalar CLI
npm install -g netlify-cli

# Login
netlify login

# Linkar ao site
netlify link

# Deploy manual (teste)
netlify deploy

# Deploy para produção
netlify deploy --prod

# Ver logs
netlify logs

# Ver status
netlify status
```

---

## 🌐 URLs Importantes

### Painel do Netlify
- **Dashboard:** https://app.netlify.com
- **Site settings:** https://app.netlify.com/sites/[seu-site]/settings
- **Deploys:** https://app.netlify.com/sites/[seu-site]/deploys
- **Environment:** https://app.netlify.com/sites/[seu-site]/settings/deploys#environment

### Documentação
- **Netlify Docs:** https://docs.netlify.com
- **Build settings:** https://docs.netlify.com/configure-builds/overview/
- **Environment vars:** https://docs.netlify.com/environment-variables/overview/

---

## 🎯 Próximos Passos Após Deploy Bem-Sucedido

### 1. Configurar Domínio Customizado
```
Site settings → Domain management → Add custom domain
```

### 2. Ativar HTTPS
```
Site settings → Domain management → HTTPS
(Automático para domínios Netlify)
```

### 3. Configurar Deploy Preview
```
Site settings → Build & deploy → Deploy contexts
Ativar: "Deploy Preview" para PRs
```

### 4. Configurar Notificações
```
Site settings → Build & deploy → Deploy notifications
Adicionar: Email ou Slack
```

### 5. Performance Monitoring
```
Analytics → Enable analytics
```

---

## 🐛 Ainda com Problemas?

### Opção 1: Deploy Manual (Teste)

```bash
# No seu computador
npm run build

# Arraste a pasta 'dist' para:
# Netlify Dashboard → Sites → Drag & Drop
```

Se funcionar, o problema está na configuração do build automático.

### Opção 2: Verificar Netlify Status

https://www.netlifystatus.com

Pode ser uma interrupção temporária do serviço.

### Opção 3: Logs Detalhados

1. Abra o deploy com problema
2. Clique em **Show full logs**
3. Copie todos os logs
4. Procure por linhas com `Error`, `Failed`, `Warning`

### Opção 4: Limpar Cache e Tentar Novamente

```
Deploys → Trigger deploy → Clear cache and deploy site
```

Isso força uma instalação limpa de todas as dependências.

### Opção 5: Verificar Supabase

Se o deploy funciona mas o site não:

1. Acesse o Supabase Dashboard
2. Verifique se o projeto está ativo
3. Verifique se as políticas RLS estão corretas
4. Teste a conexão manualmente

---

## 📝 Notas Importantes

### ⚠️ Sobre as Variáveis de Ambiente

**NO NETLIFY:**
- Devem ser configuradas no painel (Settings → Environment variables)
- NÃO use arquivo `.env` no repositório (é ignorado no build)

**LOCALMENTE:**
- Use arquivo `.env` na raiz do projeto
- NÃO commite o `.env` (está no .gitignore)

### 🔒 Segurança

**NUNCA commite:**
- Arquivo `.env` com chaves reais
- Chaves de API no código
- Senhas ou tokens

**SEMPRE use:**
- Variáveis de ambiente
- `.env.example` como template
- Chaves diferentes para dev/prod

---

## 🎉 Status Final

### ✅ Correções Aplicadas

1. **Headers HTTP** → Removidos headers COEP/COOP problemáticos
2. **Tailwind Config** → Simplificado para v3.x
3. **Build Local** → Funcionando sem erros/warnings
4. **Código** → Pronto para deploy

### 📦 Arquivos Modificados

- `public/_headers` → Headers seguros
- `tailwind.config.js` → Formato v3.x
- Este guia criado

### 🚀 Pronto para Deploy!

O código está pronto. Se ainda houver problemas no Netlify:
1. Verifique variáveis de ambiente
2. Verifique logs do deploy
3. Use este guia para troubleshooting

---

## 📞 Suporte

**Se precisar de ajuda:**
1. Cole os logs completos do deploy
2. Mencione qual seção está falhando
3. Informe mensagens de erro específicas

**Status do build local:**
```
✓ built in 15.92s
✓ 0 errors
✓ 0 warnings
✓ 20 chunks gerados
✓ Pronto para produção
```

**Última atualização:** 11/02/2026
**Build testado:** ✅ Sucesso
**Deploy no Netlify:** 🟡 Aguardando verificação
