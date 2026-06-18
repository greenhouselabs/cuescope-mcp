/**
 * Tests for custom error types
 */

import { describe, it, expect } from 'vitest';
import {
  VmixError,
  ConnectionError,
  CommandError,
  InputNotFoundError,
  ValidationError,
  ScriptError,
  TimeoutError,
  isVmixError,
  formatErrorMessage,
  wrapError,
} from '../../../src/errors/index.js';

describe('VmixError', () => {
  it('has correct name and code', () => {
    const error = new VmixError('test error', 'UNKNOWN_ERROR');

    expect(error.name).toBe('VmixError');
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.message).toBe('test error');
  });

  it('has timestamp', () => {
    const before = new Date();
    const error = new VmixError('test');
    const after = new Date();

    expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('converts to JSON', () => {
    const error = new VmixError('test error', 'UNKNOWN_ERROR');
    const json = error.toJSON();

    expect(json).toHaveProperty('name', 'VmixError');
    expect(json).toHaveProperty('code', 'UNKNOWN_ERROR');
    expect(json).toHaveProperty('message', 'test error');
    expect(json).toHaveProperty('timestamp');
  });
});

describe('ConnectionError', () => {
  it('includes connection details', () => {
    const error = new ConnectionError('Connection refused', '192.168.1.1', 8088, 'http');

    expect(error.host).toBe('192.168.1.1');
    expect(error.port).toBe(8088);
    expect(error.transport).toBe('http');
    expect(error.code).toBe('CONNECTION_ERROR');
  });

  it('provides actionable user message', () => {
    const error = new ConnectionError('Connection refused', 'localhost', 8088);
    const message = error.toUserMessage();

    expect(message).toContain('localhost:8088');
    expect(message).toContain('Web Controller');
  });
});

describe('CommandError', () => {
  it('includes command details', () => {
    const error = new CommandError('Invalid input', 'Cut', { Input: 'Camera 1' }, 400);

    expect(error.functionName).toBe('Cut');
    expect(error.params).toEqual({ Input: 'Camera 1' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('COMMAND_ERROR');
  });

  it('formats params in user message', () => {
    const error = new CommandError('Failed', 'SetVolume', { Input: '1', Value: '80' });
    const message = error.toUserMessage();

    expect(message).toContain('SetVolume');
    expect(message).toContain('Input=1');
    expect(message).toContain('Value=80');
  });
});

describe('InputNotFoundError', () => {
  it('includes input reference', () => {
    const error = new InputNotFoundError('Camera 1');

    expect(error.input).toBe('Camera 1');
    expect(error.code).toBe('INPUT_NOT_FOUND');
  });

  it('mentions case sensitivity in user message', () => {
    const error = new InputNotFoundError('camera 1');
    const message = error.toUserMessage();

    expect(message).toContain('case-sensitive');
  });

  it('shows available inputs when provided', () => {
    const error = new InputNotFoundError('Cam 1', ['Camera 1', 'Camera 2', 'Video']);
    const message = error.toUserMessage();

    expect(message).toContain('Camera 1');
    expect(message).toContain('Camera 2');
  });

  it('truncates long input lists', () => {
    const inputs = ['Input 1', 'Input 2', 'Input 3', 'Input 4', 'Input 5', 'Input 6'];
    const error = new InputNotFoundError('Test', inputs);
    const message = error.toUserMessage();

    expect(message).toContain('...');
  });
});

describe('ValidationError', () => {
  it('includes validation issues', () => {
    const error = new ValidationError('Validation failed', [
      { field: 'volume', message: 'Must be 0-100' },
    ]);

    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]?.field).toBe('volume');
  });

  it('creates from single field', () => {
    const error = ValidationError.fromField('input', 'Required', undefined);

    expect(error.issues).toHaveLength(1);
    expect(error.message).toContain('input');
  });

  it('formats multiple issues', () => {
    const error = new ValidationError('Validation failed', [
      { field: 'volume', message: 'Too high' },
      { field: 'input', message: 'Not found' },
    ]);
    const message = error.toUserMessage();

    expect(message).toContain('volume');
    expect(message).toContain('input');
  });
});

describe('ScriptError', () => {
  it('includes errors and warnings', () => {
    const error = new ScriptError(
      'Script invalid',
      ['Missing Sleep()'],
      ['Consider using &'],
      'Dim x = 1'
    );

    expect(error.errors).toContain('Missing Sleep()');
    expect(error.warnings).toContain('Consider using &');
    expect(error.script).toBe('Dim x = 1');
  });

  it('creates from validation result', () => {
    const error = ScriptError.fromValidation(['Error 1', 'Error 2'], ['Warning 1']);

    expect(error.errors).toHaveLength(2);
    expect(error.warnings).toHaveLength(1);
    expect(error.message).toContain('Error 1');
  });

  it('formats errors and warnings differently', () => {
    const error = new ScriptError('Failed', ['Error'], ['Warning']);
    const message = error.toUserMessage();

    expect(message).toContain('❌');
    expect(message).toContain('⚠️');
    expect(message).toContain('NOT executed');
  });
});

describe('TimeoutError', () => {
  it('uses the TIMEOUT_ERROR code and records the budget', () => {
    const error = new TimeoutError('Command timed out after 30000ms', 30000);

    expect(error.name).toBe('TimeoutError');
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.timeoutMs).toBe(30000);
    expect(error).toBeInstanceOf(VmixError);
  });

  it('provides an actionable user message', () => {
    const error = new TimeoutError('State fetch timed out after 5000ms', 5000);
    const message = error.toUserMessage();

    expect(message).toContain('Timeout');
    expect(message).toContain('State fetch timed out after 5000ms');
  });

  it('includes timeoutMs in JSON output', () => {
    const error = new TimeoutError('timed out', 1000);
    const json = error.toJSON();

    expect(json).toHaveProperty('code', 'TIMEOUT_ERROR');
    expect(json).toHaveProperty('timeoutMs', 1000);
  });

  it('is recognized by isVmixError', () => {
    expect(isVmixError(new TimeoutError('timed out', 100))).toBe(true);
  });
});

describe('isVmixError', () => {
  it('returns true for VmixError', () => {
    expect(isVmixError(new VmixError('test'))).toBe(true);
  });

  it('returns true for subclasses', () => {
    expect(isVmixError(new ConnectionError('test', 'localhost', 8088))).toBe(true);
    expect(isVmixError(new CommandError('test', 'Cut', {}))).toBe(true);
    expect(isVmixError(new InputNotFoundError('test'))).toBe(true);
  });

  it('returns false for regular errors', () => {
    expect(isVmixError(new Error('test'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isVmixError('string')).toBe(false);
    expect(isVmixError(null)).toBe(false);
    expect(isVmixError(undefined)).toBe(false);
  });
});

describe('formatErrorMessage', () => {
  it('uses toUserMessage for VmixError', () => {
    const error = new ConnectionError('Failed', 'localhost', 8088);
    const message = formatErrorMessage(error);

    expect(message).toContain('Web Controller');
  });

  it('extracts message from regular Error', () => {
    const error = new Error('Something went wrong');
    const message = formatErrorMessage(error);

    expect(message).toBe('Error: Something went wrong');
  });

  it('handles non-error values', () => {
    expect(formatErrorMessage('string error')).toBe('Unknown error: string error');
    expect(formatErrorMessage(42)).toBe('Unknown error: 42');
  });
});

describe('wrapError', () => {
  it('returns VmixError unchanged', () => {
    const original = new ConnectionError('test', 'localhost', 8088);
    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
  });

  it('wraps regular Error', () => {
    const original = new Error('Something failed');
    const wrapped = wrapError(original);

    expect(wrapped).toBeInstanceOf(VmixError);
    expect(wrapped.message).toBe('Something failed');
    expect(wrapped.code).toBe('UNKNOWN_ERROR');
  });

  it('includes context in message', () => {
    const original = new Error('Network timeout');
    const wrapped = wrapError(original, 'HTTP request');

    expect(wrapped.message).toBe('HTTP request: Network timeout');
  });

  it('handles non-error values', () => {
    const wrapped = wrapError('string error');

    expect(wrapped).toBeInstanceOf(VmixError);
    expect(wrapped.message).toBe('string error');
  });
});
