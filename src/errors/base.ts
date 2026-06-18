/**
 * Base error class for all vMix-related errors
 */

export type VmixErrorCode =
  | 'CONNECTION_ERROR'
  | 'COMMAND_ERROR'
  | 'INPUT_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SCRIPT_ERROR'
  | 'TIMEOUT_ERROR'
  | 'STATE_PARSE_ERROR'
  | 'PRESET_TOO_LARGE'
  | 'PRESET_INPUT_MISSING'
  | 'PRESET_ROOT_INVALID'
  | 'PRESET_OUTSIDE_ROOT'
  | 'PRESET_BAD_EXTENSION'
  | 'PRESET_NOT_FOUND'
  | 'PRESET_PARSE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Base error class for CueScope's vMix integration
 * All custom errors extend this class
 */
export class VmixError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: VmixErrorCode;

  /**
   * Timestamp when the error occurred
   */
  public readonly timestamp: Date;

  constructor(message: string, code: VmixErrorCode = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'VmixError';
    this.code = code;
    this.timestamp = new Date();

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to a user-friendly message for MCP tool responses
   */
  toUserMessage(): string {
    return this.message;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
