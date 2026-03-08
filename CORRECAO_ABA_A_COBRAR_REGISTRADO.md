# Correção - Aba "À Cobrar" (Incluir Status Registrado)

## Problema Identificado

Os projetos com status **"Registrado"** não estavam aparecendo na aba **"À Cobrar"**, mesmo quando possuíam saldo devedor.

### Comportamento Anterior (Incorreto)
- ❌ Status "Registrado" NÃO aparecia na aba "À Cobrar"
- ✅ Status "Finalizado" e "Entregue" apareciam normalmente

### Comportamento Esperado
- ✅ Status "Finalizado", "Entregue" E "Registrado" devem aparecer
- ✅ Apenas se tiverem saldo devedor (balance > 0)
- ✅ Removidos automaticamente quando saldo = 0

## Causa Raiz

A view `projects_to_collect` tinha uma cláusula WHERE que filtrava apenas os status 'finalizado' e 'entregue', excluindo 'registrado':

```sql
-- ANTES (Incorreto)
WHERE ep.status IN ('finalizado', 'entregue')
  AND ep.balance > 0
```

## Solução Implementada

### Migration Criada
**Arquivo:** `supabase/migrations/[timestamp]_fix_projects_to_collect_include_registrado.sql`

### Alteração Realizada
Atualização da view `projects_to_collect` para incluir o status 'registrado':

```sql
-- DEPOIS (Correto)
WHERE ep.status IN ('finalizado', 'entregue', 'registrado')
  AND ep.balance > 0
```

### View Completa Atualizada
```sql
CREATE OR REPLACE VIEW projects_to_collect AS
SELECT
  ep.id,
  ep.name AS project_name,
  ep.status,
  ep.grand_total,
  ep.total_received,
  ep.balance AS balance_due,
  ep.created_at,
  ep.actual_completion_date,
  ep.property_id,
  c.id AS customer_id,
  c.name AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone
FROM engineering_projects ep
JOIN customers c ON c.id = ep.customer_id
WHERE ep.status IN ('finalizado', 'entregue', 'registrado')
  AND ep.balance > 0
ORDER BY ep.actual_completion_date DESC NULLS LAST, ep.created_at DESC;
```

## Regras de Negócio Implementadas

### 1. Inclusão na Aba "À Cobrar"
Um projeto aparece na aba "À Cobrar" quando:
- ✅ Status = 'finalizado' OU 'entregue' OU 'registrado'
- ✅ Saldo devedor > 0 (balance > 0)

### 2. Remoção Automática da Aba "À Cobrar"
Um projeto é removido automaticamente quando:
- ❌ Saldo devedor = 0 (totalmente pago)
- ❌ Status diferente de 'finalizado', 'entregue' ou 'registrado'

### 3. Comportamento por Status

| Status | Aparece se balance > 0 | Removido se balance = 0 |
|--------|------------------------|-------------------------|
| A Iniciar | ❌ Não | - |
| Em Desenvolvimento | ❌ Não | - |
| Em Correção | ❌ Não | - |
| Em Exigência | ❌ Não | - |
| **Finalizado** | ✅ Sim | ✅ Sim |
| **Entregue** | ✅ Sim | ✅ Sim |
| **Registrado** | ✅ Sim | ✅ Sim |

## Impacto no Sistema

### Componentes Afetados
1. **EngineeringProjectsManager.tsx** (Nenhuma alteração necessária)
   - Já usa a view `projects_to_collect`
   - Atualização automática com a nova view

2. **Aba "À Cobrar"**
   - Agora mostra projetos registrados com saldo devedor
   - Contador atualizado automaticamente

3. **Dashboard/Relatórios**
   - Qualquer componente que use `projects_to_collect` se beneficia

### Frontend (Nenhuma Alteração Necessária)
O código TypeScript já estava preparado para os 3 status:
```typescript
status: 'a_iniciar' | 'em_desenvolvimento' | 'em_correcao' | 'finalizado' | 'entregue' | 'em_exigencia' | 'registrado';
```

## Como Testar

### Teste Manual

1. **Criar um projeto de teste:**
   - Status: "Registrado"
   - Valor Total: R$ 1.000,00
   - Recebido: R$ 500,00
   - Saldo: R$ 500,00

2. **Verificar na aba "À Cobrar":**
   - ✅ O projeto DEVE aparecer
   - ✅ Mostrar saldo de R$ 500,00

3. **Realizar pagamento total:**
   - Cadastrar recebimento de R$ 500,00
   - Saldo fica R$ 0,00

4. **Verificar novamente:**
   - ✅ O projeto NÃO deve mais aparecer na aba "À Cobrar"

### Teste com SQL
Execute o arquivo: `TESTE_PROJETOS_A_COBRAR_REGISTRADO.sql`

Esse arquivo contém 7 queries de validação que verificam:
- Projetos registrados aparecem corretamente
- Projetos com saldo zero não aparecem
- Contadores estão corretos
- Nenhuma discrepância existe

## Exemplos de Uso

### Cenário 1: Projeto Registrado com Débito
```
Projeto: CAR João Silva
Status: Registrado
Valor Total: R$ 2.000,00
Recebido: R$ 1.500,00
Saldo: R$ 500,00

Resultado: ✅ APARECE na aba "À Cobrar"
```

### Cenário 2: Projeto Registrado Totalmente Pago
```
Projeto: Georreferenciamento Maria
Status: Registrado
Valor Total: R$ 5.000,00
Recebido: R$ 5.000,00
Saldo: R$ 0,00

Resultado: ❌ NÃO APARECE na aba "À Cobrar"
```

### Cenário 3: Projeto em Desenvolvimento com Débito
```
Projeto: Levantamento Topográfico
Status: Em Desenvolvimento
Valor Total: R$ 3.000,00
Recebido: R$ 1.000,00
Saldo: R$ 2.000,00

Resultado: ❌ NÃO APARECE na aba "À Cobrar"
(Status não está em finalizado/entregue/registrado)
```

### Cenário 4: Projeto Finalizado com Débito
```
Projeto: PRAD Fazenda
Status: Finalizado
Valor Total: R$ 8.000,00
Recebido: R$ 5.000,00
Saldo: R$ 3.000,00

Resultado: ✅ APARECE na aba "À Cobrar"
```

## Fluxo Completo de Cobrança

```
1. Projeto criado → Status: "Em Desenvolvimento"
   └─ NÃO aparece em "À Cobrar"

2. Projeto concluído → Status: "Finalizado"
   └─ Se balance > 0 → ✅ APARECE em "À Cobrar"
   └─ Se balance = 0 → ❌ NÃO aparece

3. Projeto entregue → Status: "Entregue"
   └─ Se balance > 0 → ✅ APARECE em "À Cobrar"
   └─ Se balance = 0 → ❌ NÃO aparece

4. Projeto registrado → Status: "Registrado"
   └─ Se balance > 0 → ✅ APARECE em "À Cobrar"
   └─ Se balance = 0 → ❌ NÃO aparece

5. Cliente paga o saldo → balance = 0
   └─ ✅ REMOVIDO automaticamente de "À Cobrar"
```

## Benefícios da Correção

### Para Gestão Financeira
- ✅ Visibilidade completa de todos os débitos
- ✅ Não perde projetos registrados com pendências
- ✅ Controle mais preciso de inadimplência

### Para Cobrança
- ✅ Lista completa de projetos a cobrar
- ✅ Incluindo projetos já registrados em cartório
- ✅ Acompanhamento até quitação total

### Para Relatórios
- ✅ Contadores corretos na aba
- ✅ Métricas financeiras precisas
- ✅ Dados completos para análise

## Notas Importantes

1. **Automatização Total**
   - A remoção/inclusão na aba é automática
   - Baseada apenas em status e saldo
   - Sem necessidade de ação manual

2. **Histórico Preservado**
   - Projetos totalmente pagos não aparecem mais
   - Mas permanecem no banco de dados
   - Podem ser consultados na aba "Registrados"

3. **Integração com Extrato do Cliente**
   - A nova aba "Extrato do Cliente" também se beneficia
   - Mostra todos os projetos independente do status
   - Facilita visualização completa

## Validação Final

- ✅ Migration aplicada com sucesso
- ✅ View atualizada corretamente
- ✅ Lógica de negócio validada
- ✅ Queries de teste criadas
- ✅ Documentação completa
- ✅ Nenhuma alteração no frontend necessária

## Conclusão

A correção foi implementada com sucesso através de uma simples atualização na view `projects_to_collect`. Agora todos os projetos com status "Finalizado", "Entregue" ou "Registrado" aparecem na aba "À Cobrar", desde que possuam saldo devedor maior que zero.

A remoção automática continua funcionando perfeitamente: assim que o saldo chega a zero, o projeto é removido da lista automaticamente.
