/**
 * vmix://tally - Real-time on-air tally from the vMix TCP subscription.
 *
 * Surfaces the most recent tally frame vMix pushed over the TCP API (port 8099):
 * which inputs are program (live) vs. preview. This complements vmix://state/*
 * (which reflects the HTTP cache) with the last pushed tally frame. Reports
 * unavailable when TCP is disabled or no frame has arrived yet, and flags the
 * frame as stale when the TCP connection has dropped since it was received.
 */

import { createResource, jsonContent, type ResourceContext } from './base.js';

type TallyState = 'off' | 'program' | 'preview' | 'unknown';

const STATE_BY_DIGIT: Record<string, TallyState> = {
  '0': 'off',
  '1': 'program',
  '2': 'preview',
};

const POLL_ONLY_NOTE =
  'Tally is poll-only: re-read this resource to refresh; MCP resource subscriptions are not supported yet.';

function decodeTally(raw: string): Array<{ input: number; state: TallyState }> {
  return [...raw].map((digit, index) => ({
    input: index + 1,
    state: STATE_BY_DIGIT[digit] ?? 'unknown',
  }));
}

export const tallyResource = createResource({
  name: 'vMix Tally',
  uri: 'vmix://tally',
  description: 'Real-time on-air tally (program/preview per input) from the vMix TCP subscription',
  mimeType: 'application/json',
  handler: async (ctx: ResourceContext) => {
    const tcp = ctx.vmix.tcp;

    if (!tcp) {
      return {
        contents: [
          jsonContent('vmix://tally', {
            available: false,
            reason: 'TCP is disabled (TCP_ENABLED=false); tally is delivered over the vMix TCP API.',
            note: 'Program and preview are also available via vmix://state/summary.',
            pollOnly: POLL_ONLY_NOTE,
          }),
        ],
      };
    }

    const raw = tcp.lastTally;
    if (raw === null) {
      return {
        contents: [
          jsonContent('vmix://tally', {
            available: false,
            tcpConnected: tcp.connected,
            tcpStatus: tcp.status,
            reason: 'No tally frame received yet (TCP may still be connecting, or vMix has not pushed tally).',
            note: 'Program and preview are also available via vmix://state/summary.',
            pollOnly: POLL_ONLY_NOTE,
          }),
        ],
      };
    }

    const state = await ctx.state.getState();
    const inputs = decodeTally(raw);
    const receivedAtMs = tcp.lastTallyAt;
    const stale = tcp.tallyStale || !tcp.connected;
    const staleReason = stale
      ? tcp.tallyStale
        ? 'The TCP connection dropped after this frame was received; vMix state may have changed since.'
        : `TCP is not connected (status: ${tcp.status}); this frame may be outdated.`
      : null;

    return {
      contents: [
        jsonContent('vmix://tally', {
          available: true,
          tcpConnected: tcp.connected,
          tcpStatus: tcp.status,
          stale,
          ...(staleReason ? { staleReason } : {}),
          receivedAt: receivedAtMs !== null ? new Date(receivedAtMs).toISOString() : null,
          ageMs: receivedAtMs !== null ? Math.max(0, Date.now() - receivedAtMs) : null,
          source: 'vMix TCP tally subscription (last pushed frame)',
          semantics: {
            tcpTally:
              'program and preview arrays are decoded from the last TCP tally frame and can include every input vMix marks as tally-program or tally-preview.',
            httpState:
              'httpProgram and httpPreview come from the current parsed vMix XML state; httpPreview is the single Preview input reported by /vmix/preview.',
            age:
              'ageMs is the time since the last pushed tally frame. A connected tally frame is not marked stale just because no Program/Preview change has occurred.',
          },
          httpProgram: state.active,
          httpPreview: state.preview,
          program: inputs.filter((t) => t.state === 'program').map((t) => t.input),
          preview: inputs.filter((t) => t.state === 'preview').map((t) => t.input),
          inputs,
          raw,
          pollOnly: POLL_ONLY_NOTE,
        }),
      ],
    };
  },
});
