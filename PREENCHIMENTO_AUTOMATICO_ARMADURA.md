# Preenchimento Automático de Armaduras Transversais

## Funcionalidade Implementada

Quando estiver cadastrando um produto que utiliza forma e o mesmo utilizar armadura transversal (estribos), ao informar o material e diâmetro para o primeiro item de armadura transversal, o sistema preencherá automaticamente com o mesmo material e diâmetro para as demais armaduras transversais que forem cadastradas.

## Como Funciona

### 1. Cadastro da Primeira Armadura Transversal

Ao cadastrar a primeira armadura transversal de um produto:

1. Selecione **"Transversal (Estribos)"** no campo "Tipo de Armadura"
2. Preencha normalmente todos os campos:
   - Número de barras
   - Comprimento por barra
   - **Diâmetro da barra** (ex: Ø 5.0mm)
   - **Material do estoque** (ex: Aço CA-60)
   - Observações

### 2. Cadastro das Armaduras Transversais Seguintes

Quando você for adicionar uma nova armadura transversal e já existir pelo menos uma cadastrada:

1. Ao selecionar **"Transversal (Estribos)"** no campo "Tipo de Armadura"
2. **O sistema automaticamente preenche:**
   - Campo "Diâmetro da barra" com o mesmo diâmetro da primeira armadura transversal
   - Campo "Material do estoque" com o mesmo material da primeira armadura transversal

### 3. Feedback Visual

Uma mensagem verde aparece logo abaixo do campo "Tipo de Armadura" informando:

```
✓ Material e diâmetro preenchidos automaticamente baseado na primeira armadura transversal
  (Material: Aço CA-60, Diâmetro: Ø 5.0mm)
```

Esta mensagem desaparece automaticamente após 8 segundos.

## Cenário de Uso

**Exemplo prático:**

Você está cadastrando uma viga pré-moldada que possui:
- 4 barras longitudinais (armadura principal)
- 20 estribos ao longo do comprimento (armadura transversal)

**Processo:**

1. **Primeira armadura transversal:**
   - Tipo: Transversal (Estribos)
   - Número de barras: 20
   - Comprimento: 0.8m
   - Diâmetro: Ø 5.0mm - CA 60
   - Material: Aço CA-60 Ø 5.0mm
   - Salvar

2. **Segunda armadura transversal** (se houver variação, por exemplo, estribos de reforço):
   - Ao selecionar tipo "Transversal (Estribos)"
   - ✓ Sistema preenche automaticamente:
     - Diâmetro: Ø 5.0mm - CA 60
     - Material: Aço CA-60 Ø 5.0mm
   - Você só precisa ajustar:
     - Número de barras: 5
     - Comprimento: 0.8m
     - Observações: "Estribos de reforço"
   - Salvar

## Vantagens

1. **Agilidade**: Não precisa selecionar o mesmo material e diâmetro repetidamente
2. **Consistência**: Garante que todos os estribos usem o mesmo material e diâmetro
3. **Redução de erros**: Diminui chance de selecionar materiais ou diâmetros diferentes por engano
4. **Praticidade**: Especialmente útil quando há múltiplas configurações de estribos (zona de apoio, zona central, reforços, etc.)

## Quando o Preenchimento Automático NÃO Ocorre

O preenchimento automático **não acontece** nas seguintes situações:

1. **Primeira armadura transversal**: Não há referência anterior para copiar
2. **Modo de edição**: Quando você está editando uma armadura existente
3. **Outros tipos de armadura**: Funciona apenas para "Transversal (Estribos)"
   - Armaduras longitudinais não são preenchidas automaticamente
   - Armaduras de içamento não são preenchidas automaticamente
   - Ganchos de barra roscada não são preenchidos automaticamente

## Flexibilidade

Mesmo com o preenchimento automático, você pode:

- **Alterar o material**: Se quiser usar um material diferente
- **Alterar o diâmetro**: Se quiser usar um diâmetro diferente
- **Modificar qualquer campo**: O preenchimento automático é apenas uma sugestão inicial

## Observações Técnicas

- O preenchimento se baseia na **primeira** armadura transversal encontrada no banco de dados
- Apenas o **material** e o **diâmetro** são preenchidos automaticamente
- Os campos de quantidade, comprimento e observações sempre devem ser preenchidos manualmente
- A funcionalidade respeita o fluxo natural de cadastro sem interferir na edição de armaduras existentes
