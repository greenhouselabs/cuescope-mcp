/**
 * vmix://copilot/context - Intelligent vMix Setup Analysis
 *
 * Provides Claude with contextual guidance about the current vMix setup:
 * - Categorized inputs (cameras, graphics, audio, etc.)
 * - Recommended workflows based on available inputs
 * - Suggestions for next actions
 * - Warnings about common issues
 *
 * This resource is the "intelligence layer" that helps Claude make
 * smart decisions about how to use vMix tools.
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import type { VmixInput } from '../state/types.js';

/**
 * Input categories for analysis
 */
interface CategorizedInputs {
  cameras: string[];
  graphics: string[];
  audio: string[];
  videos: string[];
  images: string[];
  ndi: string[];
  calls: string[];
  browsers: string[];
  other: string[];
}

/**
 * Categorize an input by its type
 */
function categorizeInput(input: VmixInput): keyof CategorizedInputs {
  const type = input.type.toLowerCase();

  // Camera types
  if (type.includes('capture') || type.includes('camera') || type.includes('webcam')) {
    return 'cameras';
  }

  // NDI
  if (type.includes('ndi')) {
    return 'ndi';
  }

  // Graphics/titles
  if (type === 'gt' || type === 'title' || type === 'xaml' || type.includes('title')) {
    return 'graphics';
  }

  // Audio
  if (type === 'audio' || type === 'audiofile' || type.includes('audio')) {
    return 'audio';
  }

  // Video
  if (type === 'video' || type === 'videolist' || type.includes('video')) {
    return 'videos';
  }

  // Images
  if (type === 'image' || type === 'photos' || type.includes('image')) {
    return 'images';
  }

  // vMix Call
  if (type === 'vmixcall' || type.includes('call')) {
    return 'calls';
  }

  // Browser
  if (type === 'browser' || type.includes('browser')) {
    return 'browsers';
  }

  return 'other';
}

/**
 * Determine recommended workflows based on available inputs
 */
function getRecommendedWorkflows(categorized: CategorizedInputs): string[] {
  const workflows: string[] = [];
  const cameraCount = categorized.cameras.length + categorized.ndi.length + categorized.calls.length;

  // Podcast workflows
  if (cameraCount >= 4) {
    workflows.push('four-person-podcast');
  }
  if (cameraCount >= 2) {
    workflows.push('two-person-interview');
    workflows.push('side-by-side-comparison');
  }
  if (cameraCount >= 1) {
    workflows.push('single-camera-presentation');
  }

  // Multiview layouts
  if (cameraCount === 4) {
    workflows.push('quad-multiview');
  }
  if (cameraCount >= 2) {
    workflows.push('picture-in-picture');
  }

  // Streaming workflows
  if (categorized.graphics.length > 0) {
    workflows.push('lower-third-graphics');
  }
  if (categorized.videos.length > 0) {
    workflows.push('video-playback');
  }
  if (categorized.audio.length > 0) {
    workflows.push('background-music-with-ducking');
  }

  return workflows;
}

/**
 * Generate contextual suggestions based on setup
 */
function getSuggestions(
  categorized: CategorizedInputs,
  state: { active: number; preview: number },
  operatorMode: boolean
): string[] {
  const suggestions: string[] = [];
  const cameraCount = categorized.cameras.length + categorized.ndi.length + categorized.calls.length;

  // Camera suggestions
  if (cameraCount === 0) {
    suggestions.push(
      operatorMode
        ? 'No cameras detected. Add a camera input with vmix_input_add (type: Capture or NDI)'
        : 'No camera or NDI sources detected in the current preset.'
    );
  } else if (cameraCount >= 2 && cameraCount <= 4) {
    suggestions.push(
      operatorMode
        ? `You have ${cameraCount} camera sources - consider creating a multiview with vmix_multiview_create`
        : `You have ${cameraCount} camera sources - run vmix_analyze_preset for a full production map.`
    );
  }

  // Graphics suggestions
  if (categorized.graphics.length > 0) {
    const graphicNames = categorized.graphics.slice(0, 2).join(', ');
    suggestions.push(
      operatorMode
        ? `Graphics available (${graphicNames}) - use vmix_title_set_text to update text fields`
        : `Graphics available (${graphicNames}) - inspect their fields via vmix_explain_input or vmix://inputs/fields.`
    );
  } else {
    suggestions.push(
      operatorMode
        ? 'No graphics loaded. Add a lower third with vmix_input_add (type: GT, path: your-template.gtzip)'
        : 'No title graphics detected in the current preset.'
    );
  }

  // Audio suggestions
  if (categorized.audio.length > 0) {
    suggestions.push(
      operatorMode
        ? 'Audio inputs available - use vmix_audio_bus to route to buses M, A, B, etc.'
        : 'Audio inputs available - review routing and mix-minus risks with vmix_diagnose_audio.'
    );
  }

  // vMix Call suggestions
  if (categorized.calls.length > 0) {
    suggestions.push(
      operatorMode
        ? 'vMix Call inputs ready - guests can connect. Use vmix_call_video_source to configure video routing.'
        : 'vMix Call inputs present - review return/mix-minus routing with vmix_diagnose_audio.'
    );
  }

  // State-based suggestions (0 means no active input)
  if (state.active === 0) {
    suggestions.push(
      operatorMode
        ? 'No input is currently on Program - use vmix_cut or vmix_fade to go live'
        : 'No input is currently on Program.'
    );
  }

  return suggestions;
}

/**
 * Tool hints, gated by mode. In Review Mode the live-control tools do not exist,
 * so recommending them would be misleading; point at read-only Review tooling.
 */
function getToolHints(operatorMode: boolean): Record<string, string> {
  if (operatorMode) {
    return {
      switching: 'Use vmix_cut (instant) or vmix_fade (smooth) to change program',
      graphics: 'Use vmix_title_set_text with input name and field name (e.g., "Name.Text")',
      multiview: 'Use vmix_multiview_create with layout: "quad", "side-by-side", or "pip-corner"',
      audio: 'Use vmix_audio_bus to route audio, vmix_audio_mute to mute/unmute',
      overlays: 'Use vmix_overlay_in to show graphics on channels 1-4',
    };
  }

  return {
    analysis: 'Use vmix_analyze_preset for a full production map of the current preset.',
    audio: 'Use vmix_diagnose_audio to check routing, mutes, and mix-minus risks.',
    scripts:
      'Use vmix_generate_script or vmix_generate_api_sequence for reviewable (non-executed) automation artifacts.',
    inputs: 'Use vmix_explain_input, or read vmix://state/live and vmix://inputs/fields, to inspect inputs.',
    controlMode:
      'Live control requires restarting the MCP with VMIX_CONTROL_MODE=true; see vmix://server/status.',
  };
}

/**
 * Generate warnings about potential issues
 */
function getWarnings(categorized: CategorizedInputs, inputs: VmixInput[]): string[] {
  const warnings: string[] = [];

  // Check for placeholder inputs (black colour inputs often indicate failed NDI)
  const colourInputs = inputs.filter(i => i.type.toLowerCase() === 'colour');
  const namedPlaceholders = colourInputs.filter(i =>
    i.title.toLowerCase().includes('camera') ||
    i.title.toLowerCase().includes('placeholder')
  );
  if (namedPlaceholders.length > 0) {
    warnings.push(`${namedPlaceholders.length} placeholder input(s) detected - may need manual NDI reconnection`);
  }

  // Check for audio muting
  const mutedInputs = inputs.filter(i => i.muted);
  if (mutedInputs.length > 0) {
    warnings.push(`${mutedInputs.length} input(s) are muted - check audio routing`);
  }

  // Check for missing audio buses (audioBuses is a string like "M,A,B")
  const inputsWithoutBuses = inputs.filter(i =>
    !i.audioBuses || i.audioBuses.trim() === ''
  );
  if (inputsWithoutBuses.length > 0 && categorized.audio.length === 0) {
    warnings.push('Some inputs may not be routed to any audio bus');
  }

  return warnings;
}

/**
 * Copilot Context Resource
 */
export const copilotContextResource = createResource({
  name: 'vMix Copilot Context',
  uri: 'vmix://copilot/context',
  mimeType: 'application/json',
  description:
    'Intelligent vMix setup analysis with recommendations. ' +
    'Provides categorized inputs, suggested workflows, actionable suggestions, and warnings. ' +
    'Read this resource to understand what actions are most appropriate for the current setup.',
  handler: async (ctx: ResourceContext) => {
    const state = await ctx.state.getState();
    const operatorMode = ctx.config.VMIX_CONTROL_MODE;

    // Categorize all inputs
    const categorized: CategorizedInputs = {
      cameras: [],
      graphics: [],
      audio: [],
      videos: [],
      images: [],
      ndi: [],
      calls: [],
      browsers: [],
      other: [],
    };

    for (const input of state.inputs) {
      const category = categorizeInput(input);
      categorized[category].push(input.title);
    }

    // Generate recommendations
    const recommendedWorkflows = getRecommendedWorkflows(categorized);
    const suggestions = getSuggestions(
      categorized,
      {
        active: state.active,
        preview: state.preview,
      },
      operatorMode
    );
    const warnings = getWarnings(categorized, state.inputs);

    // Build response
    const context = {
      summary: {
        totalInputs: state.inputs.length,
        cameraCount: categorized.cameras.length + categorized.ndi.length + categorized.calls.length,
        graphicsCount: categorized.graphics.length,
        isLive: state.recording || state.streaming,
        hasActiveInput: state.active !== 0,
      },
      currentSetup: {
        cameras: categorized.cameras,
        ndiSources: categorized.ndi,
        vmixCalls: categorized.calls,
        graphics: categorized.graphics,
        audio: categorized.audio,
        videos: categorized.videos,
        images: categorized.images,
        browsers: categorized.browsers,
        other: categorized.other,
      },
      currentState: {
        active: state.active,
        preview: state.preview,
        recording: state.recording,
        streaming: state.streaming,
        fadeToBlack: state.fadeToBlack,
      },
      recommendedWorkflows,
      suggestions,
      warnings,
      toolHints: getToolHints(operatorMode),
    };

    return {
      contents: [jsonContent('vmix://copilot/context', context)],
    };
  },
});
