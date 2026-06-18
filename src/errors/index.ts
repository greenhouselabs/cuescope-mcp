/**
 * Custom error types for CueScope's vMix integration
 * @module errors
 */

export { VmixError, type VmixErrorCode } from './base.js';
export { ConnectionError } from './connection-error.js';
export { CommandError } from './command-error.js';
export { InputNotFoundError } from './input-not-found-error.js';
export { ValidationError, type ValidationIssue } from './validation-error.js';
export { ScriptError } from './script-error.js';
export { TimeoutError } from './timeout-error.js';

import { VmixError } from './base.js';

/**
 * Type guard to check if an error is a VmixError
 */
export function isVmixError(error: unknown): error is VmixError {
  return error instanceof VmixError;
}

/**
 * Format any error to a user-friendly message
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof VmixError) {
    return error.toUserMessage();
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Unknown error: ${String(error)}`;
}

/**
 * Wrap an unknown error in the appropriate VmixError type
 */
export function wrapError(error: unknown, context?: string): VmixError {
  if (error instanceof VmixError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = context ? `${context}: ${message}` : message;

  return new VmixError(fullMessage, 'UNKNOWN_ERROR');
}
