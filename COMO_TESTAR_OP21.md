# Como Testar - OP #21 Agora Aparece

## Confirmação do Problema (Resolvido)

**OP #21 - Dados:**
- Número: 21
- Status: open
- Produto: "Tesoura pré moldada T vão de 10,00 m sem aba"
- Cliente: Celso Schaefer
- Quantidade total: 3
- Quantidade produzida: 0
- Quantidade restante: 3
- **Tipo: LEGADO (sem itens)**

**Problema:** Sistema não mostrava a OP #21 na lista porque buscava apenas ordens com itens em `production_order_items`, mas a OP #21 é uma ordem antiga sem itens.

**Solução:** Sistema agora busca de AMBOS os lugares (com itens e sem itens).

---

## Passo a Passo para Testar

### 1. Abrir Produção Diária
- Acessar o sistema
- Ir em **Produção Diária**

### 2. Abrir Console do Navegador (F12)
- Pressionar **F12**
- Clicar na aba **Console**
- Deixar aberto para ver os logs

### 3. Selecionar o Produto
- No formulário de produção
- Campo "Produto *"
- Selecionar: **"Tesoura pré moldada T vão de 10,00 m sem aba"**

### 4. Selecionar Tipo de Produção
- Campo "Tipo de Produção *"
- Selecionar: **"Para Ordem de Produção"**

### 5. Verificar Logs no Console
Deve aparecer algo assim:

```
Carregando ordens abertas (modelo novo e legado) para produto: adcb5b14-887c-4f4d-9e9e-43dc01239bae

=== DEBUG ORDENS ABERTAS ===
Produto selecionado: adcb5b14-887c-4f4d-9e9e-43dc01239bae
Total de ordens encontradas: 1
Ordens modelo novo (com itens): 0
Ordens modelo legado (sem itens): 1
Detalhes das ordens: [
  {
    id: "31986b50-5125-4e9c-ad42-e156c7ec89e3",
    item_id: null,
    order_number: 21,
    product_id: "adcb5b14-887c-4f4d-9e9e-43dc01239bae",
    total_quantity: 3,
    produced_quantity: 0,
    remaining_quantity: 3,
    is_legacy: true,
    customers: { name: "Celso Schaefer" },
    products: { name: "Tesoura pré moldada T vão de 10,00 m sem aba" }
  }
]
==========================
```

### 6. Verificar Select de Ordem de Produção
- Campo "Ordem de Produção *"
- Deve aparecer:
  ```
  OP #21 - Tesoura pré moldada T vão de 10,00 m sem aba - Celso Schaefer - Faltam 3 de 3 (Ordem legada)
  ```

✅ **Se aparecer "OP #21 (Ordem legada)", está funcionando!**

### 7. Registrar uma Produção de Teste
- Selecionar "OP #21" no campo "Ordem de Produção *"
- Quantidade: **1**
- Data: deixar como hoje
- Observações: "Teste de produção OP #21"
- Clicar em **"Registrar Produção"**

### 8. Verificar Logs de Atualização
No console deve aparecer:

```
Atualizando ordem legada (sem itens)...

✓ Ordem legada atualizada: {
  ordem: 21,
  produzido_antes: 0,
  produzido_agora: 1,
  produzido_total: 1,
  restante: 2,
  novo_status: "in_progress"
}
```

### 9. Verificar no Banco de Dados (Opcional)
Se tiver acesso ao Supabase, executar:

```sql
SELECT
  order_number,
  total_quantity,
  produced_quantity,
  remaining_quantity,
  status
FROM production_orders
WHERE order_number = 21;
```

**Resultado esperado:**
- order_number: 21
- total_quantity: 3
- produced_quantity: 1 (antes era 0)
- remaining_quantity: 2 (antes era 3)
- status: 'in_progress' (antes era 'open')

### 10. Registrar Mais Produções (Opcional)
Repetir o processo:
- Registrar mais 1 unidade → remaining = 1, status = 'in_progress'
- Registrar mais 1 unidade → remaining = 0, status = 'completed'

Quando chegar a 0, a OP #21 deve sumir da lista de ordens abertas.

---

## Casos de Teste

### ✅ Caso 1: OP Legada Aparece
- **Ação:** Selecionar produto da OP #21
- **Esperado:** OP #21 aparece com "(Ordem legada)"
- **Status:** DEVE FUNCIONAR

### ✅ Caso 2: Registro de Produção Funciona
- **Ação:** Registrar 1 unidade na OP #21
- **Esperado:** Produção registrada, OP atualizada
- **Status:** DEVE FUNCIONAR

### ✅ Caso 3: Progresso Atualiza Corretamente
- **Ação:** Verificar progresso após produção
- **Esperado:** produced_quantity aumenta, remaining_quantity diminui
- **Status:** DEVE FUNCIONAR

### ✅ Caso 4: Status Muda Corretamente
- **Ação:** Produzir até completar
- **Esperado:** Status muda para 'in_progress' e depois 'completed'
- **Status:** DEVE FUNCIONAR

### ✅ Caso 5: OP Completa Some da Lista
- **Ação:** Completar toda a produção
- **Esperado:** OP #21 não aparece mais na lista de abertas
- **Status:** DEVE FUNCIONAR

---

## Troubleshooting

### Problema: OP #21 não aparece
**Verificar:**
1. Console tem logs de "DEBUG ORDENS ABERTAS"?
2. O produto selecionado é realmente "Tesoura pré moldada T vão de 10,00 m sem aba"?
3. No log aparece "Ordens modelo legado (sem itens): 0"?

**Se sim, verificar no banco:**
```sql
SELECT * FROM production_orders WHERE order_number = 21;
```

Se status não for 'open' ou 'in_progress', a OP não aparecerá.

### Problema: Erro ao registrar produção
**Verificar console:**
- Deve ter logs detalhados do erro
- Verificar se payload foi enviado corretamente
- Verificar se `production_order_id` está preenchido

### Problema: Progresso não atualiza
**Verificar logs:**
- Deve aparecer "Atualizando ordem legada (sem itens)..."
- Se não aparecer, verificar se `order.is_legacy` está true

**Verificar no banco:**
```sql
SELECT produced_quantity, remaining_quantity
FROM production_orders
WHERE order_number = 21;
```

---

## Diferença Visual: Ordem Legada vs Nova

### Ordem Legada (OP #21)
```
OP #21 - Tesoura pré moldada T vão de 10,00 m sem aba - Celso Schaefer - Faltam 3 de 3 (Ordem legada)
                                                                                      ^^^^^^^^^^^^^^^^
                                                                                      Indicador visual
```

### Ordem Nova (com itens)
```
OP #23 - Bloco de concreto 14x19x39 - João Silva - Faltam 100 de 200
                                                     (sem indicador)
```

---

## Queries Úteis

### Ver status atual da OP #21
```sql
SELECT
  order_number,
  status,
  total_quantity,
  produced_quantity,
  remaining_quantity,
  ROUND((produced_quantity::numeric / total_quantity::numeric * 100), 2) as percentual
FROM production_orders
WHERE order_number = 21;
```

### Ver histórico de produções da OP #21
```sql
SELECT
  p.quantity,
  p.production_date,
  p.created_at,
  p.notes
FROM production p
WHERE p.production_order_id = (
  SELECT id FROM production_orders WHERE order_number = 21
)
ORDER BY p.created_at DESC;
```

### Ver todas as OPs legadas abertas
```sql
SELECT
  po.order_number,
  p.name as produto,
  po.remaining_quantity
FROM production_orders po
LEFT JOIN products p ON p.id = po.product_id
WHERE po.product_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM production_order_items poi
  WHERE poi.production_order_id = po.id
)
AND po.status IN ('open', 'in_progress')
ORDER BY po.order_number DESC;
```

---

## Resumo Final

**Antes da correção:**
- ❌ OP #21 não aparecia na lista
- ❌ Impossível vincular produção à OP #21
- ❌ Sistema ignorava ordens legadas

**Depois da correção:**
- ✅ OP #21 aparece na lista
- ✅ Possível vincular produção à OP #21
- ✅ Sistema suporta ordens legadas E novas
- ✅ Progresso atualiza corretamente
- ✅ Logs detalhados para diagnóstico

**Status:** Pronto para uso!
