/**
 * Tests for vmix_connection_test
 */

import { describe, expect, it } from 'vitest';
import { connectionTestTool } from '../../../../src/tools/brain/connection-test.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../../src/config/index.js';
import {
  ConnectionError,
  TimeoutError,
  CommandError,
} from '../../../../src/errors/index.js';

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? '{}');
}

describe('vmix_connection_test', () => {
  it('is read-only metadata: name matches the documented tool name', () => {
    expect(connectionTestTool.name).toBe('vmix_connection_test');
    expect(connectionTestTool.description).toMatch(/read-only/i);
  });

  it('reports version, edition, and input count on success', async () => {
    const ctx = createMockToolContext();
    const result = await connectionTestTool.handler({}, ctx);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.ok).toBe(true);
    expect(data.http.ok).toBe(true);
    expect(data.http.vmixVersion).toBe('29.0.0.0');
    expect(data.http.vmixEdition).toBe('4K Plus');
    expect(data.http.inputCount).toBe(2);
    expect(ctx.vmix.http._getExecutedCalls()).toEqual([]);
  });

  it('reports configured host/port without secrets and the active mode', async () => {
    const ctx = createMockToolContext();
    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.configured).toEqual({
      host: ctx.config.VMIX_HOST,
      httpPort: ctx.config.VMIX_HTTP_PORT,
      tcpPort: ctx.config.VMIX_TCP_PORT,
      tcpEnabled: ctx.config.TCP_ENABLED,
    });
    expect(data.mode).toBe('review');
    expect(data.modeLabel).toBe('Review Mode');
    // Only connection coordinates are reported - never credentials
    expect(Object.keys(data.configured)).toEqual(['host', 'httpPort', 'tcpPort', 'tcpEnabled']);
    expect(JSON.stringify(data)).not.toMatch(/password|apiKey|token/i);
  });

  it('reports control and high-impact modes', async () => {
    const operatorCtx = createMockToolContext();
    operatorCtx.config = createTestConfig({ VMIX_CONTROL_MODE: true });
    expect(parseResult(await connectionTestTool.handler({}, operatorCtx)).mode).toBe('control');

    const dangerousCtx = createMockToolContext();
    dangerousCtx.config = createTestConfig({
      VMIX_CONTROL_MODE: true,
      VMIX_HIGH_IMPACT: true,
    });
    expect(parseResult(await connectionTestTool.handler({}, dangerousCtx)).mode).toBe(
      'highImpactControl'
    );
  });

  it('classifies connection refused with Web Controller hints', async () => {
    const ctx = createMockToolContext();
    ctx.state.getState = async () => {
      throw new ConnectionError(
        'Cannot reach vMix: fetch failed (ECONNREFUSED)',
        'localhost',
        8088,
        'http'
      );
    };

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.ok).toBe(false);
    expect(data.http.ok).toBe(false);
    expect(data.http.errorType).toBe('connection_refused');
    expect(data.http.hints.join('\n')).toMatch(/is vMix running/i);
    expect(data.http.hints.join('\n')).toMatch(/Settings > Web Controller/i);
  });

  it('classifies DNS failures with host hints', async () => {
    const ctx = createMockToolContext();
    ctx.state.getState = async () => {
      throw new ConnectionError(
        'Cannot reach vMix: fetch failed (ENOTFOUND)',
        'bad-host',
        8088,
        'http'
      );
    };

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.http.errorType).toBe('connection_error');
    expect(data.http.hints.join('\n')).toMatch(/could not be resolved/i);
    expect(data.http.hints.join('\n')).toMatch(/VMIX_HOST/);
  });

  it('classifies timeouts with host/firewall hints', async () => {
    const ctx = createMockToolContext();
    ctx.state.getState = async () => {
      throw new TimeoutError('State fetch timed out after 30000ms', 30000);
    };

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.ok).toBe(false);
    expect(data.http.errorType).toBe('timeout');
    expect(data.http.hints.join('\n')).toMatch(/firewall/i);
    expect(data.http.hints.join('\n')).toMatch(/VMIX_HOST/);
    expect(data.http.hints.join('\n')).toContain('30000ms');
  });

  it('classifies HTTP error responses with the status code', async () => {
    const ctx = createMockToolContext();
    ctx.state.getState = async () => {
      throw new CommandError('HTTP 500: Internal Server Error', 'getState', {}, 500);
    };

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.http.errorType).toBe('http_error');
    expect(data.http.hints.join('\n')).toContain('HTTP 500');
  });

  it('classifies unknown errors without crashing', async () => {
    const ctx = createMockToolContext();
    ctx.state.getState = async () => {
      throw new Error('something odd');
    };

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.ok).toBe(false);
    expect(data.http.errorType).toBe('unknown');
    expect(data.http.message).toContain('something odd');
  });

  it('reports TCP tally status when enabled and a frame has arrived', async () => {
    const ctx = createMockToolContext();
    ctx.vmix.tcp?._setConnected(true);
    ctx.vmix.tcp?._emitTally('012');

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.tcpTally.enabled).toBe(true);
    expect(data.tcpTally.status).toBe('connected');
    expect(data.tcpTally.connected).toBe(true);
    expect(typeof data.tcpTally.lastTallyAgeMs).toBe('number');
    expect(data.tcpTally.tallyStale).toBe(false);
  });

  it('reports no tally frame yet when TCP is connected but silent', async () => {
    const ctx = createMockToolContext();
    ctx.vmix.tcp?._setConnected(true);

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.tcpTally.enabled).toBe(true);
    expect(data.tcpTally.lastTallyAgeMs).toBeNull();
    expect(data.tcpTally.note).toMatch(/No tally frame received yet/i);
  });

  it('handles a disabled (null) TCP client gracefully', async () => {
    const ctx = createMockToolContext();
    ctx.vmix = createMockVmixClient({ tcpEnabled: false });

    const data = parseResult(await connectionTestTool.handler({}, ctx));

    expect(data.tcpTally.enabled).toBe(false);
    expect(data.tcpTally.note).toMatch(/TCP is disabled/i);
    // HTTP diagnosis still works
    expect(data.http.ok).toBe(true);
  });
});
