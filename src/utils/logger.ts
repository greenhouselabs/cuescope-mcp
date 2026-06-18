/**
 * Logging abstraction for CueScope
 * Uses stderr for all logging (stdout reserved for MCP protocol)
 */

import type { LogLevel } from '../config/index.js';

/**
 * Log levels and their numeric priorities
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function formatUnknownValue(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/**
 * Logger instance configuration
 */
export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
}

/**
 * Logger class for structured logging
 * All output goes to stderr (stdout is for MCP protocol)
 */
export class Logger {
  private readonly level: number;
  private readonly prefix: string;

  constructor(options: LoggerOptions) {
    this.level = LOG_LEVELS[options.level];
    this.prefix = options.prefix ?? 'cuescope-mcp';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.level;
  }

  private formatMessage(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    let formatted = `[${timestamp}] ${levelStr} [${this.prefix}] ${message}`;

    if (data && Object.keys(data).length > 0) {
      formatted += ` ${JSON.stringify(data)}`;
    }

    return formatted;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.error(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      const errorData: Record<string, unknown> = { ...data };

      if (error instanceof Error) {
        errorData['errorName'] = error.name;
        errorData['errorMessage'] = error.message;
        if (error.stack) {
          errorData['stack'] = error.stack.split('\n').slice(0, 3).join('\n');
        }
      } else if (error !== undefined) {
        errorData['error'] = formatUnknownValue(error);
      }

      console.error(this.formatMessage('error', message, errorData));
    }
  }

  /**
   * Create a child logger with a new prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      level: Object.entries(LOG_LEVELS).find(([_, v]) => v === this.level)?.[0] as LogLevel ?? 'info',
      prefix: `${this.prefix}:${prefix}`,
    });
  }
}

/**
 * Default logger instance (replace explicitly via setDefaultLogger)
 */
let defaultLogger: Logger | null = null;

/**
 * Get the default logger, creating it on first use.
 *
 * Options are only applied if the default logger does not exist yet;
 * once created, the default is immutable through this function. Use
 * setDefaultLogger to replace it explicitly (e.g., after config load
 * or in tests).
 */
export function getLogger(options?: LoggerOptions): Logger {
  defaultLogger ??= new Logger(options ?? { level: 'info' });
  return defaultLogger;
}

/**
 * Explicitly replace the default logger
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Create a logger with specific options
 */
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
