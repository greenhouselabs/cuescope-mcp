/**
 * Input tools domain
 * Tools for playback control, adding, removing, and managing inputs
 */

import type { AnyToolDefinition } from '../base.js';

export { playbackTool } from './playback.js';
export { addInputTool } from './add.js';
export { removeInputTool } from './remove.js';
export { renameInputTool } from './rename.js';
export { moveInputTool } from './move.js';
export { resetInputTool } from './reset.js';
export { inputPropertiesTool } from './properties.js';

import { playbackTool } from './playback.js';
import { addInputTool } from './add.js';
import { removeInputTool } from './remove.js';
import { renameInputTool } from './rename.js';
import { moveInputTool } from './move.js';
import { resetInputTool } from './reset.js';
import { inputPropertiesTool } from './properties.js';

/**
 * All input tools
 */
export const inputTools: AnyToolDefinition[] = [
  playbackTool,
  addInputTool,
  removeInputTool,
  renameInputTool,
  moveInputTool,
  resetInputTool,
  inputPropertiesTool,
];
