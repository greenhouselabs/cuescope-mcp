/**
 * Browser tools domain
 * Tools for controlling browser inputs
 */

import type { AnyToolDefinition } from '../base.js';

export {
  browserNavigateTool,
  browserReloadTool,
  browserBackTool,
  browserForwardTool,
  browserKeyboardTool,
  browserMouseTool,
} from './controls.js';

import {
  browserNavigateTool,
  browserReloadTool,
  browserBackTool,
  browserForwardTool,
  browserKeyboardTool,
  browserMouseTool,
} from './controls.js';

/**
 * All browser tools
 */
export const browserTools: AnyToolDefinition[] = [
  browserNavigateTool,
  browserReloadTool,
  browserBackTool,
  browserForwardTool,
  browserKeyboardTool,
  browserMouseTool,
];
