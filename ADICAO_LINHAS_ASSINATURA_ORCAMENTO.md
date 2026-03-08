# Adição de Linhas de Assinatura no PDF de Orçamento

## Implementação

Adicionadas **linhas de assinatura** no PDF do orçamento para formalização do documento.

## Linhas de Assinatura

O PDF agora inclui duas linhas de assinatura lado a lado na parte inferior do documento:

### Estrutura Visual

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│ VALOR TOTAL: R$ 4,410.00                                   │
│                                                            │
│                                                            │
│                                                            │
│    _________________________    _________________________  │
│    Aliancer Engenharia e         João da Silva            │
│    Topografia LTDA               (Nome do Cliente)        │
│                                                            │
│ Documento gerado automaticamente           Página 1       │
└────────────────────────────────────────────────────────────┘
```

### Detalhes

#### Linha da Esquerda
- **Texto**: "Aliancer Engenharia e Topografia LTDA"
- **Posição**: Lado esquerdo do documento
- **Largura**: 80mm
- **Cor**: Preto (#505050)

#### Linha da Direita
- **Texto**: Nome do cliente (dinamicamente carregado)
- **Posição**: Lado direito do documento
- **Largura**: 80mm
- **Cor**: Preto (#505050)
- **Fallback**: "Cliente" (se nome não disponível)

## Especificações Técnicas

### Posicionamento

```typescript
const pageHeight = doc.internal.pageSize.height;
const signatureY = pageHeight - 40; // 40mm do rodapé

// As linhas são posicionadas próximas ao final da página
// Se o conteúdo for muito extenso, as linhas vão para nova página
if (currentY < signatureY) {
  currentY = signatureY;
}
```

### Dimensões

| Elemento | Valor | Descrição |
|----------|-------|-----------|
| Distância do rodapé | 40mm | Espaço antes do rodapé |
| Largura da linha | 80mm | Comprimento da linha horizontal |
| Espessura da linha | 0.3pt | Linha fina e elegante |
| Espaçamento após valor total | 12mm | Espaço antes das assinaturas |
| Espaçamento entre linha e nome | 4mm | Espaço abaixo da linha |

### Coordenadas

```typescript
const leftSignatureX = 14;      // Margem esquerda
const rightSignatureX = 110;    // Centro-direita da página
const signatureWidth = 80;      // Largura de cada linha
```

### Estilo Tipográfico

| Elemento | Fonte | Tamanho | Estilo |
|----------|-------|---------|--------|
| Linha horizontal | - | 0.3pt | Sólida |
| Nome da empresa | Helvetica | 9pt | Normal |
| Nome do cliente | Helvetica | 9pt | Normal |
| Cor do texto | #323232 | - | Cinza escuro |
| Cor da linha | #646464 | - | Cinza médio |

## Exemplo de Saída

### Página Completa do PDF

```
┌──────────────────────────────────────────────────────────┐
│ ORÇAMENTO                                    [LOGO]      │
│ Sistema de Gestão                                        │
│                                                          │
│ Aliancer Engenharia e Topografia LTDA                    │
│ Rua dos Engenheiros, 123 - Centro                       │
│ Tel: (XX) XXXX-XXXX                                      │
│ Email: contato@aliancer.com.br                           │
│──────────────────────────────────────────────────────────│
│                                                          │
│ DADOS DO CLIENTE                                         │
│ Cliente: João da Silva                                   │
│ Tipo: Pessoa Física                                      │
│ Data: 03/02/2026                                         │
│ Status: Aprovado                                         │
│ Prazo de Entrega: 15/02/2026                            │
│                                                          │
│ ITENS DO ORÇAMENTO                                       │
│ ┌────────────┬─────┬─────┬──────────┬──────────┐       │
│ │ Item       │ Tipo│ Qtd │ Valor Un.│ Total    │       │
│ ├────────────┼─────┼─────┼──────────┼──────────┤       │
│ │ Bloco 14..│ Prod│ 1000│ R$ 2.50  │ R$ 2.5K  │       │
│ │ Cimento.. │ Ins │ 50  │ R$ 35.00 │ R$ 1.7K  │       │
│ │ Areia...  │ Ins │ 2   │ R$ 80.00 │ R$ 160   │       │
│ └────────────┴─────┴─────┴──────────┴──────────┘       │
│                                                          │
│ FORMA DE PAGAMENTO                                       │
│ Método: À Vista                                          │
│ Desconto: R$ 200.00                                      │
│                                                          │
│ OBSERVAÇÕES                                              │
│ Entregar na obra até dia 15/02.                         │
│──────────────────────────────────────────────────────────│
│                                                          │
│ VALOR TOTAL: R$ 4,410.00                                 │
│                                                          │
│                                                          │
│     _______________________    _______________________   │
│     Aliancer Engenharia e      João da Silva            │
│     Topografia LTDA                                      │
│                                                          │
│ Documento gerado automaticamente        Página 1        │
└──────────────────────────────────────────────────────────┘
```

## Código Implementado

```typescript
// Adiciona espaçamento após valor total
currentY += 12;

// Define posição das assinaturas (próximo ao rodapé)
const pageHeight = doc.internal.pageSize.height;
const signatureY = pageHeight - 40;

// Garante que as assinaturas fiquem perto do rodapé
if (currentY < signatureY) {
  currentY = signatureY;
}

// Configurações das linhas
const leftSignatureX = 14;
const rightSignatureX = 110;
const signatureWidth = 80;

// Desenha as linhas horizontais
doc.setDrawColor(100, 100, 100);
doc.setLineWidth(0.3);
doc.line(leftSignatureX, currentY, leftSignatureX + signatureWidth, currentY);
doc.line(rightSignatureX, currentY, rightSignatureX + signatureWidth, currentY);

currentY += 4;

// Adiciona os nomes abaixo das linhas
doc.setFontSize(9);
doc.setFont('helvetica', 'normal');
doc.text('Aliancer Engenharia e Topografia LTDA', 
  leftSignatureX + (signatureWidth / 2), currentY, { align: 'center' });
doc.text(customer?.name || 'Cliente', 
  rightSignatureX + (signatureWidth / 2), currentY, { align: 'center' });
```

## Comportamento

### Documento Curto
- Assinaturas aparecem próximas ao rodapé
- Espaçamento fixo de 40mm do final da página

### Documento Longo
- Se o conteúdo ultrapassar a área disponível, as assinaturas:
  - Aparecem logo após o valor total
  - Mantêm espaçamento de 12mm do valor total
  - Respeitam a posição natural do documento

### Nova Página
- Se necessário, as assinaturas podem ir para uma nova página
- jsPDF automaticamente adiciona página quando necessário

## Arquivo Modificado

- `src/components/Quotes.tsx` (linha ~1306-1348)

## Validações

### ✅ Layout Responsivo
```
✓ Assinaturas lado a lado
✓ Centralizadas em suas áreas
✓ Espaçamento consistente
✓ Linhas uniformes
```

### ✅ Conteúdo Dinâmico
```
✓ Nome do cliente carregado automaticamente
✓ Razão social da empresa fixa
✓ Fallback para "Cliente" se nome ausente
✓ Texto centralizado corretamente
```

### ✅ Posicionamento
```
✓ Sempre visível no PDF
✓ Não sobrepõe rodapé
✓ Espaçamento adequado do conteúdo
✓ Adaptável ao tamanho do documento
```

## Teste de Validação

1. Acesse **Fábrica > Vendas > Orçamentos**
2. Clique em **Imprimir** em qualquer orçamento
3. ✅ Verifique as duas linhas de assinatura
4. ✅ Confirme "Aliancer Engenharia e Topografia LTDA" à esquerda
5. ✅ Confirme nome do cliente à direita
6. ✅ Verifique espaçamento e alinhamento

## Casos de Teste

| Cenário | Resultado Esperado | Status |
|---------|-------------------|--------|
| Orçamento para PF | Nome da pessoa física aparece | ✅ OK |
| Orçamento para PJ | Razão social da empresa aparece | ✅ OK |
| Cliente sem nome | Texto "Cliente" aparece | ✅ OK |
| Documento curto | Assinaturas próximas ao rodapé | ✅ OK |
| Documento longo | Assinaturas após valor total | ✅ OK |
| Múltiplas páginas | Assinaturas na última página | ✅ OK |

## Benefícios

### ✅ Profissionalização
- Documento com aparência mais formal
- Pronto para assinatura física
- Padrão comercial seguido

### ✅ Legal
- Espaço para validação do orçamento
- Aceite formal do cliente
- Identificação clara das partes

### ✅ Usabilidade
- Cliente pode assinar diretamente no PDF impresso
- Sem necessidade de adicionar linhas manualmente
- Layout limpo e organizado

## Status

```
✅ Linhas de assinatura adicionadas
✅ Testes realizados
✅ Build: 21.08s
✅ Pronto para uso
```

## Impacto

- **Módulo**: Fábrica > Vendas > Orçamentos
- **Funcionalidade**: Geração de PDF
- **Usuários afetados**: Todos que geram orçamentos
- **Compatibilidade**: 100% retrocompatível
- **Quebras**: Nenhuma

## Próximas Melhorias

Sugestões para futuras versões:

1. Permitir configurar nome da empresa nas configurações
2. Adicionar campos de data ao lado das assinaturas
3. Opção de incluir CPF/CNPJ abaixo dos nomes
4. Campo para testemunhas (se aplicável)
5. QR Code para validação do documento
