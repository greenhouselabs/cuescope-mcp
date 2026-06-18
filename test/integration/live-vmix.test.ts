/**
 * Integration test against a REAL vMix instance (read-only).
 *
 * Run with: npm run test:integration
 * Requires vMix running with the Web Controller enabled (VMIX_HOST / VMIX_HTTP_PORT).
 * Excluded from the default `npm test`; self-skips if vMix is unreachable.
 *
 * This exercises the real Review Mode read path end to end: connect over HTTP,
 * parse live state, and run an advisory tool — without mutating vMix.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadConfig } from '../../src/config/index.js';
import { VmixClient } from '../../src/clients/vmix-client.js';
import { StateCache } from '../../src/state/cache.js';
import { analyzePresetTool } from '../../src/tools/brain/index.js';
import type { ToolContext } from '../../src/tools/base.js';

const config = loadConfig();
const baseUrl = `http://${config.VMIX_HOST}:${config.VMIX_HTTP_PORT}/api/`;

let reachable = false;
try {
  reachable = (await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })).ok;
} catch {
  reachable = false;
}

if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn(`[integration] vMix not reachable at ${baseUrl} — skipping live integration tests.`);
}

describe.skipIf(!reachable)('live vMix integration (read-only)', () => {
  let ctx: ToolContext;
  let vmix: VmixClient | undefined;

  beforeAll(async () => {
    vmix = VmixClient.fromConfig(config);
    await vmix.connect();
    const state = new StateCache(vmix.http, { ttlMs: config.STATE_CACHE_TTL });
    ctx = { vmix, state, config };
  });

  afterAll(() => {
    // Close the client (drops the TCP tally socket when VMIX_TCP_ENABLED),
    // otherwise the worker can leak an open socket and hang on teardown.
    vmix?.disconnect();
  });

  it('reads live state with a version and an inputs array', async () => {
    const state = await ctx.state.getState();
    expect(state.version.length).toBeGreaterThan(0);
    expect(Array.isArray(state.inputs)).toBe(true);
  });

  it('runs vmix_analyze_preset read-only against live state', async () => {
    const result = await analyzePresetTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.inputCount).toBe('number');
  });
});
