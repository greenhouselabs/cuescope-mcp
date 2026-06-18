/**
 * DataSource tools domain
 * Tools for controlling data-driven titles and graphics
 */

import type { AnyToolDefinition } from '../base.js';

export {
  dataNextTool,
  dataPreviousTool,
  dataSelectTool,
  dataAutoNextTool,
  dataPlayPauseTool,
} from './controls.js';

import {
  dataNextTool,
  dataPreviousTool,
  dataSelectTool,
  dataAutoNextTool,
  dataPlayPauseTool,
} from './controls.js';

/**
 * All data source tools
 */
export const datasourceTools: AnyToolDefinition[] = [
  dataNextTool,
  dataPreviousTool,
  dataSelectTool,
  dataAutoNextTool,
  dataPlayPauseTool,
];
