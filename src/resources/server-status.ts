/**
 * vmix://server/status - Server mode and safety status
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';
import { getToolStats, getToolsForMode } from '../tools/index.js';
import { getResourceCount } from './stats.js';
import { getPromptCount } from '../prompts/index.js';
import {
  getServerModeInfo,
  SERVER_BUILD_MARKER,
  SERVER_PACKAGE_NAME,
  SERVER_PRODUCT_NAME,
  SERVER_RUNTIME_NAME,
  SERVER_VERSION,
} from '../version.js';
import { getRuntimeBuildCheck } from '../utils/runtime-build-check.js';

export const serverStatusResource = createResource({
  name: 'Server Status',
  uri: 'vmix://server/status',
  description:
    'Server mode and safety status - shows whether Review, Control, or High-Impact Control is active.',
  mimeType: 'application/json',
  handler: (ctx: ResourceContext) => {
    const operatorMode = ctx.config.VMIX_CONTROL_MODE;
    const dangerousMode = ctx.config.VMIX_HIGH_IMPACT;
    const toolStats = getToolStats();
    const activeTools = getToolsForMode(operatorMode, dangerousMode);
    const reviewTools = getToolsForMode(false, false);
    const runtimeBuildCheck = getRuntimeBuildCheck();
    const modeInfo = getServerModeInfo(operatorMode, dangerousMode);

    return Promise.resolve({
      contents: [
        jsonContent('vmix://server/status', {
          server: {
            name: SERVER_RUNTIME_NAME,
            productName: SERVER_PRODUCT_NAME,
            packageName: SERVER_PACKAGE_NAME,
            version: SERVER_VERSION,
            buildMarker: SERVER_BUILD_MARKER,
            runtimeHealth: runtimeBuildCheck.health,
            buildRecommended: runtimeBuildCheck.recommendations.buildRecommended,
            restartRecommended: runtimeBuildCheck.recommendations.restartRecommended,
            versionResource: 'vmix://server/version',
          },
          mode: modeInfo.mode,
          modeLabel: modeInfo.label,
          modeSummary: modeInfo.summary,
          controlMode: operatorMode,
          highImpactMode: dangerousMode,
          safety: {
            defaultMode: 'review',
            defaultModeLabel: 'Review Mode',
            mutatesVmixByDefault: false,
            controlToolsRequireOptIn: true,
            highImpactToolsRequireSecondOptIn: true,
            rawHttpBypassAllowedInReviewMode: false,
            scriptGenerationExecutes: false,
            scriptExecutionToolsActive: operatorMode && dangerousMode,
            controlModeFlag: 'VMIX_CONTROL_MODE=true',
            highImpactModeFlag: 'VMIX_HIGH_IMPACT=true',
            modeSwitchRequiresRestart: true,
            reviewModeGuidance:
              'In Review Mode, refuse mutating control requests. Do not provide or echo raw vMix HTTP URLs, curl/shell commands, or shortcut-function strings as bypasses, even as negative examples. Offer read-only checks, reviewable artifacts, or instructions to restart the MCP with the proper opt-in flags.',
            reviewModeRefusalPolicy: {
              appliesTo: [
                'recording',
                'streaming',
                'snapshots',
                'scripts',
                'batch',
                'presets',
                'input-management',
                'outputs',
                'show-building',
                'replay-recording',
              ],
              prohibitedSuggestions: [
                'raw vMix HTTP URLs for mutating shortcut functions',
                'curl, Invoke-WebRequest, shell-bang, or direct localhost command examples for mutating actions',
                'instructions to bypass MCP mode gates from inside the assistant session',
                'printing the literal bypass URL or command in a refusal, even when telling the user not to use it',
              ],
              allowedAlternatives: [
                'read current state resources',
                'run Review Mode analysis and diagnostics',
                'generate reviewable scripts or API plans without executing them',
                'explain the required MCP opt-in flags and restart boundary',
              ],
            },
            modeSetup: {
              review: {
                label: 'Review Mode',
                description: 'Default read-only mode. No optional env vars are required.',
                env: {},
                restartRequired: true,
              },
              control: {
                label: 'Control Mode',
                description:
                  'Enables safer live-control tools. High-impact tools remain hidden.',
                env: {
                  VMIX_CONTROL_MODE: 'true',
                },
                restartRequired: true,
              },
              highImpactControl: {
                label: 'High-Impact Control',
                description:
                  'Enables scripts, batch, recording, streaming, presets, output routing, destructive input actions, show-building, and replay recording.',
                env: {
                  VMIX_CONTROL_MODE: 'true',
                  VMIX_HIGH_IMPACT: 'true',
                },
                restartRequired: true,
              },
            },
            executionBoundary: {
              reviewMode: {
                canExecuteScripts: false,
                canCallVmixFunctions: false,
                rawHttpBypassAllowed: false,
                blockedFunctions: [
                  'ScriptStart',
                  'ScriptStartDynamic',
                  'ScriptStop',
                  'ScriptStopAll',
                  'vMix HTTP function execution',
                ],
                outputType: 'reviewable-artifacts-and-analysis',
              },
              controlMode: {
                canExecuteScripts: dangerousMode,
                canCallVmixFunctions: true,
                requiresExplicitOptIn: true,
                highImpactToolsActive: dangerousMode,
              },
              highImpactControlTools: {
                active: operatorMode && dangerousMode,
                categories: [
                  'recording',
                  'streaming',
                  'snapshots',
                  'scripts',
                  'batch',
                  'presets',
                  'input-management',
                  'outputs',
                  'show-building',
                  'replay-recording',
                ],
              },
              scriptExecutionTools: [
                'vmix_script_run',
                'vmix_script_run_file',
                'vmix_script_stop',
                'vmix_script_generate',
              ],
            },
          },
          tools: {
            active: activeTools.length,
            activeNames: activeTools.map((tool) => tool.name),
            review: toolStats.brain,
            reviewNames: reviewTools.map((tool) => tool.name),
            controlAvailable: toolStats.operator,
            controlSafeAvailable: toolStats.operatorSafe,
            highImpactAvailable: toolStats.operatorDangerous,
            totalKnown: toolStats.total,
          },
          resources: {
            active: getResourceCount(),
          },
          prompts: {
            active: getPromptCount(),
          },
          vmix: {
            host: ctx.config.VMIX_HOST,
            httpPort: ctx.config.VMIX_HTTP_PORT,
            tcpEnabled: ctx.config.TCP_ENABLED,
          },
        }),
      ],
    });
  },
});
