/**
 * Effects tools domain
 * Tools for controlling input effects
 */

import type { AnyToolDefinition } from '../base.js';

export {
  effectToggleTool,
  effectOnTool,
  effectOffTool,
  effectStrengthTool,
} from './controls.js';

import {
  effectToggleTool,
  effectOnTool,
  effectOffTool,
  effectStrengthTool,
} from './controls.js';

/**
 * All effects tools
 */
export const effectsTools: AnyToolDefinition[] = [
  effectToggleTool,
  effectOnTool,
  effectOffTool,
  effectStrengthTool,
];
