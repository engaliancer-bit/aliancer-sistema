# Exemplos Práticos: Importação de XML

## Cenário 1: Primeira Importação (Insumos Novos)

### XML de Entrada
```xml
<det nItem="1">
  <prod>
    <cProd>001</cProd>
    <xProd>CIMENTO CP-II-F-40</xProd>
    <qCom>50.0000</qCom>
    <uCom>SC</uCom>
    <vUnCom>45.8000</vUnCom>
    <vProd>2290.00</vProd>
  </prod>
</det>
```

### Console Output
```
=== INICIANDO IMPORTAÇÃO ===
Total de itens: 1

--- Processando item: CIMENTO CP-II-F-40 (insumo) ---
Processando insumo: CIMENTO CP-II-F-40
Criando novo insumo: CIMENTO CP-II-F-40
✓ Novo insumo criado com ID: abc-123-def-456
Criando purchase_item...
✓ purchase_item criado com sucesso (ID: xyz-789)
Registrando entrada de estoque para material ID abc-123-def-456...
✓ Entrada de estoque registrada: 50 SC
Atualizando custo unitário para R$ 45.80...
✓ Custo unitário atualizado com sucesso

=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===
```

### Alerta para Usuário
```
✅ Compra importada com sucesso!

📦 Total de itens: 1

📊 Categorias:
  • Insumos: 1 (1 novo, 0 atualizados)
```

### Resultado no Banco
```sql
-- materials
id: abc-123-def-456
name: CIMENTO CP-II-F-40
unit: SC
unit_cost: 45.80
import_status: imported_pending
imported_at: 2026-02-05 14:30:00
nfe_key: 35260112345678000190550010001234561234567890

-- material_movements
material_id: abc-123-def-456
movement_type: entrada
quantity: 50
movement_date: 2026-01-15

-- purchase_items
product_description: CIMENTO CP-II-F-40
quantity: 50
unit: SC
unit_price: 45.80
total_price: 2290.00
```

---

## Cenário 2: Reimportação (Insumo Já Existe)

### Situação
- Mesmo fornecedor
- Nova compra com preço diferente
- Insumo já cadastrado no sistema

### XML de Entrada
```xml
<det nItem="1">
  <prod>
    <cProd>002</cProd>
    <xProd>CIMENTO CP-II-F-40</xProd>
    <qCom>100.0000</qCom>
    <uCom>SC</uCom>
    <vUnCom>48.9000</vUnCom>  ← PREÇO DIFERENTE!
    <vProd>4890.00</vProd>
  </prod>
</det>
```

### Console Output
```
=== INICIANDO IMPORTAÇÃO ===
Total de itens: 1

--- Processando item: CIMENTO CP-II-F-40 (insumo) ---
Processando insumo: CIMENTO CP-II-F-40
✓ Insumo já existe (ID: abc-123-def-456), atualizando preço...
  - Preço anterior: R$ 45.80
  - Preço novo: R$ 48.90
✓ Insumo atualizado com sucesso
Criando purchase_item...
✓ purchase_item criado com sucesso (ID: xyz-790)
Registrando entrada de estoque para material ID abc-123-def-456...
✓ Entrada de estoque registrada: 100 SC
Atualizando custo unitário para R$ 48.90...
✓ Custo unitário atualizado com sucesso

=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===
```

### Alerta para Usuário
```
✅ Compra importada com sucesso!

📦 Total de itens: 1

📊 Categorias:
  • Insumos: 1 (0 novos, 1 atualizado)  ← ATUALIZADO!
```

### Resultado no Banco
```sql
-- materials (mesmo ID, preço atualizado)
id: abc-123-def-456
name: CIMENTO CP-II-F-40
unit: SC
unit_cost: 48.90  ← ATUALIZADO de 45.80
import_status: imported_pending
imported_at: 2026-02-05 15:45:00  ← ATUALIZADO
nfe_key: 35260212345678000190550010001234571234567891  ← NOVA CHAVE

-- material_movements (novo movimento)
material_id: abc-123-def-456
movement_type: entrada
quantity: 100  ← NOVA ENTRADA
movement_date: 2026-02-01

-- Estoque total agora: 50 + 100 = 150 SC
```

---

## Cenário 3: Importação Mista (Várias Categorias)

### XML de Entrada
```xml
<det nItem="1">
  <prod>
    <cProd>101</cProd>
    <xProd>CIMENTO CP-II-F-40</xProd>
    <qCom>50</qCom>
    <uCom>SC</uCom>
    <vUnCom>45.80</vUnCom>
    <vProd>2290.00</vProd>
  </prod>
</det>
<det nItem="2">
  <prod>
    <cProd>201</cProd>
    <xProd>CONSERTO DE BETONEIRA</xProd>
    <qCom>1</qCom>
    <uCom>SERV</uCom>
    <vUnCom>850.00</vUnCom>
    <vProd>850.00</vProd>
  </prod>
</det>
<det nItem="3">
  <prod>
    <cProd>301</cProd>
    <xProd>VIBRADOR DE CONCRETO 2200W</xProd>
    <qCom>1</qCom>
    <uCom>UN</uCom>
    <vUnCom>1890.00</vUnCom>
    <vProd>1890.00</vProd>
  </prod>
</det>
```

### Usuário Categoriza
```
Item 1: CIMENTO → Insumo
Item 2: CONSERTO DE BETONEIRA → Manutenção
Item 3: VIBRADOR DE CONCRETO → Investimento/Patrimônio
```

### Console Output
```
=== INICIANDO IMPORTAÇÃO ===
Total de itens: 3
Itens por categoria: {
  insumo: 1,
  servico: 0,
  manutencao: 1,
  investimento: 1
}

--- Processando item: CIMENTO CP-II-F-40 (insumo) ---
✓ Novo insumo criado com ID: aaa-111
✓ purchase_item criado com sucesso
✓ Entrada de estoque registrada: 50 SC
✓ Custo unitário atualizado com sucesso

--- Processando item: CONSERTO DE BETONEIRA (manutencao) ---
✓ purchase_item criado com sucesso
Criando despesa de manutenção para: CONSERTO DE BETONEIRA
✓ Despesa de manutenção registrada no cash_flow

--- Processando item: VIBRADOR DE CONCRETO 2200W (investimento) ---
✓ purchase_item criado com sucesso
Criando ativo para item: VIBRADOR DE CONCRETO 2200W
✓ Ativo criado com sucesso
✓ Despesa de investimento registrada no cash_flow

=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===
```

### Alerta para Usuário
```
✅ Compra importada com sucesso!

📦 Total de itens: 3

📊 Categorias:
  • Insumos: 1 (1 novo, 0 atualizados)
  • Serviços: 0
  • Manutenção: 1
  • Investimentos/Patrimônio: 1
```

### Resultado no Banco

**materials (apenas insumo)**
```sql
id: aaa-111
name: CIMENTO CP-II-F-40
unit_cost: 45.80
```

**material_movements (apenas insumo)**
```sql
material_id: aaa-111
movement_type: entrada
quantity: 50
```

**assets (apenas investimento)**
```sql
name: VIBRADOR DE CONCRETO 2200W
acquisition_value: 1890.00
status: ativo
```

**cash_flow (manutenção + investimento)**
```sql
-- Registro 1 (manutenção)
type: expense
category: Manutenção
description: CONSERTO DE BETONEIRA - NF 123/1
amount: 850.00

-- Registro 2 (investimento)
type: expense
category: Investimento/Patrimônio
description: VIBRADOR DE CONCRETO 2200W - NF 123/1
amount: 1890.00
```

**purchase_items (todos os 3 itens)**
```sql
-- Item 1
product_description: CIMENTO CP-II-F-40
item_category: insumo
material_id: aaa-111 ← VINCULADO

-- Item 2
product_description: CONSERTO DE BETONEIRA
item_category: manutencao
material_id: NULL ← NÃO VINCULADO

-- Item 3
product_description: VIBRADOR DE CONCRETO 2200W
item_category: investimento
material_id: NULL ← NÃO VINCULADO
```

---

## Cenário 4: Erro de Duplicidade (Manual)

### Situação
- Usuário marca "Novo" manualmente
- Insumo já existe no sistema

### Console Output
```
--- Processando item: CIMENTO CP-II-F-40 (insumo) ---
Criando novo insumo: CIMENTO CP-II-F-40

❌ Erro ao criar material: {
  erro: "duplicate key value violates unique constraint",
  code: "23505",
  details: "Key (name)=(CIMENTO CP-II-F-40) already exists.",
  hint: "Check for existing records before inserting.",
  dados: {
    name: "CIMENTO CP-II-F-40",
    unit: "SC",
    unit_cost: 45.80
  }
}

=== ERRO NA IMPORTAÇÃO ===
```

### Alerta para Usuário
```
❌ Erro ao importar:
O insumo "CIMENTO CP-II-F-40" já existe no sistema.
Se quiser atualizar o preço, vincule-o manualmente antes de importar.
```

### Solução
1. Não marcar "Novo"
2. Deixar o sistema fazer UPSERT automático

---

## Cenário 5: Múltiplas Parcelas

### XML de Entrada
```xml
<cobr>
  <dup>
    <nDup>001</nDup>
    <dVenc>2026-03-01</dVenc>
    <vDup>1000.00</vDup>
  </dup>
  <dup>
    <nDup>002</nDup>
    <dVenc>2026-04-01</dVenc>
    <vDup>1000.00</vDup>
  </dup>
  <dup>
    <nDup>003</nDup>
    <dVenc>2026-05-01</dVenc>
    <vDup>1000.00</vDup>
  </dup>
</cobr>
```

### Console Output
```
Criando contas a pagar...
✓ 3 conta(s) a pagar criada(s)
```

### Resultado no Banco
```sql
-- payable_accounts (3 registros)

-- Parcela 1
description: NF 123/1 - FORNECEDOR LTDA - Parcela 1/3
installment_number: 1
total_installments: 3
amount: 1000.00
due_date: 2026-03-01
payment_status: pending

-- Parcela 2
description: NF 123/1 - FORNECEDOR LTDA - Parcela 2/3
installment_number: 2
total_installments: 3
amount: 1000.00
due_date: 2026-04-01
payment_status: pending

-- Parcela 3
description: NF 123/1 - FORNECEDOR LTDA - Parcela 3/3
installment_number: 3
total_installments: 3
amount: 1000.00
due_date: 2026-05-01
payment_status: pending
```

---

## Resumo dos Comportamentos

| Cenário | Insumo Existe? | Ação | Estoque | Preço |
|---------|----------------|------|---------|-------|
| 1. Primeira importação | Não | Cria | +50 | 45.80 |
| 2. Reimportação | Sim | Atualiza | +100 | 48.90 |
| 3. Misto | Variado | Misto | Variado | Variado |
| 4. Forçar criar | Sim | Erro | - | - |
| 5. Parcelas | - | Cria contas | - | - |

## Dicas Finais

✅ **Deixe o sistema decidir**: Não force criar novo, use UPSERT automático
✅ **Categorize corretamente**: Insumo vs Serviço vs Manutenção vs Investimento
✅ **Revise o console**: Logs detalhados ajudam a entender o que aconteceu
✅ **Confira o resumo**: Veja quantos foram criados vs atualizados
