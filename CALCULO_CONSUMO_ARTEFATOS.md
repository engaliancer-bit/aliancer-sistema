# Cálculo de Consumo de Insumos para Artefatos

## Resumo da Implementação

Foi implementado um sistema de cálculo automático de consumo de insumos para produtos do tipo **Artefatos** baseado no peso unitário do produto e na **proporção dos materiais no traço de concreto**.

## Como Funciona

### 1. Requisitos
Para que o cálculo funcione, você precisa:
- Cadastrar um produto do tipo **"Artefato"**
- Selecionar um **traço de concreto** que tenha:
  - Materiais cadastrados (cimento, areia, brita, etc.)
  - **Cimento** cadastrado no traço (obrigatório)
- Informar o **peso unitário** do produto em kg

### 2. Processo de Cálculo

O sistema mantém **exatamente a mesma proporção** do traço original:

```
Peso Total do Traço = Soma de todos os materiais do traço (em kg)
Multiplicador = Peso do Produto ÷ Peso Total do Traço

Para cada material:
  Consumo = Quantidade no Traço × Multiplicador
  Custo = Consumo × Custo Unitário do Material
```

**Exemplo Conceitual:**
- Se o traço tem: 1kg cimento + 5,56kg areia + 4,44kg areia média + 2,5kg pedrisco = 13,5kg total
- E o produto pesa: 100kg
- Então: Multiplica cada material por (100 ÷ 13,5) = 7,4 vezes
- Resultado: 7,4kg cimento, 41,1kg areia, 32,9kg areia média, 18,5kg pedrisco = 100kg total

### 3. Como Usar

#### Passo 1: Editar Produto Artefato
1. Acesse **Cadastro de Produtos**
2. Clique em **Editar** no produto tipo "Artefato" (ex: "Bloco Canaleta 14")

#### Passo 2: Selecionar Traço
1. No campo **"Traço de Concreto"**, selecione o traço desejado (ex: "TCS AL001")
2. Uma nova seção aparecerá: **"Cálculo de Consumo de Insumos para Artefatos"**

#### Passo 3: Informar Peso
1. Informe o **Peso Unitário do Produto (kg)**
   - Exemplo: Para um bloco que pesa 14,5 kg, informe `14.5`
   - Exemplo: Para uma peça de 100 kg, informe `100`
2. O sistema mostrará a **Proporção de Cimento no Traço** automaticamente

#### Passo 4: Visualizar Consumo Calculado
1. Após informar o peso, o sistema calcula automaticamente
2. Role até a seção **"Detalhamento do Custo de Materiais"**
3. Você verá:
   - Consumo proporcional de cada insumo (kg ou unidade)
   - Custo unitário de cada insumo
   - Custo total de cada insumo
   - **Custo total de materiais** calculado

## Exemplo Prático Real - Traço TCS AL001

### Cenário
- **Produto**: Bloco Canaleta 14
- **Tipo**: Artefato
- **Peso**: 100 kg
- **Traço**: TCS AL001
  - Cimento: 1,00 kg (R$ 0,60/kg)
  - Areia Industrial: 5,56 kg (R$ 0,08/kg)
  - Areia Média: 4,44 kg (R$ 0,07/kg)
  - Pedrisco: 2,50 kg (R$ 0,12/kg)
  - Aditivo CQ Plast PM 9000: 0,003 kg (R$ 15,00/kg)
  - **Total do Traço**: 13,503 kg

### Cálculo Automático
```
Multiplicador = 100 kg ÷ 13,503 kg = 7,406

Consumo de Cimento = 1,00 kg × 7,406 = 7,41 kg
  Custo = 7,41 × 0,60 = R$ 4,44

Consumo de Areia Industrial = 5,56 kg × 7,406 = 41,18 kg
  Custo = 41,18 × 0,08 = R$ 3,29

Consumo de Areia Média = 4,44 kg × 7,406 = 32,88 kg
  Custo = 32,88 × 0,07 = R$ 2,30

Consumo de Pedrisco = 2,50 kg × 7,406 = 18,52 kg
  Custo = 18,52 × 0,12 = R$ 2,22

Consumo de Aditivo = 0,003 kg × 7,406 = 0,022 kg
  Custo = 0,022 × 15,00 = R$ 0,33

CUSTO TOTAL DE MATERIAIS = R$ 12,58
```

### Verificação da Proporção
```
Soma dos consumos = 7,41 + 41,18 + 32,88 + 18,52 + 0,022 = 100,01 kg ✓

A soma é praticamente igual ao peso do produto (100 kg),
confirmando que a proporção está correta!
```

## Alertas e Validações

### Traço sem Cimento
Se o traço não tiver um material com "cimento" no nome, o sistema exibe:
- ⚠️ **Alerta amarelo**: "Cimento não encontrado no traço"
- Instruções para adicionar cimento ao traço

### Campo de Peso
- Aceita valores decimais (Ex: 14.5, 100.75)
- Suporta até 2 casas decimais
- Atualização automática ao digitar
- Recalcula instantaneamente

## Integração com Sistema de Custos

O custo total de materiais calculado é automaticamente integrado ao sistema de custos:
- **Custo de Material** → Calculado automaticamente pela proporção
- **Custo de Mão de Obra** → Percentual sobre material
- **Custos Fixos** → Percentual sobre material
- **Custo de Transporte** → Valor fixo
- **Perda** → Percentual sobre material
- **Custo de Produção** → Soma de todos os custos

## Benefícios

1. **Precisão Proporcional**: Mantém exatamente a proporção do traço original
2. **Simplicidade**: Basta informar o peso do produto
3. **Rapidez**: Cálculo instantâneo ao informar o peso
4. **Transparência**: Visualização detalhada de cada insumo
5. **Atualização Automática**: Qualquer mudança recalcula tudo
6. **Controle de Custos**: Base sólida e precisa para precificação

## Diferença para Produtos Pré-Moldados

| Característica | Artefatos | Pré-Moldados |
|----------------|-----------|--------------|
| Base do cálculo | Peso unitário | Volume (m³) |
| Requer | Cimento no traço | Peso específico do traço |
| Proporção | Total do traço | Volume × peso específico |
| Uso típico | Blocos, tampas, canaletas | Pilares, vigas, lajes |

## Observações Importantes

- O cálculo é **proporcional ao peso total do traço**
- Requer que o traço tenha **cimento cadastrado** (material com "cimento" no nome)
- O peso deve ser informado em **quilogramas (kg)**
- Os custos são calculados em **reais (R$)**
- A soma dos consumos sempre será aproximadamente igual ao peso do produto
- O sistema valida automaticamente se os dados necessários estão presentes

## Status da Implementação

✅ **Concluído e Testado**
- Lógica de cálculo proporcional implementada
- Interface gráfica criada e responsiva
- Validações e alertas adicionados
- Build compilado com sucesso
- Pronto para uso em produção

## Documentação Adicional

- **GUIA_USO_CALCULO_ARTEFATOS.md**: Guia passo a passo de uso
- **TESTE_CALCULO_ARTEFATOS.md**: Como testar e validar
- **ALTERACOES_TECNICAS_CONSUMO_ARTEFATOS.md**: Detalhes técnicos da implementação
