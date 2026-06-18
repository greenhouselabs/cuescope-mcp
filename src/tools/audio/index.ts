/**
 * Audio tools domain
 * Tools for controlling audio levels, muting, and bus routing
 */

import type { AnyToolDefinition } from '../base.js';

export { volumeTool } from './volume.js';
export { muteTool } from './mute.js';
export { busTool } from './bus.js';

import { volumeTool } from './volume.js';
import { muteTool } from './mute.js';
import { busTool } from './bus.js';

/**
 * All audio tools
 */
export const audioTools: AnyToolDefinition[] = [volumeTool, muteTool, busTool];
