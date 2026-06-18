/**
 * Replay tools domain
 * Tools for instant replay functionality
 * Note: All replay features require vMix Pro edition
 */

import type { AnyToolDefinition } from '../base.js';

export {
  replayRecordTool,
  replayLiveTool,
  replayMarkInTool,
  replayMarkOutTool,
  replayMarkCancelTool,
} from './recording.js';

export {
  replayPlayTool,
  replayPauseTool,
  replaySpeedTool,
  replayJumpTool,
  replayPlayEventTool,
  replayPlayLastTool,
} from './playback.js';

export {
  replayCameraTool,
  replayChannelTool,
  replayToggleEventCameraTool,
} from './camera.js';

import {
  replayRecordTool,
  replayLiveTool,
  replayMarkInTool,
  replayMarkOutTool,
  replayMarkCancelTool,
} from './recording.js';

import {
  replayPlayTool,
  replayPauseTool,
  replaySpeedTool,
  replayJumpTool,
  replayPlayEventTool,
  replayPlayLastTool,
} from './playback.js';

import {
  replayCameraTool,
  replayChannelTool,
  replayToggleEventCameraTool,
} from './camera.js';

/**
 * All replay tools (requires vMix Pro edition)
 */
export const replayTools: AnyToolDefinition[] = [
  replayRecordTool,
  replayLiveTool,
  replayMarkInTool,
  replayMarkOutTool,
  replayMarkCancelTool,
  replayPlayTool,
  replayPauseTool,
  replaySpeedTool,
  replayJumpTool,
  replayPlayEventTool,
  replayPlayLastTool,
  replayCameraTool,
  replayChannelTool,
  replayToggleEventCameraTool,
];
