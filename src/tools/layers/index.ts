/**
 * Layer tools domain
 * Tools for controlling input layers (compositing multiple sources)
 */

import type { AnyToolDefinition } from '../base.js';

export { layerOnTool, layerOffTool, layerToggleTool } from './visibility.js';
export {
  layerSetTool,
  layerPositionTool,
  layerSizeTool,
  layerCropTool,
} from './properties.js';

import { layerOnTool, layerOffTool, layerToggleTool } from './visibility.js';
import {
  layerSetTool,
  layerPositionTool,
  layerSizeTool,
  layerCropTool,
} from './properties.js';

/**
 * All layer tools
 */
export const layerTools: AnyToolDefinition[] = [
  layerOnTool,
  layerOffTool,
  layerToggleTool,
  layerSetTool,
  layerPositionTool,
  layerSizeTool,
  layerCropTool,
];
