type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  operation: string;
  message: string;
  data?: any;
  error?: Error;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private isProduction = import.meta.env.PROD;

  private constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__getFinancialLogs = () => this.getLogs();
      (window as any).__clearFinancialLogs = () => this.clearLogs();
      (window as any).__exportFinancialLogs = () => this.exportLogs();
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(
    level: LogLevel,
    component: string,
    operation: string,
    message: string,
    data?: any,
    error?: Error
  ) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      operation,
      message,
      data,
      error,
      stack: error?.stack,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (!this.isProduction || level === 'error' || level === 'critical') {
      this.consoleLog(entry);
    }
  }

  private consoleLog(entry: LogEntry) {
    const icon = this.getIcon(entry.level);
    const color = this.getColor(entry.level);
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    console.groupCollapsed(
      `%c${icon} [${entry.level.toUpperCase()}] ${entry.component} - ${entry.operation}`,
      `color: ${color}; font-weight: bold;`
    );
    console.log(`⏰ ${timestamp}`);
    console.log(`📝 ${entry.message}`);
    if (entry.data) {
      console.log('📊 Data:', entry.data);
    }
    if (entry.error) {
      console.error('❌ Error:', entry.error);
    }
    if (entry.stack) {
      console.log('📚 Stack:', entry.stack);
    }
    console.groupEnd();
  }

  private getIcon(level: LogLevel): string {
    const icons = {
      debug: '🐛',
      info: '📘',
      warn: '⚠️',
      error: '❌',
      critical: '🔥',
    };
    return icons[level];
  }

  private getColor(level: LogLevel): string {
    const colors = {
      debug: '#6c757d',
      info: '#0d6efd',
      warn: '#ffc107',
      error: '#dc3545',
      critical: '#8b0000',
    };
    return colors[level];
  }

  debug(component: string, operation: string, message: string, data?: any) {
    this.log('debug', component, operation, message, data);
  }

  info(component: string, operation: string, message: string, data?: any) {
    this.log('info', component, operation, message, data);
  }

  warn(component: string, operation: string, message: string, data?: any) {
    this.log('warn', component, operation, message, data);
  }

  error(component: string, operation: string, message: string, error?: Error, data?: any) {
    this.log('error', component, operation, message, data, error);
  }

  critical(component: string, operation: string, message: string, error?: Error, data?: any) {
    this.log('critical', component, operation, message, data, error);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    console.log('🗑️ Financial logs cleared');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter((log) => log.component === component);
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  getErrorCount(): number {
    return this.logs.filter((log) => log.level === 'error' || log.level === 'critical').length;
  }

  getRecentErrors(count: number = 10): LogEntry[] {
    return this.logs
      .filter((log) => log.level === 'error' || log.level === 'critical')
      .slice(-count);
  }
}

export const logger = Logger.getInstance();

export function logStateChange(component: string, operation: string, before: any, after: any) {
  logger.debug(component, operation, 'State changed', {
    before,
    after,
    changes: getStateChanges(before, after),
  });
}

function getStateChanges(before: any, after: any): Record<string, { before: any; after: any }> {
  const changes: Record<string, { before: any; after: any }> = {};

  if (typeof before !== 'object' || typeof after !== 'object') {
    return changes;
  }

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  allKeys.forEach((key) => {
    if (before?.[key] !== after?.[key]) {
      changes[key] = {
        before: before?.[key],
        after: after?.[key],
      };
    }
  });

  return changes;
}

export function logApiCall(component: string, operation: string, params?: any) {
  logger.info(component, operation, 'API call started', params);
}

export function logApiSuccess(component: string, operation: string, data?: any) {
  logger.info(component, operation, 'API call successful', data);
}

export function logApiError(component: string, operation: string, error: Error, params?: any) {
  logger.error(component, operation, 'API call failed', error, params);
}

export function logValidationError(component: string, field: string, error: string, value?: any) {
  logger.warn(component, 'validation', `Validation failed for ${field}: ${error}`, { field, value });
}

export function logFormSubmit(component: string, formData: any) {
  logger.info(component, 'submit', 'Form submitted', formData);
}

export function logFormError(component: string, error: Error, formData?: any) {
  logger.error(component, 'submit', 'Form submission failed', error, formData);
}

export function logCriticalOperation(component: string, operation: string, details: any) {
  logger.critical(component, operation, 'Critical operation', undefined, details);
}

export function startOperationTimer(component: string, operation: string): () => void {
  const startTime = performance.now();
  logger.debug(component, operation, 'Operation started');

  return () => {
    const duration = performance.now() - startTime;
    logger.debug(component, operation, `Operation completed in ${duration.toFixed(2)}ms`, {
      duration,
    });
  };
}

export function withLogging<T extends (...args: any[]) => any>(
  component: string,
  operation: string,
  fn: T
): T {
  return ((...args: any[]) => {
    const endTimer = startOperationTimer(component, operation);
    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return result
          .then((res) => {
            endTimer();
            logger.info(component, operation, 'Async operation successful');
            return res;
          })
          .catch((error) => {
            endTimer();
            logger.error(component, operation, 'Async operation failed', error);
            throw error;
          });
      }

      endTimer();
      logger.info(component, operation, 'Operation successful');
      return result;
    } catch (error) {
      endTimer();
      logger.error(component, operation, 'Operation failed', error as Error);
      throw error;
    }
  }) as T;
}

if (typeof window !== 'undefined') {
  console.log('📊 Financial Logger initialized. Available commands:');
  console.log('  - __getFinancialLogs() : Get all logs');
  console.log('  - __clearFinancialLogs() : Clear all logs');
  console.log('  - __exportFinancialLogs() : Export logs as JSON');
}
