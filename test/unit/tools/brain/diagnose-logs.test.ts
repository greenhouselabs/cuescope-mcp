import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { diagnoseLogsTool } from '../../../../src/tools/brain/diagnose-logs.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

const FIXTURE = join(__dirname, '../../../mocks/fixtures/sample-mcp-error.txt');
const FIXTURE_DIR = join(__dirname, '../../../mocks/fixtures');
const CORPUS = join(process.cwd(), 'knowledge', 'examples', 'troubleshooting', 'README.md');

function corpusExcerpt(id: string): string {
  const corpus = readFileSync(CORPUS, 'utf-8');
  const match = new RegExp(`## ${id}[^]*?Sanitized excerpt:\\s*\\n\\n\`\`\`text\\n([^]*?)\\n\`\`\``).exec(corpus);
  if (!match?.[1]) {
    throw new Error(`Missing sanitized excerpt for ${id}`);
  }
  return match[1];
}

function parseOk(result: Awaited<ReturnType<typeof diagnoseLogsTool.handler>>) {
  expect(result.isError).toBeUndefined();
  return JSON.parse(result.content[0]?.text ?? '{}');
}

describe('vmix_diagnose_logs', () => {
  it('has the expected tool name', () => {
    expect(diagnoseLogsTool.name).toBe('vmix_diagnose_logs');
  });

  it('requires exactly one explicit input source', async () => {
    const ctx = createMockToolContext();

    const missing = await diagnoseLogsTool.handler({}, ctx);
    expect(missing.isError).toBe(true);
    expect(missing.content[0]?.text).toContain('Provide exactly one');

    const both = await diagnoseLogsTool.handler({ content: 'error', path: FIXTURE }, ctx);
    expect(both.isError).toBe(true);
    expect(both.content[0]?.text).toContain('Provide exactly one');
  });

  it('diagnoses MCP npx launch failures without touching vMix', async () => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler(
      {
        content: 'Claude MCP error: spawn npx ENOENT while launching mcp-server-vmix',
        source: 'mcp',
      },
      ctx
    );
    const data = parseOk(result);

    expect(data.diagnosis.primarySurface).toBe('mcp-client');
    expect(data.diagnosis.confidence).toBe('high');
    expect(data.diagnosis.relatedCorpusIds).toContain('TR-007');
    expect(data.diagnosis.safeNextChecks.join(' ')).toContain('Node');
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(ctx.state.getState).not.toHaveBeenCalled();
  });

  it('classifies Blackmagic format and transport symptoms', async () => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler(
      {
        content:
          'DeckLink Quad input reports no frames. Source is 1080i59.94 but vMix input was created as 1080p59.94 SDI.',
        source: 'blackmagic',
      },
      ctx
    );
    const data = parseOk(result);

    expect(data.diagnosis.primarySurface).toBe('capture-device');
    expect(data.diagnosis.relatedCorpusIds).toContain('TR-001');
    expect(data.diagnosis.relatedCorpusIds).toContain('TR-003');
    expect(data.diagnosis.safeNextChecks.join(' ')).toContain('source output format');
  });

  it('redacts sensitive log details before returning excerpts', async () => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler(
      {
        content:
          'NDI sender on 192.168.1.55 not visible. Access Manager group mismatch. ' +
          'Log path C:\\Users\\Steve\\AppData\\Roaming\\NDI\\config.json token=abc123 ' +
          'Call https://advanced.vmixcall.com/join/secret and stream rtmp://example.com/live/streamkey',
        source: 'ndi',
      },
      ctx
    );
    const data = parseOk(result);
    const serialized = JSON.stringify(data);

    expect(data.diagnosis.primarySurface).toBe('ndi-network');
    expect(data.diagnosis.relatedCorpusIds).toContain('TR-005');
    expect(data.redactionSummary.privateIps).toBeGreaterThan(0);
    expect(data.redactionSummary.localPaths).toBeGreaterThan(0);
    expect(data.redactionSummary.vmixCallUrls).toBeGreaterThan(0);
    expect(data.redactionSummary.streamUrls).toBeGreaterThan(0);
    expect(data.redactionSummary.secretHints).toBeGreaterThan(0);
    expect(serialized).not.toContain('192.168.1.55');
    expect(serialized).not.toContain('Steve');
    expect(serialized).not.toContain('abc123');
    expect(serialized).not.toContain('advanced.vmixcall.com');
    expect(serialized).not.toContain('rtmp://example.com');
  });

  it('reads one explicit log file with bounded metadata and does not echo the path', async () => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler({ path: FIXTURE, source: 'mcp' }, ctx);
    const data = parseOk(result);
    const serialized = JSON.stringify(data);

    expect(data.source.kind).toBe('path');
    expect(data.source.pathPolicy).toContain('explicit-file-only');
    expect(data.source.truncated).toBe(false);
    expect(data.sanitizedExcerpt).toContain('spawn npx ENOENT');
    expect(data.diagnosis.relatedCorpusIds).toContain('TR-007');
    expect(serialized).not.toContain(FIXTURE);
    expect(serialized).not.toContain('sample-mcp-error.txt');
  });

  it('rejects directory-like and non-log paths instead of scanning', async () => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler({ path: FIXTURE_DIR }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Log path must point|directories are not accepted/);
  });

  it('bounds pasted content analysis and reports truncation', async () => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler({ content: 'spawn npx ENOENT after ' + 'x'.repeat(100), maxBytes: 20 }, ctx);
    const data = parseOk(result);

    expect(data.source.kind).toBe('content');
    expect(data.source.truncated).toBe(true);
    expect(data.source.analyzedBytes).toBeLessThanOrEqual(20);
    expect(data.diagnosis.primarySurface).toBe('mcp-client');
  });

  it.each([
    {
      id: 'TR-001',
      source: 'blackmagic',
      primarySurface: 'capture-device',
      summaryIncludes: 'format',
      safeCheckIncludes: 'source output format',
    },
    {
      id: 'TR-002',
      source: 'blackmagic',
      primarySurface: 'capture-device',
      summaryIncludes: 'already be open',
      safeCheckIncludes: 'Close other video applications',
    },
    {
      id: 'TR-003',
      source: 'blackmagic',
      primarySurface: 'capture-device',
      summaryIncludes: 'connector',
      safeCheckIncludes: 'connector',
    },
    {
      id: 'TR-004',
      source: 'audio',
      primarySurface: 'audio-device',
      summaryIncludes: 'sample-rate',
      safeCheckIncludes: '48 kHz',
    },
    {
      id: 'TR-005',
      source: 'ndi',
      primarySurface: 'ndi-network',
      summaryIncludes: 'NDI discovery',
      safeCheckIncludes: 'NDI sender',
    },
    {
      id: 'TR-006',
      source: 'mcp',
      primarySurface: 'vmix-connectivity',
      summaryIncludes: 'Web Controller',
      safeCheckIncludes: 'vmix_connection_test',
    },
    {
      id: 'TR-007',
      source: 'mcp',
      primarySurface: 'mcp-client',
      summaryIncludes: 'Node/npx',
      safeCheckIncludes: 'Node',
    },
    {
      id: 'TR-008',
      source: 'script',
      primarySurface: 'script',
      summaryIncludes: 'VB.NET',
      safeCheckIncludes: 'vmix_validate_script',
    },
    {
      id: 'TR-009',
      source: 'vmix-api',
      primarySurface: 'vmix-api',
      summaryIncludes: 'ambiguous',
      safeCheckIncludes: 'stable input keys',
    },
  ])('classifies corpus fixture $id', async ({ id, source, primarySurface, summaryIncludes, safeCheckIncludes }) => {
    const ctx = createMockToolContext();
    const result = await diagnoseLogsTool.handler({
      content: corpusExcerpt(id),
      source: source as Parameters<typeof diagnoseLogsTool.handler>[0]['source'],
    }, ctx);
    const data = parseOk(result);

    expect(data.diagnosis.primarySurface).toBe(primarySurface);
    expect(data.diagnosis.summary).toContain(summaryIncludes);
    expect(data.diagnosis.relatedCorpusIds).toContain(id);
    expect(data.diagnosis.safeNextChecks.join(' ')).toContain(safeCheckIncludes);
    expect(data.sanitizedExcerpt).toContain(corpusExcerpt(id).split('\n')[0]);
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(ctx.state.getState).not.toHaveBeenCalled();
  });
});
