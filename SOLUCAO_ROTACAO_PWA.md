# Solução Definitiva: Rotação Automática no App Instalado (PWA)

## PROBLEMA IDENTIFICADO

O navegador Chrome/Firefox rotaciona normalmente, mas quando instalado como App (PWA), o sistema força orientação vertical mesmo com o tablet na horizontal.

## CAUSA RAIZ

1. **Manifest.json em cache**: Android cacheia agressivamente o manifest.json
2. **Propriedade "orientation"**: Quando definida no manifest, pode bloquear rotação no PWA
3. **Service Worker cacheando HTML**: Impede que mudanças nas meta tags sejam aplicadas

## CORREÇÕES IMPLEMENTADAS (v6)

### 1. Manifest.json Atualizado
- **REMOVIDA** a propriedade `"orientation": "any"` (conflitava com PWA)
- Adicionado parâmetro de versão na `start_url`: `"/?v=6"` para forçar reconhecimento como app novo

### 2. JavaScript Agressivo no HTML
Script executado ANTES do React carregar que:
- Detecta se está rodando como PWA instalado
- Força unlock da orientação via Screen Orientation API
- Injeta CSS dinâmico para suportar ambas orientações
- Monitora mudanças de orientação a cada 500ms quando em modo PWA
- Dispara eventos de resize para forçar recálculo de layout

### 3. Service Worker v6
- **NÃO cacheia mais** o manifest.json e index.html
- Força limpeza de todos os caches antigos
- Atualização automática com recarregamento

## COMO ATUALIZAR NO TABLET

### MÉTODO OBRIGATÓRIO: Desinstalar e Reinstalar

**Não há atalho desta vez. O Android cacheia o manifest de forma muito agressiva.**

#### Passo 1: Desinstalar Completamente o App
1. Pressione e segure o ícone **"Aliancer ERP"** na tela inicial
2. Arraste para **"Desinstalar"** ou toque em **"Informações do app"** → **"Desinstalar"**
3. Confirme a desinstalação
4. **IMPORTANTE**: Toque em **"Excluir também os dados do app"** se aparecer a opção

#### Passo 2: Limpar Cache e Dados do Chrome
1. Abra **Configurações do Android** (ícone de engrenagem)
2. Vá em **Apps** ou **Aplicativos**
3. Procure e toque em **Chrome** (ou o navegador que usa)
4. Toque em **Armazenamento**
5. Toque em **"Limpar armazenamento"** ou **"Gerenciar espaço"**
6. Toque em **"Limpar todos os dados"** (não apenas cache)
7. Confirme **"OK"** ou **"Excluir"**

**ATENÇÃO**: Isso vai deslogar você de todos os sites no Chrome. Anote senhas importantes antes!

#### Passo 3: Fechar Chrome Completamente
1. Pressione o botão de **apps recentes** (quadrado ou três linhas)
2. Deslize o **Chrome** para cima para fechá-lo completamente
3. Aguarde 10 segundos

#### Passo 4: Limpar Cache do Sistema (Android)
1. Desligue o tablet completamente (pressione e segure o botão Power → Desligar)
2. Aguarde 10 segundos
3. Ligue o tablet novamente

#### Passo 5: Reinstalar o App
1. Abra o **Chrome**
2. Digite o endereço do sistema na barra de URL
3. Aguarde carregar COMPLETAMENTE (15-20 segundos na primeira vez)
4. **IMPORTANTE**: Abra o **Console do Chrome** para verificar:
   - Toque nos três pontinhos (⋮) → **"Mais ferramentas"** → **"Ferramentas do desenvolvedor"**
   - Na aba **Console**, procure por: `=== ROTATION SCRIPT LOADED ===`
   - Deve aparecer: `Display mode: Browser` (na primeira vez)
   - Deve aparecer: `✓ Screen orientation unlocked via API`
5. **Agora** você verá a notificação: **"Instalar app"** ou **"Adicionar à tela inicial"**
6. Toque em **"Instalar"**
7. Aguarde a instalação

#### Passo 6: Testar a Rotação
1. **Feche o Chrome** completamente
2. **Abra o App Aliancer** da tela inicial (NÃO pelo navegador)
3. Abra o Console novamente (no app):
   - Três pontinhos → "Mais ferramentas" → "Ferramentas do desenvolvedor"
   - Na aba Console, você DEVE ver:
     - `Display mode: PWA` ← ISSO CONFIRMA QUE É O APP
     - `🚀 Running as installed PWA - forcing rotation support`
4. **Com o tablet na HORIZONTAL**, vire para vertical
5. **Com o tablet na VERTICAL**, vire para horizontal
6. Deve rotacionar em ambas as direções

## VERIFICAÇÃO TÉCNICA

### Logs que você DEVE ver no Console do App instalado:

```
=== ROTATION SCRIPT LOADED ===
Display mode: PWA
Screen size: 1024 x 768 (ou similar)
✓ Screen orientation unlocked via API
✓ Viewport meta updated
✓ Rotation CSS injected
✓ Orientation change listener added (Screen API)
✓ Orientation change listener added (Window)
✓ Resize listener added
🚀 Running as installed PWA - forcing rotation support
=== ROTATION SCRIPT READY ===

[Service Worker] Installing v6 - PWA Rotation Fix...
[Service Worker] Activating v6 - PWA Rotation Fix...
```

### Se NÃO aparecer "Display mode: PWA":
Você está no navegador, não no app instalado. Feche o navegador e abra o ícone do app na tela inicial.

### Se NÃO aparecer "v6":
O service worker antigo ainda está ativo. Repita todo o processo desde o Passo 1.

## POR QUE ESSE PROCESSO É NECESSÁRIO?

O Android cacheia o arquivo `manifest.json` de forma extremamente agressiva e associa ele ao ícone instalado. Mesmo que você limpe o cache do navegador, o Android mantém uma cópia do manifest original.

A única forma garantida de forçar o Android a ler o novo manifest é:
1. Desinstalar completamente o app (remove a associação do manifest)
2. Limpar todos os dados do Chrome (remove cache local)
3. Reiniciar o dispositivo (limpa cache do sistema)
4. Reinstalar (cria nova associação com manifest atualizado)

## ALTERNATIVA: Modo Kiosk (Se Disponível)

Se o seu tablet suporta, você pode usar o modo desenvolvedor:

1. Ative **Opções do desenvolvedor**:
   - Vá em Configurações → Sobre o tablet
   - Toque 7 vezes em "Número da compilação"
2. Vá em **Opções do desenvolvedor**
3. Ative **"Não manter atividades"**
4. Isso forçará o Android a recarregar o app toda vez que você abrir

## IMPORTANTE: TESTE APÓS INSTALAÇÃO

Não feche estas instruções até confirmar que:
- [ ] O app abre em modo PWA (não navegador)
- [ ] Console mostra "Display mode: PWA"
- [ ] Console mostra "v6" no Service Worker
- [ ] Tablet rotaciona automaticamente em AMBAS as direções
- [ ] Interface se ajusta corretamente após rotação

## SOLUÇÃO DE PROBLEMAS

### App ainda força vertical após todo o processo:

1. Verifique se a **rotação automática do Android** está ativa:
   - Deslize de cima para baixo (painel rápido)
   - Procure ícone "Auto-rotate" ou "Rotação automática"
   - Deve estar LIGADO (azul/destacado)

2. Teste se outros apps rotacionam:
   - Abra o YouTube ou Google Chrome
   - Se esses também não rotacionam, é configuração do tablet

3. Verifique o modelo do tablet:
   - Alguns tablets baratos travam a orientação por hardware
   - Teste em outro tablet se possível

4. Cache persistente do Android:
   - Como último recurso, faça **reset de fábrica** do tablet
   - (Faça backup antes!)

## SUPORTE

Se após seguir TODOS os passos o problema persistir, forneça:
- Modelo completo do tablet
- Versão do Android
- Screenshot do Console mostrando os logs
- Vídeo do problema (grave virando o tablet)

---

**Versão do sistema**: v6 - PWA Rotation Fix
**Data**: 2026-01-27
**Service Worker**: v6
