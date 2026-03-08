# Guia Rápido de Validação de Performance

## 🎯 Como Testar as Otimizações

---

## 1️⃣ BUILD LOCAL

### Executar Build Otimizado

```bash
npm run build
```

**Verificar:**
- ✅ Build completa em ~74s
- ✅ 28 chunks gerados
- ✅ Arquivos .gz criados
- ✅ Arquivos .br criados
- ✅ Avisos de chunk > 200KB apenas para pdf-lib

### Analisar Bundle

```bash
npm run build:analyze
```

**Arquivo gerado:** `dist/stats.html`

**Verificar:**
- Bundle inicial (gzip): ~165 KB
- Bundle inicial (brotli): ~143 KB
- Chunks bem distribuídos
- Sem duplicações

---

## 2️⃣ TESTE LOCAL

### Servir Build Localmente

```bash
npm run preview
```

**Acessar:** http://localhost:4173

### Chrome DevTools - Network

1. Abra DevTools (F12)
2. Vá para Network tab
3. Recarregue a página (Ctrl+R)
4. Verifique:

**index.js:**
- Size: ~10 KB (transferred)
- Status: 200
- Type: script

**react-core-[hash].js:**
- Size: ~51 KB (transferred)
- Status: 200
- Type: script

**CSS:**
- Size: ~9 KB (transferred)
- Status: 200
- Type: stylesheet

**Total (primeira visita):**
- Transferred: ~165 KB
- Resources: ~605 KB (tamanho real)
- Requests: 6-8
- Finish: < 2s (4G)

### Segunda Visita (Cache)

1. Recarregue novamente (Ctrl+R)
2. Verifique:

**Todos os assets:**
- Status: 200 (from disk cache)
- Size: (disk cache)
- Time: 0ms

**Apenas index.html revalidado!**

---

## 3️⃣ LIGHTHOUSE

### Desktop

```bash
# Chrome DevTools → Lighthouse
# Device: Desktop
# Categories: Performance, Best Practices, Accessibility, SEO
# Mode: Navigation (Default)
```

**Metas:**
- ✅ Performance: > 90
- ✅ FCP: < 1.5s
- ✅ LCP: < 2.5s
- ✅ TTI: < 3.0s
- ✅ TBT: < 300ms
- ✅ CLS: < 0.1

### Mobile

```bash
# Device: Mobile
# Throttling: Simulated 4G
```

**Metas:**
- ✅ Performance: > 85
- ✅ FCP: < 2.0s
- ✅ LCP: < 3.5s
- ✅ TTI: < 4.5s

---

## 4️⃣ DEPLOY NETLIFY

### Deploy

```bash
# Via Git push
git add .
git commit -m "Build otimizado com Brotli"
git push

# Ou via CLI
netlify deploy --prod
```

### Validar Headers Brotli

```bash
curl -I -H "Accept-Encoding: br" \
  https://seu-site.netlify.app/assets/index-[hash].js
```

**Esperado:**
```
HTTP/2 200
content-encoding: br
content-type: application/javascript; charset=utf-8
cache-control: public, max-age=31536000, immutable
vary: Accept-Encoding
```

### Validar Headers Gzip

```bash
curl -I -H "Accept-Encoding: gzip" \
  https://seu-site.netlify.app/assets/index-[hash].js
```

**Esperado:**
```
HTTP/2 200
content-encoding: gzip
content-type: application/javascript; charset=utf-8
cache-control: public, max-age=31536000, immutable
vary: Accept-Encoding
```

### Verificar Tamanho Real

```bash
# Brotli
curl -s -H "Accept-Encoding: br" \
  https://seu-site.netlify.app/assets/index-[hash].js \
  | wc -c

# Esperado: ~10000 bytes (10 KB)
```

---

## 5️⃣ WEBPAGETEST

### Teste Completo

**URL:** https://www.webpagetest.org

**Configuração:**
- Test Location:Ближайший к seus usuários
- Browser: Chrome
- Connection: 4G
- Number of Tests: 3

**Métricas Esperadas:**

| Métrica | First View | Repeat View |
|---------|------------|-------------|
| **First Byte** | < 500ms | < 100ms |
| **Start Render** | < 1.5s | < 0.5s |
| **FCP** | < 1.5s | < 0.5s |
| **LCP** | < 2.5s | < 1.0s |
| **TTI** | < 3.0s | < 1.5s |
| **Speed Index** | < 2.0s | < 1.0s |

---

## 6️⃣ CHROME DEVTOOLS - COVERAGE

### Verificar Código Não Usado

1. DevTools → More tools → Coverage
2. Clique em Record
3. Navegue pela aplicação
4. Analise:

**JavaScript:**
- Usado: > 70%
- Não usado: < 30%

**CSS:**
- Usado: > 60%
- Não usado: < 40%

---

## 7️⃣ BUNDLE ANALYZER

### Análise Visual

**Arquivo:** `dist/stats.html`

**Verificar:**

1. **Maiores Chunks:**
   - pdf-lib: ~164 KB (lazy)
   - vendor-misc: ~83 KB
   - react-core: ~51 KB

2. **Sem Duplicações:**
   - Cada biblioteca aparece apenas 1 vez
   - Sem código duplicado entre chunks

3. **Tree Shaking:**
   - lucide-react: apenas ícones usados
   - date-fns: apenas funções usadas
   - Código morto removido

---

## 8️⃣ PERFORMANCE API

### Medir no Navegador

```javascript
// Console do navegador
performance.getEntriesByType('navigation')[0].toJSON()
```

**Verificar:**
- `domContentLoadedEventEnd`: < 1500ms
- `loadEventEnd`: < 2500ms
- `domInteractive`: < 1200ms

### Resource Timing

```javascript
performance
  .getEntriesByType('resource')
  .filter(r => r.name.includes('index'))
  .forEach(r => {
    console.log(r.name, r.transferSize, 'bytes');
  });
```

**Esperado:**
- index.js: ~10000 bytes
- react-core: ~51000 bytes

---

## 9️⃣ MOBILE TESTING

### Android Chrome

**Via USB Debugging:**

```bash
# Chrome DevTools → Remote Devices
# Conecte o dispositivo Android
# Inspecione o site
```

**Verificar:**
- Carregamento < 3s em 4G
- Sem problemas de layout
- Scroll suave
- Interações responsivas

### iOS Safari

**Via Safari Technology Preview:**

```bash
# Safari → Develop → [Dispositivo]
# Inspecione o site
```

---

## 🔟 MÉTRICAS CORE WEB VITALS

### Usar Chrome User Experience Report

**URL:** https://developers.google.com/speed/pagespeed/insights/

**Inserir:** URL do seu site

**Verificar Field Data:**
- ✅ LCP: < 2.5s (Verde)
- ✅ FID: < 100ms (Verde)
- ✅ CLS: < 0.1 (Verde)

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Build

- [ ] npm run build completa sem erros
- [ ] Arquivos .br gerados
- [ ] Arquivos .gz gerados
- [ ] dist/stats.html criado
- [ ] Bundle inicial < 200 KB (gzip)

### Local Preview

- [ ] npm run preview funciona
- [ ] Site carrega corretamente
- [ ] Todos os módulos funcionam
- [ ] Sem erros no console
- [ ] Cache funciona na segunda visita

### Lighthouse

- [ ] Performance > 90 (desktop)
- [ ] Performance > 85 (mobile)
- [ ] FCP < 1.5s
- [ ] LCP < 2.5s
- [ ] TTI < 3.0s
- [ ] Todas as métricas verdes

### Netlify Deploy

- [ ] Deploy concluído com sucesso
- [ ] Headers Brotli corretos
- [ ] Headers Gzip corretos
- [ ] Cache-Control correto
- [ ] Vary: Accept-Encoding presente

### Performance Real

- [ ] WebPageTest score > A
- [ ] First Byte < 500ms
- [ ] FCP < 1.5s
- [ ] TTI < 3s
- [ ] Speed Index < 2s

### Bundle Analysis

- [ ] Sem duplicações
- [ ] Tree shaking efetivo
- [ ] Chunks bem organizados
- [ ] PDF isolado (lazy)
- [ ] Vendors otimizados

---

## 🚨 PROBLEMAS COMUNS

### Build Falha

**Erro:** "Cannot find module..."

**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Bundle Muito Grande

**Erro:** "Chunk size exceeds 200 KB"

**Solução:**
- Verificar se pdf-lib é lazy loaded
- Revisar manualChunks no vite.config.ts
- Usar dynamic import() onde possível

### Brotli Não Funciona

**Erro:** Netlify não serve .br

**Solução:**
- Verificar netlify.toml headers
- Confirmar Content-Encoding: br
- Testar com curl -H "Accept-Encoding: br"

### Cache Não Funciona

**Erro:** Assets sempre recarregam

**Solução:**
- Verificar Cache-Control headers
- Confirmar immutable flag
- Limpar cache do navegador (Ctrl+Shift+R)

---

## 📊 MÉTRICAS DE SUCESSO

### Valores Alvo

| Métrica | Alvo | Excelente |
|---------|------|-----------|
| **Bundle (gzip)** | < 200 KB | < 150 KB ✅ |
| **Bundle (brotli)** | < 180 KB | < 130 KB ✅ |
| **FCP** | < 1.5s | < 1.0s ✅ |
| **LCP** | < 2.5s | < 1.5s ✅ |
| **TTI** | < 3.0s | < 2.0s ✅ |
| **Lighthouse** | > 90 | > 95 ✅ |

### Resultado Esperado

✅ **Bundle: 143 KB** (brotli)
✅ **FCP: ~1.0s** (4G)
✅ **TTI: ~1.5s** (4G)
✅ **Lighthouse: 95**

---

## 🎓 COMANDOS ÚTEIS

```bash
# Build com análise
npm run build:analyze

# Preview local
npm run preview

# Type checking
npm run typecheck

# Limpar e rebuild
rm -rf dist node_modules
npm install
npm run build

# Testar headers (após deploy)
curl -I https://seu-site.netlify.app

# Ver tamanho dos chunks
ls -lh dist/assets/chunks/

# Contar arquivos comprimidos
ls dist/**/*.br | wc -l
ls dist/**/*.gz | wc -l
```

---

## 🏆 RESULTADO ESPERADO

**Todas as validações passam:**
✅ Build otimizado
✅ Bundle < 150 KB
✅ Compressão Brotli ativa
✅ Cache configurado
✅ Lighthouse > 95
✅ FCP < 1.5s
✅ TTI < 3s
✅ Experiência excepcional

---

**Guia de Validação de Performance**
**Teste • Valide • Confirme • Celebre**

**Data:** 29 de Janeiro de 2026
**Status:** Pronto para Testes
