/**
 * Video Call tools domain
 * Tools for controlling vMix Call inputs
 */

import type { AnyToolDefinition } from '../base.js';

export { callAudioSourceTool, callVideoSourceTool } from './routing.js';

import { callAudioSourceTool, callVideoSourceTool } from './routing.js';

/**
 * All video call tools
 */
export const videocallTools: AnyToolDefinition[] = [
  callAudioSourceTool,
  callVideoSourceTool,
];
