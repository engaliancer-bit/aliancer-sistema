# 🧪 Teste Rápido: Movimentos de Estoque

## ✅ Verificação em 3 Passos

### Passo 1: Acessar Estoque
```
1. Acesse: Indústria → Estoque de Produção
2. Localize qualquer produto (ex: "Bloco de vedação com encaixe")
3. Clique no ícone de olho (👁️) ao lado do produto
```

### Passo 2: Verificar Modal
```
✅ O que você DEVE ver agora:

┌──────────────────────────────────────────────────┐
│ Detalhes do Estoque: [Nome do Produto]          │
│ Estoque Total: X.XXX,XX UN                       │
│                                        [ X ]      │
├──────────────────────────────────────────────────┤
│ Movimentação de Estoque (Entradas e Saídas)     │
│                                                  │
│ 🟢 Total de Entradas  🔴 Total de Saídas  📊 Saldo│
│                                                  │
│ Tabela com:                                      │
│ - Data                                           │
│ - Tipo (🟢 Entrada ou 🔴 Saída)                  │
│ - Quantidade (+XXX ou -XXX)                      │
│ - Cliente (se for saída) ou Observações          │
└──────────────────────────────────────────────────┘
```

### Passo 3: Validar Dados
```
✅ Verificações:

1. Cards de Resumo:
   [ ] Card verde com "Total de Entradas"
   [ ] Card vermelho com "Total de Saídas"
   [ ] Card azul com "Saldo Calculado"

2. Tabela:
   [ ] Tem entradas (🟢) E saídas (🔴)
   [ ] Entradas mostram quantidade em verde com +
   [ ] Saídas mostram quantidade em vermelho com -
   [ ] Saídas mostram nome do cliente
   [ ] Está ordenado por data (mais recente primeiro)

3. Cálculo:
   [ ] Saldo Calculado = Total Entradas - Total Saídas
```

## 🎯 Exemplo Esperado

### Produto: Bloco de vedação com encaixe

**Cards de Resumo:**
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🔼 Entradas      │  │ 📦 Saídas        │  │ 📊 Saldo         │
│   12.945,00      │  │    4.230,00      │  │    8.715,00      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Tabela de Movimentos:**
| Data       | Tipo       | Quantidade | Cliente/Observações |
|------------|------------|------------|---------------------|
| 09/02/2026 | 🟢 Entrada | +1.910,00  | -                   |
| 07/02/2026 | 🔴 Saída   | -600,00    | Wiliam Wilges       |
| 07/02/2026 | 🔴 Saída   | -240,00    | Aderlei Rohden      |
| 07/02/2026 | 🔴 Saída   | -600,00    | Wiliam Wilges       |
| 06/02/2026 | 🟢 Entrada | +630,00    | -                   |
| 05/02/2026 | 🟢 Entrada | +950,00    | -                   |

## 🔍 Como Interpretar

### Entradas (🟢)
```
Representam PRODUÇÕES do produto
- Cor: Verde
- Sinal: + (positivo)
- Origem: Tabela "production"
- Observações: Geralmente vazio
```

### Saídas (🔴)
```
Representam ENTREGAS do produto
- Cor: Vermelho
- Sinal: - (negativo)
- Origem: Tabela "delivery_items"
- Cliente: Nome de quem recebeu
```

### Saldo
```
Fórmula: Total Entradas - Total Saídas

Exemplo:
  Entradas:  12.945,00
  Saídas:     4.230,00
  ──────────────────
  Saldo:      8.715,00

Deve conferir com "Estoque Total" na tela principal!
```

## ❌ Problemas Comuns

### Problema 1: Não aparece o botão de olho (👁️)
**Causa:** Produto pode não ter movimentações
**Solução:** Tente outro produto que já foi produzido/entregue

### Problema 2: Modal só mostra entradas
**Causa:** Produto não teve entregas ainda OU bug não corrigido
**Verificar:**
1. Abra Console (F12)
2. Procure por erros em vermelho
3. Verifique se tem entregas no banco de dados

### Problema 3: Saldo não confere
**Verificar:**
1. Saldo Calculado nos cards
2. Estoque Total no cabeçalho
3. Se diferente, pode haver:
   - Ajustes manuais de estoque
   - Movimentos de material (não produção)
   - Produtos vinculados a ordens

### Problema 4: Cliente não aparece na saída
**Causa:** Entrega pode não ter cliente associado
**Normal:** Algumas entregas podem não ter cliente

## 🧮 Validação Manual

Se quiser validar os números manualmente:

### 1. Contar Entradas
```
Some todas as quantidades verdes com +
Exemplo:
  +1.910,00
  +  630,00
  +  950,00
  +1.270,00
  ──────────
  =4.760,00 ← Deve bater com card verde
```

### 2. Contar Saídas
```
Some todas as quantidades vermelhas com -
Exemplo:
  -600,00
  -240,00
  -600,00
  -480,00
  ──────
  =1.920,00 ← Deve bater com card vermelho
```

### 3. Calcular Saldo
```
Entradas - Saídas = Saldo
4.760,00 - 1.920,00 = 2.840,00 ← Deve bater com card azul
```

## 🎯 Casos de Teste Específicos

### Teste A: Produto com Muitas Movimentações
```
Produto sugerido: "Bloco de vedação com encaixe"
Esperado:
  - Várias entradas E saídas
  - Clientes diversos
  - Datas variadas
```

### Teste B: Produto Recém Produzido
```
Produto sugerido: Qualquer produção recente
Esperado:
  - Só entradas (ainda não entregue)
  - Total Saídas = 0
  - Saldo = Total Entradas
```

### Teste C: Produto com Entrega Recente
```
Produto sugerido: Entrega dos últimos 2 dias
Esperado:
  - Última movimentação é saída (🔴)
  - Nome do cliente aparece
  - Data corresponde à entrega
```

## 📊 Checklist Completo

### Interface
- [ ] Modal abre sem demora (< 2 segundos)
- [ ] Cards de resumo aparecem
- [ ] Cores corretas (verde, vermelho, azul)
- [ ] Ícones aparecem nos badges
- [ ] Tabela está legível e organizada

### Dados
- [ ] Entradas aparecem
- [ ] Saídas aparecem
- [ ] Ambas na mesma tabela
- [ ] Ordenadas por data (recente primeiro)
- [ ] Quantidades formatadas corretamente

### Cálculos
- [ ] Total Entradas correto
- [ ] Total Saídas correto
- [ ] Saldo = Entradas - Saídas
- [ ] Números com 2 casas decimais
- [ ] Formatação brasileira (1.234,56)

### Informações
- [ ] Data formatada (DD/MM/AAAA)
- [ ] Tipo bem visível (badge)
- [ ] Cliente aparece nas saídas
- [ ] Observações aparecem quando existem

### Performance
- [ ] Sem travamentos
- [ ] Scroll suave
- [ ] Modal fecha corretamente
- [ ] Pode abrir outros produtos sem problemas

## 🐛 Como Reportar Problema

Se encontrar erro, inclua:

```
1. Produto testado:
   Nome: _______________
   ID (se souber): _______________

2. O que fez:
   - Passo a passo para reproduzir

3. O que esperava:
   - Comportamento correto

4. O que aconteceu:
   - Comportamento errado observado

5. Screenshot:
   - Tire print do modal aberto

6. Console (F12):
   - Copie erros em vermelho
   - Procure por linhas relacionadas a "delivery" ou "production"

7. Dados:
   - Total de Entradas: ___
   - Total de Saídas: ___
   - Saldo Calculado: ___
   - Estoque Total (header): ___
```

## 💡 Dicas

### Dica 1: Validar com SQL
```sql
-- Total de Entradas
SELECT SUM(quantity) FROM production
WHERE product_id = 'UUID_DO_PRODUTO'
AND production_order_id IS NULL;

-- Total de Saídas
SELECT SUM(loaded_quantity) FROM delivery_items
WHERE product_id = 'UUID_DO_PRODUTO'
AND loaded_quantity > 0;
```

### Dica 2: Filtrar no Console
```javascript
// Abra Console (F12) e digite:
console.log('Entradas:', unifiedMovements.filter(m => m.movement_type === 'entrada'));
console.log('Saídas:', unifiedMovements.filter(m => m.movement_type === 'saida'));
```

### Dica 3: Verificar Performance
```
Abra Console (F12) → Network
- Clique no olho do produto
- Verifique:
  • 2 requisições (production + delivery_items)
  • Tempo < 1 segundo cada
  • Status: 200 OK
```

## ✅ Teste Passou?

Se todos os itens abaixo estão OK:

- ✅ Cards de resumo aparecem
- ✅ Entradas E saídas na tabela
- ✅ Cores corretas (verde/vermelho)
- ✅ Clientes aparecem nas saídas
- ✅ Cálculos conferem
- ✅ Ordenação por data funciona

**PARABÉNS! O sistema está funcionando corretamente!** 🎉

## 📞 Suporte

Em caso de dúvidas:

1. Consulte: `CORRECAO_ESTOQUE_PRODUCAO_MOVIMENTOS.md`
2. Verifique logs no Console (F12)
3. Compare com exemplos deste documento
4. Teste com produto diferente

---

**Lembre-se:** Quanto mais produtos você testar, mais confiança terá no sistema!

**Teste recomendado:**
- 3 produtos diferentes
- 1 com muitas movimentações
- 1 recém produzido
- 1 com entregas recentes
