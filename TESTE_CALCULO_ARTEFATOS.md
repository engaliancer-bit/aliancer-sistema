# Como Testar o Cálculo de Artefatos

## Verificação Rápida no Banco de Dados

Execute esta query para verificar produtos do tipo artefato:

```sql
-- Ver produtos do tipo artefato e seus traços
SELECT
  p.id,
  p.name AS produto,
  p.code AS codigo,
  p.product_type AS tipo,
  p.total_weight AS peso_cadastrado,
  p.recipe_id,
  r.name AS traco,
  p.material_cost AS custo_material
FROM products p
LEFT JOIN recipes r ON r.id = p.recipe_id
WHERE p.product_type = 'artifact'
ORDER BY p.name;
```

## Verificar Materiais de um Traço Específico

```sql
-- Ver composição do traço TCS AL001 (substitua o nome)
SELECT
  r.name AS traco,
  m.name AS material,
  rm.quantity AS quantidade,
  m.unit AS unidade,
  m.unit_cost AS custo_unitario
FROM recipes r
JOIN recipe_materials rm ON rm.recipe_id = r.id
JOIN materials m ON m.id = rm.material_id
WHERE r.name ILIKE '%TCS AL001%'
ORDER BY rm.quantity DESC;
```

## Calcular Manualmente para Validação

Use esta query para calcular o consumo proporcional manualmente:

```sql
-- Cálculo manual de consumo (exemplo: produto de 100kg)
WITH traco_info AS (
  SELECT
    r.id AS recipe_id,
    r.name AS traco,
    SUM(rm.quantity) AS peso_total_traco
  FROM recipes r
  JOIN recipe_materials rm ON rm.recipe_id = r.id
  WHERE r.name ILIKE '%TCS AL001%'  -- Substitua pelo nome do traço
  GROUP BY r.id, r.name
),
produto_info AS (
  SELECT 100.0 AS peso_produto  -- Substitua pelo peso do produto
)
SELECT
  m.name AS material,
  rm.quantity AS quantidade_traco,
  m.unit AS unidade,

  -- Calcular multiplicador e consumo
  (SELECT peso_produto FROM produto_info) / ti.peso_total_traco AS multiplicador,
  rm.quantity * ((SELECT peso_produto FROM produto_info) / ti.peso_total_traco) AS consumo_produto,

  -- Calcular custos
  m.unit_cost AS custo_unitario,
  (rm.quantity * ((SELECT peso_produto FROM produto_info) / ti.peso_total_traco)) * m.unit_cost AS custo_total
FROM traco_info ti
JOIN recipe_materials rm ON rm.recipe_id = ti.recipe_id
JOIN materials m ON m.id = rm.material_id
ORDER BY rm.quantity DESC;
```

## Verificar se Produto tem Cimento no Traço

```sql
-- Verificar se o traço tem cimento
SELECT
  p.name AS produto,
  r.name AS traco,
  m.name AS material,
  rm.quantity AS quantidade,
  CASE
    WHEN m.name ILIKE '%cimento%' THEN '✓ CIMENTO ENCONTRADO'
    ELSE 'Outro material'
  END AS identificacao
FROM products p
JOIN recipes r ON r.id = p.recipe_id
JOIN recipe_materials rm ON rm.recipe_id = r.id
JOIN materials m ON m.id = rm.material_id
WHERE p.name ILIKE '%Bloco Canaleta%'  -- Substitua pelo nome do produto
ORDER BY rm.quantity DESC;
```

## Teste Passo a Passo na Interface

### 1. Verificar Produto Existente

1. Acesse **Fábrica > Cadastro > Produtos**
2. Procure por "Bloco Canaleta 14" ou qualquer produto tipo "Artefato"
3. Clique no botão **Editar** (ícone de lápis)

### 2. Verificar Tipo do Produto

Se o produto não for tipo "Artefato":
1. No campo **"Tipo de Produto"**, selecione **"Artefato"**
2. Salve o produto

### 3. Selecionar Traço

1. No campo **"Traço de Concreto"**, clique e selecione um traço
2. Exemplo: "TCS AL001"
3. Aguarde a seção **"Cálculo de Consumo de Insumos para Artefatos"** aparecer

### 4. Informar Peso

1. Na seção que apareceu, localize **"Peso Unitário do Produto (kg)"**
2. Digite o peso (exemplo: `100`)
3. Pressione Tab ou clique fora do campo

### 5. Verificar Cálculo

1. Role a página para baixo
2. Procure a seção **"Detalhamento do Custo de Materiais"**
3. Você deve ver:
   - Lista de todos os materiais
   - Consumo de cada material
   - Custo de cada material
   - Total de materiais

### 6. Validar Proporção

Para validar que a proporção está correta:
1. Some todos os consumos dos materiais
2. O resultado deve ser aproximadamente igual ao peso do produto
3. Exemplo: Se produto pesa 100 kg, a soma deve dar ~100 kg

## Exemplo de Validação

### Dados de Entrada
- Produto: Bloco Canaleta 14
- Peso: 100 kg
- Traço: TCS AL001

### Composição do Traço
| Material | Quantidade |
|----------|------------|
| Cimento | 1,00 kg |
| Areia Industrial | 5,56 kg |
| Areia Média | 4,44 kg |
| Pedrisco | 2,50 kg |
| Aditivo | 0,003 kg |
| **TOTAL** | **13,503 kg** |

### Cálculo Esperado
```
Multiplicador = 100 / 13,503 = 7,406

Consumos:
- Cimento: 1,00 × 7,406 = 7,41 kg
- Areia Industrial: 5,56 × 7,406 = 41,18 kg
- Areia Média: 4,44 × 7,406 = 32,88 kg
- Pedrisco: 2,50 × 7,406 = 18,52 kg
- Aditivo: 0,003 × 7,406 = 0,02 kg

Soma: 100,01 kg ✓
```

### Validação na Interface
Os valores mostrados na interface devem ser **exatamente iguais** aos calculados acima.

## Erros Comuns e Soluções

### Erro 1: Campo de Peso Não Aparece

**Causa**: Traço não selecionado ou produto não é tipo "Artefato"

**Solução**:
1. Verifique se o produto é tipo "Artefato"
2. Selecione um traço de concreto no campo "Traço de Concreto"
3. A seção deve aparecer automaticamente

### Erro 2: Alerta "Cimento não encontrado"

**Causa**: O traço não tem um material com "cimento" no nome

**Solução**:
1. Vá em **Cadastro > Traços de Concreto**
2. Edite o traço
3. Adicione um material que contenha "cimento" no nome
4. Exemplo: "Cimento CP-II", "Cimento Portland", etc.

### Erro 3: Custo Total Zerado

**Causa**: Os materiais do traço não têm custo unitário cadastrado

**Solução**:
1. Vá em **Cadastro > Materiais**
2. Para cada material do traço, edite e informe o **Custo Unitário**
3. Salve os materiais
4. Retorne ao produto e o custo será calculado automaticamente

### Erro 4: Valores Não Atualizam

**Causa**: Navegador pode ter cache da página antiga

**Solução**:
1. Pressione **Ctrl + Shift + R** (Windows/Linux)
2. Ou **Cmd + Shift + R** (Mac)
3. Isso força a atualização da página

## Checklist de Teste Completo

- [ ] 1. Produto é tipo "Artefato"
- [ ] 2. Traço de concreto selecionado
- [ ] 3. Traço contém material com "cimento" no nome
- [ ] 4. Todos os materiais do traço têm custo unitário
- [ ] 5. Campo de peso aparece após selecionar traço
- [ ] 6. Ao digitar peso, consumo é calculado
- [ ] 7. Seção "Detalhamento" mostra todos os materiais
- [ ] 8. Soma dos consumos = peso do produto
- [ ] 9. Custos são calculados corretamente
- [ ] 10. Ao salvar, dados persistem no banco

## Consulta para Ver Resultado Final

```sql
-- Ver produto com todos os cálculos
SELECT
  p.name AS produto,
  p.product_type AS tipo,
  p.total_weight AS peso_kg,
  r.name AS traco,
  p.material_cost AS custo_materiais,
  p.production_cost AS custo_producao,
  p.final_sale_price AS preco_venda
FROM products p
LEFT JOIN recipes r ON r.id = p.recipe_id
WHERE p.name ILIKE '%Bloco Canaleta%'
ORDER BY p.name;
```

## Status do Teste

Após seguir todos os passos acima, você deve ter:

✅ Campo de peso visível e funcional
✅ Cálculo proporcional correto
✅ Custos calculados automaticamente
✅ Dados salvos no banco de dados
✅ Sistema pronto para uso em produção
