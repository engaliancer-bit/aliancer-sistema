# Resumo - Módulo Receitas/Despesas (Engenharia)

## O que foi implementado

Nova aba **"Receitas/Despesas"** no módulo de Engenharia e Topografia com controle financeiro completo do escritório.

## Principais Funcionalidades

### 1. Receitas Automáticas
- ✅ Todo recebimento de cliente é registrado automaticamente como receita
- ✅ Integração total com aba de Pagamentos
- ✅ Sem necessidade de lançamento manual

### 2. Sistema de Antecipações
- ✅ Registra custos pagos pelo escritório para o cliente
- ✅ Adiciona automaticamente ao valor total do projeto
- ✅ Incorpora ao saldo devedor do cliente
- ✅ Marca como reembolsado quando cliente pagar

### 3. Classificação de Receitas
- **Honorários**: Receitas de serviços prestados
- **Antecipação/Reembolso**: Receitas de reembolso de custos
- **Outras Receitas**: Outras fontes de receita

### 4. Classificação de Despesas
- **Antecipação para Cliente**: Custos pagos em nome do cliente
- **Despesa Operacional**: Custos de funcionamento do escritório
- **Outras Despesas**: Outras saídas de recursos

## Exemplo Prático: Milton Klein

### Cenário:
- Projeto: Georreferenciamento
- Honorários: R$ 4.500,00
- Antecipação (taxas + marcos): R$ 439,82
- **Total devido: R$ 4.939,82**

### Passo a Passo:

**1. Criar antecipação:**
```
Receitas/Despesas → Antecipação
Projeto: Georreferenciamento Milton Klein
Tipo: Material
Descrição: Taxas e marcos de concreto
Valor: R$ 439,82

Resultado:
- DESPESA de R$ 439,82 registrada
- Valor total do projeto atualizado para R$ 4.939,82
- Saldo devedor do cliente: R$ 4.939,82
```

**2. Cliente paga honorários:**
```
Pagamentos → Novo Recebimento
Valor: R$ 4.500,00
Descrição: Honorários

Resultado automático:
- RECEITA de R$ 4.500,00
- Categoria: Honorários
- Saldo devedor: R$ 439,82
```

**3. Cliente paga antecipação:**
```
Pagamentos → Novo Recebimento
Valor: R$ 439,82
Descrição: Reembolso antecipação

Resultado automático:
- RECEITA de R$ 439,82
- Categoria: Antecipação/Reembolso
- Antecipação marcada como reembolsada
- Saldo devedor: R$ 0,00
```

## Dashboard Financeiro

### Cards de Resumo:

**Total Receitas**
- Honorários
- Reembolsos
- Outras receitas

**Total Despesas**
- Antecipações
- Operacionais
- Outras despesas

**Saldo**
- Receitas - Despesas
- Verde se positivo
- Laranja se negativo

## Como Usar

### Acessar
```
Menu → Engenharia e Topografia → Aba "Receitas/Despesas"
```

### Nova Receita Manual
```
1. Clicar em "Nova Receita"
2. Categoria: Honorários | Antecipação/Reembolso | Outras
3. Valor e descrição
4. Projeto (opcional)
5. Salvar
```

### Nova Despesa Manual
```
1. Clicar em "Nova Despesa"
2. Categoria: Antecipação | Operacional | Outras
3. Valor e descrição
4. Projeto (opcional)
5. Salvar
```

### Nova Antecipação (Importante!)
```
1. Clicar em "Antecipação"
2. Projeto (OBRIGATÓRIO)
3. Cliente (preenchido automaticamente)
4. Tipo: Taxa | Material | Serviço | Deslocamento | Outros
5. Descrição e valor
6. Salvar

⚠️ Sistema adiciona automaticamente ao saldo do cliente!
```

### Filtrar Lançamentos
```
- Por tipo: Receitas | Despesas | Todos
- Por categoria
- Por período (data início e fim)
- Por descrição (busca textual)
```

## Tipos de Antecipação

### Taxa
Taxas em cartórios, órgãos públicos
**Exemplo:** Taxa de registro CAR, averbação

### Material
Materiais adquiridos para o cliente
**Exemplo:** Marcos de concreto, GPS

### Serviço de Terceiro
Serviços contratados em nome do cliente
**Exemplo:** Topógrafo externo, laboratório

### Deslocamento
Custos de deslocamento
**Exemplo:** Combustível, hospedagem

### Outros
Outras antecipações não categorizadas

## Integrações Automáticas

### Quando cadastrar um recebimento:
1. Sistema cria receita automaticamente
2. Categoria: Honorários (padrão)
3. Vincula ao projeto e cliente
4. Aparece na aba Receitas/Despesas

### Quando cadastrar uma antecipação:
1. Sistema cria despesa automaticamente
2. Adiciona ao `grand_total` do projeto
3. Aumenta saldo devedor do cliente
4. Aparece na aba Receitas/Despesas

### Quando cliente paga antecipação:
1. Sistema marca antecipação como reembolsada
2. Atualiza categoria da receita para "Antecipação/Reembolso"
3. Permite segregar honorários de reembolsos

## Relatórios Disponíveis

### Visão Geral (Dashboard)
- Total receitas (com detalhamento)
- Total despesas (com detalhamento)
- Saldo atual

### Listagem Completa
- Todos os lançamentos
- Filtros múltiplos
- Busca textual
- Exportação por período

### Relatórios SQL (arquivo de teste)
- Saldo financeiro por período
- Antecipações pendentes
- Receitas por categoria
- Despesas operacionais
- Integração receitas x recebimentos
- E muito mais...

## Arquivos Criados

1. **Migration SQL**
   - `create_engineering_finance_management_system_fixed.sql`
   - Tabelas, triggers, views e funções

2. **Componente React**
   - `src/components/EngineeringFinanceManager.tsx`
   - Interface completa de gerenciamento

3. **Documentação**
   - `MODULO_RECEITAS_DESPESAS_ENGENHARIA.md`
   - Guia completo com exemplos

4. **Testes**
   - `TESTE_RECEITAS_DESPESAS_ENGENHARIA.sql`
   - 20 queries de validação

5. **Resumo**
   - `RESUMO_MODULO_RECEITAS_DESPESAS.md`
   - Este arquivo (guia rápido)

## Benefícios

### Para Gestão Financeira
- ✅ Visão completa de receitas e despesas
- ✅ Segregação entre honorários e reembolsos
- ✅ Controle de antecipações pendentes
- ✅ Relatórios detalhados por categoria

### Para Gestão de Projetos
- ✅ Valores atualizados automaticamente
- ✅ Saldo correto incluindo antecipações
- ✅ Rastreamento de reembolsos
- ✅ Integração total com módulo de projetos

### Para Contabilidade
- ✅ Classificação contábil das receitas
- ✅ Separação de receitas próprias vs reembolsos
- ✅ Despesas categorizadas
- ✅ Exportação de relatórios

### Para Cobrança
- ✅ Identificação clara de valores a receber
- ✅ Separação entre honorários e reembolsos
- ✅ Histórico completo de movimentações
- ✅ Alertas de antecipações não reembolsadas

## Observações Importantes

### Lançamentos Automáticos
- Criados a partir de recebimentos ou antecipações
- NÃO podem ser excluídos diretamente
- Têm ícone indicando origem automática

### Lançamentos Manuais
- Criados manualmente pelo usuário
- Podem ser excluídos a qualquer momento
- Úteis para despesas operacionais

### Antecipações
- Sempre vinculadas a um projeto
- Sempre atualizam o saldo do cliente
- Marcadas automaticamente quando reembolsadas

## Validação

- ✅ Build executado com sucesso
- ✅ Componente integrado ao módulo
- ✅ Banco de dados estruturado
- ✅ Triggers funcionando
- ✅ Integração com pagamentos
- ✅ Sistema de antecipações operacional
- ✅ Documentação completa

## Próximos Passos

1. Testar o módulo no sistema
2. Cadastrar uma antecipação de teste
3. Verificar atualização automática do saldo
4. Cadastrar recebimento e verificar receita
5. Explorar filtros e relatórios

## Suporte

Para dúvidas:
- Consulte `MODULO_RECEITAS_DESPESAS_ENGENHARIA.md` (documentação completa)
- Execute `TESTE_RECEITAS_DESPESAS_ENGENHARIA.sql` (validação)
- Verifique exemplos práticos na documentação

---

**Módulo pronto para uso!** ✅
