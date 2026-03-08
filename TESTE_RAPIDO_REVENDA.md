# ⚡ Teste Rápido: Edição de Insumo com Revenda

## 🎯 Como Testar Agora

### Passo 1: Prepare o Console
1. Abra o navegador (Chrome/Edge/Firefox)
2. Pressione **F12** para abrir DevTools
3. Vá na aba **Console**
4. Clique no ícone de "limpar console" (🗑️)

### Passo 2: Edite o ANEL DE CERA
1. No sistema, vá em **Insumos > Compras**
2. Busque por "**ANEL DE CERA**"
3. Clique no botão **Editar** (ícone de lápis roxo)
4. O formulário vai abrir com os dados

### Passo 3: Configure a Revenda
1. Marque o checkbox **"Para Revenda"**
2. No campo **"Impostos na Revenda (%)"**:
   - Digite: `9,33` (pode usar vírgula!)
3. No campo **"Margem de Lucro (%)"**:
   - Digite: `70,00` (pode usar vírgula!)

### Passo 4: Salve e Observe
1. Clique no botão **"Salvar"**
2. **OLHE NO CONSOLE** - você deve ver:

```
🚀 Iniciando salvamento do insumo...
📋 FormData completo: { ... }
💰 Unit cost: { original: "6.59", parsed: 6.59 }
📦 Package size: { original: "1", parsed: 1 }
📊 Tax percentage: { original: "9,33", parsed: 9.33 }
📈 Margin percentage: { original: "70,00", parsed: 70 }
💰 Resale price calculated: 11.819527
🔍 Atualizando material ID: 7625bcbf-3444-41d5-afb8-82b0b0a46c1c
📦 Dados a salvar: { ... }
✅ Material atualizado com sucesso!
```

## ✅ Resultado Esperado

Se tudo funcionou:
- ✅ Nenhum erro aparece
- ✅ Formulário fecha automaticamente
- ✅ Lista de insumos é recarregada
- ✅ Material aparece com ícone de revenda ativo

## ❌ Se Der Erro

Se aparecer um alerta de erro:

1. **NÃO feche o alerta ainda**
2. Tire uma **foto/print da tela** mostrando:
   - O alerta de erro
   - O console do DevTools com os logs
3. **Copie TODO o texto** do console (Ctrl+A, Ctrl+C)
4. Me envie:
   - A mensagem do alerta
   - Os logs do console
   - Print da tela

## 🔍 O Que Procurar nos Logs

### ✅ Logs Normais (Sucesso)
```
🚀 Iniciando salvamento...
💰 Unit cost: { parsed: 6.59 }          ← Número válido
📦 Package size: { parsed: 1 }          ← Maior que zero
📊 Tax percentage: { parsed: 9.33 }     ← Número válido
📈 Margin percentage: { parsed: 70 }    ← Número válido
💰 Resale price: 11.82                  ← Calculado corretamente
✅ Material atualizado com sucesso!     ← SUCESSO!
```

### ❌ Logs com Problema
```
🚀 Iniciando salvamento...
💰 Unit cost: { parsed: NaN }           ← ❌ PROBLEMA: Valor inválido
```

ou

```
📦 Package size: { parsed: 0 }          ← ❌ PROBLEMA: Deve ser > 0
```

ou

```
❌ Erro do Supabase: ...                ← ❌ PROBLEMA: Erro no banco
```

## 🧪 Testes Adicionais (Opcional)

### Teste com Vírgula vs Ponto

1. Edite qualquer insumo
2. Teste 1: Digite impostos como `18,5` (vírgula)
3. Salve → Deve funcionar ✅
4. Edite novamente
5. Teste 2: Digite impostos como `18.5` (ponto)
6. Salve → Deve funcionar ✅

### Teste com Campos Vazios

1. Edite um insumo
2. Deixe campo "Marca" vazio
3. Deixe campo "Descrição" vazio
4. Salve → Deve funcionar ✅

### Teste com Zero (Deve Dar Erro)

1. Edite um insumo
2. Coloque "Tamanho do Pacote" = `0`
3. Salve → Deve mostrar erro ❌
4. Mensagem esperada: "Tamanho do pacote deve ser maior que zero"

## 📋 Checklist de Verificação

- [ ] Console aberto e limpo (F12)
- [ ] Editei o insumo "ANEL DE CERA"
- [ ] Habilitei "Para Revenda"
- [ ] Digitei impostos: `9,33`
- [ ] Digitei margem: `70,00`
- [ ] Cliquei em "Salvar"
- [ ] Vi os logs no console
- [ ] Material foi salvo com sucesso
- [ ] Nenhum erro apareceu

## 🎉 Sucesso!

Se todos os checkboxes acima estão marcados, **a correção funcionou perfeitamente!**

O sistema agora:
- ✅ Aceita vírgula e ponto em números
- ✅ Lida com campos vazios sem erro
- ✅ Mostra logs detalhados para debug
- ✅ Exibe mensagens de erro claras
- ✅ Salva corretamente no banco de dados

## 🆘 Ainda Não Funcionou?

Me envie:

1. **Print da tela** com o erro
2. **Logs completos** do console (copiar e colar texto)
3. **Nome do insumo** que tentou editar
4. **Valores** que digitou nos campos

Com essas informações conseguirei identificar o problema específico!
