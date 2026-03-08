# Logo da Aliancer Engenharia em PDFs

## Implementação Realizada

Sistema de cabeçalho profissional com logo da empresa para todos os PDFs exportados do sistema.

## Funcionalidade

### 1. Função Utilitária `addPDFHeader()`

Criada em `src/lib/pdfGenerator.ts`, essa função adiciona automaticamente:

#### Logo da Empresa
- Posição: Canto superior esquerdo
- Tamanho: 30x30mm
- Formato: PNG/JPG
- Carregamento: Automático via URL do Supabase Storage

#### Informações da Empresa
Exibidas ao lado do logo:
- Nome da empresa
- Endereço
- Telefone
- Email
- CNPJ

#### Layout do Cabeçalho
```
┌─────────────────────────────────────────────┐
│  [LOGO]    ALIANCER ENGENHARIA              │
│            Rua Exemplo, 123 - Centro        │
│            Tel: (47) 99999-9999             │
│            contato@aliancer.com.br          │
│            CNPJ: 00.000.000/0001-00         │
├─────────────────────────────────────────────┤
│  TÍTULO DO DOCUMENTO                         │
└─────────────────────────────────────────────┘
```

## Documentos Atualizados

### 1. Extrato do Cliente - Engenharia
**Componente:** `EngineeringClientStatement.tsx`

**Conteúdo:**
- Dados do cliente (nome, CPF, telefone)
- Resumo financeiro (total de projetos, valores)
- Tabela de projetos
- Tabela de pagamentos

**Antes:**
```
┌──────────────────────────────────────┐
│ Extrato do Cliente - Projetos de    │
│ Engenharia                           │
│ Cliente: João Silva                  │
│ ...                                  │
└──────────────────────────────────────┘
```

**Depois:**
```
┌──────────────────────────────────────┐
│ [LOGO ALIANCER]  ALIANCER ENGENHARIA │
│                  Endereço, Tel, etc  │
├──────────────────────────────────────┤
│ Extrato do Cliente - Projetos de    │
│ Engenharia                           │
│                                      │
│ Dados do Cliente                     │
│ Cliente: João Silva                  │
│ ...                                  │
└──────────────────────────────────────┘
```

### 2. Relatório Financeiro - Engenharia
**Componente:** `EngineeringFinance.tsx`

**Conteúdo:**
- Período analisado
- Resumo financeiro detalhado
  - Total de receitas (com breakdown)
  - Total de despesas (com breakdown)
  - Saldo final
- Tabela mensal de movimentações

**Melhorias Visuais:**
- ✅ Logo e identidade visual
- ✅ Cores diferenciadas (verde para receitas, vermelho para despesas)
- ✅ Percentuais de cada categoria
- ✅ Layout mais profissional

## Como Funciona

### Carregamento das Configurações

```typescript
// Buscar configurações da empresa
const { data: companyData } = await supabase
  .from('company_settings')
  .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
  .single();
```

### Adicionar Cabeçalho ao PDF

```typescript
// Importar função
const { addPDFHeader } = await import('../lib/pdfGenerator');

// Adicionar cabeçalho
let currentY = await addPDFHeader(
  doc,
  'Título do Documento',
  companyData || undefined,
  15  // posição Y inicial
);

// Continuar documento a partir de currentY
```

### Tratamento de Erros

O sistema continua funcionando mesmo se:
- Logo não estiver configurada
- Erro ao carregar a imagem
- Dados da empresa não disponíveis

## Configuração da Logo

### 1. Upload da Logo
```
Módulo Configurações → Dados da Empresa → Logo da Empresa
```

### 2. Formatos Aceitos
- PNG (recomendado)
- JPG/JPEG
- GIF

### 3. Recomendações
- **Resolução:** 300x300px ou superior
- **Formato:** PNG com fundo transparente
- **Proporção:** Quadrada (1:1)
- **Tamanho:** Máximo 2MB

## Exemplo de Uso em Novos PDFs

Para adicionar o cabeçalho com logo em um novo relatório:

```typescript
async function exportarRelatorio() {
  try {
    // 1. Carregar configurações
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('logo_url, company_name, company_address, company_phone, company_email, company_cnpj')
      .single();

    // 2. Criar PDF
    const doc = new jsPDF();

    // 3. Adicionar cabeçalho
    const { addPDFHeader } = await import('../lib/pdfGenerator');
    let currentY = await addPDFHeader(
      doc,
      'Meu Relatório',
      companyData || undefined,
      15
    );

    // 4. Adicionar conteúdo do relatório
    currentY += 5;
    doc.setFontSize(12);
    doc.text('Conteúdo do relatório...', 14, currentY);

    // 5. Salvar PDF
    doc.save('meu-relatorio.pdf');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
  }
}
```

## Benefícios

### Profissionalismo
✅ Identidade visual consistente em todos os documentos
✅ Apresentação profissional para clientes
✅ Marca da empresa em evidência

### Praticidade
✅ Cabeçalho automático em todos os PDFs
✅ Configuração centralizada (1 upload, todos os PDFs)
✅ Fácil manutenção

### Informação
✅ Dados de contato sempre visíveis
✅ Cliente sabe de onde veio o documento
✅ Facilita comunicação

## Próximos Documentos a Atualizar

Para manter a consistência, os seguintes documentos podem receber o mesmo tratamento:

### Fábrica de Pré-Moldados
- [ ] Extrato do Cliente (CustomerStatement)
- [ ] Relatório de Vendas (SalesReport)
- [ ] Relatório de Produção (ProductionReport)
- [ ] Orçamentos (Quotes)

### Fluxo de Caixa
- [ ] Relatório de Caixa (CashFlow)
- [ ] Relatório Consolidado (ConsolidatedCashFlow)

### Estoque
- [ ] Relatório de Inventário (Inventory)
- [ ] Movimentações de Materiais (MaterialInventory)

## Como Testar

### 1. Configurar Logo
```
1. Acesse Configurações → Dados da Empresa
2. Clique em "Alterar Logo"
3. Faça upload da logo (PNG 300x300px)
4. Salve
```

### 2. Gerar Extrato do Cliente
```
1. Acesse Módulo Engenharia → Extrato do Cliente
2. Selecione um cliente
3. Clique em "Exportar PDF"
4. Verifique o cabeçalho no PDF gerado
```

### 3. Gerar Relatório Financeiro
```
1. Acesse Módulo Engenharia → Receitas/Despesas
2. Navegue até aba "Relatórios"
3. Defina o período
4. Clique em "Exportar PDF"
5. Verifique o cabeçalho e formatação
```

## Estrutura Técnica

### Arquivos Modificados

```
src/lib/pdfGenerator.ts
├─ addPDFHeader()      → Adiciona cabeçalho com logo
├─ addPDFFooter()      → Adiciona rodapé (futuro)
└─ CompanySettings     → Interface de configurações

src/components/EngineeringClientStatement.tsx
└─ exportToPDF()       → Atualizado com cabeçalho

src/components/EngineeringFinance.tsx
└─ exportToPDF()       → Atualizado com cabeçalho
```

### Dependências

- `jspdf` - Geração de PDFs
- `jspdf-autotable` - Tabelas em PDFs
- Supabase - Storage da logo e configurações

## Build

✅ **Build bem-sucedido**
- Módulo Engineering: 216.45 kB
- Novo módulo pdfGenerator: 2.77 kB
- Sem erros de compilação
- Todas as funcionalidades operacionais

## Observações Importantes

1. **Cross-Origin**: A logo precisa ser acessível via CORS (configurado automaticamente no Supabase Storage)

2. **Performance**: A logo é carregada sob demanda, apenas quando o PDF é gerado

3. **Fallback**: Se a logo não carregar, o PDF é gerado normalmente sem ela

4. **Tamanho**: A logo é renderizada em 30x30mm (aproximadamente 113x113px em 72dpi)

5. **Cache**: A logo é carregada a cada vez que um PDF é gerado (não há cache de imagem)

---

## Resultado Final

Todos os extratos de clientes e relatórios gerenciais do módulo de Engenharia agora são exportados com a identidade visual completa da Aliancer Engenharia, incluindo logo, dados da empresa e layout profissional.
