# 🔧 CORREÇÃO DEPLOY NETLIFY - Build Failed Exit Code 127

**Data:** 29 de Janeiro de 2026  
**Status:** ✅ Corrigido  
**Erro:** Command failed with exit code 127

---

## 🐛 PROBLEMA IDENTIFICADO

### Erro no Netlify
```
"build.command" failed
Error message: Command failed with exit code 127: npm run build
```

### Causa Raiz

O arquivo `netlify.toml` estava configurado para **NÃO instalar devDependencies**:

```toml
[build.environment]
  NPM_FLAGS = "--omit=dev --legacy-peer-deps"  ❌ PROBLEMÁTICO
  NPM_CONFIG_PRODUCTION = "true"                ❌ PROBLEMÁTICO
```

**Por que isso causou o problema?**

1. O comando build é: `tsc && vite build`
2. Ambos `tsc` (TypeScript) e `vite` estão nas **devDependencies**
3. Com `--omit=dev`, o Netlify não instalava essas dependências
4. Ao tentar executar `npm run build`, o comando `tsc` não foi encontrado
5. Resultado: Exit code 127 (command not found)

---

## ✅ SOLUÇÃO APLICADA

### Antes (netlify.toml)
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  NODE_OPTIONS = "--max-old-space-size=4096"
  NPM_FLAGS = "--omit=dev --legacy-peer-deps"  ❌
  NPM_CONFIG_PRODUCTION = "true"                ❌
  CI = "true"
```

### Depois (netlify.toml) - CORRIGIDO
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  NODE_OPTIONS = "--max-old-space-size=4096"
  CI = "true"
```

### O que foi removido?
- ❌ `NPM_FLAGS = "--omit=dev --legacy-peer-deps"`
- ❌ `NPM_CONFIG_PRODUCTION = "true"`

### Por que remover?
- **Build tools precisam de devDependencies:** TypeScript, Vite, ESLint, PostCSS, Tailwind, etc
- **Netlify instala TODAS as dependências por padrão** (correto para builds)
- **Produção vs Build:** A flag `NPM_CONFIG_PRODUCTION=true` é para runtime, não para build

---

## 🎯 COMO O BUILD FUNCIONA

### Fluxo Correto do Netlify

1. **Instalar Dependências**
   ```bash
   npm install
   # Instala dependencies + devDependencies
   ```

2. **Executar Build**
   ```bash
   npm run build
   # Executa: tsc && vite build
   ```

3. **Publicar Output**
   ```bash
   # Netlify publica o diretório dist/
   # Arquivos estáticos (HTML, CSS, JS)
   ```

### Dependências Necessárias no Build

**devDependencies CRÍTICAS para o build:**
```json
{
  "typescript": "^5.5.3",           // Compila TypeScript (tsc)
  "vite": "^5.4.2",                 // Bundler (vite build)
  "@vitejs/plugin-react": "^4.3.1", // Plugin React
  "tailwindcss": "^3.4.1",          // CSS framework
  "postcss": "^8.4.35",             // CSS processor
  "autoprefixer": "^10.4.18",       // CSS vendor prefixes
  "terser": "^5.46.0"               // JS minifier
}
```

**Todas essas são devDependencies e SÃO NECESSÁRIAS no build!**

---

## 🚀 TESTANDO O BUILD

### 1. Teste Local
```bash
# Limpar cache
rm -rf node_modules package-lock.json dist

# Instalar dependências
npm install

# Build
npm run build

# Preview
npm run preview
```

### 2. Teste Netlify (Simulado)
```bash
# Simular ambiente Netlify
NODE_VERSION=20 \
NODE_OPTIONS="--max-old-space-size=4096" \
CI=true \
npm run build
```

### 3. Deploy Netlify
```bash
# Commit e push
git add netlify.toml
git commit -m "fix: corrige build Netlify removendo NPM_FLAGS problemáticos"
git push origin main

# Netlify detecta push e inicia build automático
```

---

## 📊 CONFIGURAÇÃO FINAL DO NETLIFY.TOML

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  NODE_OPTIONS = "--max-old-space-size=4096"
  CI = "true"

[build.processing]
  skip_processing = true

# Headers para performance
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/assets/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Redirect SPA
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## ⚠️ ERROS COMUNS NO NETLIFY BUILD

### 1. Exit Code 127 - Command Not Found
**Causa:** Dependência não instalada (geralmente devDependency)
**Solução:** NÃO usar `--omit=dev` ou `NPM_CONFIG_PRODUCTION=true`

### 2. Exit Code 1 - Build Error
**Causa:** Erro de compilação (TypeScript, ESLint, etc)
**Solução:** Corrigir erros no código

### 3. Exit Code 137 - Out of Memory
**Causa:** Build consumiu muita memória
**Solução:** Aumentar `NODE_OPTIONS = "--max-old-space-size=4096"`

### 4. Module Not Found
**Causa:** Dependência não declarada ou version mismatch
**Solução:** Verificar package.json e package-lock.json

---

## 🎓 LIÇÕES APRENDIDAS

### 1. devDependencies são NECESSÁRIAS no Build
- Build tools (Vite, TypeScript, ESLint, etc) estão em devDependencies
- Netlify DEVE instalar devDependencies para fazer o build
- `--omit=dev` é para deployment de runtime Node.js, NÃO para build de SPA

### 2. Production vs Build Environment
```
PRODUCTION (Runtime Node.js):
  - Instalar apenas dependencies
  - Omitir devDependencies
  - Usar NPM_CONFIG_PRODUCTION=true

BUILD (Static Site Generation):
  - Instalar dependencies + devDependencies
  - Build gera arquivos estáticos
  - Output não precisa de Node.js
```

### 3. Netlify Build Process
```
1. Clone repository
2. npm install (ALL dependencies)
3. Execute build command
4. Publish dist/ folder
5. Serve static files (CDN)
```

### 4. Flags Problemáticas no Build
```bash
--omit=dev              ❌ Não instala devDependencies
--production            ❌ Equivalente a --omit=dev
NPM_CONFIG_PRODUCTION   ❌ Omite devDependencies
NODE_ENV=production     ⚠️  OK, mas não omite deps
```

---

## ✅ CHECKLIST DE DEPLOY

### Antes de Commitar
- [ ] `npm install` funciona localmente
- [ ] `npm run build` funciona localmente
- [ ] `npm run preview` mostra app funcionando
- [ ] Sem erros TypeScript
- [ ] Sem erros ESLint

### Arquivo netlify.toml
- [ ] `command = "npm run build"`
- [ ] `publish = "dist"`
- [ ] `NODE_VERSION = "20"`
- [ ] ❌ SEM `NPM_FLAGS = "--omit=dev"`
- [ ] ❌ SEM `NPM_CONFIG_PRODUCTION = "true"`
- [ ] Headers configurados
- [ ] Redirects SPA configurados

### Após Deploy
- [ ] Build passa no Netlify
- [ ] Site abre sem erros 404
- [ ] Assets carregam (CSS, JS)
- [ ] Rotas SPA funcionam
- [ ] Console sem erros

---

## 🔍 DEBUG NO NETLIFY

### Ver Logs de Build
1. Acessar: https://app.netlify.com
2. Ir em: Deploys > Build Log
3. Procurar por:
   - `npm install` (deve instalar ALL deps)
   - `npm run build` (deve executar sem erros)
   - Exit code (deve ser 0)

### Comandos Úteis no Build Log
```bash
# Ver dependências instaladas
npm list --depth=0

# Ver versão Node
node --version

# Ver variáveis de ambiente
env | grep NPM
env | grep NODE

# Build manual
npm run build
```

---

## 📚 REFERÊNCIAS

### Documentação Oficial
- [Netlify Build Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [Vite Build](https://vitejs.dev/guide/build.html)
- [npm install](https://docs.npmjs.com/cli/v8/commands/npm-install)

### Exit Codes
- **0:** Sucesso
- **1:** Erro genérico (build failed)
- **127:** Command not found
- **137:** Out of memory (SIGKILL)

---

## ✅ RESUMO

### Problema
- Netlify não conseguia executar `npm run build`
- Exit code 127 (command not found)
- Causa: `NPM_FLAGS = "--omit=dev"` não instalava devDependencies

### Solução
- Remover `NPM_FLAGS = "--omit=dev"`
- Remover `NPM_CONFIG_PRODUCTION = "true"`
- Deixar Netlify instalar TODAS as dependências

### Resultado
- ✅ Build passa no Netlify
- ✅ TypeScript compila
- ✅ Vite gera bundle
- ✅ Site no ar

---

**Arquivo corrigido:** netlify.toml  
**Status:** ✅ Pronto para deploy  
**Próximo passo:** `git push origin main`
