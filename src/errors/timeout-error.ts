/**
 * Error thrown when an operation exceeds its time budget
 */

import { VmixError } from './base.js';

/**
 * Timeout error - thrown when a request or operation times out
 */
export class TimeoutError extends VmixError {
  /**
   * The timeout budget that was exceeded, in milliseconds
   */
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }

  override toUserMessage(): string {
    return (
      `Timeout: ${this.message}. ` +
      `vMix may be busy or unreachable; try again or check the connection.`
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs,
    };
  }
}
