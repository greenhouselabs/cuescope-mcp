/**
 * Overlay tools domain
 * Tools for controlling overlay channels 1-4
 */

import type { AnyToolDefinition } from '../base.js';

export { overlayInTool } from './overlay-in.js';
export { overlayOutTool } from './overlay-out.js';
export { overlayOffTool } from './overlay-off.js';

import { overlayInTool } from './overlay-in.js';
import { overlayOutTool } from './overlay-out.js';
import { overlayOffTool } from './overlay-off.js';

/**
 * All overlay tools
 */
export const overlayTools: AnyToolDefinition[] = [overlayInTool, overlayOutTool, overlayOffTool];
