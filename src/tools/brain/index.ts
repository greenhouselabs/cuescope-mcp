/**
 * Review Mode tools
 * Read-only/advisory tools exposed by default.
 */

import type { AnyToolDefinition } from '../base.js';
import { analyzePresetTool } from './analyze-preset.js';
import { compareXmlSnapshotsTool } from './compare-xml-snapshots.js';
import { diagnoseAudioTool } from './diagnose-audio.js';
import { diagnoseLogsTool } from './diagnose-logs.js';
import { diagnoseOutputsTool } from './diagnose-outputs.js';
import { explainInputTool } from './explain-input.js';
import { findInputTool } from './find-input.js';
import { generateApiSequenceTool } from './generate-api-sequence.js';
import { generateScriptTool } from './generate-script.js';
import { generateShowChecklistTool } from './generate-show-checklist.js';
import { validateScriptTool } from './validate-script.js';
import { readPresetFileTool } from './read-preset-file.js';
import { explainPresetScriptsTool } from './explain-preset-scripts.js';
import { auditPresetFileTool } from './audit-preset-file.js';
import { preflightTool } from './preflight.js';
import { connectionTestTool } from './connection-test.js';
import { serverVersionTool } from './server-version.js';
import { showReviewTool } from './show-review.js';

export const brainToolDefinitions: AnyToolDefinition[] = [
  serverVersionTool,
  showReviewTool,
  analyzePresetTool,
  generateShowChecklistTool,
  findInputTool,
  explainInputTool,
  diagnoseAudioTool,
  diagnoseOutputsTool,
  generateScriptTool,
  validateScriptTool,
  generateApiSequenceTool,
  compareXmlSnapshotsTool,
  readPresetFileTool,
  explainPresetScriptsTool,
  auditPresetFileTool,
  preflightTool,
  diagnoseLogsTool,
  connectionTestTool,
];

export { analyzePresetTool } from './analyze-preset.js';
export { compareXmlSnapshotsTool } from './compare-xml-snapshots.js';
export { diagnoseAudioTool } from './diagnose-audio.js';
export { diagnoseLogsTool } from './diagnose-logs.js';
export { diagnoseOutputsTool } from './diagnose-outputs.js';
export { explainInputTool } from './explain-input.js';
export { findInputTool } from './find-input.js';
export { generateApiSequenceTool } from './generate-api-sequence.js';
export { generateScriptTool } from './generate-script.js';
export { generateShowChecklistTool } from './generate-show-checklist.js';
export { validateScriptTool } from './validate-script.js';
export { readPresetFileTool } from './read-preset-file.js';
export { explainPresetScriptsTool } from './explain-preset-scripts.js';
export { auditPresetFileTool } from './audit-preset-file.js';
export { preflightTool } from './preflight.js';
export { connectionTestTool } from './connection-test.js';
export { serverVersionTool } from './server-version.js';
export { showReviewTool } from './show-review.js';
