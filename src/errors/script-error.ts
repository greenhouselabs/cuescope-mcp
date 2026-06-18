/**
 * Error thrown when VB.NET script validation or execution fails
 */

import { VmixError } from './base.js';

/**
 * Script error - thrown when VB.NET script validation or execution fails
 */
export class ScriptError extends VmixError {
  public readonly errors: string[];
  public readonly warnings: string[];
  public readonly script?: string;

  constructor(message: string, errors: string[], warnings: string[] = [], script?: string) {
    super(message, 'SCRIPT_ERROR');
    this.name = 'ScriptError';
    this.errors = errors;
    this.warnings = warnings;
    this.script = script;
  }

  /**
   * Create from validation result
   */
  static fromValidation(
    errors: string[],
    warnings: string[],
    script?: string
  ): ScriptError {
    const message =
      errors.length > 0
        ? `Script validation failed: ${errors[0]}`
        : 'Script validation failed';
    return new ScriptError(message, errors, warnings, script);
  }

  override toUserMessage(): string {
    let message = 'Script Validation Failed:\n';

    if (this.errors.length > 0) {
      message += 'Errors:\n';
      message += this.errors.map((e) => `  ❌ ${e}`).join('\n');
    }

    if (this.warnings.length > 0) {
      message += '\nWarnings:\n';
      message += this.warnings.map((w) => `  ⚠️ ${w}`).join('\n');
    }

    message += '\n\nScript was NOT executed. Fix the errors and try again.';

    return message;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      errors: this.errors,
      warnings: this.warnings,
      scriptLength: this.script?.length,
    };
  }
}
