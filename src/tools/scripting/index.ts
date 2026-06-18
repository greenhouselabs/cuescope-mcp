/**
 * Scripting tools domain
 * Tools for running, generating, and controlling vMix VB.NET scripts
 */

import type { AnyToolDefinition } from '../base.js';

export { runScriptTool } from './run.js';
export { runScriptFileTool } from './run-file.js';
export { stopScriptTool } from './stop.js';
export { generateTool } from './generate.js';
export { templateTool } from './template.js';
export { saveScriptTool } from './save.js';

import { runScriptTool } from './run.js';
import { runScriptFileTool } from './run-file.js';
import { stopScriptTool } from './stop.js';
import { generateTool } from './generate.js';
import { templateTool } from './template.js';
import { saveScriptTool } from './save.js';

/**
 * All scripting tools
 */
export const scriptingTools: AnyToolDefinition[] = [
  runScriptTool,
  runScriptFileTool,
  stopScriptTool,
  generateTool,
  templateTool,
  saveScriptTool,
];
