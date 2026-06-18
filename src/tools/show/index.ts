/**
 * Show Building Tools
 * Tools for creating complete production setups from templates
 */

import { showTemplateListTool } from './template-list.js';
import { showTemplateDetailsTool } from './template-details.js';
import { showBuildTool } from './build.js';
import { showValidateTool } from './validate.js';
import { participantAddTool } from './participant.js';
import { multiviewCreateTool } from './multiview.js';

export const showTools = [
  showTemplateListTool,
  showTemplateDetailsTool,
  showBuildTool,
  showValidateTool,
  participantAddTool,
  multiviewCreateTool,
];

export {
  showTemplateListTool,
  showTemplateDetailsTool,
  showBuildTool,
  showValidateTool,
  participantAddTool,
  multiviewCreateTool,
};

// Re-export types
export type { ShowConfig, ShowTemplate, ParticipantConfig, ShowOptions } from './templates.js';
