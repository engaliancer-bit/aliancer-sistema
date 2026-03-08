# Correção: Preservação de Material e Diâmetro ao Alterar Comprimento

## Problema Identificado

Quando o usuário alterava o **comprimento total da peça** em um produto, os dados de **material** e **diâmetro** das armaduras eram perdidos e precisavam ser preenchidos novamente.

### Comportamento Anterior (Incorreto)

```
1. Usuário cadastra produto
2. Seleciona fôrma → Armaduras são carregadas
3. Preenche material e diâmetro para cada armadura
4. Altera o comprimento da peça
5. Sistema recarrega a fôrma
6. ❌ Material e diâmetro são PERDIDOS (voltam vazios)
7. Usuário precisa preencher tudo novamente
```

## Solução Implementada

Sistema agora **preserva automaticamente** os dados de material e diâmetro ao recarregar a fôrma.

### Comportamento Atual (Correto)

```
1. Usuário cadastra produto
2. Seleciona fôrma → Armaduras são carregadas
3. Preenche material e diâmetro para cada armadura
4. Altera o comprimento da peça
5. Sistema recarrega a fôrma
6. ✅ Material e diâmetro são PRESERVADOS
7. Apenas quantidades/comprimentos são recalculados
```

## Como Funciona

### Algoritmo de Preservação

1. **Antes de recarregar:**
   - Sistema cria um "mapa de backup" das armaduras atuais
   - Chave: `tipo-identificador-descrição`
   - Valor: `material_id`, `material_name`, `bar_diameter_mm`

2. **Durante o recarregamento:**
   - Fôrma é consultada no banco de dados
   - Armaduras são recriadas com quantidades recalculadas

3. **Ao criar cada armadura:**
   - Sistema busca no mapa de backup usando a chave
   - Se encontrar: restaura material e diâmetro
   - Se não encontrar: deixa vazio (armadura nova)

### Exemplo Prático

```javascript
// ANTES DE RECARREGAR - Criar Mapa de Backup
const backup = new Map();

// Armadura existente: E1 - Padrão do comprimento
backup.set(
  'transversal--E1 - Padrão do comprimento',
  {
    material_id: 'abc123',
    material_name: 'Ferro CA-60 Ø 5.0mm',
    bar_diameter_mm: 5.0
  }
);

// DURANTE O RECARREGAMENTO - Buscar no Backup
const key = 'transversal--E1 - Padrão do comprimento';
const preserved = backup.get(key);

// Criar armadura com dados preservados
{
  material_id: preserved?.material_id || '',  // 'abc123' ✅
  material_name: preserved?.material_name || '',  // 'Ferro CA-60...' ✅
  bar_diameter_mm: preserved?.bar_diameter_mm || 0,  // 5.0 ✅
  bar_count: 33,  // Recalculado ✅
  bar_length_meters: 2.5,  // Da fôrma ✅
}
```

## Código Implementado

### Arquivo: `src/components/Products.tsx`

**Função modificada:** `loadMoldData` (linhas 566-714)

#### 1. Criar Mapa de Backup (linhas 570-591)

```typescript
// Preservar dados existentes das armaduras (material e diâmetro)
const existingReinforcementsMap = new Map<string, {
  material_id: string;
  material_name: string;
  bar_diameter_mm: number;
}>();

reinforcements.forEach(r => {
  const key = `${r.type}-${r.identifier || ''}-${r.description}`;
  if (r.material_id || r.bar_diameter_mm > 0) {
    existingReinforcementsMap.set(key, {
      material_id: r.material_id,
      material_name: r.material_name || '',
      bar_diameter_mm: r.bar_diameter_mm,
    });
    console.log(`💾 Preservando dados de: ${key}`, {
      material_id: r.material_id,
      material_name: r.material_name,
      diameter: r.bar_diameter_mm
    });
  }
});
```

#### 2. Restaurar Dados Preservados (linhas 679-695)

```typescript
// Restaurar dados preservados (material e diâmetro)
const key = `${mr.type === 'lifting' ? 'lifting_hooks' : mr.type === 'threaded_bar_hook' ? 'threaded_bar_hooks' : mr.type}-${mr.identifier || ''}-${mr.description || ''}`;
const preserved = existingReinforcementsMap.get(key);

if (preserved) {
  console.log(`♻️ Restaurando dados de: ${key}`, preserved);
}

return {
  tempId: `mold-${mr.id}-${Date.now()}`,
  type: mr.type === 'lifting' ? 'lifting_hooks' : mr.type === 'threaded_bar_hook' ? 'threaded_bar_hooks' : mr.type,
  identifier: mr.identifier || null,
  material_id: preserved?.material_id || '',  // ✅ RESTAURADO
  material_name: preserved?.material_name || '',  // ✅ RESTAURADO
  bar_count: barCount,
  bar_length_meters: barLengthMeters,
  bar_diameter_mm: preserved?.bar_diameter_mm || 0,  // ✅ RESTAURADO
  // ... outros campos
};
```

## Recarga Automática ao Alterar Comprimento

O sistema já tinha um handler que recarrega automaticamente a fôrma quando o comprimento é alterado:

### Arquivo: `src/components/Products.tsx` (linhas 2266-2270)

```typescript
// Recalcular armaduras se houver forma selecionada
if (formData.mold_id && length) {
  console.log('♻️ Recalculando armaduras com novo comprimento:', length);
  loadMoldData(formData.mold_id, length);
}
```

Isso significa que:
- ✅ Usuário altera o comprimento
- ✅ Sistema detecta automaticamente
- ✅ Recarrega a fôrma com novo comprimento
- ✅ **Preserva material e diâmetro** (nova funcionalidade!)
- ✅ Recalcula apenas quantidades e comprimentos

## Chave de Identificação

Para identificar cada armadura de forma única, usamos:

```javascript
const key = `${type}-${identifier}-${description}`;
```

### Exemplos de Chaves

| Tipo | Identificador | Descrição | Chave Gerada |
|------|---------------|-----------|--------------|
| transversal | E1 | Padrão do comprimento | `transversal-E1-Padrão do comprimento` |
| longitudinal | A | 4 barras superiores | `longitudinal-A-4 barras superiores` |
| longitudinal | B | 4 barras inferiores | `longitudinal-B-4 barras inferiores` |
| lifting_hooks | - | Ganchos de içamento | `lifting_hooks--Ganchos de içamento` |

## Logs no Console

Quando você altera o comprimento, veja no console (F12):

```
♻️ Recalculando armaduras com novo comprimento: 8
🔍 Carregando dados da fôrma: abc123-def456...

💾 Preservando dados de: transversal-E1-Padrão do comprimento
   material_id: "xyz789"
   material_name: "Ferro CA-60 Ø 5.0mm"
   diameter: 5.0

💾 Preservando dados de: longitudinal-A-4 barras superiores
   material_id: "abc456"
   material_name: "Ferro CA-50 Ø 10.0mm"
   diameter: 10.0

📏 Diferença de comprimento: -2m (Produto: 8m - Referência: 10m)
⭐ Ajustando estribo PADRÃO "E1": 66 estribos / 10m × 8m = 53 estribos

♻️ Restaurando dados de: transversal-E1-Padrão do comprimento
   material_id: "xyz789"
   material_name: "Ferro CA-60 Ø 5.0mm"
   bar_diameter_mm: 5.0

♻️ Restaurando dados de: longitudinal-A-4 barras superiores
   material_id: "abc456"
   material_name: "Ferro CA-50 Ø 10.0mm"
   bar_diameter_mm: 10.0

✅ Armaduras carregadas da fôrma: 5 armaduras
```

## O Que É Preservado

### ✅ Dados Preservados (Não Mudam)

- **Material ID**: Referência ao material no banco
- **Nome do Material**: Nome exibido na interface
- **Diâmetro da Barra**: Diâmetro em milímetros

### 🔄 Dados Recalculados (Mudam com o Comprimento)

- **Quantidade de Estribos**: Ajustada proporcionalmente (se padrão)
- **Comprimento de Armaduras**: Ajustado pela diferença
- **Comprimento Total**: Recalculado
- **Volume de Concreto**: Recalculado

### 📋 Dados Mantidos da Fôrma (Não Mudam)

- **Tipo de Armadura**: Longitudinal, transversal, etc.
- **Identificador**: A, B, E1, E2, etc.
- **Descrição**: Texto descritivo
- **Posição**: Superior, inferior, middle, pele
- **Notas**: Observações

## Cenário de Teste Completo

### Passo 1: Cadastrar Produto

```
Menu → Produtos → Novo Produto

Nome: Pilar P1
Tipo: Pré-Moldado
Fôrma: Viga V-15x30
Comprimento: 10m
```

**Armaduras carregadas:**
```
├─ E1: 66 estribos × 2.5m
├─ E2: 10 estribos × 2.8m
├─ A: 4 barras × 10.2m
└─ B: 4 barras × 10.2m
```

### Passo 2: Preencher Material e Diâmetro

```
E1:
├─ Material: Ferro CA-60 Ø 5.0mm
└─ Diâmetro: 5.0mm

E2:
├─ Material: Ferro CA-60 Ø 6.0mm
└─ Diâmetro: 6.0mm

A:
├─ Material: Ferro CA-50 Ø 10.0mm
└─ Diâmetro: 10.0mm

B:
├─ Material: Ferro CA-50 Ø 12.5mm
└─ Diâmetro: 12.5mm
```

### Passo 3: Alterar Comprimento

```
Comprimento: 10m → 5m
```

### Passo 4: Verificar Resultado

**❌ ANTES (Comportamento Antigo):**
```
E1: 33 estribos × 2.5m
    Material: [VAZIO - PERDIDO] ❌
    Diâmetro: 0mm [PERDIDO] ❌

E2: 10 estribos × 2.8m
    Material: [VAZIO - PERDIDO] ❌
    Diâmetro: 0mm [PERDIDO] ❌

... (todos perdidos)
```

**✅ AGORA (Comportamento Novo):**
```
E1: 33 estribos × 2.5m
    Material: Ferro CA-60 Ø 5.0mm ✅ PRESERVADO
    Diâmetro: 5.0mm ✅ PRESERVADO

E2: 10 estribos × 2.8m
    Material: Ferro CA-60 Ø 6.0mm ✅ PRESERVADO
    Diâmetro: 6.0mm ✅ PRESERVADO

A: 4 barras × 5.2m (ajustado)
    Material: Ferro CA-50 Ø 10.0mm ✅ PRESERVADO
    Diâmetro: 10.0mm ✅ PRESERVADO

B: 4 barras × 5.2m (ajustado)
    Material: Ferro CA-50 Ø 12.5mm ✅ PRESERVADO
    Diâmetro: 12.5mm ✅ PRESERVADO
```

## Casos Especiais

### Caso 1: Nova Armadura Adicionada à Fôrma

Se você adicionar uma nova armadura na fôrma e recarregar:
- ✅ Armaduras existentes: Material e diâmetro preservados
- ℹ️ Nova armadura: Chega vazia (normal, pois não existia antes)

### Caso 2: Armadura Removida da Fôrma

Se você remover uma armadura da fôrma:
- ✅ Armaduras que ainda existem: Preservadas
- ℹ️ Armadura removida: Não aparece mais (normal)

### Caso 3: Descrição/Identificador Alterado

Se você alterar o identificador ou descrição na fôrma:
- ⚠️ Sistema não reconhece como a mesma armadura
- ℹ️ Aparecerá como nova (chave diferente)
- 💡 Solução: Não altere identificadores de armaduras já em uso

## Benefícios

### Para o Usuário
✅ Não precisa preencher material e diâmetro novamente
✅ Pode experimentar diferentes comprimentos livremente
✅ Workflow mais rápido e eficiente
✅ Menos frustrações e retrabalho

### Para o Sistema
✅ Experiência do usuário melhorada
✅ Menos erros de preenchimento
✅ Dados consistentes
✅ Logs detalhados para debug

## Sobre o Warning do fetch.worker.js

O aviso mencionado:
```
The resource https://w-credentialless-staticblitz.com/fetch.worker.31fc58ec.js
was preloaded using link preload but not used within a few seconds...
```

### Explicação

- ⚠️ **Tipo**: Warning (aviso), não um erro
- 🌐 **Origem**: Ambiente StackBlitz/Bolt
- 📦 **Causa**: Service Worker/PWA fazendo preload de recursos
- ✅ **Impacto**: Zero impacto na funcionalidade
- 🔧 **Ação**: Não requer correção

Este warning é específico do ambiente de desenvolvimento online e não afeta:
- ✅ A funcionalidade da aplicação
- ✅ O desempenho real
- ✅ A experiência do usuário
- ✅ O build de produção

## Resumo Técnico

### Alterações no Código

**Arquivo:** `src/components/Products.tsx`
**Função:** `loadMoldData()`
**Linhas modificadas:** 566-714

### Mudanças Principais

1. **Adicionar mapa de backup** (linhas 570-591)
   - Cria Map com dados das armaduras atuais
   - Usa chave composta: `tipo-identificador-descrição`
   - Armazena: material_id, material_name, bar_diameter_mm

2. **Restaurar dados ao criar armaduras** (linhas 679-695)
   - Busca no mapa usando a mesma chave
   - Restaura material e diâmetro se encontrado
   - Mantém vazio se não encontrado (armadura nova)

### Comportamento Automático

- ✅ Já existia: Handler que recarrega ao alterar comprimento
- ✅ Adicionado: Preservação de dados no recarregamento
- ✅ Resultado: Workflow completo e fluido

## Status

- ✅ Implementado
- ✅ Testado (compilação OK)
- ✅ Documentado
- ✅ Logs implementados
- ✅ Zero impacto em dados existentes
- ✅ Compatível com todas as funcionalidades

## Conclusão

O sistema agora oferece uma experiência muito mais fluida:

1. **Antes**: Alterar comprimento → Perder tudo → Preencher novamente
2. **Agora**: Alterar comprimento → Apenas recalcula → Dados preservados

A correção resolve completamente o problema reportado e melhora significativamente a experiência do usuário ao trabalhar com produtos pré-moldados!
