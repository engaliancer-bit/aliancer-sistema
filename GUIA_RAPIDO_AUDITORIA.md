# GUIA RÁPIDO - AUDITORIA DE BUGS

**Última Atualização**: 28/01/2026

---

## SISTEMAS DISPONÍVEIS

### 1. FinancialErrorBoundary

Captura erros em componentes financeiros.

```typescript
import FinancialErrorBoundary from './components/FinancialErrorBoundary';

<FinancialErrorBoundary componentName="CashFlow">
  <CashFlow />
</FinancialErrorBoundary>
```

### 2. Logger Centralizado

Rastreamento estruturado de operações.

```typescript
import { logger } from '../lib/logger';

logger.info('Component', 'operation', 'Message', { data });
logger.error('Component', 'operation', 'Error', error);

// Console commands
__getFinancialLogs()      // Ver todos logs
__clearFinancialLogs()    // Limpar logs
__exportFinancialLogs()   // Export JSON
```

### 3. Database Helper

Operações seguras de database.

```typescript
import { safeInsert, handleDbError } from '../lib/dbHelper';

const result = await safeInsert('Component', 'table', data);

if (!result.success) {
  handleDbError('Component', result.error);
  return;
}

console.log('Saved in', result.duration, 'ms');
```

### 4. Testes Unitários

```bash
npm test           # Durante desenvolvimento
npm run test:run   # Antes de commit
```

---

## PADRÕES DE FALHA COMUNS

### Race Conditions

**Problema**: Múltiplas atualizações de estado simultâneas

**Correção**:
```typescript
// ANTES
const [loading, setLoading] = useState(false);
const [data, setData] = useState(null);

// DEPOIS
const [state, setState] = useState({ loading: false, data: null });
```

### Validações Bloqueantes

**Problema**: UI trava durante validação

**Correção**:
```typescript
// ANTES
const valid = await validateSync(value); // Bloqueia

// DEPOIS
const validation = useAsyncValidation(validator, 500);
await validation.validate(value); // Não bloqueia
```

### Erros Silenciosos

**Problema**: Erros capturados mas não tratados

**Correção**:
```typescript
// ANTES
try { await save(); } catch (e) { console.log(e); }

// DEPOIS
const result = await safeInsert('Component', 'table', data);
if (!result.success) {
  handleDbError('Component', result.error);
}
```

### Memory Leaks

**Problema**: useEffect sem cleanup

**Correção**:
```typescript
// ANTES
useEffect(() => {
  const timer = setInterval(refresh, 5000);
}, []);

// DEPOIS
useEffect(() => {
  const timer = setInterval(refresh, 5000);
  return () => clearInterval(timer); // Cleanup
}, []);
```

### N+1 Queries

**Problema**: Múltiplas queries em loop

**Correção**:
```typescript
// ANTES
for (const order of orders) {
  const customer = await getCustomer(order.customer_id);
}

// DEPOIS
const orders = await supabase
  .from('orders')
  .select('*, customers(*)');
```

---

## CHECKLIST RÁPIDO

### Antes de Commit

- [ ] Código wrapped com Error Boundary
- [ ] Logging adicionado em operações críticas
- [ ] Database operations usando helper
- [ ] Testes passando (npm run test:run)
- [ ] Build sem erros (npm run build)

### Antes de Deploy

- [ ] npm audit sem vulnerabilidades críticas
- [ ] Todos testes passando
- [ ] Error boundaries aplicados
- [ ] Logs verificados em staging
- [ ] Performance testada

---

## COMANDOS ÚTEIS

```bash
# Testes
npm test              # Modo watch
npm run test:ui       # UI interativa
npm run test:run      # Executar uma vez

# Build
npm run build         # Build de produção
npm run typecheck     # Verificar TypeScript

# Logs (no console do navegador)
__getFinancialLogs()
__clearFinancialLogs()
__exportFinancialLogs()

# Filtros de logs
logger.getLogsByComponent('CashFlow')
logger.getLogsByLevel('error')
logger.getRecentErrors(10)
```

---

## VULNERABILIDADES CONHECIDAS

### jspdf/dompurify (CRÍTICO)

**Status**: ⚠️ Pendente
**Impacto**: XSS em exports de PDF
**Correção**:
```bash
npm audit fix --force
# ou
npm install jspdf@latest jspdf-autotable@latest
```

---

## DOCUMENTAÇÃO COMPLETA

📄 **AUDITORIA_BUGS_INTERMITENTES.md** - Documentação técnica completa
📄 **GUIA_RAPIDO_AUDITORIA.md** - Este arquivo

---

## SUPORTE

### Debugging

1. Abrir DevTools do navegador
2. Verificar logs no console
3. Executar `__getFinancialLogs()`
4. Filtrar por componente ou nível
5. Export logs se necessário

### Erros Persistentes

1. Verificar Error Boundary capturou
2. Copiar stack trace
3. Verificar logs do logger
4. Reproduzir em ambiente controlado
5. Adicionar testes para o caso

---

**Versão**: 1.0
**Status**: ✅ Sistema Protegido

Sistema com 4 camadas de proteção contra bugs! 🚀
