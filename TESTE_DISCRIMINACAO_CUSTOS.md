# Teste Rápido: Discriminação de Custos no Extrato

## Como Testar a Funcionalidade

### Passo 1: Verificar Estrutura do Banco

```sql
-- Verificar se a tabela engineering_project_costs existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'engineering_project_costs';
```

### Passo 2: Criar Dados de Teste

```sql
-- 1. Criar ou usar cliente existente
-- Pegar o ID de um cliente
SELECT id, name FROM customers LIMIT 5;

-- 2. Pegar template de serviço
SELECT id, name, fees FROM engineering_service_templates LIMIT 5;

-- 3. Pegar imóvel
SELECT id, name FROM properties LIMIT 5;

-- 4. Criar projeto de teste
INSERT INTO engineering_projects (
  customer_id,
  template_id,
  property_id,
  name,
  start_date,
  status,
  grand_total,
  total_received,
  balance
) VALUES (
  '[id_cliente]',
  '[id_template]',
  '[id_imovel]',
  'Projeto Teste - Discriminação de Custos',
  CURRENT_DATE,
  'em_desenvolvimento',
  10500.00,
  5000.00,
  5500.00
) RETURNING id;

-- 5. Adicionar custos adicionais ao projeto
-- Use o ID retornado acima
INSERT INTO engineering_project_costs (project_id, cost_type, description, value, date) VALUES
('[project_id]', 'material', 'GPS Geodésico de alta precisão', 2500.00, CURRENT_DATE),
('[project_id]', 'travel', 'Deslocamento para visitas técnicas (3x)', 800.00, CURRENT_DATE + 1),
('[project_id]', 'service', 'Serviço de topografia especializada', 1500.00, CURRENT_DATE + 2),
('[project_id]', 'equipment', 'Aluguel de equipamento de medição', 700.00, CURRENT_DATE + 3);
```

### Passo 3: Verificar Dados Criados

```sql
-- Verificar projeto e seus custos
SELECT
  ep.id,
  ep.name as projeto,
  est.name as servico,
  est.fees as honorarios,
  ep.grand_total,
  ep.total_received,
  ep.balance,
  COUNT(epc.id) as qtd_custos_adicionais,
  COALESCE(SUM(epc.value), 0) as total_custos_adicionais
FROM engineering_projects ep
LEFT JOIN engineering_service_templates est ON ep.template_id = est.id
LEFT JOIN engineering_project_costs epc ON ep.project_id = epc.project_id
WHERE ep.name LIKE '%Teste - Discriminação%'
GROUP BY ep.id, ep.name, est.name, est.fees, ep.grand_total, ep.total_received, ep.balance;

-- Listar custos adicionais
SELECT
  epc.cost_type,
  epc.description,
  epc.value,
  epc.date
FROM engineering_project_costs epc
JOIN engineering_projects ep ON epc.project_id = ep.id
WHERE ep.name LIKE '%Teste - Discriminação%'
ORDER BY epc.date;
```

**Resultado esperado:**
```
Projeto: Projeto Teste - Discriminação de Custos
Serviço: [Nome do serviço]
Honorários: 5000.00 (ou valor do template)
Grand Total: 10500.00
Total Recebido: 5000.00
Saldo: 5500.00
Qtd Custos Adicionais: 4
Total Custos Adicionais: 5500.00

Custos:
- Material: GPS Geodésico de alta precisão - R$ 2.500,00
- Viagem/Deslocamento: Deslocamento para visitas técnicas (3x) - R$ 800,00
- Serviço: Serviço de topografia especializada - R$ 1.500,00
- Equipamento: Aluguel de equipamento de medição - R$ 700,00
```

### Passo 4: Testar Interface Web

1. **Acesse o Sistema**
   ```
   Módulo Engenharia → Extrato do Cliente
   ```

2. **Selecione o Cliente**
   - Digite o nome do cliente no campo de busca
   - Clique no cliente para selecioná-lo

3. **Verifique os Cards de Resumo**
   - Total de Projetos: deve mostrar quantidade
   - Valor Total: soma de todos os projetos
   - Total Recebido: soma de pagamentos
   - **Saldo a Receber**: deve estar em vermelho, negrito, fundo vermelho

4. **Verifique a Tabela de Projetos**
   - Deve mostrar o projeto de teste
   - Coluna "Serviço Prestado" deve mostrar nome do serviço (não descrição)
   - Valor Total deve ser R$ 10.500,00

5. **Verifique a Seção "Discriminação de Valores por Projeto"**
   ```
   ✓ Cabeçalho em azul: [Nome do Serviço] - [Nome do Imóvel]
   ✓ Status do projeto com badge colorido
   ✓ Fundo cinza claro (bg-gray-50)
   ✓ • Honorários do Serviço: R$ 5.000,00 (ou valor do template)
   ✓ • Material: GPS Geodésico de alta precisão: R$ 2.500,00
   ✓ • Viagem/Deslocamento: Deslocamento para visitas técnicas (3x): R$ 800,00
   ✓ • Serviço: Serviço de topografia especializada: R$ 1.500,00
   ✓ • Equipamento: Aluguel de equipamento de medição: R$ 700,00
   ✓ Linha separadora
   ✓ TOTAL DO PROJETO: R$ 10.500,00 (em azul e negrito)
   ✓ Total Recebido: R$ 5.000,00 (em verde)
   ✓ Saldo a Receber: R$ 5.500,00 (em vermelho e negrito)
   ```

6. **Verifique o Histórico de Recebimentos**
   - Deve mostrar todos os pagamentos (se houver)
   - Com observações na última coluna

### Passo 5: Testar Exportação de PDF

1. **Gerar PDF**
   - Clique no botão "Exportar PDF"
   - Aguarde o download

2. **Abrir e Verificar o PDF**

   **a) Cabeçalho do Documento**
   ```
   ✓ Logo da empresa (se configurado)
   ✓ Dados da empresa
   ✓ Título: "Extrato do Cliente - Projetos de Engenharia"
   ```

   **b) Dados do Cliente**
   ```
   ✓ Nome do cliente
   ✓ CPF
   ✓ Telefone
   ```

   **c) Resumo Financeiro**
   ```
   ✓ Total de Projetos: 1 (ou quantidade)
   ✓ Valor Total: R$ 10.500,00
   ✓ Total Recebido: R$ 5.000,00
   ✓ SALDO A RECEBER: R$ 5.500,00 ← EM VERMELHO E NEGRITO
   ```

   **d) Tabela de Projetos**
   ```
   ┌─────────────────┬─────────┬────────┬────────┬──────────┬────────┐
   │ Serviço Prestado│ Imóvel  │ Status │ Valor  │ Recebido │ Saldo  │
   ├─────────────────┼─────────┼────────┼────────┼──────────┼────────┤
   │ [Nome Serviço]  │ [Imóvel]│ [...]  │ 10500  │ 5000     │ 5500   │
   └─────────────────┴─────────┴────────┴────────┴──────────┴────────┘
   ```

   **e) Discriminação de Valores por Projeto** ⭐ NOVA SEÇÃO
   ```
   Discriminação de Valores por Projeto

   [Nome do Serviço] - [Nome do Imóvel]

   • Honorários do Serviço:                           R$ 5.000,00
   • Material: GPS Geodésico de alta precisão         R$ 2.500,00
   • Viagem/Deslocamento: Deslocamento para...        R$ 800,00
   • Serviço: Serviço de topografia especializada     R$ 1.500,00
   • Equipamento: Aluguel de equipamento de medição   R$ 700,00

   TOTAL DO PROJETO:                                 R$ 10.500,00
   ─────────────────────────────────────────────────────────────
   ```

   **f) Detalhamento de Recebimentos** (se houver)
   ```
   ┌──────────┬──────────────┬────────────┬────────┬────────┬──────────────┐
   │ Data     │ Serv. Prest. │ Forma Pgto │ Conta  │ Valor  │ Observações  │
   ├──────────┼──────────────┼────────────┼────────┼────────┼──────────────┤
   │ [...]    │ [...]        │ [...]      │ [...]  │ [...]  │ [...]        │
   └──────────┴──────────────┴────────────┴────────┴────────┴──────────────┘

   Total de Recebimentos: X
   Valor Total Recebido: R$ X.XXX,XX ← EM VERDE E NEGRITO
   ```

### Passo 6: Testar Cenários Diferentes

#### Cenário 1: Projeto SEM Custos Adicionais

```sql
-- Criar projeto apenas com honorários
INSERT INTO engineering_projects (
  customer_id,
  template_id,
  property_id,
  name,
  start_date,
  status,
  grand_total
) VALUES (
  '[id_cliente]',
  '[id_template]',
  '[id_imovel]',
  'Projeto Simples - Apenas Honorários',
  CURRENT_DATE,
  'finalizado',
  3500.00
);
```

**Resultado esperado na Interface:**
```
Projeto Simples - Apenas Honorários
Status: [Finalizado]

┌────────────────────────────────────────┐
│ • Honorários do Serviço: R$ 3.500,00  │
│ ──────────────────────────────────────  │
│ TOTAL DO PROJETO:        R$ 3.500,00  │
└────────────────────────────────────────┘
```

#### Cenário 2: Projeto com Muitos Custos

```sql
INSERT INTO engineering_project_costs (project_id, cost_type, description, value, date) VALUES
('[project_id]', 'material', 'Item 1', 500.00, CURRENT_DATE),
('[project_id]', 'material', 'Item 2', 300.00, CURRENT_DATE),
('[project_id]', 'labor', 'Mão de obra especializada', 2000.00, CURRENT_DATE),
('[project_id]', 'equipment', 'Equipamento A', 800.00, CURRENT_DATE),
('[project_id]', 'equipment', 'Equipamento B', 600.00, CURRENT_DATE),
('[project_id]', 'service', 'Consultoria', 1500.00, CURRENT_DATE),
('[project_id]', 'travel', 'Viagens', 400.00, CURRENT_DATE),
('[project_id]', 'other', 'Diversos', 200.00, CURRENT_DATE);
```

**Resultado esperado:**
- Todos os 8 itens devem aparecer listados
- Cada um com seu tipo traduzido em português
- Valores alinhados à direita
- Soma total correta

#### Cenário 3: Múltiplos Projetos para o Mesmo Cliente

```sql
-- Verificar que cada projeto aparece separado
-- com sua própria discriminação de custos
```

**Resultado esperado:**
- Cada projeto em sua própria seção
- Linha separadora entre projetos
- Totais individuais corretos

### Passo 7: Verificar Tipos de Custo

Testar todos os tipos de custo suportados:

```sql
INSERT INTO engineering_project_costs (project_id, cost_type, description, value, date) VALUES
('[project_id]', 'material', 'Teste Material', 100.00, CURRENT_DATE),
('[project_id]', 'labor', 'Teste Mão de Obra', 200.00, CURRENT_DATE),
('[project_id]', 'equipment', 'Teste Equipamento', 300.00, CURRENT_DATE),
('[project_id]', 'service', 'Teste Serviço', 400.00, CURRENT_DATE),
('[project_id]', 'travel', 'Teste Viagem', 500.00, CURRENT_DATE),
('[project_id]', 'other', 'Teste Outros', 600.00, CURRENT_DATE);
```

**Verificar no PDF e Interface:**
```
✓ material     → Material
✓ labor        → Mão de Obra
✓ equipment    → Equipamento
✓ service      → Serviço
✓ travel       → Viagem/Deslocamento
✓ other        → Outros
```

### Passo 8: Limpar Dados de Teste

```sql
-- Remover custos adicionais
DELETE FROM engineering_project_costs
WHERE project_id IN (
  SELECT id FROM engineering_projects
  WHERE name LIKE '%Teste%'
);

-- Remover projetos de teste
DELETE FROM engineering_projects
WHERE name LIKE '%Teste%';
```

---

## Checklist de Validação

### Interface Web
- [ ] Seção "Discriminação de Valores por Projeto" aparece
- [ ] Honorários do serviço são exibidos corretamente
- [ ] Custos adicionais aparecem com tipo traduzido
- [ ] Valores estão alinhados à direita
- [ ] Total do projeto está correto
- [ ] Total recebido em verde
- [ ] Saldo a receber em vermelho (se houver)
- [ ] Layout limpo e organizado
- [ ] Funciona com múltiplos projetos
- [ ] Funciona com projetos sem custos adicionais

### PDF
- [ ] Seção "Discriminação de Valores por Projeto" aparece após tabela
- [ ] Cabeçalho de cada projeto em azul
- [ ] Honorários listados primeiro
- [ ] Custos adicionais com marcadores (•)
- [ ] Tipos de custo traduzidos corretamente
- [ ] Valores alinhados à direita (140px)
- [ ] "TOTAL DO PROJETO" em negrito
- [ ] Linha separadora entre projetos
- [ ] Paginação automática se necessário
- [ ] Todos os valores formatados corretamente (R$ X.XXX,XX)

### Cálculos
- [ ] grand_total = service_fees + soma(additional_costs)
- [ ] balance = grand_total - total_received
- [ ] Valores decimais corretos (2 casas)
- [ ] Formatação de moeda consistente

---

## Problemas Comuns e Soluções

### Problema 1: Custos adicionais não aparecem

**Causa:** Projeto não tem custos cadastrados ou project_id incorreto

**Solução:**
```sql
-- Verificar custos do projeto
SELECT * FROM engineering_project_costs
WHERE project_id = '[id_projeto]';

-- Se vazio, inserir custos de teste
```

### Problema 2: Honorários aparecem como R$ 0,00

**Causa:** Template não tem valor de fees configurado

**Solução:**
```sql
-- Verificar fees do template
SELECT id, name, fees FROM engineering_service_templates;

-- Atualizar se necessário
UPDATE engineering_service_templates
SET fees = 5000.00
WHERE id = '[template_id]';
```

### Problema 3: Total não bate

**Causa:** grand_total não foi atualizado após adicionar custos

**Solução:**
```sql
-- Recalcular e atualizar grand_total
UPDATE engineering_projects ep
SET grand_total = (
  SELECT COALESCE(est.fees, 0) + COALESCE(SUM(epc.value), 0)
  FROM engineering_service_templates est
  LEFT JOIN engineering_project_costs epc ON epc.project_id = ep.id
  WHERE est.id = ep.template_id
)
WHERE ep.id = '[project_id]';
```

### Problema 4: PDF não gera a seção

**Causa:** Erro de JavaScript ou dados incompletos

**Solução:**
```
1. Abrir console do navegador (F12)
2. Tentar gerar PDF novamente
3. Verificar erros no console
4. Verificar se projects tem dados corretos
```

---

## Conclusão

Após seguir todos os passos:

✅ Discriminação de custos funcionando na interface web
✅ Discriminação de custos funcionando no PDF
✅ Todos os tipos de custo traduzidos corretamente
✅ Cálculos corretos
✅ Layout profissional e organizado

**Funcionalidade pronta para uso em produção!**
