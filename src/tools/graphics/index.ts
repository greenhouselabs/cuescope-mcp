/**
 * Graphics/Title tools domain
 * Tools for controlling title and GT input content
 */

import type { AnyToolDefinition } from '../base.js';

export { setTextTool } from './set-text.js';
export { setImageTool } from './set-image.js';
export { countdownTool } from './countdown.js';
export { animationTool } from './animation.js';
export { titlePresetTool, titlePresetNextTool, titlePresetPrevTool } from './preset.js';
export { textColorTool, textVisibleTool } from './text-style.js';
export { tickerSpeedTool } from './ticker.js';

import { setTextTool } from './set-text.js';
import { setImageTool } from './set-image.js';
import { countdownTool } from './countdown.js';
import { animationTool } from './animation.js';
import { titlePresetTool, titlePresetNextTool, titlePresetPrevTool } from './preset.js';
import { textColorTool, textVisibleTool } from './text-style.js';
import { tickerSpeedTool } from './ticker.js';

/**
 * All graphics/title tools
 */
export const graphicsTools: AnyToolDefinition[] = [
  setTextTool,
  setImageTool,
  countdownTool,
  animationTool,
  titlePresetTool,
  titlePresetNextTool,
  titlePresetPrevTool,
  textColorTool,
  textVisibleTool,
  tickerSpeedTool,
];
