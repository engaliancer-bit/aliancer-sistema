# 🔍 DEBUG - ABA IMÓVEIS

## ✅ Correções Aplicadas

Adicionei **logs extensivos** em todo o fluxo para identificar exatamente onde está o problema:

### 1. Logs de Carregamento
- ✅ Quando carrega os imóveis
- ✅ Quantos imóveis foram encontrados
- ✅ Dados completos dos imóveis

### 2. Logs de Navegação
- ✅ Quando clica na aba "Imóveis"
- ✅ Quando a aba muda de estado
- ✅ Estado atual (quantos imóveis, qual selecionado)

### 3. Logs de Interação
- ✅ Quando clica em um imóvel
- ✅ Quando carrega detalhes
- ✅ Quando carrega documentos
- ✅ Quando carrega anexos

---

## 📝 COMO TESTAR AGORA

### Passo 1: Abrir Console

1. **Abra o Portal do Cliente** (gere novo token)
2. **Pressione F12** no navegador
3. **Clique na aba "Console"**
4. **Deixe o console aberto** durante todo o teste

### Passo 2: Ver Logs Iniciais

Ao abrir o portal, você DEVE ver:

```
🟢 Portal: Iniciando...
📍 URL: https://seusite.com/?portal=abc123...
🔍 Token da URL: Encontrado
🔐 Autenticando com token...
✅ Autenticado: Nome do Cliente
📥 Carregando dados do cliente: customer-id-123
🔍 Buscando imóveis...
✅ Imóveis carregados: X
📋 Imóveis: [array com os dados]
```

**SE NÃO VER "Imóveis carregados":**
- ❌ Cliente não tem imóveis ou
- ❌ Imóveis não estão habilitados

### Passo 3: Clicar na Aba Imóveis

Quando clicar em "Imóveis", você DEVE ver:

```
🖱️ Clicou na aba Imóveis
📊 Total de imóveis: X
🔄 activeTab mudou para: properties
📊 Estado atual - properties: X selectedProperty: null
🎨 Renderizando aba Imóveis
📊 Imóveis disponíveis: X
```

**SE NÃO VER ESSES LOGS:**
- ❌ O click não está funcionando
- ❌ Há um erro JavaScript

### Passo 4: Clicar em Um Imóvel

Quando clicar em qualquer card de imóvel, você DEVE ver:

```
🖱️ Clicou no imóvel: Nome do Imóvel
📄 Carregando detalhes do imóvel: property-id-456 Nome do Imóvel
🔍 Buscando documentos da propriedade...
✅ Documentos carregados: X
📋 Documentos: [array com documentos]
🔍 Buscando anexos da propriedade...
✅ Anexos carregados: X
📎 Anexos: [array com anexos]
```

**SE NÃO VER ESSES LOGS:**
- ❌ O click no card não está funcionando
- ❌ Há erro no carregamento de dados

---

## ❌ CENÁRIOS DE ERRO

### Erro 1: "Imóveis carregados: 0"

**Causa:** Cliente não tem imóveis habilitados

**Solução:**
```sql
-- Ver imóveis do cliente
SELECT id, name, client_access_enabled
FROM properties
WHERE customer_id = 'ID_DO_CLIENTE';

-- Se houver imóveis mas client_access_enabled = false
UPDATE properties
SET client_access_enabled = true,
    share_documents = true
WHERE customer_id = 'ID_DO_CLIENTE';
```

### Erro 2: Console mostra erro vermelho

**Exemplo:**
```
❌ Erro ao carregar imóveis: {...}
```

**Ação:**
- Copie o erro completo
- Tire screenshot
- Envie para análise

### Erro 3: Aba não muda ao clicar

**Sintomas:**
- Clica em "Imóveis"
- Aba não destaca
- Conteúdo não muda

**O que verificar:**
```
1. Há log "🖱️ Clicou na aba Imóveis"? 
   - NÃO → Problema no evento de click
   - SIM → Continua abaixo

2. Há log "🔄 activeTab mudou para: properties"?
   - NÃO → Problema no setState
   - SIM → Continua abaixo

3. Há log "🎨 Renderizando aba Imóveis"?
   - NÃO → Problema na renderização condicional
   - SIM → Problema na visualização (CSS?)
```

### Erro 4: Card de imóvel não responde ao click

**Sintomas:**
- Vê os cards de imóveis
- Clica no card ou botão "Ver Detalhes"
- Nada acontece

**O que verificar:**
```
1. Há log "🖱️ Clicou no imóvel: Nome"?
   - NÃO → Evento de click não está funcionando
   - SIM → Continua abaixo

2. Há log "📄 Carregando detalhes do imóvel"?
   - NÃO → Função loadPropertyDetails não foi chamada
   - SIM → Problema no carregamento dos dados
```

---

## 📋 CHECKLIST DE DEBUG

Faça esses testes na ordem e anote os resultados:

- [ ] **1. Console aberto (F12)**
- [ ] **2. Portal carrega?** (vê "✅ Autenticado")
- [ ] **3. Imóveis carregam?** (vê "✅ Imóveis carregados: X")
  - Se X = 0, execute SQL para habilitar
  - Se X > 0, continue
- [ ] **4. Clica em "Imóveis"**
  - [ ] Vê "🖱️ Clicou na aba Imóveis"?
  - [ ] Vê "🔄 activeTab mudou"?
  - [ ] Vê "🎨 Renderizando aba Imóveis"?
  - [ ] Vê os cards na tela?
- [ ] **5. Clica em um card de imóvel**
  - [ ] Vê "🖱️ Clicou no imóvel"?
  - [ ] Vê "📄 Carregando detalhes"?
  - [ ] Vê "✅ Documentos carregados"?
  - [ ] Vê "✅ Anexos carregados"?
  - [ ] Vê detalhes na tela?

---

## 📸 O QUE ENVIAR SE AINDA NÃO FUNCIONAR

Por favor, envie:

1. **Screenshot do console inteiro** (F12 → Console → Ctrl+A → Print)
2. **URL completa** que está acessando
3. **Nome do cliente** que está testando
4. **Exatamente o que clica** e o que acontece (ou não acontece)

---

## 🎯 RESULTADO ESPERADO

Se tudo estiver funcionando, você verá:

### Console:
```
✅ Autenticado: Nome Cliente
✅ Imóveis carregados: 3
🖱️ Clicou na aba Imóveis
🎨 Renderizando aba Imóveis
📊 Imóveis disponíveis: 3
🖱️ Clicou no imóvel: Fazenda X
📄 Carregando detalhes do imóvel: property-123 Fazenda X
✅ Documentos carregados: 5
✅ Anexos carregados: 12
```

### Tela:
1. Vê aba "Imóveis" com número (ex: Imóveis 3)
2. Clica e aba fica azul
3. Vê cards dos imóveis com botão "Ver Detalhes"
4. Clica no card
5. Vê página de detalhes com:
   - Nome e dados do imóvel
   - Lista de documentos
   - Lista de anexos com botões Visualizar/Baixar

---

**STATUS:** ✅ Logs de debug adicionados
**BUILD:** ✅ Completo e pronto para teste
**AÇÃO:** Teste agora seguindo este guia!
