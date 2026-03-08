# Guia Rápido: Importação de XML de Compras

## Como Importar uma Nota Fiscal (XML)

### Passo 1: Acessar a Importação

1. Abra o sistema
2. Vá em **Compras/Insumos**
3. Clique no botão **"Importar XML"**

### Passo 2: Selecionar o Arquivo XML

1. Na tela que abrir, clique em **"Clique para selecionar o arquivo XML"**
2. Escolha o arquivo `.xml` da nota fiscal eletrônica (NF-e)
3. Aguarde o processamento (geralmente 1-2 segundos)

### Passo 3: Revisar os Dados

Após o processamento, você verá:

**Dados da Nota Fiscal:**
- Número da NF
- Série
- Data de emissão
- Valor total
- Fornecedor (CNPJ e nome)

**Selecionar Fornecedor:**
- Se o fornecedor já estiver cadastrado, será selecionado automaticamente
- Caso contrário, selecione manualmente na lista

### Passo 4: Categorizar os Itens

Para cada item da nota, você pode:

#### 4.1 Definir a Categoria

Escolha entre:
- **Insumo**: Materiais para produção (cimento, ferro, areia, etc.)
- **Serviço**: Prestação de serviços (consultoria, manutenção, etc.)
- **Manutenção**: Reparos e manutenção de equipamentos
- **Investimento/Patrimônio**: Máquinas, veículos, equipamentos

**Dica:** Use os botões no topo para marcar todos os itens com a mesma categoria.

#### 4.2 Vincular Insumos (apenas para categoria "Insumo")

Para itens categorizados como **Insumo**, você pode:

**Opção A: Vincular a um insumo existente**
- Selecione o insumo na lista suspensa
- O sistema atualizará o preço automaticamente

**Opção B: Criar novo insumo**
- Clique no botão **"Novo"** (fica verde quando ativado)
- Um novo insumo será criado automaticamente

**Opção C: Deixar o sistema decidir (RECOMENDADO)**
- Não selecione nada
- O sistema irá:
  - Buscar se já existe um insumo com nome similar
  - Se encontrar, **atualiza o preço**
  - Se não encontrar, **cria novo**

### Passo 5: Importar

1. Revise todas as informações
2. Clique em **"Importar Compra"**
3. Aguarde a confirmação

### Passo 6: Verificar o Resultado

Após a importação, você verá um resumo:

```
✅ Compra importada com sucesso!

📦 Total de itens: 15

📊 Categorias:
  • Insumos: 10 (3 novos, 7 atualizados)
  • Serviços: 2
  • Manutenção: 1
  • Investimentos/Patrimônio: 2
```

## O Que Acontece Após a Importação?

### Para INSUMOS:
1. ✅ Insumo criado ou atualizado (preço)
2. ✅ Entrada de estoque registrada
3. ✅ Item de compra vinculado ao insumo

### Para SERVIÇOS:
1. ✅ Despesa registrada no fluxo de caixa
2. ✅ Categoria: "Despesas Administrativas"

### Para MANUTENÇÃO:
1. ✅ Despesa registrada no fluxo de caixa
2. ✅ Categoria: "Manutenção de Máquinas"

### Para INVESTIMENTOS:
1. ✅ Ativo criado no patrimônio
2. ✅ Despesa registrada no fluxo de caixa
3. ✅ Categoria: "Equipamentos e Patrimônio"

### Para TODOS:
1. ✅ Compra registrada com dados da nota
2. ✅ Contas a pagar criadas (se houver parcelas)
3. ✅ Vínculo com fornecedor

## Erros Comuns e Soluções

### ❌ "Esta nota fiscal já foi importada"

**Causa:** O XML já foi importado anteriormente.

**Solução:**
- Verifique na lista de compras se a NF já existe
- Se precisar reimportar, delete a compra anterior primeiro

### ❌ "O insumo X já existe no sistema"

**Causa:** Tentou criar um insumo duplicado manualmente.

**Solução:**
- Desmarque o botão "Novo"
- Selecione o insumo existente na lista
- Ou deixe o sistema fazer o UPSERT automático

### ❌ "XML inválido: tag infNFe não encontrada"

**Causa:** Arquivo XML corrompido ou formato incorreto.

**Solução:**
- Verifique se o arquivo é uma NF-e válida
- Baixe o XML novamente do portal da SEFAZ
- Certifique-se de que é o arquivo XML completo

### ❌ "Erro ao criar item de compra"

**Causa:** Pode haver problema de validação no banco.

**Solução:**
- Abra o Console (F12) e verifique os logs detalhados
- Verifique se todos os campos obrigatórios estão preenchidos
- Entre em contato com o suporte informando o erro completo

## Dicas e Boas Práticas

### ✅ Antes de Importar

1. **Cadastre o fornecedor** se ele não existir
2. **Revise os insumos** existentes para evitar duplicatas
3. **Categorize corretamente** desde o início

### ✅ Durante a Importação

1. **Use o botão "Marcar todos"** quando todos os itens são da mesma categoria
2. **Deixe o sistema fazer UPSERT** (não force criar novo)
3. **Revise as quantidades e unidades** antes de importar

### ✅ Após a Importação

1. **Abra o Console (F12)** para ver logs detalhados
2. **Verifique o estoque** dos insumos importados
3. **Confira as contas a pagar** criadas

## Debug: Como Ver os Logs Detalhados

1. Pressione **F12** para abrir o Console do navegador
2. Vá na aba **Console**
3. Durante a importação, você verá logs como:

```
=== INICIANDO IMPORTAÇÃO ===
Total de itens: 10

--- Processando item: CIMENTO CP-II-F-40 (insumo) ---
✓ Insumo já existe (ID: abc123), atualizando preço...
  - Preço anterior: R$ 42.50
  - Preço novo: R$ 45.80
✓ Insumo atualizado com sucesso
✓ purchase_item criado com sucesso
✓ Entrada de estoque registrada: 50 SC
✓ Custo unitário atualizado com sucesso

=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===
```

## Perguntas Frequentes

### 1. Posso importar o mesmo XML várias vezes?

**Não.** O sistema detecta nota fiscal duplicada pela chave da NF-e.

Se precisar reimportar:
1. Delete a compra anterior
2. Importe novamente

### 2. O que acontece com o preço dos insumos?

Quando você importa um XML:
- Se o insumo **já existe**: o preço é **ATUALIZADO** automaticamente
- Se o insumo **não existe**: é criado com o preço da nota

### 3. Como funciona o estoque?

Para insumos (categoria "Insumo"):
- Uma **entrada de estoque** é registrada automaticamente
- A quantidade vai para o estoque disponível
- O movimento fica registrado com a data da nota

Para outras categorias:
- **Não afeta o estoque** (serviços, manutenção, investimentos)

### 4. E se eu categorizar errado?

**Antes de importar:**
- Basta mudar a categoria no dropdown

**Depois de importar:**
- Você precisará corrigir manualmente:
  - Delete o item de compra
  - Ou ajuste a categoria diretamente no banco

### 5. Como importar múltiplas notas?

Atualmente, uma de cada vez:
1. Importe a primeira nota
2. Aguarde o sucesso
3. Clique em "Importar XML" novamente
4. Repita para cada nota

## Atalhos de Teclado

| Ação | Atalho |
|------|--------|
| Abrir Console | **F12** |
| Fechar modal | **ESC** |
| Rolar lista de itens | **Scroll** ou **↑↓** |

## Fluxo Visual

```
[Selecionar XML]
    ↓
[Sistema processa e valida]
    ↓
[Mostra dados da NF + itens]
    ↓
[Usuário categoriza cada item]
    ↓
[Usuário clica "Importar"]
    ↓
[Sistema processa cada item:]
  - Insumo? → Cria/Atualiza + Estoque
  - Serviço? → Cash Flow
  - Manutenção? → Cash Flow
  - Investimento? → Patrimônio + Cash Flow
    ↓
[Cria contas a pagar]
    ↓
[Mostra resumo de sucesso]
```

## Suporte

Se encontrar problemas:

1. ✅ Abra o Console (F12) e copie os logs de erro
2. ✅ Tire um print da tela
3. ✅ Anote o número da NF e fornecedor
4. ✅ Entre em contato informando:
   - O que estava fazendo
   - Mensagem de erro
   - Logs do console
   - Arquivo XML (se possível)
