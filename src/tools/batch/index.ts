/**
 * Batch tools domain
 * Tools for executing multiple vMix commands at once
 */

import type { AnyToolDefinition } from '../base.js';

export { batchTool } from './execute.js';

import { batchTool } from './execute.js';

/**
 * All batch tools
 */
export const batchTools: AnyToolDefinition[] = [batchTool];
