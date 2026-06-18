/**
 * Configuration schema for CueScope
 * Uses Zod for runtime validation of environment variables
 */

import { z } from 'zod';

/**
 * Log level options
 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Accepted string spellings for boolean environment variables
 */
const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSY_VALUES = new Set(['false', '0', 'no', 'off', '']);

/**
 * Transform string boolean values properly
 * (z.coerce.boolean() treats 'false' as true because Boolean('false') === true)
 *
 * Accepts true/1/yes/on and false/0/no/off (case-insensitive; empty string is
 * false). Anything else is rejected so typos surface at startup instead of
 * silently mapping to false.
 */
function stringBooleanSchema(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .transform((val, ctx) => {
      if (typeof val === 'boolean') return val;
      const normalized = val.trim().toLowerCase();
      if (TRUTHY_VALUES.has(normalized)) return true;
      if (FALSY_VALUES.has(normalized)) return false;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid boolean value "${val}". Use true/false, 1/0, yes/no, or on/off.`,
      });
      return z.NEVER;
    })
    .default(defaultValue);
}

/**
 * Full configuration schema with defaults
 */
export const ConfigSchema = z.object({
  // vMix connection settings
  VMIX_HOST: z
    .string()
    .min(1, 'VMIX_HOST must not be empty')
    .refine((host) => !/[\s:/\\]/.test(host), {
      message:
        'VMIX_HOST must be a bare hostname or IP address (no scheme, port, path, or whitespace). ' +
        'Use VMIX_HTTP_PORT / VMIX_TCP_PORT to configure ports.',
    })
    .default('localhost'),
  VMIX_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8088),
  VMIX_TCP_PORT: z.coerce.number().int().min(1).max(65535).default(8099),

  // TCP connection settings
  TCP_ENABLED: stringBooleanSchema(true),
  TCP_RECONNECT_DELAY: z.coerce.number().int().min(100).max(60000).default(5000),
  TCP_MAX_RECONNECTS: z.coerce.number().int().min(0).max(100).default(10),
  TCP_CONNECT_TIMEOUT: z.coerce.number().int().min(1000).max(30000).default(10000),

  // Safety mode
  VMIX_CONTROL_MODE: stringBooleanSchema(false),
  VMIX_HIGH_IMPACT: stringBooleanSchema(false),

  // State caching
  STATE_CACHE_TTL: z.coerce.number().int().min(0).max(10000).default(100),

  // Skills system
  SKILLS_PATH: z.string().optional(),
  // Optional directory of user-authored skills (each at <dir>/<name>/SKILL.md),
  // discovered and merged in addition to the bundled skills.
  VMIX_USER_SKILLS_PATH: z.string().optional(),

  // Logging
  LOG_LEVEL: LogLevelSchema.default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Partial config for overrides during testing
 */
export type ConfigOverrides = Partial<z.input<typeof ConfigSchema>>;
