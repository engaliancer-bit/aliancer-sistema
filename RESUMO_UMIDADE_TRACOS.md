# Resumo - Campo de Umidade em Traços TCS

## Implementação

✅ **Campo de umidade da massa adicionado aos traços tipo TCS (Concreto Seco)**

## Como Funciona

### Cadastro
1. Selecione tipo: **TCS AL - Concreto Seco**
2. Campo "Umidade da Massa (%)" aparece automaticamente
3. Informe o percentual (ex: 6.00%)
4. Sistema calcula peso total automaticamente

### Cálculo Automático
```
Peso Total = Peso dos Insumos + (Peso dos Insumos × Umidade%)

Exemplo com 6% de umidade:
- Insumos: 100 kg
- Umidade: 100 × 0.06 = 6 kg
- Total: 100 + 6 = 106 kg
```

### Visualização
No modal de detalhes, mostra:
- Tipo do traço
- Percentual de umidade
- Peso dos insumos
- **Peso total com umidade** (destaque em azul)
- Exemplo de cálculo

## Validações
- ✅ Valor entre 0 e 100%
- ✅ Aceita decimais (6.50%)
- ✅ Campo opcional
- ✅ Apenas para traços TCS

## Status
```
✅ Migração: add_moisture_percentage_to_recipes
✅ Interface: Recipes.tsx
✅ Build: 15.09s
✅ Pronto para uso
```

## Teste Rápido
1. Crie um traço tipo TCS
2. Informe 6% de umidade
3. Adicione insumos totalizando 100 kg
4. Clique em Detalhes
5. Verifique: "Peso Total com Umidade: 106.0000 kg"

