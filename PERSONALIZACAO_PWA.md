# Guia de Personalização do PWA

## Como Personalizar o PWA do Sistema Aliancer

Este guia mostra como você pode personalizar o Progressive Web App de acordo com suas necessidades.

## 1. Personalizar Nome e Descrição

### Arquivo: `public/manifest.json`

```json
{
  "name": "SEU NOME COMPLETO AQUI",
  "short_name": "NOME CURTO",
  "description": "SUA DESCRIÇÃO AQUI"
}
```

**Exemplo:**
```json
{
  "name": "Minha Empresa - Sistema de Gestão",
  "short_name": "Minha Empresa",
  "description": "Sistema completo de gestão empresarial"
}
```

## 2. Mudar Cores do Tema

### Arquivo: `public/manifest.json`

```json
{
  "background_color": "#SUA_COR_AQUI",
  "theme_color": "#SUA_COR_AQUI"
}
```

**Cores Sugeridas:**
- Azul: `#0A7EC2` (atual)
- Verde: `#10B981`
- Vermelho: `#EF4444`
- Roxo: `#8B5CF6`
- Laranja: `#F97316`

**Onde a cor aparece:**
- `theme_color`: Barra de status no celular
- `background_color`: Cor de fundo ao abrir o app

## 3. Trocar Ícone/Logo

### Opção 1: Usando Imagem Existente

1. Coloque sua logo na pasta `public/`
2. Edite `public/manifest.json`:

```json
{
  "icons": [
    {
      "src": "/sua-logo.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/sua-logo.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Opção 2: Criar Ícones Profissionais

**Tamanhos Recomendados:**
- 192x192 pixels (obrigatório)
- 512x512 pixels (obrigatório)
- 144x144 pixels (opcional)
- 96x96 pixels (opcional)
- 48x48 pixels (opcional)

**Formato:** PNG com fundo transparente ou branco

**Ferramentas Online Gratuitas:**
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

## 4. Personalizar Tela de Compartilhamento

### Arquivo: `src/components/ModuleSharing.tsx`

**Mudar Texto do Cabeçalho:**
Linha 98-102:
```tsx
<h2 className="text-2xl font-bold text-gray-900">
  SEU TÍTULO AQUI
</h2>
<p className="text-gray-600">
  SUA DESCRIÇÃO AQUI
</p>
```

**Adicionar/Remover Módulos:**
Linha 15-32 (array `AVAILABLE_MODULES`):

```tsx
const AVAILABLE_MODULES: Module[] = [
  {
    id: 'meu-modulo',
    name: 'Meu Módulo',
    category: 'factory',
    icon: '📦',
    description: 'Descrição do módulo'
  },
  // ... mais módulos
];
```

## 5. Personalizar Mensagem de Instalação

### Arquivo: `src/components/PWAInstallPrompt.tsx`

**Título (linha 51):**
```tsx
<h3 className="font-bold text-lg mb-1">
  SEU TÍTULO AQUI
</h3>
```

**Descrição (linha 52-55):**
```tsx
<p className="text-sm text-blue-100 mb-4">
  SUA MENSAGEM PERSONALIZADA AQUI
</p>
```

**Benefícios (linha 69-74):**
```tsx
<ul className="text-xs space-y-1 text-blue-100">
  <li>• Seu benefício 1</li>
  <li>• Seu benefício 2</li>
  <li>• Seu benefício 3</li>
</ul>
```

## 6. Configurar Módulos Offline

### Arquivo: `public/sw.js`

**Adicionar mais arquivos ao cache (linha 6-14):**
```javascript
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/sua-imagem.jpg',
  '/seu-arquivo.css',
  // ... mais arquivos
];
```

**IMPORTANTE:**
- Adicione apenas arquivos essenciais
- Imagens grandes podem deixar o cache pesado
- Arquivos no cache funcionam offline

## 7. Atalhos Personalizados

### Arquivo: `public/manifest.json`

Seção `shortcuts` (linha 28-60):

```json
{
  "shortcuts": [
    {
      "name": "Nome do Atalho",
      "short_name": "Atalho",
      "description": "Descrição",
      "url": "/?sua_rota",
      "icons": [
        {
          "src": "/seu-icone.jpg",
          "sizes": "192x192"
        }
      ]
    }
  ]
}
```

**Como funciona:**
- Pressione e segure o ícone do app
- Aparecerão os atalhos configurados
- Funciona apenas em alguns dispositivos Android

## 8. Mudar Orientação da Tela

### Arquivo: `public/manifest.json`

```json
{
  "orientation": "portrait"
}
```

**Opções:**
- `portrait`: Apenas vertical (padrão)
- `landscape`: Apenas horizontal
- `any`: Qualquer orientação

## 9. Configurar Modo de Exibição

### Arquivo: `public/manifest.json`

```json
{
  "display": "standalone"
}
```

**Opções:**
- `standalone`: Tela cheia, sem navegador (recomendado)
- `fullscreen`: Tela totalmente cheia
- `minimal-ui`: Com controles mínimos
- `browser`: Como página web normal

## 10. Personalizar Nome no HTML

### Arquivo: `index.html`

```html
<title>Seu Título Aqui</title>
<meta name="description" content="Sua descrição aqui" />
<meta name="apple-mobile-web-app-title" content="Nome iOS" />
```

## Exemplos de Personalização Completa

### Exemplo 1: Empresa de Transporte

```json
{
  "name": "TransLog - Gestão de Frotas",
  "short_name": "TransLog",
  "theme_color": "#F97316",
  "background_color": "#F97316",
  "description": "Sistema de gestão de transportes e logística"
}
```

### Exemplo 2: Restaurante

```json
{
  "name": "GastroSystem - Gestão Gastronômica",
  "short_name": "GastroSys",
  "theme_color": "#EF4444",
  "background_color": "#EF4444",
  "description": "Gestão completa para restaurantes"
}
```

### Exemplo 3: Consultoria

```json
{
  "name": "ConsultPro - Gestão de Projetos",
  "short_name": "ConsultPro",
  "theme_color": "#8B5CF6",
  "background_color": "#8B5CF6",
  "description": "Sistema de gestão para consultorias"
}
```

## Testando Suas Personalizações

### 1. Desenvolvimento Local
```bash
npm run dev
```

### 2. Verificar PWA
1. Abra o Chrome DevTools (F12)
2. Vá em "Application" → "Manifest"
3. Veja se está tudo correto

### 3. Testar Instalação
1. Clique em "Application" → "Service Workers"
2. Marque "Update on reload"
3. Teste instalar o app

### 4. Validar PWA
- Acesse: https://www.pwabuilder.com/
- Cole a URL do seu site
- Veja a pontuação e sugestões

## Dicas Importantes

### Performance
- Mantenha o cache pequeno (< 10 MB ideal)
- Use imagens otimizadas (WebP quando possível)
- Não adicione arquivos desnecessários ao cache

### Experiência do Usuário
- Escolha cores que combinem com sua marca
- Use ícones claros e legíveis
- Teste em diferentes dispositivos

### Manutenção
- Aumente o número da versão no cache ao fazer mudanças
- Teste após cada personalização
- Documente suas alterações

## Suporte

Arquivos Principais para Personalização:
- `public/manifest.json` - Configurações do PWA
- `public/sw.js` - Service Worker (cache offline)
- `src/components/PWAInstallPrompt.tsx` - Popup de instalação
- `src/components/ModuleSharing.tsx` - Compartilhamento
- `index.html` - Meta tags e títulos

---

**Precisa de Ajuda?**
Consulte a documentação oficial:
- MDN PWA: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- Web.dev PWA: https://web.dev/progressive-web-apps/

---

**Desenvolvido pela Aliancer Engenharia & Topografia**
