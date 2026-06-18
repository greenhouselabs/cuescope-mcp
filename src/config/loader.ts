/**
 * Configuration loader
 * Loads and validates configuration from environment variables
 */

import { ConfigSchema, type Config, type ConfigOverrides } from './schema.js';
import { ZodError } from 'zod';

/**
 * Configuration validation error
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load configuration from environment variables
 * @param overrides Optional overrides (useful for testing)
 * @returns Validated configuration object
 * @throws ConfigError if validation fails
 */
export function loadConfig(overrides?: ConfigOverrides): Config {
  const envConfig = {
    VMIX_HOST: process.env['VMIX_HOST'],
    VMIX_HTTP_PORT: process.env['VMIX_HTTP_PORT'],
    VMIX_TCP_PORT: process.env['VMIX_TCP_PORT'],
    TCP_ENABLED: process.env['TCP_ENABLED'],
    TCP_RECONNECT_DELAY: process.env['TCP_RECONNECT_DELAY'],
    TCP_MAX_RECONNECTS: process.env['TCP_MAX_RECONNECTS'],
    TCP_CONNECT_TIMEOUT: process.env['TCP_CONNECT_TIMEOUT'],
    VMIX_CONTROL_MODE: process.env['VMIX_CONTROL_MODE'],
    VMIX_HIGH_IMPACT: process.env['VMIX_HIGH_IMPACT'],
    STATE_CACHE_TTL: process.env['STATE_CACHE_TTL'],
    SKILLS_PATH: process.env['SKILLS_PATH'],
    VMIX_USER_SKILLS_PATH: process.env['VMIX_USER_SKILLS_PATH'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
    ...overrides,
  };

  try {
    return ConfigSchema.parse(envConfig);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new ConfigError(
        `Invalid configuration: ${issues.map((i) => `${i.path}: ${i.message}`).join(', ')}`,
        issues
      );
    }
    throw error;
  }
}

/**
 * Create a config with defaults for testing
 */
export function createTestConfig(overrides?: ConfigOverrides): Config {
  return loadConfig({
    VMIX_HOST: 'localhost',
    VMIX_HTTP_PORT: 8088,
    VMIX_TCP_PORT: 8099,
    TCP_ENABLED: true,
    VMIX_CONTROL_MODE: false,
    VMIX_HIGH_IMPACT: false,
    LOG_LEVEL: 'error',
    ...overrides,
  });
}
