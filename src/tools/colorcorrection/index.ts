/**
 * Color correction tools domain
 * Tools for adjusting input colors
 */

import type { AnyToolDefinition } from '../base.js';

export {
  ccHueTool,
  ccSaturationTool,
  ccLiftTool,
  ccGammaTool,
  ccGainTool,
  ccAutoTool,
  ccResetTool,
} from './controls.js';

import {
  ccHueTool,
  ccSaturationTool,
  ccLiftTool,
  ccGammaTool,
  ccGainTool,
  ccAutoTool,
  ccResetTool,
} from './controls.js';

/**
 * All color correction tools
 */
export const colorCorrectionTools: AnyToolDefinition[] = [
  ccHueTool,
  ccSaturationTool,
  ccLiftTool,
  ccGammaTool,
  ccGainTool,
  ccAutoTool,
  ccResetTool,
];
