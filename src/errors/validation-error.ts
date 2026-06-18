/**
 * Error thrown when input validation fails
 */

import { VmixError } from './base.js';

/**
 * Validation issue details
 */
export interface ValidationIssue {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation error - thrown when tool input validation fails
 */
export class ValidationError extends VmixError {
  public readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.issues = issues;
  }

  /**
   * Create from a single field validation failure
   */
  static fromField(field: string, message: string, value?: unknown): ValidationError {
    return new ValidationError(`Validation failed for ${field}: ${message}`, [
      { field, message, value },
    ]);
  }

  override toUserMessage(): string {
    const issueList = this.issues.map((i) => `  - ${i.field}: ${i.message}`).join('\n');
    return `Validation Error:\n${issueList}`;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }
}
