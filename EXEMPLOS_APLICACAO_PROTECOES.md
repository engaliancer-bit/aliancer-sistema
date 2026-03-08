# EXEMPLOS PRÁTICOS - APLICAÇÃO DE PROTEÇÕES

**Data**: 28/01/2026
**Objetivo**: Guia prático para aplicar as 4 camadas de proteção em componentes existentes

---

## ÍNDICE

1. [Aplicar Error Boundary](#aplicar-error-boundary)
2. [Adicionar Logging](#adicionar-logging)
3. [Migrar para Database Helper](#migrar-para-database-helper)
4. [Criar Testes](#criar-testes)

---

## APLICAR ERROR BOUNDARY

### Exemplo 1: CashFlow.tsx

**ANTES** (src/App.tsx):
```typescript
import CashFlow from './components/CashFlow';

function App() {
  return (
    <div>
      <CashFlow businessUnit="factory" />
    </div>
  );
}
```

**DEPOIS** (src/App.tsx):
```typescript
import CashFlow from './components/CashFlow';
import FinancialErrorBoundary from './components/FinancialErrorBoundary';

function App() {
  return (
    <div>
      <FinancialErrorBoundary
        componentName="CashFlow"
        onError={(error, errorInfo) => {
          // Opcional: enviar para servidor de logs
          console.error('CashFlow error:', error, errorInfo);
        }}
      >
        <CashFlow businessUnit="factory" />
      </FinancialErrorBoundary>
    </div>
  );
}
```

### Exemplo 2: Múltiplos Componentes

```typescript
import FinancialErrorBoundary from './components/FinancialErrorBoundary';
import { CashFlow, PayableAccounts, UnifiedSales } from './components';

function FinancialDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FinancialErrorBoundary componentName="CashFlow">
        <CashFlow />
      </FinancialErrorBoundary>

      <FinancialErrorBoundary componentName="PayableAccounts">
        <PayableAccounts />
      </FinancialErrorBoundary>

      <FinancialErrorBoundary componentName="UnifiedSales">
        <UnifiedSales />
      </FinancialErrorBoundary>
    </div>
  );
}
```

### Exemplo 3: HOC Pattern

```typescript
import { withFinancialErrorBoundary } from './components/FinancialErrorBoundary';
import CashFlow from './components/CashFlow';

// Wrap component com HOC
const SafeCashFlow = withFinancialErrorBoundary(CashFlow, 'CashFlow');

// Usar normalmente
function App() {
  return <SafeCashFlow businessUnit="factory" />;
}
```

---

## ADICIONAR LOGGING

### Exemplo 1: loadData() em CashFlow.tsx

**ANTES**:
```typescript
async function loadManualExpenses() {
  const { data, error } = await supabase
    .from('cash_flow')
    .select('*')
    .eq('business_unit', businessUnit)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error loading expenses:', error);
    return;
  }

  setExpenses(data || []);
}
```

**DEPOIS**:
```typescript
import { logger, logApiCall, logApiSuccess, logApiError } from '../lib/logger';

async function loadManualExpenses() {
  logApiCall('CashFlow', 'loadManualExpenses', { businessUnit });

  const { data, error } = await supabase
    .from('cash_flow')
    .select('*')
    .eq('business_unit', businessUnit)
    .order('date', { ascending: false });

  if (error) {
    logApiError('CashFlow', 'loadManualExpenses', error, { businessUnit });
    return;
  }

  logApiSuccess('CashFlow', 'loadManualExpenses', {
    recordCount: data.length,
    businessUnit
  });

  setExpenses(data || []);
}
```

### Exemplo 2: Validações

**ANTES**:
```typescript
function validateForm() {
  if (!formData.supplier_id) {
    alert('Fornecedor é obrigatório');
    return false;
  }

  if (!formData.amount || formData.amount <= 0) {
    alert('Valor inválido');
    return false;
  }

  return true;
}
```

**DEPOIS**:
```typescript
import { logValidationError } from '../lib/logger';

function validateForm() {
  if (!formData.supplier_id) {
    logValidationError('PayableAccounts', 'supplier_id', 'Fornecedor é obrigatório');
    alert('Fornecedor é obrigatório');
    return false;
  }

  if (!formData.amount || formData.amount <= 0) {
    logValidationError('PayableAccounts', 'amount', 'Valor inválido', formData.amount);
    alert('Valor inválido');
    return false;
  }

  logger.debug('PayableAccounts', 'validation', 'Form validation passed', formData);
  return true;
}
```

### Exemplo 3: Operações Críticas

**ANTES**:
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const { error } = await supabase
    .from('payable_accounts')
    .insert([formData]);

  if (error) {
    console.error('Error:', error);
    alert('Erro ao salvar');
    return;
  }

  alert('Salvo com sucesso');
  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { logFormSubmit, logFormError, startOperationTimer } from '../lib/logger';

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const endTimer = startOperationTimer('PayableAccounts', 'submit');
  logFormSubmit('PayableAccounts', formData);

  const { error } = await supabase
    .from('payable_accounts')
    .insert([formData]);

  endTimer(); // Log: "Operation completed in 234ms"

  if (error) {
    logFormError('PayableAccounts', error, formData);
    alert('Erro ao salvar');
    return;
  }

  logger.info('PayableAccounts', 'submit', 'Form saved successfully', {
    id: formData.id,
    amount: formData.amount,
  });

  alert('Salvo com sucesso');
  loadAccounts();
}
```

### Exemplo 4: Rastrear Mudanças de Estado

**ANTES**:
```typescript
const [filters, setFilters] = useState({ startDate: '', endDate: '' });

function updateFilters(newFilters: typeof filters) {
  setFilters(newFilters);
  applyFilters();
}
```

**DEPOIS**:
```typescript
import { logStateChange } from '../lib/logger';

const [filters, setFilters] = useState({ startDate: '', endDate: '' });

function updateFilters(newFilters: typeof filters) {
  logStateChange('CashFlow', 'updateFilters', filters, newFilters);
  setFilters(newFilters);
  applyFilters();
}
```

---

## MIGRAR PARA DATABASE HELPER

### Exemplo 1: SELECT Simples

**ANTES**:
```typescript
async function loadSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Error:', error);
    alert('Erro ao carregar fornecedores');
    return;
  }

  setSuppliers(data || []);
}
```

**DEPOIS**:
```typescript
import { safeSelect, handleDbError } from '../lib/dbHelper';

async function loadSuppliers() {
  const result = await safeSelect<Supplier[]>(
    'PayableAccounts',
    'suppliers',
    'id, name',
    { operation: 'loadSuppliers' }
  );

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao carregar fornecedores');
    return;
  }

  console.log(`Loaded ${result.data?.length} suppliers in ${result.duration}ms`);
  setSuppliers(result.data || []);
}
```

### Exemplo 2: INSERT

**ANTES**:
```typescript
async function savePayment(data: PaymentData) {
  const { error } = await supabase
    .from('payable_accounts')
    .insert([data]);

  if (error) {
    console.error('Error:', error);
    alert('Erro ao salvar');
    return;
  }

  alert('Salvo com sucesso');
  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { safeInsert, handleDbError } from '../lib/dbHelper';

async function savePayment(data: PaymentData) {
  const result = await safeInsert<PayableAccount>(
    'PayableAccounts',
    'payable_accounts',
    data,
    { operation: 'savePayment' }
  );

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao salvar pagamento');
    return;
  }

  console.log(`Saved payment in ${result.duration}ms`);
  alert('Salvo com sucesso');
  loadAccounts();
}
```

### Exemplo 3: UPDATE

**ANTES**:
```typescript
async function markAsPaid(accountId: string, paymentDate: string) {
  const { error } = await supabase
    .from('payable_accounts')
    .update({ payment_status: 'paid', payment_date: paymentDate })
    .eq('id', accountId);

  if (error) {
    console.error('Error:', error);
    alert('Erro ao atualizar');
    return;
  }

  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { safeUpdate, handleDbError } from '../lib/dbHelper';

async function markAsPaid(accountId: string, paymentDate: string) {
  const result = await safeUpdate<PayableAccount>(
    'PayableAccounts',
    'payable_accounts',
    { payment_status: 'paid', payment_date: paymentDate },
    { id: accountId },
    { operation: 'markAsPaid' }
  );

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao marcar como pago');
    return;
  }

  console.log(`Updated in ${result.duration}ms`);
  loadAccounts();
}
```

### Exemplo 4: DELETE

**ANTES**:
```typescript
async function deleteAccount(accountId: string) {
  if (!confirm('Confirma exclusão?')) return;

  const { error } = await supabase
    .from('payable_accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    console.error('Error:', error);
    alert('Erro ao excluir');
    return;
  }

  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { safeDelete, handleDbError } from '../lib/dbHelper';

async function deleteAccount(accountId: string) {
  if (!confirm('Confirma exclusão?')) return;

  const result = await safeDelete<PayableAccount>(
    'PayableAccounts',
    'payable_accounts',
    { id: accountId },
    { operation: 'deleteAccount' }
  );

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao excluir conta');
    return;
  }

  console.log(`Deleted in ${result.duration}ms`);
  loadAccounts();
}
```

### Exemplo 5: RPC (Stored Procedures)

**ANTES**:
```typescript
async function createInstallments(data: InstallmentData) {
  const { error } = await supabase.rpc('create_payable_accounts_from_purchase', {
    supplier_id_param: data.supplier_id,
    total_amount_param: data.amount,
    installments_param: data.installments,
  });

  if (error) {
    console.error('Error:', error);
    alert('Erro ao criar parcelas');
    return;
  }

  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { safeRpc, handleDbError } from '../lib/dbHelper';

async function createInstallments(data: InstallmentData) {
  const result = await safeRpc<any>(
    'PayableAccounts',
    'create_payable_accounts_from_purchase',
    {
      supplier_id_param: data.supplier_id,
      total_amount_param: data.amount,
      installments_param: data.installments,
    }
  );

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao criar parcelas');
    return;
  }

  console.log(`Created installments in ${result.duration}ms`);
  loadAccounts();
}
```

### Exemplo 6: Retry com Backoff

**ANTES**:
```typescript
async function saveWithRetry(data: PaymentData) {
  let retries = 3;
  let lastError;

  while (retries > 0) {
    const { error } = await supabase
      .from('payable_accounts')
      .insert([data]);

    if (!error) {
      loadAccounts();
      return;
    }

    lastError = error;
    retries--;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.error('Failed after retries:', lastError);
  alert('Erro ao salvar após 3 tentativas');
}
```

**DEPOIS**:
```typescript
import { safeInsert, retryDbOperation, handleDbError } from '../lib/dbHelper';

async function saveWithRetry(data: PaymentData) {
  const result = await retryDbOperation(
    () => safeInsert('PayableAccounts', 'payable_accounts', data),
    3,    // max retries
    1000  // initial delay ms
  );

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao salvar após 3 tentativas');
    return;
  }

  console.log(`Saved (with retries) in ${result.duration}ms`);
  loadAccounts();
}
```

### Exemplo 7: Batch Operations

**ANTES**:
```typescript
async function saveMultipleAccounts(accounts: PaymentData[]) {
  for (const account of accounts) {
    const { error } = await supabase
      .from('payable_accounts')
      .insert([account]);

    if (error) {
      console.error('Error saving:', account, error);
    }
  }

  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { safeInsert, batchDbOperation, handleDbError } from '../lib/dbHelper';

async function saveMultipleAccounts(accounts: PaymentData[]) {
  const operations = accounts.map(account =>
    () => safeInsert('PayableAccounts', 'payable_accounts', account)
  );

  const result = await batchDbOperation('PayableAccounts', operations, {
    stopOnError: false, // Continua mesmo com erros
  });

  if (!result.success) {
    console.warn(`Batch completed with ${result.error} errors`);
  }

  console.log(`Saved ${result.data?.length} accounts in ${result.duration}ms`);
  loadAccounts();
}
```

### Exemplo 8: Validação Antes de Salvar

**ANTES**:
```typescript
async function savePayment(data: PaymentData) {
  if (!data.supplier_id) {
    alert('Fornecedor é obrigatório');
    return;
  }

  if (!data.amount || data.amount <= 0) {
    alert('Valor inválido');
    return;
  }

  const { error } = await supabase
    .from('payable_accounts')
    .insert([data]);

  if (error) {
    console.error('Error:', error);
    alert('Erro ao salvar');
    return;
  }

  loadAccounts();
}
```

**DEPOIS**:
```typescript
import { safeInsert, validateData, handleDbError } from '../lib/dbHelper';

async function savePayment(data: PaymentData) {
  // Validar dados antes
  const validation = validateData('PayableAccounts', data, {
    supplier_id: (value) => value ? null : 'Fornecedor é obrigatório',
    amount: (value) => value > 0 ? null : 'Valor deve ser maior que zero',
    due_date: (value) => value ? null : 'Data de vencimento é obrigatória',
  });

  if (!validation.valid) {
    const errorMessages = Object.values(validation.errors).join('\n');
    alert(`Erros de validação:\n${errorMessages}`);
    return;
  }

  // Salvar com logging automático
  const result = await safeInsert('PayableAccounts', 'payable_accounts', data);

  if (!result.success) {
    handleDbError('PayableAccounts', result.error, 'Erro ao salvar pagamento');
    return;
  }

  console.log(`Saved in ${result.duration}ms`);
  loadAccounts();
}
```

---

## CRIAR TESTES

### Exemplo 1: Teste de Hook Customizado

**Arquivo**: `src/test/hooks/useDebounce.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce', () => {
  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Mudar valor rapidamente
    rerender({ value: 'updated1', delay: 500 });
    rerender({ value: 'updated2', delay: 500 });
    rerender({ value: 'updated3', delay: 500 });

    // Valor ainda deve ser o inicial
    expect(result.current).toBe('initial');

    // Esperar debounce
    await waitFor(
      () => {
        expect(result.current).toBe('updated3');
      },
      { timeout: 1000 }
    );
  });

  it('should update immediately when delay is 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 0 } }
    );

    rerender({ value: 'updated', delay: 0 });

    expect(result.current).toBe('updated');
  });
});
```

### Exemplo 2: Teste de Função Utilitária

**Arquivo**: `src/test/utils/formatCurrency.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../../utils/formatters';

describe('formatCurrency', () => {
  it('should format positive values correctly', () => {
    expect(formatCurrency(1000)).toBe('R$ 1.000,00');
    expect(formatCurrency(1000.5)).toBe('R$ 1.000,50');
    expect(formatCurrency(1000.99)).toBe('R$ 1.000,99');
  });

  it('should format negative values correctly', () => {
    expect(formatCurrency(-1000)).toBe('R$ -1.000,00');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('should handle very large numbers', () => {
    expect(formatCurrency(1000000)).toBe('R$ 1.000.000,00');
  });

  it('should handle very small decimals', () => {
    expect(formatCurrency(0.01)).toBe('R$ 0,01');
    expect(formatCurrency(0.99)).toBe('R$ 0,99');
  });
});
```

### Exemplo 3: Teste de Componente Simples

**Arquivo**: `src/test/components/ErrorMessage.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorMessage from '../../components/ErrorMessage';

describe('ErrorMessage', () => {
  it('should render error message', () => {
    render(<ErrorMessage message="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should not render when message is empty', () => {
    const { container } = render(<ErrorMessage message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should apply error styling', () => {
    render(<ErrorMessage message="Test error" />);
    const element = screen.getByText('Test error');
    expect(element).toHaveClass('text-red-600');
  });
});
```

---

## CONCLUSÃO

### Checklist de Aplicação

Para cada componente financeiro:

- [ ] Wrapped com FinancialErrorBoundary
- [ ] Logging adicionado em:
  - [ ] loadData()
  - [ ] save/update/delete operations
  - [ ] Validações críticas
  - [ ] Operações assíncronas
- [ ] Migrado para Database Helper:
  - [ ] SELECT → safeSelect
  - [ ] INSERT → safeInsert
  - [ ] UPDATE → safeUpdate
  - [ ] DELETE → safeDelete
  - [ ] RPC → safeRpc
- [ ] Testes criados:
  - [ ] Hooks customizados
  - [ ] Funções utilitárias
  - [ ] Validações críticas

### Prioridade de Aplicação

**Alta Prioridade** (aplicar primeiro):
1. CashFlow.tsx
2. PayableAccounts.tsx
3. UnifiedSales.tsx
4. ConsolidatedCashFlow.tsx

**Média Prioridade**:
5. EngineeringFinance.tsx
6. ConstructionFinance.tsx
7. CustomerRevenue.tsx
8. EngineeringProjectPayments.tsx

**Baixa Prioridade**:
9. Sales.tsx
10. SalesReport.tsx
11. SalesPrices.tsx
12. PayableAccountAlerts.tsx
13. OptimizedPaymentForm.tsx

---

**Data**: 28/01/2026
**Versão**: 1.0

**Aplique as 4 camadas de proteção e tenha um sistema robusto!** 🚀
