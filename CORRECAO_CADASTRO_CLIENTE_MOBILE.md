# Correção: Erros ao Cadastrar Cliente pelo Celular

## Problemas Identificados e Resolvidos

### 1. Mensagens de Erro Genéricas
**Sintoma:** Ao cadastrar cliente pelo celular, o sistema mostrava apenas "Erro ao salvar cliente", sem detalhes sobre o que estava errado.

### 2. CPF/CNPJ Duplicado sem Aviso Claro
**Sintoma:** Quando tentava cadastrar um CPF/CNPJ já existente, a mensagem de erro não informava claramente que o documento estava duplicado.

### 3. Experiência Mobile Ruim
**Sintoma:** Campos de texto causavam zoom automático no iOS e não abriam teclados apropriados (numérico para CPF, email para email, etc).

---

## Soluções Implementadas

### Solução 1: Validação Prévia de CPF/CNPJ Duplicado

Agora o sistema verifica se o CPF/CNPJ já existe ANTES de tentar salvar, mostrando mensagem clara:

```typescript
if (!editingId) {
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('cpf', formData.cpf)
    .maybeSingle();

  if (existingCustomer) {
    const docType = formData.person_type === 'pf' ? 'CPF' : 'CNPJ';
    alert(`Este ${docType} já está cadastrado para o cliente: ${existingCustomer.name}`);
    return;
  }
}
```

#### Benefícios:
- Mensagem clara identificando qual cliente já tem aquele CPF/CNPJ
- Validação mais rápida, sem esperar o erro do banco
- Melhor experiência do usuário

### Solução 2: Tratamento de Erros Específicos

Tratamento detalhado dos erros do banco de dados:

```typescript
catch (error: any) {
  console.error('Erro ao salvar cliente:', error);

  let errorMessage = 'Erro ao salvar cliente';

  if (error?.code === '23505' && error?.message?.includes('customers_cpf_key')) {
    errorMessage = formData.person_type === 'pf'
      ? `Este CPF já está cadastrado no sistema. Por favor, verifique o CPF informado.`
      : `Este CNPJ já está cadastrado no sistema. Por favor, verifique o CNPJ informado.`;
  } else if (error?.message) {
    errorMessage = `Erro ao salvar cliente: ${error.message}`;
  }

  alert(errorMessage);
}
```

#### Mensagens de Erro Melhoradas:
- CPF duplicado: "Este CPF já está cadastrado para o cliente: [Nome]"
- CNPJ duplicado: "Este CNPJ já está cadastrado para o cliente: [Nome]"
- Outros erros: Mensagem detalhada do erro real
- Sucesso: "Cliente salvo com sucesso!"

### Solução 3: Melhorias para Mobile

#### A. Campos com Tamanho Correto (text-base)
Todos os campos agora têm `text-base` (16px), evitando zoom automático no iOS:

```typescript
className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2
           focus:ring-[#0A7EC2] focus:border-transparent text-base"
```

#### B. Teclados Apropriados (inputMode)

Cada campo abre o teclado correto no celular:

| Campo | inputMode | Teclado |
|-------|-----------|---------|
| Nome | (padrão) | Texto com capitalização |
| CPF/CNPJ | numeric | Numérico |
| Inscrição Estadual | numeric | Numérico |
| Email | email | Teclado com @ e . |
| Telefone | numeric | Numérico |
| Endereço | (padrão) | Texto |

#### C. Autocomplete Correto

Campos agora sugerem preenchimento automático apropriado:

```typescript
// Nome
autoComplete="name"

// Email
autoComplete="email"

// Telefone
autoComplete="tel"

// Endereço
autoComplete="street-address"

// Cidade
autoComplete="address-level2"

// CPF/CNPJ e IE
autoComplete="off"  // Não sugerir, cada cliente é único
```

#### D. Type Correto nos Inputs

- Email: `type="email"` + `inputMode="email"`
- Telefone: `type="tel"` + `inputMode="numeric"`
- CPF/CNPJ: `type="text"` + `inputMode="numeric"`

### Solução 4: AutoSave com Tratamento de Erro

Salvamento automático ao editar também detecta CPF duplicado:

```typescript
catch (error: any) {
  console.error('Erro ao salvar automaticamente:', error);
  setAutoSaveStatus('idle');

  if (error?.code === '23505' && error?.message?.includes('customers_cpf_key')) {
    const docType = formData.person_type === 'pf' ? 'CPF' : 'CNPJ';
    alert(`Este ${docType} já está cadastrado no sistema. Por favor, verifique o ${docType} informado.`);
  }
}
```

---

## Testes Recomendados

### 1. Cadastro com CPF Duplicado
1. Tente cadastrar cliente com CPF já existente
2. Deve mostrar: "Este CPF já está cadastrado para o cliente: [Nome]"
3. Não deve tentar salvar no banco

### 2. Teclados Mobile (iOS/Android)
1. Campo CPF/CNPJ: Deve abrir teclado numérico
2. Campo Email: Deve abrir teclado com @ e .com
3. Campo Telefone: Deve abrir teclado numérico
4. Campo Nome: Deve abrir teclado texto normal

### 3. Zoom Automático iOS
1. Tocar em qualquer campo no iPhone
2. Não deve dar zoom automático
3. Fonte deve estar legível (16px)

### 4. Sucesso no Salvamento
1. Cadastrar novo cliente válido
2. Deve mostrar: "Cliente salvo com sucesso!"
3. Formulário deve limpar
4. Cliente deve aparecer na lista

---

## Arquivos Modificados

### `src/components/Customers.tsx`

#### Modificações:

1. **Linhas 117-143:** handleSubmit com validação prévia de CPF duplicado
2. **Linhas 164-178:** Tratamento de erros específicos com mensagens claras
3. **Linhas 89-97:** autoSave com tratamento de erro de CPF duplicado
4. **Linhas 302-310:** Campo Nome com text-base e autocomplete
5. **Linhas 317-326:** Campo CPF/CNPJ com inputMode="numeric" e text-base
6. **Linhas 335-343:** Campo IE com inputMode="numeric" e text-base
7. **Linhas 351-358:** Campo Endereço com text-base e autocomplete
8. **Linhas 366-388:** Campos Bairro e Cidade com text-base
9. **Linhas 396-404:** Campo Email com inputMode="email" e text-base
10. **Linhas 420-432:** Campo Telefone com type="tel", inputMode="numeric" e text-base

---

## Validações no Banco de Dados

O banco de dados tem as seguintes constraints que são validadas:

```sql
-- CPF/CNPJ deve ser único
CONSTRAINT customers_cpf_key UNIQUE (cpf)

-- Tipo de pessoa deve ser 'pf' ou 'pj'
CONSTRAINT customers_person_type_check
  CHECK (person_type = ANY (ARRAY['pf'::text, 'pj'::text]))
```

Campos obrigatórios (NOT NULL):
- id
- name
- cpf
- person_type
- street (default '')
- neighborhood (default '')
- city (default '')
- email (default '')
- phone (default '')

---

## Possíveis Erros e Como o Sistema Trata

| Situação | Erro Anterior | Erro Agora |
|----------|--------------|------------|
| CPF duplicado novo | "Erro ao salvar cliente" | "Este CPF já está cadastrado para o cliente: João Silva" |
| CPF duplicado edit | "Erro ao salvar automaticamente" | "Este CPF já está cadastrado no sistema" |
| Nome vazio | "Nome do cliente é obrigatório" | "Nome do cliente é obrigatório" |
| CPF vazio | "CPF é obrigatório" | "CPF é obrigatório" |
| Sucesso | (sem mensagem) | "Cliente salvo com sucesso!" |

---

## Experiência Mobile Antes x Depois

### ANTES:
- Zoom automático ao focar campos (iOS)
- Teclado padrão para todos os campos
- Erro genérico "Erro ao salvar cliente"
- Sem indicação de campo duplicado

### DEPOIS:
- Sem zoom automático (fonte 16px)
- Teclado apropriado para cada campo
- Mensagem clara de qual cliente tem o CPF duplicado
- Validação prévia antes de tentar salvar
- Autocomplete inteligente

---

## Query Útil: Verificar CPF Duplicados

```sql
-- Listar CPFs duplicados (se houver)
SELECT cpf, COUNT(*) as quantidade, STRING_AGG(name, ', ') as clientes
FROM customers
GROUP BY cpf
HAVING COUNT(*) > 1
ORDER BY cpf;

-- Buscar cliente por CPF
SELECT id, name, cpf, person_type, phone, email, city
FROM customers
WHERE cpf = '12345678901';
```

---

## Status

- ✅ Validação prévia de CPF/CNPJ duplicado implementada
- ✅ Mensagens de erro específicas e claras
- ✅ Melhorias de experiência mobile (inputMode, text-base, autocomplete)
- ✅ Tratamento de erro no autoSave
- ✅ Build testado e aprovado
- ✅ Sistema pronto para uso em mobile e desktop

---

## Recomendações Futuras (Opcional)

1. **Formatação Automática:** Formatar CPF/CNPJ enquanto o usuário digita (###.###.###-##)
2. **Validação de CPF/CNPJ:** Validar dígitos verificadores antes de salvar
3. **Toast Notifications:** Substituir `alert()` por notificações mais elegantes
4. **Loading States:** Mostrar spinner durante validação de CPF duplicado
5. **Feedback Visual:** Destacar campo CPF em vermelho se duplicado
