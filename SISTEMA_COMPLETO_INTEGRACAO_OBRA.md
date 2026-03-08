# Sistema Completo de Integração Orçamento-Obra

## Visão Geral

Sistema completo que verifica **TODOS os items** (produtos E materiais) das composições, gerencia estoque, cria ordens de produção automáticas para produtos sem estoque, cria entregas automáticas para items com estoque e atualiza status conforme a produção é finalizada.

## Fluxo Completo do Sistema

```
ORÇAMENTO APROVADO
       ↓
[PROCESSAMENTO AUTOMÁTICO]
       ↓
    ┌──────────────────────────────┐
    │  VERIFICAR CADA ITEM DA      │
    │  COMPOSIÇÃO (PRODUTOS +      │
    │  MATERIAIS)                  │
    └──────────────────────────────┘
            ↓           ↓
       PRODUTO       MATERIAL
            ↓           ↓
    [VERIFICAR      [VERIFICAR
     ESTOQUE]        ESTOQUE]
            ↓           ↓
       ┌────┴────┐  ┌──┴───┐
       │         │  │      │
   TEM    NÃO TEM  TEM  NÃO TEM
  ESTOQUE ESTOQUE ESTOQUE ESTOQUE
       │         │  │      │
       ↓         ↓  ↓      ↓
   [CRIAR    [CRIAR [CRIAR [ALERTAR]
   ENTREGA]  ORDEM] ENTREGA]
   AUTOMÁTICA       AUTOMÁTICA
       │         │  │
       ↓         ↓  ↓
   [VINCULAR  [QUANDO [VINCULAR
    À OBRA]   PRODUÇÃO À OBRA]
              TERMINAR]
                 ↓
            [ATUALIZAR
              STATUS]
                 ↓
           [DISPONÍVEL
            P/ ENTREGA]
```

## Componentes do Sistema

### 1. Funções de Banco de Dados

#### `get_material_stock(material_id_param uuid)`
**Função:** Obtém o estoque atual de um material
**Retorno:** Quantidade em estoque (decimal)

```sql
SELECT COALESCE(stock_quantity, 0)
FROM materials
WHERE id = material_id_param;
```

#### `check_composition_full_stock(composition_id_param uuid, quantity_multiplier decimal)`
**Função:** Verifica estoque completo de TODOS os items (produtos + materiais) de uma composição
**Retorno:** Tabela com informações detalhadas de cada item

**Campos retornados:**
- `item_id` - ID do item na composição
- `item_type` - Tipo: 'product' ou 'material'
- `item_reference_id` - ID do produto ou material
- `item_name` - Nome do item
- `quantity_required` - Quantidade necessária
- `quantity_in_stock` - Quantidade em estoque
- `quantity_to_produce` - Quantidade que precisa produzir/comprar
- `has_sufficient_stock` - true/false se tem estoque suficiente
- `unit` - Unidade de medida

**Exemplo de uso:**
```sql
SELECT * FROM check_composition_full_stock(
  'uuid-da-composicao',
  10 -- multiplicador de quantidade
);
```

**Retorno exemplo:**
```
item_type | item_name        | quantity_required | quantity_in_stock | quantity_to_produce | has_sufficient_stock
----------|------------------|-------------------|-------------------|---------------------|---------------------
product   | Vigota 3m        | 20                | 5                 | 15                  | false
product   | Tavela           | 30                | 50                | 0                   | true
material  | Arame Recozido   | 2.5               | 10                | 0                   | true
material  | Cimento CP-II    | 5                 | 2                 | 3                   | false
```

### 2. Função Principal: `process_quote_approval_for_construction`

**Responsável por:**
1. ✅ Verificar todos os items (produtos + materiais) da composição
2. ✅ Criar registro de cada item vinculado à obra
3. ✅ Criar **ordens de produção** para produtos sem estoque
4. ✅ Criar **entregas automáticas** para items com estoque
5. ✅ Definir status adequado para cada item
6. ✅ Vincular ordens e entregas aos items

**Parâmetros:**
- `quote_id_param` - UUID do orçamento
- `quote_type_param` - 'quote' ou 'ribbed_slab'
- `construction_project_id_param` - UUID da obra

**Retorno:**
```json
{
  "success": true,
  "total_composition_items": 5,
  "construction_items_created": 15,
  "production_orders_created": 3,
  "deliveries_created": 1,
  "message": "5 composicoes | 15 items | 3 ordens de producao | 1 entregas"
}
```

### 3. Triggers Automáticos

#### Trigger: `trigger_update_construction_items_on_production_completion`
**Quando:** Ordem de produção é marcada como "completed"
**Ação:** Atualiza todos os items da obra vinculados à ordem para status "available_for_delivery"

**Exemplo:**
```
Ordem OP-123 → Status: completed
    ↓
Items vinculados:
  - Item A: "in_production" → "available_for_delivery"
  - Item B: "in_production" → "available_for_delivery"
```

#### Trigger: `trigger_update_construction_items_on_delivery`
**Quando:** Entrega é marcada como "completed"
**Ação:** Atualiza todos os items da obra vinculados à entrega para status "delivered"

**Exemplo:**
```
Entrega ENT-45 → Status: completed
    ↓
Items vinculados:
  - Item C: "available_for_delivery" → "delivered"
  - Item D: "available_for_delivery" → "delivered"
```

## Estrutura de Dados

### Tabela: `construction_quote_items`

**Novos campos adicionados:**
- `material_id` - UUID do material (nullable)
- `item_type` - 'product' ou 'material'
- `unit` - Unidade de medida do item

**Campos existentes:**
- `id` - UUID único
- `construction_project_id` - Obra vinculada
- `quote_id` - Orçamento origem
- `quote_type` - Tipo do orçamento
- `composition_id` - Composição origem
- `product_id` - Produto (nullable)
- `quantity_required` - Quantidade necessária
- `quantity_in_stock` - Quantidade em estoque
- `quantity_to_produce` - Quantidade a produzir/comprar
- `status` - Status atual do item
- `production_order_id` - Ordem de produção vinculada (nullable)
- `delivery_id` - Entrega vinculada (nullable)
- `notes` - Observações

### Status dos Items

| Status | Significado | Quando Ocorre |
|--------|-------------|---------------|
| **in_production** | Item sem estoque, aguardando produção | Produto sem estoque, ordem criada |
| **partially_available** | Estoque parcial disponível | Tem estoque mas não suficiente |
| **available_for_delivery** | Pronto para entregar | Estoque completo OU produção finalizada |
| **delivered** | Item já foi entregue | Entrega concluída |

## Como Usar o Sistema

### Passo 1: Preparação

**Antes de vincular um orçamento:**

1. ✅ Certifique-se que o orçamento está aprovado
2. ✅ Verifique que os items do orçamento têm composições vinculadas
3. ✅ Confirme que as composições têm **produtos E materiais** cadastrados
4. ✅ Verifique que a obra existe e tem cliente vinculado

### Passo 2: Vincular Orçamento

**Interface Web:**

1. Acesse **Construtora → Acompanhamento**
2. Selecione a obra
3. Na seção "Vincular Orçamento à Obra":
   - Selecione o tipo (Padrão ou Laje Treliçada)
   - Cole o ID do orçamento (UUID completo)
   - Clique em "Vincular e Processar"

**O sistema irá automaticamente:**

✅ Verificar **TODOS** os items (produtos + materiais) da composição
✅ Calcular estoque necessário vs disponível
✅ Criar ordens de produção para produtos sem estoque
✅ Criar entrega automática para items com estoque
✅ Registrar todos os items na obra
✅ Mostrar resultado detalhado

### Passo 3: Acompanhar Produção

**Quando houver ordens criadas:**

1. Acesse **Produção → Ordens de Produção**
2. Filtre por status "Aberta"
3. Ordens para obras terão nota: "Ordem para obra: [Nome da Obra]"
4. Registre a produção normalmente
5. **Ao marcar a ordem como "Concluída":**
   - ✅ Sistema atualiza automaticamente os items da obra
   - ✅ Status muda para "Disponível para Entrega"

### Passo 4: Verificar Entregas Automáticas

**Items com estoque geram entrega automática:**

1. Acesse **Vendas → Entregas**
2. Busque por entregas com status "Aberta"
3. Entregas automáticas terão:
   - Número: ENT-XXX
   - Nota: "Entrega automática - Obra: [Nome]"
   - Items com estoque disponível já vinculados
4. **Ao marcar a entrega como "Concluída":**
   - ✅ Sistema atualiza automaticamente os items
   - ✅ Status muda para "Entregue"

### Passo 5: Atualizar Status

**Na tela de Acompanhamento da Obra:**

1. Clique no botão "Atualizar Status"
2. Sistema verifica estoque atual de todos os items
3. Atualiza quantidades e status automaticamente
4. Mostra items que ficaram prontos para entrega

## Exemplos Práticos

### Exemplo 1: Orçamento com Produtos e Materiais

**Cenário:**
- Obra: Casa do João
- Orçamento: 3 vigotas de 3m
- Composição: 1 vigota = 1 produto + materiais

**Composição da Vigota:**
- 1x Vigota 3m (PRODUTO)
- 2kg Arame Recozido (MATERIAL)
- 0.5kg Espaçador (MATERIAL)

**Estoque Atual:**
- Vigotas 3m: 0 unidades
- Arame: 10kg
- Espaçador: 2kg

**Resultado do Processamento:**

```
✅ Item 1: Vigota 3m (PRODUTO)
   Necessário: 3 un | Estoque: 0 un | A Produzir: 3 un
   Status: IN_PRODUCTION
   Ação: Ordem OP-123 criada

✅ Item 2: Arame Recozido (MATERIAL)
   Necessário: 6kg | Estoque: 10kg | Faltante: 0kg
   Status: AVAILABLE_FOR_DELIVERY
   Ação: Incluído na entrega ENT-45

✅ Item 3: Espaçador (MATERIAL)
   Necessário: 1.5kg | Estoque: 2kg | Faltante: 0kg
   Status: AVAILABLE_FOR_DELIVERY
   Ação: Incluído na entrega ENT-45

📦 RESUMO:
- 3 items registrados
- 1 ordem de produção criada (OP-123)
- 1 entrega automática criada (ENT-45) com 2 items
```

### Exemplo 2: Produção Finalizada

**Cenário Inicial:**
- Ordem OP-123: 3 Vigotas 3m → Status: "open"
- Item da obra: Status "in_production"

**Ação do Usuário:**
- Registra produção de 3 vigotas
- Marca ordem OP-123 como "completed"

**Resultado Automático:**
```
🎉 TRIGGER ACIONADO!

Ordem OP-123 → Status: completed
    ↓
Atualizando items da obra...
    ↓
✅ Item "Vigota 3m"
   Status: "in_production" → "available_for_delivery"
   Nota atualizada: "Producao concluida - Ordem OP-123"
```

**Na Interface:**
- Badge do item muda de amarelo para verde
- Aparece mensagem "Pronto para entrega"
- Usuário pode criar nova entrega ou adicionar à existente

### Exemplo 3: Estoque Parcial

**Cenário:**
- Necessário: 10 Tavelas
- Estoque: 4 Tavelas

**Resultado:**
```
✅ Item: Tavela (PRODUTO)
   Necessário: 10 un | Estoque: 4 un | A Produzir: 6 un
   Status: PARTIALLY_AVAILABLE
   Ações:
   - Ordem OP-124 criada (6 unidades)
   - Entrega ENT-46 criada (4 unidades)
```

**Fluxo:**
1. 4 tavelas vão direto para entrega
2. 6 tavelas entram em produção
3. Quando produção terminar:
   - Sistema atualiza item para "available_for_delivery"
   - 6 tavelas ficam disponíveis para nova entrega

## Interface do Usuário

### Tela: Acompanhamento da Obra

**Seção 1: Vincular Orçamento**
- Dropdown tipo de orçamento
- Campo para ID do orçamento
- Botão "Vincular e Processar"
- Botão "Debug" para diagnóstico

**Seção 2: Items Vinculados**

Para cada item, mostra:

**Badge de Tipo:**
- 🔵 PRODUTO (azul)
- 🟢 MATERIAL (verde)

**Badge de Status:**
- 🔴 Em Produção
- 🟡 Parcialmente Disponível
- 🟢 Disponível para Entrega
- ⚪ Entregue

**Informações:**
- Nome do item
- Código (se produto)
- Necessário: X unidades
- Em Estoque: Y unidades
- A Produzir/Faltante: Z unidades

**Vínculos:**
- 🏭 Ordem de Produção: OP-XXX (se houver)
- 🚚 Entrega: ENT-XXX (se houver)

**Ações:**
- 🔄 Atualizar Status (botão)

## Debug e Diagnóstico

### Ferramenta de Debug

**Como usar:**
1. Clique no botão "Debug" (roxo)
2. Preencha os campos
3. Clique em "Executar Debug Completo"

**O que o Debug mostra:**

✅ **Passo 1:** Verifica se orçamento existe
✅ **Passo 2:** Lista todos os items do orçamento
✅ **Passo 3:** Verifica quais items têm composição
✅ **Passo 4:** Para cada composição:
   - Mostra produtos e materiais cadastrados
   - Calcula estoque necessário
✅ **Passo 5:** Para cada item:
   - Mostra tipo (produto/material)
   - Mostra estoque atual vs necessário
   - Indica se precisa produzir/comprar
✅ **Passo 6:** Verifica se obra existe
✅ **Passo 7:** Executa processamento
✅ **Passo 8:** Mostra resultado final

### Queries Úteis

#### Ver todos os items de uma obra
```sql
SELECT
  cqi.item_type,
  COALESCE(p.name, m.name) as item_name,
  cqi.quantity_required,
  cqi.quantity_in_stock,
  cqi.quantity_to_produce,
  cqi.unit,
  cqi.status,
  po.order_number,
  d.delivery_number
FROM construction_quote_items cqi
LEFT JOIN products p ON p.id = cqi.product_id
LEFT JOIN materials m ON m.id = cqi.material_id
LEFT JOIN production_orders po ON po.id = cqi.production_order_id
LEFT JOIN deliveries d ON d.id = cqi.delivery_id
WHERE cqi.construction_project_id = 'UUID_DA_OBRA'
ORDER BY cqi.created_at DESC;
```

#### Ver ordens de produção criadas para obra
```sql
SELECT
  po.order_number,
  po.status,
  p.name as product_name,
  po.quantity,
  po.notes,
  po.created_at
FROM production_orders po
JOIN products p ON p.id = po.product_id
WHERE po.notes LIKE '%Ordem para obra%'
ORDER BY po.created_at DESC;
```

#### Ver entregas automáticas criadas
```sql
SELECT
  d.delivery_number,
  d.status,
  c.name as customer_name,
  cp.name as project_name,
  COUNT(di.id) as total_items,
  d.notes
FROM deliveries d
JOIN customers c ON c.id = d.customer_id
LEFT JOIN construction_projects cp ON cp.id = d.construction_project_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
WHERE d.notes LIKE '%Entrega automática%'
GROUP BY d.id, d.delivery_number, d.status, c.name, cp.name, d.notes
ORDER BY d.created_at DESC;
```

## Perguntas Frequentes (FAQ)

### 1. O que acontece se a composição só tem materiais, sem produtos?

**Resposta:** O sistema processa normalmente!
- ✅ Verifica estoque de cada material
- ✅ Materiais com estoque → Entrega automática
- ✅ Materiais sem estoque → Fica marcado como "faltante"
- ⚠️ **Não cria ordem de produção** (materiais são comprados, não produzidos)

### 2. Posso vincular o mesmo orçamento a várias obras?

**Resposta:** Sim! Cada obra terá seus próprios items registrados e ordens de produção independentes.

### 3. E se eu atualizar o estoque manualmente?

**Resposta:** Use o botão "Atualizar Status" na tela da obra. O sistema vai:
- ✅ Verificar estoque atual de cada item
- ✅ Atualizar quantidades
- ✅ Atualizar status se necessário

### 4. Posso cancelar uma ordem de produção?

**Resposta:** Sim, mas:
- ⚠️ Item da obra continuará com status "in_production"
- ⚠️ Você precisará criar nova ordem ou marcar manualmente como disponível

### 5. Como sei quais items precisam ser comprados?

**Resposta:**
- Items tipo MATERIAL sem estoque ficam com status "faltante"
- Não geram ordem de produção
- Aparecem na lista com badge verde (material) e status amarelo

### 6. Posso editar uma entrega automática antes de concluir?

**Resposta:** Sim!
- ✅ Pode adicionar mais items
- ✅ Pode alterar quantidades
- ✅ Pode alterar data de entrega
- ✅ Quando marcar como "completed", items da obra serão atualizados

### 7. E se eu tiver estoque parcial de vários items?

**Resposta:** Sistema otimiza automaticamente:
- ✅ Uma única entrega com todos os items disponíveis
- ✅ Ordens de produção separadas para cada produto faltante
- ✅ Conforme produção termina, pode criar nova entrega com items prontos

### 8. Como desfazer uma vinculação?

**Resposta:**
1. Marque entregas como "cancelled"
2. Marque ordens como "cancelled"
3. Delete os registros de `construction_quote_items` se necessário

**Atenção:** Não há "desfazer" automático por segurança dos dados!

## Monitoramento e Logs

O sistema gera logs detalhados no processamento:

```
Iniciando processamento do orcamento para obra
Processando composicao com quantidade: 10
Item tipo: product nome: Vigota 3m
Necessario: 10 Estoque: 0
Criando ordem de producao: OP-123
Item tipo: material nome: Arame Recozido
Necessario: 20 Estoque: 50
Criando entrega automatica para items com estoque
Entrega criada: ENT-45
Processamento concluido: 1 composicoes, 2 items, 1 ordens, 1 entregas
```

## Benefícios do Sistema

✅ **Automação Total:** Cria ordens e entregas automaticamente
✅ **Visibilidade:** Mostra status de cada item em tempo real
✅ **Integração:** Liga orçamento → produção → entrega
✅ **Rastreabilidade:** Cada item tem histórico completo
✅ **Flexibilidade:** Funciona com produtos E materiais
✅ **Inteligência:** Detecta estoque parcial e otimiza
✅ **Atualização:** Triggers mantêm status sempre atual
✅ **Debug:** Ferramenta completa de diagnóstico

## Próximas Melhorias Sugeridas

1. **Notificações:**
   - Email quando produção ficar pronta
   - WhatsApp quando entrega for concluída

2. **Dashboard:**
   - Visão geral de todas as obras
   - Items pendentes de produção
   - Items prontos para entrega

3. **Relatórios:**
   - Tempo médio de produção por obra
   - Taxa de estoque vs produção
   - Eficiência de entrega

4. **Mobile:**
   - App para motoristas registrarem entregas
   - App para produção registrar conclusão

---

**Sistema implementado e testado com sucesso!** 🎉

Agora você tem um sistema completo de gestão de obras integrado com produção e entregas.
