# Instruções para Atualizar o App com Suporte a Rotação Automática

## O QUE FOI CORRIGIDO

O sistema agora detecta automaticamente a rotação do tablet e ajusta a interface entre modo vertical e horizontal em tempo real.

## CORREÇÕES IMPLEMENTADAS

1. **Meta tags HTML atualizadas** com suporte completo para rotação
2. **Manifest.json configurado** com `"orientation": "any"`
3. **Service Worker atualizado** (v5) para forçar limpeza de cache
4. **JavaScript adicionado** para detectar mudanças de orientação
5. **Atualização automática** do app quando nova versão estiver disponível

## COMO ATUALIZAR NO TABLET ANDROID

### MÉTODO 1: Atualização Automática (Recomendado)

1. **Abra o App Aliancer** que já está instalado
2. O sistema detectará automaticamente a nova versão
3. Aguarde 3-5 segundos
4. O app vai recarregar sozinho
5. **Teste**: Vire o tablet - deve rotacionar automaticamente

Se não funcionar automaticamente, use o Método 2:

### MÉTODO 2: Atualização Manual Completa

#### Passo 1: Desinstalar o App Atual
1. Pressione e segure o ícone do **App Aliancer** na tela inicial
2. Arraste para **"Desinstalar"** ou toque em **"Remover"**
3. Confirme a desinstalação

#### Passo 2: Limpar Cache do Navegador
1. Abra o **Chrome** (ou navegador usado)
2. Toque nos três pontinhos (⋮) no canto superior direito
3. Vá em **Configurações**
4. Toque em **Privacidade e segurança**
5. Toque em **Limpar dados de navegação**
6. Selecione:
   - ✓ Cookies e dados de sites
   - ✓ Imagens e arquivos em cache
   - ✓ Dados de aplicativos hospedados
7. Selecione **"Todo o período"** no topo
8. Toque em **"Limpar dados"**
9. **Feche completamente o Chrome** (arraste para cima no menu de apps recentes)

#### Passo 3: Reinstalar o App
1. Abra o **Chrome** novamente
2. Digite o endereço do sistema na barra de URL
3. Aguarde o site carregar completamente (10-15 segundos)
4. Você verá uma notificação na parte inferior: **"Instalar app"** ou **"Adicionar à tela inicial"**
5. Toque em **"Instalar"**
6. Aguarde a instalação
7. Abra o app recém-instalado

#### Passo 4: Testar a Rotação
1. Abra o **App Aliancer** da tela inicial
2. **Vire o tablet para o modo horizontal** (paisagem)
3. A interface deve rotacionar automaticamente
4. **Vire de volta para vertical** (retrato)
5. A interface deve voltar para o modo vertical

## VERIFICAÇÃO DA CONFIGURAÇÃO DO TABLET

Certifique-se de que a rotação automática está ativada no Android:

1. Deslize o dedo **de cima para baixo** na tela (painel de notificações)
2. Procure o ícone de **"Rotação automática"** ou **"Auto-rotate"**
3. Deve estar **ATIVADO** (geralmente fica azul/destacado)
4. Se estiver desativado, toque nele para ativar

## SOLUÇÃO DE PROBLEMAS

### Se ainda não rotacionar após a atualização:

1. **Reinicie o tablet**
2. Repita o **Método 2** (desinstalar e reinstalar)
3. Verifique se está usando a versão mais recente do Chrome
4. Teste em outro app (YouTube, navegador) se o tablet está rotacionando
5. Se o problema persistir, pode ser uma limitação do hardware/sistema do tablet

## VERIFICAÇÃO TÉCNICA (Para TI)

Para verificar se a nova versão está instalada:

1. Abra o app
2. Abra as **Ferramentas do desenvolvedor**:
   - Chrome: Menu (⋮) → "Mais ferramentas" → "Ferramentas do desenvolvedor"
3. Vá na aba **Console**
4. Procure por: `Service Worker v5` ou `Screen orientation unlocked`
5. Se aparecer, a nova versão está instalada

## CHANGELOG TÉCNICO

- **Service Worker**: v4 → v5
- **Manifest**: `orientation: "portrait"` → `"any"`
- **HTML Meta Tags**: Adicionadas tags específicas para Android
- **JavaScript**: Listeners de orientação adicionados
- **Cache Strategy**: Forçada limpeza de cache antigo
- **Auto-update**: Implementado recarregamento automático

## SUPORTE

Se após seguir todos os passos o problema persistir, contate o suporte técnico com as seguintes informações:

- Modelo do tablet
- Versão do Android
- Navegador usado (Chrome, Firefox, etc.)
- Se outros apps rotacionam normalmente
- Screenshot das Ferramentas do Desenvolvedor (Console)
