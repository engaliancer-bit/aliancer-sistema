# Debug - Tela Preta e Piscando

## Sistema de Logs Implementado

Implementei um sistema completo de logs para identificar exatamente o que está causando a tela preta e piscando.

## Como Ver os Logs

### 1. Abrir o Console do Navegador

#### No Chrome/Edge/Brave:
- Pressione `F12` ou `Ctrl+Shift+I` (Windows/Linux)
- Pressione `Cmd+Option+I` (Mac)
- Ou clique com botão direito → "Inspecionar" → aba "Console"

#### No Firefox:
- Pressione `F12` ou `Ctrl+Shift+K`
- Ou clique com botão direito → "Inspecionar Elemento" → aba "Console"

### 2. Recarregar a Página

Com o console aberto, pressione `F5` ou `Ctrl+R` para recarregar a página.

### 3. Verificar os Logs

Você deve ver uma sequência de logs como:

```
🟢 MAIN.TSX: Iniciando aplicação...
🔍 ENV: { SUPABASE_URL: "...", HAS_ANON_KEY: true, ... }
✅ Elemento root encontrado, renderizando App...
✅ App renderizado com sucesso!
🟢 APP: Componente iniciando...
🔍 APP: Verificando modo de renderização...
  - publicToken: null
  - isClientPortal: false
  - mainTab: null
  - factoryTab: null
🔵 APP: Renderizando interface principal
```

## O que Procurar

### 1. Erros em Vermelho (🔴)

Se você ver mensagens começando com 🔴, isso indica um erro. Copie a mensagem completa do erro.

**Exemplo de erro:**
```
🔴 ERRO CRÍTICO: Elemento root não encontrado!
🔴 ERROR BOUNDARY CAUGHT: Error: ...
```

### 2. Modo de Renderização

Verifique qual modo está sendo detectado:
- `🔵 APP: Renderizando PublicQRView` - Modo de visualização pública
- `🔵 APP: Renderizando ClientPortal` - Portal do cliente
- `🔵 APP: Renderizando interface principal` - Interface normal

### 3. Estado do ClientPortal (se aplicável)

Se o sistema detectou ClientPortal, você verá:
```
🟢 ClientPortal: Componente iniciando...
🔍 ClientPortal: Estado antes de renderizar: {
  loading: true/false,
  isAuthenticated: true/false,
  hasCustomer: true/false
}
```

Se `loading: true` não mudar para `false`, há um problema no carregamento.

### 4. Loops Infinitos

Se você ver as mesmas mensagens repetindo rapidamente (dezenas ou centenas por segundo), isso indica um loop infinito:

```
🟢 APP: Componente iniciando...
🟢 APP: Componente iniciando...
🟢 APP: Componente iniciando...
🟢 APP: Componente iniciando...
... (repetindo rapidamente)
```

## Componentes de Segurança Implementados

### 1. Error Boundary

Captura erros de renderização e exibe uma tela amigável com detalhes do erro.

### 2. Loading Fallback

Exibe uma tela de carregamento enquanto a aplicação inicializa.

### 3. Suspense

Gerencia componentes assíncronos e exibe fallback durante carregamento.

## Problemas Comuns e Soluções

### Problema 1: Tela Preta Sem Logs

**Sintoma:** Console vazio, sem nenhuma mensagem
**Causa:** Erro antes do JavaScript carregar
**Solução:**
1. Verifique a aba "Network" (Rede) no DevTools
2. Procure por arquivos em vermelho (erro 404 ou 500)
3. Verifique se os arquivos .js estão carregando

### Problema 2: "Missing Supabase environment variables"

**Sintoma:** Erro dizendo que faltam variáveis de ambiente
**Causa:** Arquivo .env não está sendo carregado
**Solução:**
1. Verifique se o arquivo `.env` existe na raiz do projeto
2. Recarregue o servidor de desenvolvimento
3. Verifique se as variáveis começam com `VITE_`

### Problema 3: Loading Infinito

**Sintoma:** Tela de loading não desaparece
**Causa:** Alguma promessa nunca resolve
**Solução:**
1. Verifique os logs no console
2. Procure por mensagens de erro do Supabase
3. Verifique conexão com internet

### Problema 4: Loop de Renderização

**Sintoma:** Logs repetindo rapidamente, tela piscando
**Causa:** useEffect ou setState causando loop
**Solução:**
1. Identifique qual componente está em loop (pelos logs)
2. Verifique as dependências dos useEffect
3. Pode precisar adicionar useCallback ou useMemo

### Problema 5: "Failed to fetch" ou erro de rede

**Sintoma:** Erros relacionados a network ou fetch
**Causa:** Problema de conexão com Supabase
**Solução:**
1. Verifique sua conexão com internet
2. Verifique se a URL do Supabase está correta no .env
3. Teste se o Supabase está online

## Como Reportar o Problema

Se você ainda tiver problemas, copie e cole:

1. **Toda a sequência de logs do console** (desde o primeiro até onde o erro aparece)

2. **Erros em vermelho** (se houver)

3. **Aba Network** - Se há algum arquivo com erro (vermelho)

4. **URL atual** - A URL que está na barra de endereços

5. **Navegador e versão** - Ex: Chrome 120, Firefox 121, etc

## Próximos Passos

1. Abra o console (F12)
2. Recarregue a página (F5)
3. Observe os logs
4. Identifique onde o processo para
5. Copie os logs e erros relevantes
6. Reporte de volta com essas informações

## Melhorias Implementadas

### Logs Detalhados
- ✅ Log de inicialização do main.tsx
- ✅ Log de variáveis de ambiente
- ✅ Log de inicialização do App
- ✅ Log de modo de renderização
- ✅ Log de inicialização do ClientPortal
- ✅ Log de estado antes de cada renderização

### Tratamento de Erros
- ✅ ErrorBoundary para capturar erros de React
- ✅ Try/catch no render principal
- ✅ Validação de elemento root

### Fallbacks
- ✅ LoadingFallback para Suspense
- ✅ Tela de loading no ClientPortal
- ✅ Tela de erro amigável no ErrorBoundary

### Prevenção de Loops
- ✅ useCallback em funções de carregamento
- ✅ useRef para controle de carregamento único
- ✅ Dependências corretas nos useEffect

---

Com esses logs detalhados, agora será possível identificar exatamente onde está o problema!
