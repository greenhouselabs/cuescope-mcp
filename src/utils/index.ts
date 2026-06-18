/**
 * Utility modules
 * @module utils
 */

export { Logger, getLogger, setDefaultLogger, createLogger, type LoggerOptions } from './logger.js';
export { delay, timeout, withTimeout, retry, type RetryOptions } from './delay.js';
export {
  normalizeInput,
  normalizeInputKey,
  isGuid,
  isNumericString,
  getInputReferenceType,
  parseInputNumber,
  formatInputReference,
  type InputReference,
} from './input-normalizer.js';
export {
  resolveInput,
  resolveInputOrThrow,
  formatResolveError,
  escapeXPath,
  type InputResolveResult,
} from './input-resolver.js';
