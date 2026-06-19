/**
 * vmix_connection_test - Read-only connectivity diagnostic.
 *
 * Onboarding helper: checks the vMix HTTP API, classifies failures with
 * actionable hints (Web Controller settings, firewall, timeouts), and reports
 * the optional TCP tally status plus the active server mode. Never mutates
 * vMix and never reports secrets.
 */

import { z } from 'zod';
import { createTool, toolJsonContent, errorResult, type ToolContext } from '../base.js';
import { getServerModeInfo } from '../../version.js';
import {
  ConnectionError,
  TimeoutError,
  CommandError,
  isVmixError,
  formatErrorMessage,
} from '../../errors/index.js';

interface HttpCheckFailure {
  ok: false;
  errorType: string;
  message: string;
  hints: string[];
}

interface HttpCheckSuccess {
  ok: true;
  vmixVersion: string | null;
  vmixEdition: string | null;
  inputCount: number;
}

function classifyHttpError(error: unknown): HttpCheckFailure {
  if (error instanceof TimeoutError) {
    return {
      ok: false,
      errorType: 'timeout',
      message: formatErrorMessage(error),
      hints: [
        `The request timed out after ${error.timeoutMs}ms.`,
        'Check that VMIX_HOST points at the machine actually running vMix.',
        'If vMix runs on another machine, allow inbound TCP on the Web Controller port through Windows Firewall (trusted network only).',
        'vMix may also be busy; try again in a few seconds.',
      ],
    };
  }

  if (error instanceof ConnectionError) {
    const refused = /ECONNREFUSED/i.test(error.message);
    const notFound = /ENOTFOUND|EAI_AGAIN/i.test(error.message);
    const hints: string[] = [];
    if (refused) {
      hints.push(
        'Connection refused: is vMix running? The Web Controller only responds while vMix is open.',
        'Is the Web Controller enabled? In vMix open Settings > Web Controller and tick Enabled (default port 8088).',
        'Confirm VMIX_HTTP_PORT matches the Web Controller port shown in vMix settings.'
      );
    } else if (notFound) {
      hints.push(
        'The host name could not be resolved; check VMIX_HOST for typos.',
        'Use an IP address if DNS is unreliable on your production network.'
      );
    } else {
      hints.push(
        'Check that vMix is running and the Web Controller is enabled (Settings > Web Controller).',
        'Verify VMIX_HOST and VMIX_HTTP_PORT, and any firewall between this machine and vMix.'
      );
    }
    hints.push(
      'Verify from a browser on the vMix machine: the Web Controller /api endpoint should return XML.'
    );
    return {
      ok: false,
      errorType: refused ? 'connection_refused' : 'connection_error',
      message: formatErrorMessage(error),
      hints,
    };
  }

  if (error instanceof CommandError && error.statusCode !== undefined) {
    return {
      ok: false,
      errorType: 'http_error',
      message: formatErrorMessage(error),
      hints: [
        `vMix answered with HTTP ${error.statusCode}, so the host and port are reachable.`,
        'Confirm the port really is the vMix Web Controller and not another web service.',
        'Restart the vMix Web Controller (Settings > Web Controller) if the error persists.',
      ],
    };
  }

  return {
    ok: false,
    errorType: isVmixError(error) ? error.code.toLowerCase() : 'unknown',
    message: formatErrorMessage(error),
    hints: [
      'Unexpected failure while reading vMix state; check the server logs (stderr) for details.',
    ],
  };
}

const schema = z.object({});

export const connectionTestTool = createTool({
  name: 'vmix_connection_test',
  description:
    'Test connectivity to vMix and diagnose connection problems: checks the HTTP API ' +
    '(reporting vMix version, edition, and input count on success, or classified hints on failure), ' +
    'reports the optional TCP tally status, and shows the configured host/port and active mode. ' +
    'Read-only — never mutates vMix.',
  schema,
  handler: async (_params: Record<string, never>, ctx: ToolContext) => {
    try {
      const config = {
        host: ctx.config.VMIX_HOST,
        httpPort: ctx.config.VMIX_HTTP_PORT,
        tcpPort: ctx.config.VMIX_TCP_PORT,
        tcpEnabled: ctx.config.TCP_ENABLED,
      };

      // --- HTTP check: read state via the cache (one GET against /api) ---
      let httpCheck: HttpCheckSuccess | HttpCheckFailure;
      try {
        const state = await ctx.state.getState();
        httpCheck = {
          ok: true,
          vmixVersion: state.version || null,
          vmixEdition: state.edition || null,
          inputCount: state.inputs.length,
        };
      } catch (error) {
        httpCheck = classifyHttpError(error);
      }

      // --- TCP tally check (optional subsystem; null when disabled) ---
      const tcp = ctx.vmix.tcp;
      const tcpCheck = tcp
        ? {
            enabled: true,
            status: tcp.status,
            connected: tcp.connected,
            lastTallyAgeMs:
              tcp.lastTallyAt !== null ? Math.max(0, Date.now() - tcp.lastTallyAt) : null,
            tallyStale: tcp.tallyStale,
            note:
              tcp.lastTallyAt === null
                ? 'No tally frame received yet. TCP tally is optional; HTTP tools work without it.'
                : undefined,
          }
        : {
            enabled: false,
            note: 'TCP is disabled (TCP_ENABLED=false). Tally over vmix://tally is unavailable; everything else uses HTTP.',
          };

      const modeInfo = getServerModeInfo(
        ctx.config.VMIX_CONTROL_MODE,
        ctx.config.VMIX_HIGH_IMPACT
      );

      return toolJsonContent({
        ok: httpCheck.ok,
        configured: config,
        http: httpCheck,
        tcpTally: tcpCheck,
        mode: modeInfo.mode,
        modeLabel: modeInfo.label,
        currentInputQuestionGuidance: httpCheck.ok
          ? 'vMix live state is available. Use vmix_inspect_input first for current input questions. For saved-only preset evidence, prefer an absolute .vmix path on the CueScope server host; chat attachments may not be server-readable.'
          : 'vMix live state is unavailable. Fix or confirm connectivity before asking for a saved .vmix file, unless the user specifically wants last-saved preset evidence or saved-only scripts, triggers, data sources, or drift checks. For those saved-only checks, prefer an absolute .vmix path on the CueScope server host; raw XML content is a fallback.',
        note: 'Read-only connectivity diagnostic. No vMix state was mutated and no secrets are reported.',
      });
    } catch (error) {
      return errorResult(formatErrorMessage(error));
    }
  },
});
