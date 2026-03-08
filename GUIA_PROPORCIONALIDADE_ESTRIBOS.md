# Guia: Sistema de Proporcionalidade de Estribos nas Fôrmas

## Visão Geral

Este guia explica como configurar e utilizar o sistema de marcação de estribo padrão no módulo de **Fôrmas**.

O sistema permite que você:
1. Cadastre múltiplas configurações de estribos transversais para cada fôrma
2. Marque uma configuração como "padrão" usando o ícone de estrela (⭐)
3. Use esse padrão como referência para cálculos automáticos proporcionais em produtos de diferentes comprimentos

**IMPORTANTE**: A marcação do estribo padrão é feita **APENAS nas Fôrmas**. Ao cadastrar produtos, o sistema automaticamente ajusta a quantidade de estribos baseado no comprimento informado.

## Como Funciona

### Conceito de Padrão

Quando você marca um estribo como "padrão" na fôrma:
- Esta é a configuração de referência para esta fôrma
- Esta quantidade de estribos é para um comprimento específico (normalmente o comprimento padrão da fôrma)
- O sistema usa esta proporção para calcular automaticamente quantos estribos são necessários em produtos que usam esta fôrma

### Exemplo Prático

**Configuração na Fôrma:**
- Fôrma: Viga V-15x30
- Comprimento de referência: 10 metros
- Estribo padrão marcado com ⭐: 66 estribos × 0.80m cada
- Espaçamento: 15.15 cm entre estribos

**Quando você cria produtos usando esta fôrma:**
- Produto de 5 metros: Sistema pode calcular automaticamente 33 estribos (5m ÷ 10m × 66)
- Produto de 15 metros: Sistema pode calcular automaticamente 99 estribos (15m ÷ 10m × 66)
- Mantém o mesmo espaçamento proporcional

### Marcação Visual

O ícone de estrela aparece ao lado de cada estribo transversal:

- **⭐ Vazia (Cinza)**: Estribo não é o padrão
- **⭐ Preenchida (Amarela)**: Estribo é o padrão para cálculos
- Apenas um estribo pode ser marcado como padrão por fôrma

## Como Usar: Passo a Passo

### PASSO 1: Cadastrar a Fôrma

1. **Acesse o módulo "Fôrmas"**
   - Menu lateral > Fôrmas
   - Clique em "Nova Fôrma" ou edite uma fôrma existente

2. **Preencha os Dados Básicos (Passo 1)**
   - Nome da Fôrma: Ex: "Viga V-15x30"
   - Descrição: Ex: "Viga de 15cm x 30cm"
   - Largura da Seção: 0.15
   - Altura da Seção: 0.30
   - Clique em "Próximo: Configurar Armaduras"

### PASSO 2: Cadastrar Estribos Transversais

3. **Configure as Armaduras (Passo 2)**
   - Agora você está na aba "2. Configuração de Armaduras"
   - Clique em "+ Adicionar Armadura"

4. **Cadastre um estribo transversal**
   - Tipo: **Transversal (Estribos)**
   - Localização: Base
   - Identificador: Ex: "E1"
   - Posição: Ex: "Estribo principal"
   - Quantidade: Ex: `66`
   - Espaçamento (m): Ex: `0.15`
   - Comprimento do Estribo (m): Ex: `0.80`
   - Quantidade Padrão: Ex: `66`
   - Descrição: Ex: "Estribo padrão para vigas de 10m"
   - Clique em "Salvar Armadura"

5. **Cadastre mais estribos se necessário**
   - Você pode cadastrar diferentes configurações
   - Ex: 66 estribos, 50 estribos, 33 estribos, etc.

### PASSO 3: Marcar o Estribo Padrão

6. **Localize o ícone da estrela**
   - Após salvar os estribos, você verá a lista de "Armaduras Cadastradas"
   - Cada estribo transversal terá um ícone de estrela ⭐ ao lado dos botões de editar e excluir
   - **IMPORTANTE**: O ícone só aparece em armaduras do tipo "Transversal (Estribos)"

7. **Marque o estribo desejado como padrão**
   - Clique no ícone da estrela vazia (⭐ cinza)
   - A estrela ficará preenchida e amarela (⭐ amarelo)
   - Esta é agora a armadura padrão desta fôrma

8. **Alternar o padrão (opcional)**
   - Clique na estrela de outro estribo
   - A estrela do primeiro será desmarcada automaticamente
   - Apenas uma estrela pode estar preenchida por vez

9. **Desmarcar o padrão (opcional)**
   - Clique na estrela preenchida (amarela)
   - A estrela voltará a ser vazia (cinza)

### PASSO 4: Salvar a Fôrma

10. **Salve a fôrma**
    - Clique em "Salvar Fôrma"
    - A marcação do estribo padrão será salva no banco de dados

## Exemplo Completo

### Cenário: Viga V-15x30 com três configurações de estribos

#### 1. Fôrma
```
Nome: Viga V-15x30
Descrição: Viga de 15cm x 30cm
Largura: 0.15m
Altura: 0.30m
```

#### 2. Estribos Cadastrados

```
Estribo 1 (E1):
  - Tipo: Transversal (Estribos)
  - 66 estribos × 0.80m
  - Espaçamento: 0.15m
  - Quantidade Padrão: 66
  - ⭐ Marcado como PADRÃO

Estribo 2 (E2):
  - Tipo: Transversal (Estribos)
  - 50 estribos × 0.80m
  - Espaçamento: 0.20m
  - Quantidade Padrão: 50
  - ⭐ Não marcado

Estribo 3 (E3):
  - Tipo: Transversal (Estribos)
  - 33 estribos × 0.80m
  - Espaçamento: 0.30m
  - Quantidade Padrão: 33
  - ⭐ Não marcado
```

#### 3. Uso da Referência Padrão

Quando você cria produtos usando esta fôrma, o sistema pode usar o estribo padrão (66 estribos) como base para cálculos proporcionais.

## Interface Visual

### Localização do Ícone

O ícone de estrela aparece:
- À esquerda dos botões Editar (✏️) e Excluir (🗑️)
- Somente em armaduras do tipo "Transversal (Estribos)"
- Na lista "Armaduras Cadastradas" após salvar

### Estados da Estrela

```
Estado 1: Não é padrão
┌────────────────────────────────────────────────┐
│ Transversal (Estribos)  E1  Estribo principal │
│ Qtd: 66                                        │
│ Espaçamento: 0.15m                             │
│                                                │
│                    [⭐] [✏️] [🗑️]              │
│                    ↑                           │
│              Estrela vazia (cinza)             │
└────────────────────────────────────────────────┘

Estado 2: É o padrão
┌────────────────────────────────────────────────┐
│ Transversal (Estribos)  E1  Estribo principal │
│ Qtd: 66                                        │
│ Espaçamento: 0.15m                             │
│                                                │
│                    [⭐] [✏️] [🗑️]              │
│                    ↑                           │
│           Estrela preenchida (amarela)         │
└────────────────────────────────────────────────┘
```

### Tooltip (ao passar o mouse)

- **Estrela vazia**: "Marcar como Estribo Padrão"
- **Estrela preenchida**: "Estribo Padrão (clique para desmarcar)"

## Benefícios

### 1. Organização
- Identifique visualmente qual é a configuração de referência
- Diferencie rapidamente entre múltiplas configurações de estribos

### 2. Padronização
- Defina uma referência única por fôrma
- Facilite a comunicação entre engenheiros e equipe de produção

### 3. Cálculos Futuros
- Base para cálculos proporcionais em produtos de diferentes comprimentos
- Automatização de estimativas de material

### 4. Flexibilidade
- Alterne o padrão facilmente clicando nas estrelas
- Cadastre múltiplas configurações na mesma fôrma

## Cálculo de Espaçamento

O espaçamento entre estribos pode ser calculado:

```
Espaçamento (cm) = (Comprimento de Referência em metros × 100) / Quantidade de Estribos
```

### Exemplos:

| Comprimento | Estribos | Cálculo | Espaçamento |
|-------------|----------|---------|-------------|
| 10.00m | 66 | (10 × 100) / 66 | 15.15 cm |
| 10.00m | 50 | (10 × 100) / 50 | 20.00 cm |
| 10.00m | 33 | (10 × 100) / 33 | 30.30 cm |
| 5.00m | 33 | (5 × 100) / 33 | 15.15 cm |

## Perguntas Frequentes

### Por que apenas um estribo pode ser padrão por fôrma?
O padrão serve como referência única. Ter múltiplos padrões causaria ambiguidade nos cálculos proporcionais.

### O ícone não aparece. Por quê?
Verifique se:
- A armadura é do tipo "Transversal (Estribos)"
- A armadura foi salva com sucesso
- Você está visualizando a lista de "Armaduras Cadastradas"
- Não está apenas no formulário de cadastro

### Posso ter fôrmas sem estribo padrão?
Sim! A marcação de padrão é opcional. Se não houver padrão marcado, não haverá problemas.

### O que acontece se eu excluir o estribo padrão?
Ao excluir um estribo, ele é removido do banco de dados. Você pode marcar outro estribo como novo padrão.

### Posso editar um estribo que é padrão?
Sim! Use o botão de editar normalmente. A marcação de padrão será mantida após a edição.

### Posso marcar armaduras longitudinais como padrão?
Não. O ícone de estrela só aparece em armaduras transversais (estribos), pois a funcionalidade foi desenvolvida especificamente para este tipo.

### A marcação funciona em diferentes fôrmas?
Sim! Cada fôrma pode ter seu próprio estribo padrão independente das outras fôrmas.

## Dicas de Uso

1. **Marque o estribo mais usado**: Defina como padrão a configuração mais comum para aquele tipo de fôrma.

2. **Use comprimento de referência**: Cadastre estribos para um comprimento padrão (ex: 10m) e marque como referência.

3. **Cadastre variações**: Cadastre diferentes configurações (66, 50, 33 estribos) e marque a ideal como padrão.

4. **Validação**: Compare o espaçamento calculado com normas técnicas e projeto estrutural.

5. **Documentação**: Use a descrição dos estribos para documentar quando cada configuração deve ser usada.

## Verificação no Banco de Dados

Se você tem acesso ao Supabase, pode verificar se o campo está sendo salvo corretamente:

```sql
SELECT
  mr.id,
  m.name as forma_nome,
  mr.type,
  mr.identifier,
  mr.quantity,
  mr.stirrup_spacing_meters,
  mr.is_standard_pattern
FROM mold_reinforcements mr
JOIN molds m ON mr.mold_id = m.id
WHERE mr.type = 'transversal'
ORDER BY m.name, mr.is_standard_pattern DESC;
```

Você deve ver:
- `is_standard_pattern = true` para o estribo marcado com estrela
- `is_standard_pattern = false` (ou `null`) para os demais

## Cálculo Automático em Produtos

### Como Funciona o Ajuste Automático

Quando você cadastra um **Produto** usando uma fôrma que tem um estribo marcado como padrão (⭐), o sistema **automaticamente** ajusta a quantidade de estribos baseado no comprimento do produto.

### Fórmula de Cálculo

```javascript
quantidade_produto = Math.round(
  (quantidade_padrão_fôrma / comprimento_referência_fôrma) × comprimento_produto
)
```

### Exemplo Prático

**Configuração na Fôrma:**
```
Fôrma: Viga V-15x30
Comprimento de referência: 10.00m
E1 - Padrão: 66 estribos ⭐
E2 - Fixo: 10 estribos
```

**Cadastrando Produtos:**

```
Produto: Pilar de 5m
→ E1: 66 / 10 × 5 = 33 estribos (ajustado automaticamente)
→ E2: 10 estribos (mantém original)

Produto: Pilar de 15m
→ E1: 66 / 10 × 15 = 99 estribos (ajustado automaticamente)
→ E2: 10 estribos (mantém original)

Produto: Pilar de 3.5m
→ E1: 66 / 10 × 3.5 = 23 estribos (ajustado automaticamente)
→ E2: 10 estribos (mantém original)
```

### Benefícios do Ajuste Automático

✅ **Espaçamento Consistente**: Todos os produtos mantêm o mesmo espaçamento entre estribos
✅ **Sem Cálculos Manuais**: Sistema calcula automaticamente
✅ **Custos Precisos**: Quantidades corretas geram orçamentos precisos
✅ **Menos Erros**: Elimina erros de digitação ou cálculo

### Onde Ver o Cálculo

Ao selecionar uma fôrma no produto, abra o **Console do navegador (F12)** e veja:

```
🔍 Carregando dados da fôrma: <id>
📏 Diferença de comprimento: -2m (Produto: 8m - Referência: 10m)
⭐ Ajustando estribo PADRÃO "E1": 66 estribos / 10m × 8m = 53 estribos
✅ Armaduras carregadas da fôrma
```

### Documentação Adicional

Para mais detalhes sobre o cálculo proporcional automático:
- **CALCULO_PROPORCIONAL_ESTRIBOS.md** - Documentação completa do sistema
- **TESTE_CALCULO_PROPORCIONAL.md** - Guia de testes passo a passo

## Resumo dos Benefícios

1. ✅ **Visual intuitivo**: Ícone de estrela fácil de identificar
2. ✅ **Marcação simples**: Um clique para marcar/desmarcar
3. ✅ **Exclusividade**: Apenas um padrão por fôrma (automático)
4. ✅ **Persistente**: Salvo no banco de dados
5. ✅ **Flexível**: Alterne o padrão sempre que necessário
6. ✅ **Referência**: Base para cálculos proporcionais futuros

## Suporte Técnico

Se tiver problemas com o ícone de estrela:

1. Verifique se cadastrou pelo menos um estribo transversal
2. Verifique se a armadura foi salva (deve aparecer na lista)
3. Tente recarregar a página
4. Verifique o console do navegador (F12) para erros
5. Consulte o arquivo TESTE_ESTRIBO_PADRAO_FORMAS.md para guia passo a passo
6. Se o problema persistir, entre em contato com o suporte técnico

## Arquivos Relacionados

- `TESTE_ESTRIBO_PADRAO_FORMAS.md` - Guia de teste passo a passo
- `src/components/Molds.tsx` - Componente principal de Fôrmas
- Migration: `add_is_standard_pattern_to_mold_reinforcements.sql` - Estrutura do banco de dados
