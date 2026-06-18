/**
 * Recording tools domain
 * Tools for controlling recording, streaming, and snapshots
 */

import type { AnyToolDefinition } from '../base.js';

export { recordTool } from './record.js';
export { streamTool } from './stream.js';
export { snapshotTool } from './snapshot.js';

import { recordTool } from './record.js';
import { streamTool } from './stream.js';
import { snapshotTool } from './snapshot.js';

/**
 * All recording tools
 */
export const recordingTools: AnyToolDefinition[] = [recordTool, streamTool, snapshotTool];
