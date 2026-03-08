# Cálculo Proporcional Automático de Estribos - Guia Rápido

## Como Usar em 3 Passos

### 1️⃣ Configure a Fôrma (Uma Vez)

```
Menu → Fôrmas → Nova Fôrma

📝 Preencha:
├─ Nome: Viga V-15x30
├─ Comprimento de referência: 10.00m
└─ Aba "Armaduras":
    ├─ E1: 66 estribos × 2.5m  ⭐ CLIQUE NA ESTRELA
    ├─ E2: 10 estribos × 2.8m
    └─ E3: 20 estribos × 2.6m

💾 Salvar
```

### 2️⃣ Cadastre Produtos

```
Menu → Produtos → Novo Produto

📝 Preencha:
├─ Nome: Pilar P1 - 5m
├─ Tipo: Pré-Moldado
├─ Fôrma: Viga V-15x30
└─ Comprimento: 5m  ← Digite aqui

✨ Sistema calcula automaticamente:
├─ E1: 33 estribos  ✅ (66 ÷ 10 × 5)
├─ E2: 10 estribos  (mantém)
└─ E3: 20 estribos  (mantém)
```

### 3️⃣ Pronto!

O sistema faz tudo automaticamente:
- ✅ Calcula quantidade correta de estribos
- ✅ Mantém espaçamento uniforme
- ✅ Atualiza custos automaticamente

## Exemplo Visual

### Na Fôrma
```
┌─────────────────────────────────────┐
│ Fôrma: Viga V-15x30                 │
│ Referência: 10.00m                  │
│                                     │
│ Armaduras Transversais:             │
│ ⭐ E1: 66 estribos  ← PADRÃO       │
│ ☆  E2: 10 estribos                 │
│ ☆  E3: 20 estribos                 │
└─────────────────────────────────────┘
```

### Nos Produtos
```
┌─────────────────────────────────────┐
│ Pilar de 5m                         │
│ E1: 33 estribos  (66/10 × 5)       │
│ E2: 10 estribos                     │
│ E3: 20 estribos                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Pilar de 15m                        │
│ E1: 99 estribos  (66/10 × 15)      │
│ E2: 10 estribos                     │
│ E3: 20 estribos                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Pilar de 8m                         │
│ E1: 53 estribos  (66/10 × 8)       │
│ E2: 10 estribos                     │
│ E3: 20 estribos                     │
└─────────────────────────────────────┘
```

## Fórmula

```
Quantidade no Produto = (Quantidade da Fôrma / Comprimento da Fôrma) × Comprimento do Produto
```

## Perguntas Rápidas

### Como marcar o estribo padrão?
Clique no ícone de **estrela (⭐)** ao lado do estribo na fôrma.

### Posso ter mais de um padrão?
Pode, mas recomenda-se apenas um para evitar confusão.

### O que acontece com os outros estribos?
Mantêm a quantidade original da fôrma.

### E se não marcar nenhum como padrão?
As quantidades da fôrma são mantidas sem cálculo proporcional.

### Preciso fazer algo no cadastro do produto?
Não! Apenas informe o comprimento. O resto é automático.

## Documentação Completa

- **CALCULO_PROPORCIONAL_ESTRIBOS.md** - Explicação detalhada
- **TESTE_CALCULO_PROPORCIONAL.md** - Guia de testes passo a passo
- **GUIA_PROPORCIONALIDADE_ESTRIBOS.md** - Guia completo do sistema

## Dica: Veja os Cálculos

Pressione **F12** no navegador e veja os logs:

```
⭐ Ajustando estribo PADRÃO "E1": 66 estribos / 10m × 5m = 33 estribos
```

## Resumo

1. Marque estribo padrão (⭐) na **Fôrma**
2. Cadastre produtos com diferentes comprimentos
3. Sistema calcula automaticamente a quantidade correta
4. Espaçamento uniforme em todos os produtos
5. Custos precisos automaticamente

**É isso! Simples, automático e preciso.**
