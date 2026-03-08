# Teste Rápido: Marcação de Estribo Padrão

## Passo a Passo para Testar

### 1. Acesse o Módulo Produtos
- Menu lateral → **Produtos**
- Clique em **"Novo Produto"** ou edite um produto existente

### 2. Configure como Pré-Moldado
Preencha os campos:
- **Nome**: Viga V-15x30 - 10m
- **Tipo de Produto**: **Pré-Moldado**
- **Comprimento**: 10.00
- **Selecione uma Fôrma** (mold)
- **NÃO MARQUE** "Cadastro Simplificado" ⚠️

### 3. Role para Baixo até "Armaduras da Forma"
Você verá um botão **"+ Adicionar Armadura"**

### 4. Adicione o Primeiro Estribo
Clique em "+ Adicionar Armadura" e preencha:
- **Tipo**: Transversal
- **Localização**: Base
- **Descrição**: Estribo principal
- **Quantidade de barras**: 66
- **Comprimento da barra (m)**: 0.80
- **Diâmetro**: Ø 5.0mm - CA 60
- Clique em **"Adicionar"**

### 5. Adicione Mais Estribos (Opcional)
Adicione variações para testar:

**Estribo 2:**
- Tipo: Transversal
- Descrição: Estribo alternativo 1
- Quantidade: 50
- Comprimento: 0.80
- Diâmetro: Ø 6.0mm - CA 60

**Estribo 3:**
- Tipo: Transversal
- Descrição: Estribo alternativo 2
- Quantidade: 33
- Comprimento: 0.80
- Diâmetro: Ø 5.0mm - CA 60

### 6. Procure a Seção "Padrão de Estribos"
Após adicionar pelo menos 1 estribo transversal, uma nova seção aparecerá **ACIMA** da lista de armaduras:

```
┌────────────────────────────────────────────────┐
│ ⚙️ Padrão de Estribos para Proporcionalidade │
│                                                │
│ Marque qual estribo transversal será usado    │
│ como padrão de referência...                   │
└────────────────────────────────────────────────┘
```

### 7. Marque o Estribo Padrão
Na seção que apareceu, você verá todos os estribos transversais listados com checkboxes:

- **☐ Marcar como padrão** - 66 estribos × 0.80m • Ø 5.0mm
- **☐ Marcar como padrão** - 50 estribos × 0.80m • Ø 6.0mm
- **☐ Marcar como padrão** - 33 estribos × 0.80m • Ø 5.0mm

**Clique no checkbox** do primeiro estribo (66 estribos).

### 8. Observe o Resultado
Após marcar, você verá:

✅ O checkbox marcado com **"PADRÃO"**
✅ Fundo azul claro
✅ Badge **"✓ Referência"** ao lado
✅ Informações calculadas abaixo:

```
Padrão configurado: 66 estribos para 10m de comprimento
Espaçamento: 15.15 cm entre estribos
```

### 9. Teste Alternar o Padrão
- Clique em outro estribo (ex: 50 estribos)
- O anterior será **desmarcado automaticamente**
- O novo será marcado como padrão
- As informações de espaçamento serão recalculadas

### 10. Salve o Produto
Clique em **"Salvar Produto"** no final da página.

---

## O Que Você Deve Ver

### Seção de Padrão de Estribos
Esta seção só aparece se houver **pelo menos 1 estribo transversal** cadastrado.

#### Localização:
- **ACIMA** da lista "Armaduras Cadastradas para esta Fôrma"
- **ABAIXO** das informações do produto e traço

#### Visual:
- Borda azul
- Título com ícone de engrenagem
- Lista de checkboxes para cada estribo transversal
- Card azul com informações do padrão quando marcado

### Comportamento dos Checkboxes
1. **Marcar**: Clique no checkbox vazio → fica marcado com fundo azul
2. **Desmarcar**: Clique no checkbox marcado → volta ao normal
3. **Alternar**: Marque outro estribo → o anterior desmarca automaticamente

---

## Troubleshooting

### "Não vejo a seção de Padrão de Estribos"

**Verifique:**
1. ✓ Produto é tipo **Pré-Moldado**?
2. ✓ **NÃO** está marcado "Cadastro Simplificado"?
3. ✓ Adicionou pelo menos **1 estribo transversal**?
4. ✓ O tipo da armadura é **"Transversal"** (não Longitudinal)?

### "Não consigo marcar o checkbox"

**Verifique:**
1. Clique diretamente no checkbox (quadradinho)
2. Verifique se o estribo é realmente tipo "Transversal"
3. Tente recarregar a página

### "Marquei mas não vejo as informações calculadas"

**Verifique:**
1. O produto tem um **comprimento** definido?
2. O estribo tem **quantidade de barras** preenchida?
3. Recarregue a página e tente novamente

---

## Resultado Esperado

Ao finalizar, você terá:

✅ Um produto pré-moldado com estribos transversais cadastrados
✅ Um estribo marcado como padrão (com fundo azul e badge "Referência")
✅ Informações de espaçamento calculadas automaticamente
✅ Capacidade de alternar o padrão entre os estribos

---

## Caminho Completo para Encontrar

```
Produtos
  └─ Novo Produto / Editar Produto
      └─ Tipo: Pré-Moldado
          └─ [Role para baixo]
              └─ Seção "Armaduras da Forma"
                  └─ + Adicionar Armadura
                      └─ Tipo: Transversal
                          └─ [Adicione o estribo]
                              └─ [Aparecerá seção "Padrão de Estribos"]
                                  └─ ☑ Checkbox para marcar como padrão
```

---

## Contato

Se mesmo seguindo este guia você não conseguir ver a seção de marcação de estribo padrão, entre em contato com o suporte técnico fornecendo:
- Tipo de produto configurado
- Se está marcado "Cadastro Simplificado"
- Quantos estribos transversais foram adicionados
- Screenshot da tela (se possível)
