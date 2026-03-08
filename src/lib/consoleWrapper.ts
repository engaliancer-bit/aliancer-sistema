/**
 * Console Wrapper - Desabilita console.log em produção
 *
 * Melhora performance removendo logs desnecessários em produção
 */

const IS_PRODUCTION = import.meta.env.PROD;
const ENABLE_CONSOLE = import.meta.env.VITE_ENABLE_CONSOLE === 'true';

// Salvar métodos originais
const originalConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  table: console.table,
  group: console.group,
  groupCollapsed: console.groupCollapsed,
  groupEnd: console.groupEnd
};

/**
 * Desabilitar console em produção
 */
export function disableConsoleInProduction(): void {
  if (IS_PRODUCTION && !ENABLE_CONSOLE) {
    // Manter apenas warn e error
    console.log = () => {};
    console.debug = () => {};
    console.info = () => {};
    console.table = () => {};
    console.group = () => {};
    console.groupCollapsed = () => {};
    console.groupEnd = () => {};

    // Adicionar aviso
    originalConsole.info(
      '%c🚀 Modo Produção',
      'color: #4CAF50; font-size: 14px; font-weight: bold;',
      '\nLogs desabilitados para melhor performance'
    );
  }
}

/**
 * Restaurar console original
 */
export function restoreConsole(): void {
  console.log = originalConsole.log;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.table = originalConsole.table;
  console.group = originalConsole.group;
  console.groupCollapsed = originalConsole.groupCollapsed;
  console.groupEnd = originalConsole.groupEnd;
}

/**
 * Console condicional (só loga em dev)
 */
export const devConsole = {
  log: (...args: any[]) => {
    if (!IS_PRODUCTION) {
      originalConsole.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (!IS_PRODUCTION) {
      originalConsole.debug(...args);
    }
  },
  info: (...args: any[]) => {
    if (!IS_PRODUCTION) {
      originalConsole.info(...args);
    }
  },
  warn: (...args: any[]) => {
    originalConsole.warn(...args);
  },
  error: (...args: any[]) => {
    originalConsole.error(...args);
  }
};

// Auto-inicializar
disableConsoleInProduction();
