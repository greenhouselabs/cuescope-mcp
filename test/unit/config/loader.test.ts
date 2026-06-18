/**
 * Tests for configuration loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, createTestConfig, ConfigError } from '../../../src/config/index.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default values when no env vars set', () => {
    const config = loadConfig();

    expect(config.VMIX_HOST).toBe('localhost');
    expect(config.VMIX_HTTP_PORT).toBe(8088);
    expect(config.VMIX_TCP_PORT).toBe(8099);
    expect(config.TCP_ENABLED).toBe(true);
    expect(config.TCP_RECONNECT_DELAY).toBe(5000);
    expect(config.TCP_MAX_RECONNECTS).toBe(10);
    expect(config.VMIX_CONTROL_MODE).toBe(false);
    expect(config.VMIX_HIGH_IMPACT).toBe(false);
    expect(config.STATE_CACHE_TTL).toBe(100);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('reads values from environment variables', () => {
    process.env['VMIX_HOST'] = '192.168.1.100';
    process.env['VMIX_HTTP_PORT'] = '9088';
    process.env['VMIX_TCP_PORT'] = '9099';
    process.env['TCP_ENABLED'] = 'false';
    process.env['VMIX_CONTROL_MODE'] = 'true';
    process.env['VMIX_HIGH_IMPACT'] = 'true';
    process.env['LOG_LEVEL'] = 'debug';

    const config = loadConfig();

    expect(config.VMIX_HOST).toBe('192.168.1.100');
    expect(config.VMIX_HTTP_PORT).toBe(9088);
    expect(config.VMIX_TCP_PORT).toBe(9099);
    expect(config.TCP_ENABLED).toBe(false);
    expect(config.VMIX_CONTROL_MODE).toBe(true);
    expect(config.VMIX_HIGH_IMPACT).toBe(true);
    expect(config.LOG_LEVEL).toBe('debug');
  });

  it('applies overrides over env vars', () => {
    process.env['VMIX_HOST'] = 'from-env';

    const config = loadConfig({ VMIX_HOST: 'from-override' });

    expect(config.VMIX_HOST).toBe('from-override');
  });

  it('coerces string port numbers to integers', () => {
    process.env['VMIX_HTTP_PORT'] = '8089';

    const config = loadConfig();

    expect(config.VMIX_HTTP_PORT).toBe(8089);
    expect(typeof config.VMIX_HTTP_PORT).toBe('number');
  });

  it('coerces string booleans', () => {
    process.env['TCP_ENABLED'] = 'false';
    process.env['VMIX_CONTROL_MODE'] = 'true';
    process.env['VMIX_HIGH_IMPACT'] = 'true';

    const config = loadConfig();

    expect(config.TCP_ENABLED).toBe(false);
    expect(config.VMIX_CONTROL_MODE).toBe(true);
    expect(config.VMIX_HIGH_IMPACT).toBe(true);
    expect(typeof config.TCP_ENABLED).toBe('boolean');
    expect(typeof config.VMIX_CONTROL_MODE).toBe('boolean');
    expect(typeof config.VMIX_HIGH_IMPACT).toBe('boolean');
  });

  it('accepts all truthy boolean spellings (case-insensitive)', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', 'Yes', 'on', 'ON']) {
      process.env['VMIX_CONTROL_MODE'] = value;
      const config = loadConfig();
      expect(config.VMIX_CONTROL_MODE, `value: "${value}"`).toBe(true);
    }
  });

  it('accepts all falsy boolean spellings (case-insensitive)', () => {
    for (const value of ['false', 'FALSE', '0', 'no', 'No', 'off', 'OFF', '']) {
      process.env['TCP_ENABLED'] = value;
      const config = loadConfig();
      expect(config.TCP_ENABLED, `value: "${value}"`).toBe(false);
    }
  });

  it('rejects unrecognized boolean values instead of silently mapping to false', () => {
    process.env['VMIX_CONTROL_MODE'] = 'enabled';

    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow(/VMIX_CONTROL_MODE/);
  });

  it('rejects typos in boolean values', () => {
    process.env['TCP_ENABLED'] = 'fasle';

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('rejects an empty VMIX_HOST', () => {
    process.env['VMIX_HOST'] = '';

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('rejects VMIX_HOST containing a port', () => {
    process.env['VMIX_HOST'] = 'localhost:8088';

    expect(() => loadConfig()).toThrow(/VMIX_HTTP_PORT/);
  });

  it('rejects VMIX_HOST containing a scheme or path', () => {
    process.env['VMIX_HOST'] = 'http://localhost';
    expect(() => loadConfig()).toThrow(ConfigError);

    process.env['VMIX_HOST'] = 'localhost/api';
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('rejects VMIX_HOST containing whitespace', () => {
    process.env['VMIX_HOST'] = 'local host';

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('accepts a bare hostname or IP for VMIX_HOST', () => {
    process.env['VMIX_HOST'] = 'vmix-machine.local';
    expect(loadConfig().VMIX_HOST).toBe('vmix-machine.local');

    process.env['VMIX_HOST'] = '10.0.0.42';
    expect(loadConfig().VMIX_HOST).toBe('10.0.0.42');
  });

  it('throws ConfigError for invalid port number', () => {
    process.env['VMIX_HTTP_PORT'] = '99999';

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('throws ConfigError for invalid log level', () => {
    process.env['LOG_LEVEL'] = 'invalid';

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('includes field path in ConfigError', () => {
    process.env['VMIX_HTTP_PORT'] = '-1';

    try {
      loadConfig();
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      expect(configError.issues).toHaveLength(1);
      expect(configError.issues[0]?.path).toBe('VMIX_HTTP_PORT');
    }
  });
});

describe('createTestConfig', () => {
  it('returns valid config with test defaults', () => {
    const config = createTestConfig();

    expect(config.VMIX_HOST).toBe('localhost');
    expect(config.LOG_LEVEL).toBe('error'); // Suppressed for tests
  });

  it('applies overrides', () => {
    const config = createTestConfig({ VMIX_HOST: 'test-host' });

    expect(config.VMIX_HOST).toBe('test-host');
  });
});
