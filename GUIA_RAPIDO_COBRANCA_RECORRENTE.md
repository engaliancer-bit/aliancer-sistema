# Guia Rápido: Cobrança Recorrente para Consultoria

## Problema Resolvido

Você cadastrou um projeto de consultoria com:
- Início: 01/07/2025
- Fim: 31/12/2025
- Valor: R$ 910,80

O sistema NÃO estava somando os meses automaticamente.

## Solução Implementada

✅ **Sistema agora calcula automaticamente**:
- Conta os meses do período (6 meses)
- Divide o valor total pelos meses (R$ 910,80 ÷ 6 = R$ 151,80/mês)
- Gera cobrança para cada mês automaticamente
- Cobra no dia escolhido (ex: dia 10)

---

## Como Usar (3 Passos)

### 1. Cadastrar Projeto de Consultoria

Ao criar o projeto, você verá novos campos:

```
┌────────────────────────────────────────┐
│ [✓] Cobrança Mensal Recorrente         │
│                                        │
│ O sistema calculará automaticamente   │
│ o valor mensal com base no período    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Dia do Vencimento Mensal               │
│ [▼] Dia 10 de cada mês                │
└────────────────────────────────────────┘
```

**Preencha**:
1. ✅ Marque "Cobrança Mensal Recorrente"
2. Escolha o dia do vencimento (1 a 28)
3. Preencha data início e data fim
4. Informe o valor TOTAL do contrato
5. Salve

### 2. Sistema Calcula Automaticamente

Ao salvar, o sistema:
1. Conta quantos meses: `(fim - início) + 1`
2. Calcula valor mensal: `valor_total ÷ meses`
3. Gera uma cobrança para cada mês
4. Define vencimento no dia escolhido

### 3. Visualizar Cobranças Geradas

As cobranças aparecem automaticamente no sistema.

Você pode:
- Ver todas as mensalidades geradas
- Acompanhar o que está pago/pendente
- Receber notificações de vencimento

---

## Exemplo Real (Seu Caso)

### Dados Informados
- Data início: **01/07/2025**
- Data fim: **31/12/2025**
- Valor total: **R$ 910,80**
- Recorrência: **Mensal (dia 10)**

### O Que o Sistema Fez

**1. Calculou os meses**:
```
Julho → Agosto → Setembro → Outubro → Novembro → Dezembro = 6 meses
```

**2. Calculou o valor mensal**:
```
R$ 910,80 ÷ 6 meses = R$ 151,80/mês
```

**3. Gerou 6 cobranças**:

| Mês | Vencimento | Valor | Status |
|-----|------------|-------|--------|
| Jul/2025 | 10/07/2025 | R$ 151,80 | Vencido* |
| Ago/2025 | 10/08/2025 | R$ 151,80 | Vencido* |
| Set/2025 | 10/09/2025 | R$ 151,80 | Vencido* |
| Out/2025 | 10/10/2025 | R$ 151,80 | Vencido* |
| Nov/2025 | 10/11/2025 | R$ 151,80 | Vencido* |
| Dez/2025 | 10/12/2025 | R$ 151,80 | Vencido* |

**Total**: 6 × R$ 151,80 = **R$ 910,80** ✅

*_Marcado como "vencido" porque as datas já passaram_

---

## Próximos Meses (Automático)

Para projetos que continuam após a data fim:

O sistema **automaticamente** gera a cobrança do próximo mês quando:
- Chegar o dia do vencimento
- Projeto ainda estiver ativo
- Não houver cobrança para aquele mês

---

## Casos de Uso

### Caso 1: Contrato Novo (Futuro)

**Cadastro**:
- Início: 01/03/2026
- Fim: 31/08/2026
- Valor: R$ 3.000,00
- Recorrência: Dia 5

**Resultado**:
- Sistema gera 6 cobranças (mar a ago/2026)
- Valor mensal: R$ 500,00 cada
- Vencimento: dia 5 de cada mês

### Caso 2: Contrato Retroativo (Como o seu)

**Cadastro**:
- Início: 01/01/2025
- Fim: 31/12/2025
- Valor: R$ 12.000,00
- Recorrência: Dia 15

**Resultado**:
- Sistema gera 12 cobranças (jan a dez/2025)
- Valor mensal: R$ 1.000,00 cada
- Status: Todas vencidas (aguardando regularização)

### Caso 3: Contrato Sem Data Fim

**Cadastro**:
- Início: 01/02/2026
- Fim: (vazio)
- Valor mensal: R$ 2.500,00
- Recorrência: Dia 10

**Resultado**:
- Sistema gera cobrança do mês atual
- Todo mês gera nova cobrança
- Continua até projeto ser finalizado

---

## Perguntas Frequentes

### O valor está errado, como corrigir?

Se o sistema calculou errado:

1. Edite o projeto
2. Ajuste o valor total (grand_total)
3. As novas cobranças usarão o valor correto

Para cobranças já geradas, você pode:
- Editar manualmente cada cobrança
- Ou deletar e gerar novamente

### Como ver todas as cobranças?

No módulo Engenharia, terá uma aba mostrando:
- Todas as cobranças recorrentes
- Filtros por status (pendente/pago/vencido)
- Total a receber

### E se eu não marcar "Cobrança Recorrente"?

O projeto funciona normalmente, mas:
- Não gera cobranças automáticas
- Você controla manualmente os pagamentos
- Como era antes

### Posso mudar o dia do vencimento?

Sim! Ao editar o projeto:
- Altere o dia do vencimento
- Cobranças futuras usam o novo dia
- Cobranças antigas mantêm o dia original

---

## Comandos SQL (Para Administrador)

### Ver cobranças de um projeto

```sql
SELECT
  to_char(charge_date, 'MM/YYYY') as mes,
  to_char(due_date, 'DD/MM/YYYY') as vencimento,
  amount as valor,
  status
FROM engineering_recurring_charges
WHERE project_id = '[id-do-projeto]'
ORDER BY charge_date;
```

### Gerar cobranças manualmente

```sql
-- Para um projeto específico
SELECT generate_recurring_charges_for_project('[project-id]'::uuid);

-- Para todos os projetos recorrentes
SELECT * FROM generate_all_recurring_charges();
```

### Calcular total a receber

```sql
SELECT
  SUM(amount) as total
FROM engineering_recurring_charges
WHERE status IN ('pending', 'overdue');
```

---

## Status da Implementação

**Data**: 17 de Fevereiro de 2026
**Versão**: 1.0.0
**Status**: ✅ **FUNCIONANDO**

### O Que Foi Implementado

✅ Checkbox "Cobrança Mensal Recorrente" no formulário
✅ Campo "Dia do Vencimento" (1 a 28)
✅ Cálculo automático do valor mensal proporcional
✅ Geração automática de cobranças para todo período
✅ Suporte a cobranças retroativas (meses passados)
✅ Status automático (pendente/vencido)
✅ Edge function para processar cobranças

### Testado Com Sucesso

✅ Projeto 01/07/2025 a 31/12/2025
✅ Valor R$ 910,80
✅ 6 cobranças × R$ 151,80
✅ Total correto: R$ 910,80

---

## Suporte

Se tiver problemas ou dúvidas:

1. Verifique se marcou "Cobrança Recorrente"
2. Confirme que informou data início e fim
3. Verifique se o valor total está correto
4. Consulte o log no console do navegador (F12)

**Sistema pronto para uso!** 🎉
