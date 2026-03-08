import { describe, it, expect, beforeEach } from 'vitest';
import { logger, logStateChange, logApiCall, logApiSuccess, logApiError } from '../../lib/logger';

describe('Logger', () => {
  beforeEach(() => {
    logger.clearLogs();
  });

  it('should log debug messages', () => {
    logger.debug('TestComponent', 'testOp', 'Debug message', { data: 'test' });
    const logs = logger.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('debug');
    expect(logs[0].component).toBe('TestComponent');
    expect(logs[0].operation).toBe('testOp');
    expect(logs[0].message).toBe('Debug message');
    expect(logs[0].data).toEqual({ data: 'test' });
  });

  it('should log info messages', () => {
    logger.info('TestComponent', 'testOp', 'Info message');
    const logs = logger.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
  });

  it('should log warning messages', () => {
    logger.warn('TestComponent', 'testOp', 'Warning message');
    const logs = logger.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('warn');
  });

  it('should log error messages with error object', () => {
    const error = new Error('Test error');
    logger.error('TestComponent', 'testOp', 'Error message', error);
    const logs = logger.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].error).toBe(error);
    expect(logs[0].stack).toBeDefined();
  });

  it('should log critical messages', () => {
    const error = new Error('Critical error');
    logger.critical('TestComponent', 'testOp', 'Critical message', error);
    const logs = logger.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('critical');
  });

  it('should maintain maximum log count', () => {
    for (let i = 0; i < 150; i++) {
      logger.debug('TestComponent', 'testOp', `Message ${i}`);
    }

    const logs = logger.getLogs();
    expect(logs.length).toBeLessThanOrEqual(100);
  });

  it('should clear logs', () => {
    logger.info('TestComponent', 'testOp', 'Test message');
    expect(logger.getLogs()).toHaveLength(1);

    logger.clearLogs();
    expect(logger.getLogs()).toHaveLength(0);
  });

  it('should filter logs by component', () => {
    logger.info('Component1', 'op1', 'Message 1');
    logger.info('Component2', 'op2', 'Message 2');
    logger.info('Component1', 'op3', 'Message 3');

    const component1Logs = logger.getLogsByComponent('Component1');
    expect(component1Logs).toHaveLength(2);
    expect(component1Logs.every((log) => log.component === 'Component1')).toBe(true);
  });

  it('should filter logs by level', () => {
    logger.debug('TestComponent', 'op1', 'Debug');
    logger.info('TestComponent', 'op2', 'Info');
    logger.error('TestComponent', 'op3', 'Error', new Error('test'));

    const errorLogs = logger.getLogsByLevel('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe('error');
  });

  it('should count errors', () => {
    logger.info('TestComponent', 'op1', 'Info');
    logger.error('TestComponent', 'op2', 'Error', new Error('test'));
    logger.critical('TestComponent', 'op3', 'Critical', new Error('test'));

    expect(logger.getErrorCount()).toBe(2);
  });

  it('should get recent errors', () => {
    for (let i = 0; i < 5; i++) {
      logger.info('TestComponent', `op${i}`, `Info ${i}`);
      logger.error('TestComponent', `op${i}`, `Error ${i}`, new Error(`test ${i}`));
    }

    const recentErrors = logger.getRecentErrors(3);
    expect(recentErrors).toHaveLength(3);
    expect(recentErrors.every((log) => log.level === 'error')).toBe(true);
  });

  it('should export logs as JSON', () => {
    logger.info('TestComponent', 'testOp', 'Test message', { data: 'test' });
    const exported = logger.exportLogs();
    const parsed = JSON.parse(exported);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('Test message');
  });

  describe('Helper functions', () => {
    it('should log state changes', () => {
      const before = { count: 0, name: 'John' };
      const after = { count: 1, name: 'John' };

      logStateChange('TestComponent', 'increment', before, after);
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].data.changes).toEqual({
        count: { before: 0, after: 1 },
      });
    });

    it('should log API calls', () => {
      logApiCall('TestComponent', 'fetchData', { id: 123 });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('API call started');
      expect(logs[0].data).toEqual({ id: 123 });
    });

    it('should log API success', () => {
      logApiSuccess('TestComponent', 'fetchData', { result: 'success' });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('API call successful');
    });

    it('should log API errors', () => {
      const error = new Error('API failed');
      logApiError('TestComponent', 'fetchData', error, { id: 123 });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('API call failed');
      expect(logs[0].level).toBe('error');
      expect(logs[0].error).toBe(error);
    });
  });
});
