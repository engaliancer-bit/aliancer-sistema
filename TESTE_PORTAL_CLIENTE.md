# Guia de Teste - Portal do Cliente Mobile

## 🔍 Como testar o link no smartphone

### Passo 1: Gerar o Token de Acesso
1. Abra o sistema no computador ou tablet
2. Vá em **"Escritório de Engenharia e Topografia"**
3. Clique em **"Portal do Cliente"**
4. Selecione um cliente que tenha telefone cadastrado
5. Clique em **"Gerar Novo Token"**
6. O sistema criará um token e mostrará 3 opções:
   - ✅ **Token**: Código do token
   - ✅ **Link do Portal**: URL completa
   - ✅ **Enviar por WhatsApp**: Botão verde

### Passo 2: Enviar para o Cliente

#### Opção A - WhatsApp (Recomendado)
1. Clique no botão verde **"Abrir WhatsApp"**
2. O sistema abrirá o WhatsApp Web ou App automaticamente
3. A mensagem já vem pronta com:
   - Saudação personalizada ao cliente
   - Explicação do que é o portal
   - Link completo
   - Instruções de uso
4. Basta clicar em **Enviar**

#### Opção B - Copiar Link Manual
1. Clique no ícone de **copiar** ao lado do "Link do Portal"
2. Cole o link em qualquer mensagem (WhatsApp, SMS, Email, etc.)
3. Envie para o cliente

### Passo 3: Cliente Acessar no Smartphone

O cliente deve:
1. **Abrir a mensagem** no WhatsApp (ou onde foi enviado)
2. **Clicar no link** - O navegador abrirá automaticamente
3. **Aguardar o carregamento** - O Portal do Cliente abrirá direto
4. **Ver os dados** - Imóveis, documentos, projetos, etc.

---

## 🔧 Formato da URL

A URL gerada tem este formato:
```
https://seusite.com/?client_portal=true&token=XXXXXXXXXXXXX
```

**Componentes:**
- `?client_portal=true` → Ativa o modo Portal do Cliente
- `&token=XXXXXXXXXXXXX` → Token de autenticação único

---

## ✅ Navegadores Compatíveis

O link funciona em **TODOS** os navegadores mobile:
- ✅ Chrome Android
- ✅ Safari iOS (iPhone/iPad)
- ✅ Firefox Mobile
- ✅ Samsung Internet
- ✅ Edge Mobile
- ✅ Opera Mobile
- ✅ Brave Mobile
- ✅ Navegadores desktop (Windows, Mac, Linux)

---

## 🐛 Problemas Comuns e Soluções

### Problema: "Cliente não possui telefone"
**Solução:**
1. Volte para **"Clientes"**
2. Edite o cadastro do cliente
3. Adicione o telefone com DDD (ex: 11987654321)
4. Salve e tente novamente

### Problema: "Número inválido"
**Solução:**
- O número deve ter 10 ou 11 dígitos
- Formato: DDDxxxxxxxx ou DDDxxxxxxxxx
- Exemplo: **11987654321** ou **1133334444**

### Problema: Link não abre no smartphone
**Solução:**
1. Verifique se o link está completo (não foi cortado)
2. Tente copiar e colar em outro navegador
3. Limpe o cache do navegador
4. Tente abrir em modo anônimo/privado

### Problema: "Token inválido ou expirado"
**Solução:**
- Os tokens duram **90 dias**
- Se expirou, gere um novo token
- Desative o token antigo se necessário

---

## 📱 Teste Rápido

Para testar você mesmo:
1. Gere um token para um cliente de teste
2. Copie a URL gerada
3. Envie para o **seu próprio WhatsApp** (pode mandar para você mesmo)
4. Abra no **seu smartphone**
5. Clique no link
6. Veja se o Portal do Cliente abre corretamente

---

## 🔒 Segurança

- Cada token é **único** e **criptografado**
- Só funciona para aquele cliente específico
- Expira automaticamente em 90 dias
- Pode ser desativado manualmente a qualquer momento
- O cliente só vê os **seus próprios dados**

---

## 💡 Dicas

1. **Sempre teste antes** de enviar para o cliente real
2. **Verifique o telefone** antes de gerar o token
3. **Use o botão WhatsApp** - é mais rápido e prático
4. **Acompanhe o uso** - veja quando foi o último acesso
5. **Gere novos tokens** se o cliente perder o acesso

---

## 📞 Mensagem Padrão do WhatsApp

```
Olá [Nome do Cliente]!

Seu acesso ao Portal do Cliente está pronto! 🎉

Através dele você poderá:
✅ Acompanhar seus imóveis e documentos
✅ Ver o status dos seus projetos
✅ Aprovar orçamentos
✅ Solicitar novos serviços
✅ Receber notificações importantes

Acesse agora: [LINK AUTOMÁTICO]

Este link é pessoal e intransferível. Válido por 90 dias.

Se tiver dúvidas, estamos à disposição!
```

---

## ✨ Status da Correção

**Data:** 16/01/2026
**Status:** ✅ CORRIGIDO
**Problema resolvido:** Links agora funcionam em todos os navegadores mobile, incluindo Chrome Android
**Tecnologia usada:** Query Parameters ao invés de Hash Routing
**Compatibilidade:** 100% dos navegadores testados
