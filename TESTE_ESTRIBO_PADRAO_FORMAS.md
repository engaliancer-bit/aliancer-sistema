# Teste: Marcação de Estribo Padrão nas Fôrmas

## Passo a Passo para Testar

### 1. Acesse o Módulo Fôrmas
- Menu lateral → **Fôrmas**
- Clique em **"Nova Fôrma"** ou edite uma fôrma existente

### 2. Preencha os Dados Básicos (Passo 1)
- **Nome da Fôrma**: Ex: Viga V-15x30
- **Descrição**: Viga de 15cm x 30cm
- **Largura da Seção**: 0.15
- **Altura da Seção**: 0.30
- Clique em **"Próximo: Configurar Armaduras"**

### 3. Configure as Armaduras (Passo 2)
Agora você está na aba **"2. Configuração de Armaduras"**

### 4. Adicione um Estribo Transversal
Clique em **"+ Adicionar Armadura"** e preencha:

**Primeiro Estribo:**
- **Tipo**: Transversal (Estribos)
- **Localização**: Base
- **Identificador**: E1
- **Posição**: Estribo principal
- **Quantidade**: 66
- **Espaçamento (m)**: 0.15
- **Comprimento do Estribo (m)**: 0.80
- **Quantidade Padrão**: 66
- **Descrição**: Estribo padrão para vigas de 10m
- Clique em **"Salvar Armadura"**

### 5. Adicione Mais Estribos (Opcional)

**Segundo Estribo:**
- Tipo: Transversal (Estribos)
- Localização: Base
- Identificador: E2
- Posição: Estribo reforçado
- Quantidade: 50
- Espaçamento (m): 0.20
- Comprimento do Estribo (m)**: 0.80
- Quantidade Padrão: 50
- Descrição: Estribo para vigas de 10m - espaçamento maior
- Clique em **"Salvar Armadura"**

**Terceiro Estribo:**
- Tipo: Transversal (Estribos)
- Localização: Base
- Identificador: E3
- Quantidade: 33
- Espaçamento (m): 0.30
- Comprimento do Estribo (m)**: 0.80
- Quantidade Padrão: 33
- Descrição: Estribo para vigas de 10m - espaçamento reduzido
- Clique em **"Salvar Armadura"**

### 6. Procure o Ícone da Estrela
Após adicionar os estribos, você verá na lista de armaduras cadastradas:

```
┌────────────────────────────────────────────────────────┐
│ Transversal (Estribos)  E1  Estribo principal         │
│ Qtd: 66                                                │
│ Espaçamento: 0.15m                                     │
│ Comprimento Estribo: 0.80m                             │
│                                                        │
│                       [⭐] [✏️] [🗑️]                    │
└────────────────────────────────────────────────────────┘
```

O ícone **⭐ (estrela)** aparece **somente nas armaduras do tipo Transversal**.

### 7. Marque o Estribo Padrão
- Clique no ícone da **estrela vazia** (⭐ cinza) do primeiro estribo
- A estrela ficará **preenchida e amarela** (⭐ amarelo)
- Esta é agora a armadura padrão para cálculos proporcionais

### 8. Teste Alternar o Padrão
- Clique na estrela de outro estribo (ex: E2)
- A estrela do E1 será **desmarcada automaticamente**
- A estrela do E2 ficará **marcada**
- Apenas uma estrela pode estar preenchida por vez

### 9. Desmarque o Padrão (Opcional)
- Clique na estrela **preenchida** (amarela)
- A estrela voltará a ser **vazia** (cinza)
- Nenhum estribo estará marcado como padrão

### 10. Salve a Fôrma
Clique em **"Salvar Fôrma"** no final da página.

---

## O Que Você Deve Ver

### Ícone da Estrela

#### Localização:
- À **ESQUERDA** dos botões Editar (✏️) e Excluir (🗑️)
- **Somente** em armaduras do tipo **Transversal (Estribos)**

#### Estados da Estrela:
1. **Vazia (Cinza)**: ⭐ - Estribo não é padrão
2. **Preenchida (Amarela)**: ⭐ - Estribo é o padrão

#### Tooltip (ao passar o mouse):
- Estrela vazia: "Marcar como Estribo Padrão"
- Estrela preenchida: "Estribo Padrão (clique para desmarcar)"

### Comportamento Esperado

1. **Marcar**: Clique na estrela vazia → fica preenchida e amarela
2. **Desmarcar**: Clique na estrela preenchida → fica vazia e cinza
3. **Alternar**: Marque outra estrela → a anterior desmarca automaticamente
4. **Exclusivo**: Apenas UMA estrela pode estar preenchida por vez

---

## Troubleshooting

### "Não vejo o ícone da estrela"

**Verifique:**
1. ✓ A armadura é do tipo **Transversal (Estribos)**?
2. ✓ A armadura foi **salva com sucesso**?
3. ✓ Você está na lista de **"Armaduras Cadastradas"**?
4. ✓ Recarregue a página e verifique novamente

### "Cliquei na estrela mas nada aconteceu"

**Verifique:**
1. A fôrma está em modo de edição?
2. Há erros no console do navegador (F12)?
3. Tente recarregar a página
4. Verifique a conexão com o banco de dados

### "Marquei duas estrelas ao mesmo tempo"

Isso **não deveria** acontecer devido à constraint no banco de dados. Se aconteceu:
1. Recarregue a página
2. Verifique qual está realmente marcada
3. Contate o suporte técnico

---

## Resultado Final Esperado

Ao finalizar, você terá:

✅ Uma fôrma com múltiplos estribos transversais cadastrados
✅ Ícone de estrela visível em cada estribo transversal
✅ Um estribo marcado como padrão (estrela amarela preenchida)
✅ Capacidade de alternar o padrão clicando nas estrelas

---

## Para Que Serve o Estribo Padrão?

O estribo marcado como padrão será usado para:

1. **Cálculo de Proporcionalidade**
   - Quando um produto usar esta fôrma
   - O sistema calculará quantos estribos são necessários
   - Baseado no comprimento do produto
   - Proporcional à quantidade padrão definida

2. **Exemplo Prático**
   - Fôrma tem comprimento padrão de 10m
   - Estribo padrão: 66 estribos para 10m
   - Produto tem 5m de comprimento
   - Cálculo: 5m ÷ 10m × 66 = 33 estribos

---

## Caminho Completo

```
Fôrmas
  └─ Nova Fôrma / Editar Fôrma
      └─ 1. Dados Básicos da Fôrma
          └─ [Próximo: Configurar Armaduras]
              └─ 2. Configuração de Armaduras
                  └─ + Adicionar Armadura
                      └─ Tipo: Transversal (Estribos)
                          └─ [Salvar Armadura]
                              └─ Lista de Armaduras Cadastradas
                                  └─ ⭐ Ícone de estrela ao lado de cada estribo
                                      └─ Clique para marcar/desmarcar como padrão
```

---

## Verificação no Banco de Dados

Se você tem acesso ao Supabase, pode verificar se o campo está sendo salvo:

```sql
SELECT
  id,
  type,
  identifier,
  position,
  quantity,
  is_standard_pattern
FROM mold_reinforcements
WHERE type = 'transversal'
ORDER BY mold_id, is_standard_pattern DESC;
```

Você deve ver:
- `is_standard_pattern = true` para o estribo marcado
- `is_standard_pattern = false` (ou `null`) para os demais

---

## Observações Importantes

1. **Apenas Transversais**: O ícone só aparece em armaduras do tipo Transversal
2. **Um por Fôrma**: Apenas um estribo pode ser padrão por fôrma
3. **Opcional**: Não é obrigatório marcar um padrão
4. **Persistente**: A marcação é salva no banco de dados

---

## Contato

Se você não conseguir ver ou usar o ícone da estrela, forneça:
- Tipo de armadura configurada
- Screenshot da tela (se possível)
- Mensagens de erro no console (F12)
- ID da fôrma que está editando
