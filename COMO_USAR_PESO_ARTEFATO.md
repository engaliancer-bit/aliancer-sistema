# Como Usar o Campo peso_artefato

## Acesso Rápido

1. Vá em **Fábrica > Cadastro > Produtos**
2. Clique em **Editar** em um produto tipo "Artefato" (ex: "Bloco Canaleta 14")
3. Selecione um **Traço de Concreto**
4. Aparecerá a seção "Cálculo de Consumo de Insumos para Artefatos"
5. Informe o **Peso Unitário do Produto (kg)**

## Exemplo Prático

### Bloco Canaleta 14
**Peso**: 14,567 kg

Digite no campo: `14.567`

O sistema calculará automaticamente:
- Consumo de cada insumo (cimento, areia, etc.)
- Custo de cada material
- Custo total de materiais

## O que Mudou

### Antes
- Campo usava `total_weight` (genérico)
- Precisão de 2 casas decimais

### Agora
- Campo específico `peso_artefato`
- Precisão de 3 casas decimais (mais exato)
- Nome mais claro e descritivo

## Validação

Após salvar, verifique no banco:

```sql
SELECT name, peso_artefato, material_cost
FROM products
WHERE name = 'Bloco Canaleta 14';
```

Deve retornar:
```
name                | peso_artefato | material_cost
--------------------+--------------+--------------
Bloco Canaleta 14   | 14.567       | 1.83
```

## Dica

Pesos com alta precisão (3 decimais) resultam em cálculos de custo mais exatos.

Exemplo:
- `14.5` → Menos preciso
- `14.567` → Mais preciso ✓

