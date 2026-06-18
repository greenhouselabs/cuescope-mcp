/**
 * NDI tools domain
 * Tools for controlling NDI (Network Device Interface) inputs
 */

import type { AnyToolDefinition } from '../base.js';

export {
  ndiSelectSourceTool,
  ndiSelectIndexTool,
  ndiCommandTool,
  ndiRecordingTool,
} from './controls.js';

import {
  ndiSelectSourceTool,
  ndiSelectIndexTool,
  ndiCommandTool,
  ndiRecordingTool,
} from './controls.js';

/**
 * All NDI tools
 */
export const ndiTools: AnyToolDefinition[] = [
  ndiSelectSourceTool,
  ndiSelectIndexTool,
  ndiCommandTool,
  ndiRecordingTool,
];
