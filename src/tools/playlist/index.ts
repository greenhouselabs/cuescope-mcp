/**
 * Playlist tools domain
 * Tools for managing VideoList and Photos inputs
 */

import type { AnyToolDefinition } from '../base.js';

export {
  listAddTool,
  listRemoveTool,
  listClearTool,
  listShuffleTool,
  listNextTool,
  listPreviousTool,
  listSelectTool,
} from './controls.js';

import {
  listAddTool,
  listRemoveTool,
  listClearTool,
  listShuffleTool,
  listNextTool,
  listPreviousTool,
  listSelectTool,
} from './controls.js';

/**
 * All playlist tools
 */
export const playlistTools: AnyToolDefinition[] = [
  listAddTool,
  listRemoveTool,
  listClearTool,
  listShuffleTool,
  listNextTool,
  listPreviousTool,
  listSelectTool,
];
