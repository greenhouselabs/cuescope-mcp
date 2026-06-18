import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';
import { auditPresetFileTool } from '../../../../src/tools/brain/audit-preset-file.js';
import type { ToolContext } from '../../../../src/tools/base.js';

const FIXTURE = join(__dirname, '../../../mocks/fixtures/preset-sample.vmix');

describe('vmix_audit_preset_file', () => {
  it('cross-references saved preset against live state and labels freshness', async () => {
    const ctx = { state: { getState: vi.fn().mockResolvedValue({ inputs: [] }) } } as unknown as ToolContext;
    const res = await auditPresetFileTool.handler({ path: FIXTURE }, ctx);
    const payload = JSON.parse(res.content[0]!.text);
    expect(payload.source).toBe('saved preset file');
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(payload.findingSummary).toBeDefined();
    // With an empty live state, saved inputs surface as drift.
    expect(payload.findings.some((f: { category: string }) => f.category === 'drift')).toBe(true);
  });
});
