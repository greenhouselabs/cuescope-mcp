/**
 * Output tools domain
 * Tools for controlling vMix outputs and routing
 */

import type { AnyToolDefinition } from '../base.js';

export {
  outputSetTool,
  outputFullscreenTool,
  outputExternalTool,
} from './routing.js';

import {
  outputSetTool,
  outputFullscreenTool,
  outputExternalTool,
} from './routing.js';

/**
 * All output tools
 */
export const outputTools: AnyToolDefinition[] = [
  outputSetTool,
  outputFullscreenTool,
  outputExternalTool,
];
