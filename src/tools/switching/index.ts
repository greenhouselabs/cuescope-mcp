/**
 * Switching tools domain
 * Tools for transitioning between inputs
 */

import type { AnyToolDefinition } from '../base.js';

export { cutTool } from './cut.js';
export { fadeTool } from './fade.js';
export { transitionTool } from './transition.js';
export { stingerTool } from './stinger.js';
export { previewTool } from './preview.js';
export { ftbTool } from './ftb.js';

import { cutTool } from './cut.js';
import { fadeTool } from './fade.js';
import { transitionTool } from './transition.js';
import { stingerTool } from './stinger.js';
import { previewTool } from './preview.js';
import { ftbTool } from './ftb.js';

/**
 * All switching tools
 */
export const switchingTools: AnyToolDefinition[] = [
  cutTool,
  fadeTool,
  transitionTool,
  stingerTool,
  previewTool,
  ftbTool,
];
