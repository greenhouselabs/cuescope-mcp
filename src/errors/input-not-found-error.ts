/**
 * Error thrown when a referenced input doesn't exist
 */

import { VmixError } from './base.js';

/**
 * Input not found error - thrown when an input reference cannot be resolved
 */
export class InputNotFoundError extends VmixError {
  public readonly input: string | number;
  public readonly availableInputs?: string[];

  constructor(input: string | number, availableInputs?: string[]) {
    super(`Input not found: "${input}"`, 'INPUT_NOT_FOUND');
    this.name = 'InputNotFoundError';
    this.input = input;
    this.availableInputs = availableInputs;
  }

  override toUserMessage(): string {
    let message = `Input Not Found: "${this.input}". Input names are case-sensitive.`;

    if (this.availableInputs && this.availableInputs.length > 0) {
      const suggestions = this.availableInputs.slice(0, 5).join(', ');
      message += ` Available inputs: ${suggestions}${this.availableInputs.length > 5 ? '...' : ''}.`;
    } else {
      message += ' Use vmix://inputs resource to see available inputs.';
    }

    return message;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      input: this.input,
      availableInputs: this.availableInputs,
    };
  }
}
