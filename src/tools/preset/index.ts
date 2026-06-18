/**
 * Preset tools domain
 * Tools for managing vMix preset files
 */

import type { AnyToolDefinition } from '../base.js';

export {
  presetOpenTool,
  presetSaveTool,
  presetLastTool,
} from './controls.js';

import {
  presetOpenTool,
  presetSaveTool,
  presetLastTool,
} from './controls.js';

/**
 * All preset tools
 */
export const presetTools: AnyToolDefinition[] = [
  presetOpenTool,
  presetSaveTool,
  presetLastTool,
];
