# Sistema Aliancer - Progressive Web App (PWA)

## O que foi implementado?

O Sistema Aliancer agora é um **Progressive Web App (PWA)** completo e funcional!

## Funcionalidades Principais

### 1. Instalação como Aplicativo
- Instale o sistema como app nativo em qualquer dispositivo
- Funciona em Android, iOS, Windows, Mac e Linux
- Ícone na tela inicial
- Abre em tela cheia (sem barra do navegador)

### 2. Funcionamento Offline
- Cache automático de recursos
- Continua funcionando sem internet
- Indicador visual de status (online/offline)
- Sincronização automática quando voltar online

### 3. Compartilhamento de Módulos
- Selecione módulos específicos para compartilhar
- Gere links personalizados
- Crie QR Codes para acesso rápido
- Filtre por categoria (Indústria, Engenharia, Construtora)

### 4. Interface Nativa
- Notificação de instalação elegante
- Indicador de status de conexão
- Atalhos rápidos para módulos principais
- Experiência de app mobile completa

## Arquivos Criados/Modificados

### Arquivos de Configuração PWA
- `public/manifest.json` - Configurações do aplicativo
- `public/sw.js` - Service Worker (gerencia cache offline)
- `src/pwa-utils.ts` - Utilitários do PWA

### Novos Componentes
- `src/components/PWAInstallPrompt.tsx` - Popup de instalação
- `src/components/PWAStatus.tsx` - Indicador de status online/offline
- `src/components/ModuleSharing.tsx` - Sistema de compartilhamento

### Arquivos Atualizados
- `index.html` - Meta tags PWA, ícones, manifest
- `src/main.tsx` - Registro do Service Worker
- `src/App.tsx` - Integração dos componentes PWA
- `src/index.css` - Animações e estilos PWA

### Documentação
- `GUIA_PWA.md` - Guia completo de uso
- `PERSONALIZACAO_PWA.md` - Como personalizar
- `README_PWA.md` - Este arquivo

## Como Usar

### Instalar o App

#### Android (Chrome/Edge)
1. Acesse o sistema
2. Clique em "Instalar Agora" no banner
3. Confirme a instalação
4. O app aparecerá na tela inicial

#### iPhone/iPad (Safari)
1. Abra o Safari
2. Toque em Compartilhar (□↑)
3. "Adicionar à Tela de Início"
4. Confirme

#### Desktop (Windows/Mac/Linux)
1. Procure o ícone ⊕ na barra de endereço
2. Clique em "Instalar"
3. O app abrirá em janela própria

### Compartilhar Módulos

1. Na tela principal, clique em "Compartilhar Módulos"
2. Filtre por categoria ou veja todos
3. Selecione os módulos desejados
4. Copie o link ou baixe o QR Code
5. Compartilhe via WhatsApp, Email, etc.

### Modo Offline

O sistema funciona automaticamente offline:
- Arquivos são salvos em cache
- Você verá um indicador "Modo Offline" no canto superior direito
- Dados são sincronizados quando voltar online

## Personalização

Consulte o arquivo `PERSONALIZACAO_PWA.md` para:
- Mudar nome e descrição do app
- Trocar cores do tema
- Alterar ícone/logo
- Personalizar mensagens
- Configurar módulos offline
- E muito mais!

## Recursos do PWA

### Manifest (public/manifest.json)
- Nome: "Sistema Aliancer - Gestão Empresarial"
- Nome Curto: "Aliancer ERP"
- Cor do Tema: #0A7EC2 (Azul Aliancer)
- Ícone: Logo da Aliancer
- Atalhos: Indústria, Engenharia, Construtora

### Service Worker (public/sw.js)
- Estratégia: Cache First com fallback para rede
- Cache: Páginas, imagens, estilos
- Atualizações: Automáticas
- Versão: v1 (incrementar ao fazer mudanças)

### Componentes React
- **PWAInstallPrompt**: Banner de instalação elegante
- **PWAStatus**: Indicador online/offline
- **ModuleSharing**: Sistema de compartilhamento completo

## Vantagens do PWA

### Para Usuários
- Acesso rápido pela tela inicial
- Funciona offline
- Atualizações automáticas
- Experiência de app nativo
- Não ocupa muito espaço

### Para Desenvolvedores
- Sem necessidade de lojas de apps
- Deploy instantâneo
- Uma base de código para todos os dispositivos
- Fácil manutenção
- SEO mantido

### Para a Empresa
- Redução de custos (sem apps nativos)
- Maior alcance (funciona em todos os dispositivos)
- Analytics web tradicionais
- Controle total sobre atualizações

## Testando o PWA

### Verificar Configuração
1. Abra Chrome DevTools (F12)
2. Vá em "Application"
3. Clique em "Manifest" para ver configurações
4. Clique em "Service Workers" para ver o worker

### Testar Offline
1. DevTools → "Network"
2. Selecione "Offline"
3. Recarregue a página
4. Deve funcionar normalmente

### Validar PWA
Use ferramentas online:
- https://www.pwabuilder.com/
- Chrome Lighthouse (DevTools)
- https://web.dev/measure/

## Estatísticas do Build

```
dist/index.html                    1.66 kB
dist/assets/index.css             39.25 kB
dist/assets/index.js            1328.25 kB
```

## Compatibilidade

### Navegadores Suportados
- Chrome/Edge (Android, Desktop): Completo
- Safari (iOS, Mac): Completo
- Firefox (Desktop): Parcial
- Samsung Internet: Completo

### Funcionalidades por Plataforma
| Funcionalidade | Android | iOS | Desktop |
|----------------|---------|-----|---------|
| Instalação | ✅ | ✅ | ✅ |
| Offline | ✅ | ✅ | ✅ |
| Atalhos | ✅ | ⚠️ | ⚠️ |
| Web Share | ✅ | ✅ | ⚠️ |

✅ Suportado completamente
⚠️ Suporte limitado ou via extensões

## Próximos Passos

### Melhorias Futuras Possíveis
1. Notificações Push
2. Sincronização em Background
3. Modo offline mais robusto
4. Cache de dados do Supabase
5. Instalação via QR Code

### Como Implementar Notificações Push
Consulte: https://web.dev/push-notifications/

### Como Melhorar o Cache
1. Aumente o array `STATIC_ASSETS` no `sw.js`
2. Implemente estratégias de cache diferentes
3. Use IndexedDB para dados estruturados

## Suporte e Troubleshooting

### Problemas Comuns

**App não instala:**
- Verifique se está em HTTPS
- Limpe o cache do navegador
- Verifique o manifest.json

**Offline não funciona:**
- Verifique se o Service Worker está registrado
- DevTools → Application → Service Workers
- Force atualização do SW

**Ícone não aparece:**
- Verifique caminho da imagem no manifest
- Certifique-se que a imagem existe
- Teste tamanhos diferentes

### Logs e Debug
Abra o Console do DevTools para ver:
- Registro do Service Worker
- Cache de recursos
- Erros de instalação

## Recursos Adicionais

### Documentação Oficial
- MDN PWA: https://developer.mozilla.org/docs/Web/Progressive_web_apps
- Web.dev: https://web.dev/progressive-web-apps/
- PWA Builder: https://www.pwabuilder.com/

### Ferramentas Úteis
- Lighthouse: Auditoria PWA
- Workbox: Framework para Service Workers
- PWA Asset Generator: Gerar ícones

## Licença e Créditos

Sistema desenvolvido por **Aliancer Engenharia & Topografia**

PWA implementado com:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- QRCode.js

---

**Data de Implementação:** Janeiro 2026
**Versão PWA:** 1.0.0
**Versão do Cache:** aliancer-v1

---

Para mais informações, consulte:
- `GUIA_PWA.md` - Instruções de uso
- `PERSONALIZACAO_PWA.md` - Guia de personalização
