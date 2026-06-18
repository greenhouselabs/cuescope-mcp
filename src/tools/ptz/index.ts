/**
 * PTZ tools domain
 * Tools for controlling PTZ (Pan-Tilt-Zoom) cameras
 */

import type { AnyToolDefinition } from '../base.js';

export {
  ptzMoveTool,
  ptzStopTool,
  ptzHomeTool,
  ptzZoomTool,
  ptzZoomStopTool,
} from './movement.js';

export {
  ptzFocusTool,
  ptzFocusStopTool,
  ptzFocusAutoTool,
} from './focus.js';

export {
  ptzVirtualCreateTool,
  ptzVirtualUpdateTool,
} from './virtual.js';

import {
  ptzMoveTool,
  ptzStopTool,
  ptzHomeTool,
  ptzZoomTool,
  ptzZoomStopTool,
} from './movement.js';

import {
  ptzFocusTool,
  ptzFocusStopTool,
  ptzFocusAutoTool,
} from './focus.js';

import {
  ptzVirtualCreateTool,
  ptzVirtualUpdateTool,
} from './virtual.js';

/**
 * All PTZ tools
 */
export const ptzTools: AnyToolDefinition[] = [
  ptzMoveTool,
  ptzStopTool,
  ptzHomeTool,
  ptzZoomTool,
  ptzZoomStopTool,
  ptzFocusTool,
  ptzFocusStopTool,
  ptzFocusAutoTool,
  ptzVirtualCreateTool,
  ptzVirtualUpdateTool,
];
