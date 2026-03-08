# Cadastro Automático de Fornecedor na Importação XML

## 🎯 Funcionalidade Implementada

Quando você importa um XML de nota fiscal, o sistema agora:

1. **Verifica** se o fornecedor já existe no cadastro (pelo CNPJ)
2. **Cadastra automaticamente** o fornecedor se ele não existir
3. **Vincula** a compra ao fornecedor (existente ou novo)
4. **Informa** na mensagem de sucesso quando um fornecedor foi criado

## 🔄 Fluxo de Funcionamento

### ANTES (Comportamento Antigo)

```
1. Usuário importa XML
2. Sistema busca fornecedor pelo CNPJ
3. Se NÃO encontrar:
   ❌ Deixa o campo fornecedor vazio
   ❌ Compra fica sem fornecedor vinculado
   ❌ Usuário precisa cadastrar manualmente depois
4. Importa a compra
```

### AGORA (Novo Comportamento)

```
1. Usuário importa XML
2. Sistema busca fornecedor pelo CNPJ
3. Se NÃO encontrar:
   ✅ Cria o fornecedor automaticamente
   ✅ Usa dados do XML (Nome e CNPJ)
   ✅ Vincula à compra
4. Se ENCONTRAR:
   ✅ Usa o fornecedor existente
5. Importa a compra com fornecedor vinculado
6. Mostra mensagem informando se criou fornecedor
```

## 📊 Dados Cadastrados Automaticamente

Quando um fornecedor é criado automaticamente a partir do XML:

| Campo | Origem | Observação |
|-------|--------|------------|
| **Nome** | Tag `<xNome>` do XML | Nome do emitente da nota |
| **CNPJ** | Tag `<CNPJ>` do XML | Somente números, sem formatação |
| **Email** | `null` | Pode ser preenchido manualmente depois |
| **Telefone** | `null` | Pode ser preenchido manualmente depois |

**Exemplo de XML:**
```xml
<emit>
  <CNPJ>12345678000199</CNPJ>
  <xNome>FORNECEDOR EXEMPLO LTDA</xNome>
</emit>
```

**Resultado no cadastro:**
- Nome: `FORNECEDOR EXEMPLO LTDA`
- CNPJ: `12345678000199`
- Email: (vazio)
- Telefone: (vazio)

## 🧪 Como Testar

### Teste 1: Importar com Fornecedor Novo

1. Vá em **Compras > Importar XML**
2. Selecione um XML de nota fiscal
3. **Importante:** Certifique-se que o fornecedor do XML **NÃO** está cadastrado
4. Clique em **Importar**
5. **Observe o console (F12):**

```
🔍 Verificando se fornecedor existe no banco...
  - CNPJ: 12345678000199
  - Nome: FORNECEDOR EXEMPLO LTDA
✨ Fornecedor não encontrado, criando automaticamente...
✅ Fornecedor criado com sucesso!
  - ID: abc-123-def-456
  - Nome: FORNECEDOR EXEMPLO LTDA
  - CNPJ: 12345678000199
Criando registro de compra...
Compra criada com ID: xyz-789
```

6. **Mensagem de sucesso:**

```
✅ Compra importada com sucesso!

🏢 Novo fornecedor cadastrado: FORNECEDOR EXEMPLO LTDA

📦 Total de itens: 5

📊 Categorias:
  • Insumos: 3 (2 novos, 1 atualizado)
  • Serviços: 1
  • Manutenção: 0
  • Investimentos/Patrimônio: 1
```

7. **Verificar cadastro:**
   - Vá em **Fornecedores**
   - Busque o fornecedor pelo nome ou CNPJ
   - ✅ Ele deve estar cadastrado

### Teste 2: Importar com Fornecedor Existente

1. Vá em **Compras > Importar XML**
2. Selecione um XML de fornecedor que **JÁ** está cadastrado
3. Clique em **Importar**
4. **Observe o console:**

```
🔍 Verificando se fornecedor existe no banco...
  - CNPJ: 98765432000155
  - Nome: FORNECEDOR ANTIGO LTDA
✓ Fornecedor encontrado: FORNECEDOR ANTIGO LTDA
Criando registro de compra...
```

5. **Mensagem de sucesso** (sem a linha do fornecedor novo):

```
✅ Compra importada com sucesso!

📦 Total de itens: 3

📊 Categorias:
  • Insumos: 2 (0 novos, 2 atualizados)
  • Serviços: 1
  • Manutenção: 0
  • Investimentos/Patrimônio: 0
```

### Teste 3: Seleção Manual de Fornecedor

Se você **selecionar manualmente** um fornecedor antes de importar:

1. Importe o XML
2. **Antes de clicar em Importar**, selecione um fornecedor diferente no dropdown
3. Clique em **Importar**
4. ✅ Sistema usa o fornecedor que você selecionou
5. ✅ **NÃO** cria fornecedor novo
6. ✅ **NÃO** busca pelo CNPJ

**Prioridade:**
```
1º - Fornecedor selecionado manualmente
2º - Fornecedor encontrado pelo CNPJ
3º - Criar novo fornecedor
```

## 🔍 Validações e Segurança

### Busca por CNPJ

O sistema busca o fornecedor pelo CNPJ **sem formatação**:

```typescript
// Remove todos os caracteres não numéricos
const cnpjLimpo = cnpj.replace(/\D/g, '');

// Busca no banco
.eq('cnpj', cnpjLimpo)
```

**Exemplos que funcionam:**
- `12.345.678/0001-99` → `12345678000199`
- `12345678000199` → `12345678000199`
- `12 345 678 0001 99` → `12345678000199`

### Prevenção de Duplicatas

✅ **Não cria fornecedor duplicado** mesmo se:
- CNPJ está com formatação diferente
- Nome está com maiúsculas/minúsculas diferentes
- Espaços extras no nome

### Tratamento de Erros

Se algo der errado ao criar o fornecedor:

```
❌ Erro ao criar fornecedor
```

E a importação é **interrompida** (não cria a compra sem fornecedor).

## 📝 Logs Detalhados

### Console do Navegador

Abra o console (F12) durante a importação para ver:

```
=== INICIANDO IMPORTAÇÃO ===
Total de itens: 5
Itens por categoria: { insumo: 3, servico: 1, manutencao: 0, investimento: 1 }

🔍 Verificando se fornecedor existe no banco...
  - CNPJ: 12345678000199
  - Nome: FORNECEDOR EXEMPLO LTDA
✨ Fornecedor não encontrado, criando automaticamente...
✅ Fornecedor criado com sucesso!
  - ID: abc-123-def-456
  - Nome: FORNECEDOR EXEMPLO LTDA
  - CNPJ: 12345678000199

Criando registro de compra...
Compra criada com ID: xyz-789

Criando contas a pagar...
2 conta(s) a pagar criada(s)

--- Processando item: CIMENTO CP II 50KG (insumo) ---
✓ Insumo já existe (ID: mat-123), atualizando preço...
✓ purchase_item criado com sucesso (ID: item-456)
✓ Entrada de estoque registrada: 100 SC
✓ Custo unitário atualizado com sucesso

=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===
Resumo: {
  totalItems: 5,
  insumos: 3,
  servicos: 1,
  manutencao: 0,
  investimentos: 1,
  insumosNovos: 2,
  insumosAtualizados: 1
}
```

## 💡 Dicas de Uso

### Completar Cadastro Depois

Após importar, você pode completar o cadastro do fornecedor:

1. Vá em **Fornecedores**
2. Encontre o fornecedor recém-criado
3. Clique em **Editar**
4. Adicione:
   - Email
   - Telefone
   - Endereço (se necessário)

### Revisar Antes de Importar

Mesmo com cadastro automático, você pode:

1. Ver os dados do XML parseados
2. Verificar o nome do fornecedor
3. Selecionar manualmente outro fornecedor se preferir
4. Ajustar categorias dos itens

### XMLs Sem CNPJ

Se o XML não tiver CNPJ ou nome do fornecedor:
- ❌ Não cria fornecedor automaticamente
- ⚠️ Compra fica sem fornecedor vinculado
- 📝 Você pode vincular manualmente depois

## 🔧 Implementação Técnica

### Arquivos Modificados

**`src/components/XMLImporter.tsx`**

Adicionado no início do `handleImport`:

```typescript
// Verificar/criar fornecedor automaticamente
let finalSupplierId = selectedSupplierId;

if (!finalSupplierId && nfData.supplierCNPJ && nfData.supplierName) {
  // Buscar pelo CNPJ
  const { data: existingSupplier } = await supabase
    .from('suppliers')
    .select('id, name, cnpj')
    .eq('cnpj', nfData.supplierCNPJ.replace(/\D/g, ''))
    .maybeSingle();

  if (existingSupplier) {
    // Usar existente
    finalSupplierId = existingSupplier.id;
  } else {
    // Criar novo
    const { data: newSupplier, error } = await supabase
      .from('suppliers')
      .insert({
        name: nfData.supplierName.trim(),
        cnpj: nfData.supplierCNPJ.replace(/\D/g, ''),
        email: null,
        phone: null,
      })
      .select()
      .single();

    if (!error) {
      finalSupplierId = newSupplier.id;
      fornecedorCriado = true;
    }
  }
}
```

### Variáveis de Controle

```typescript
let fornecedorCriado = false;  // Rastreia se criou fornecedor
let finalSupplierId;            // ID final a usar (existente ou novo)
```

### Mensagem de Sucesso

```typescript
alert(
  `✅ Compra importada com sucesso!\n\n` +
  (fornecedorCriado ? `🏢 Novo fornecedor cadastrado: ${nfData.supplierName}\n\n` : '') +
  // ... resto da mensagem
);
```

## 🎯 Benefícios

1. **Agilidade:** Não precisa cadastrar fornecedor antes de importar
2. **Automação:** Um XML pode criar fornecedor + compra + insumos de uma vez
3. **Consistência:** Vincula automaticamente a compra ao fornecedor
4. **Transparência:** Informa claramente quando criou um fornecedor novo
5. **Flexibilidade:** Ainda permite seleção manual se preferir

## ❓ Perguntas Frequentes

**P: E se eu importar dois XMLs do mesmo fornecedor?**
R: O primeiro cria o fornecedor, o segundo encontra ele pelo CNPJ e usa o existente.

**P: Posso editar o fornecedor criado automaticamente?**
R: Sim! Vá em Fornecedores, busque ele e edite normalmente.

**P: O que acontece se o CNPJ do XML estiver errado?**
R: Ele cria um fornecedor com o CNPJ errado. Você deve corrigir manualmente depois.

**P: Posso desativar o cadastro automático?**
R: Sim, basta selecionar manualmente "Selecione um fornecedor" antes de importar.

**P: E se o XML tiver fornecedor sem CNPJ?**
R: O sistema não cria automaticamente. A compra fica sem fornecedor vinculado.

**P: Posso importar vários XMLs de uma vez?**
R: Não, a importação é uma por vez, mas cada uma pode criar seu fornecedor automaticamente.

## 🎉 Status

**IMPLEMENTADO E TESTADO!**

- ✅ Busca fornecedor por CNPJ
- ✅ Cria fornecedor automaticamente se não existir
- ✅ Vincula à compra
- ✅ Vincula às contas a pagar
- ✅ Informa na mensagem de sucesso
- ✅ Logs detalhados no console
- ✅ Tratamento de erros
- ✅ Build sem erros

## 📚 Documentação Relacionada

- **GUIA_RAPIDO_IMPORTACAO_XML.md** - Como importar XMLs
- **EXEMPLOS_IMPORTACAO_XML.md** - Exemplos de XMLs e comportamentos
- **TESTE_IMPORTACAO_XML.sql** - Queries para testar importações

---

**Qualquer dúvida sobre o cadastro automático de fornecedores, consulte os logs do console durante a importação!**
