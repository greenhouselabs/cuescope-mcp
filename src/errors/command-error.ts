/**
 * Error thrown when a vMix command fails
 */

import { VmixError } from './base.js';

/**
 * Command error - thrown when a vMix API command fails
 */
export class CommandError extends VmixError {
  public readonly functionName: string;
  public readonly params: Record<string, unknown>;
  public readonly statusCode?: number;

  constructor(
    message: string,
    functionName: string,
    params: Record<string, unknown>,
    statusCode?: number
  ) {
    super(message, 'COMMAND_ERROR');
    this.name = 'CommandError';
    this.functionName = functionName;
    this.params = params;
    this.statusCode = statusCode;
  }

  override toUserMessage(): string {
    const paramStr = Object.entries(this.params)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(', ');
    return (
      `Command Failed: ${this.functionName}(${paramStr}) - ${this.message}. ` +
      `Check vMix function reference for correct usage.`
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      functionName: this.functionName,
      params: this.params,
      statusCode: this.statusCode,
    };
  }
}
