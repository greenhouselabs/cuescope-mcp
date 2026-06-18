/**
 * Tests for vmix_show_validate — read-only readiness checks against state.
 */

import { describe, it, expect } from 'vitest';
import { showValidateTool } from '../../../../src/tools/show/validate.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import type { VmixInput } from '../../../../src/state/types.js';

function makeInput(overrides: Partial<VmixInput> & { number: number; title: string }): VmixInput {
  return {
    key: `{guid-${overrides.number}}`,
    type: 'Capture',
    state: 'Running',
    position: 0,
    duration: 0,
    muted: false,
    loop: false,
    audioBuses: 'M',
    ...overrides,
  };
}

describe('vmix_show_validate', () => {
  it('has correct name and is read-only', async () => {
    expect(showValidateTool.name).toBe('vmix_show_validate');

    const ctx = createMockToolContext();
    await showValidateTool.handler({}, ctx);
    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
  });

  it('flags an empty vMix setup as having errors', async () => {
    const ctx = createMockToolContext({ initialState: { inputs: [] } });
    const result = await showValidateTool.handler({}, ctx);
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('Issues Found');
    expect(text).toContain('No inputs found');
    expect(text).toContain('Fix the errors above before going live');
  });

  it('passes the general check with cameras present (warnings allowed)', async () => {
    const ctx = createMockToolContext(); // 2 Capture inputs with audio buses
    const result = await showValidateTool.handler({}, ctx);
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('Ready for Production');
    expect(text).toContain('Found 2 video/camera inputs');
    expect(text).toContain('Errors: 0');
  });

  it('reports an unknown template as an error and lists available ones', async () => {
    const ctx = createMockToolContext();
    const result = await showValidateTool.handler({ template: 'no-such-show' }, ctx);
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('Template "no-such-show" not found');
    expect(text).toContain('four-person-podcast');
  });

  it('errors when camera count is below the requested participant count', async () => {
    const ctx = createMockToolContext(); // only 2 cameras
    const result = await showValidateTool.handler(
      { template: 'four-person-podcast', participantCount: 4 },
      ctx
    );
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('Need 4 camera inputs, found 2');
    expect(text).toContain('Issues Found');
  });

  it('recognizes lower thirds, music, and intro for a podcast template', async () => {
    const ctx = createMockToolContext({
      initialState: {
        inputs: [
          makeInput({ number: 1, title: 'Camera 1' }),
          makeInput({ number: 2, title: 'Camera 2' }),
          makeInput({ number: 3, title: 'Lower Third', type: 'GT' }),
          makeInput({ number: 4, title: 'Background Music', type: 'AudioFile' }),
          makeInput({ number: 5, title: 'Intro Video', type: 'Video', duration: 15000 }),
        ],
      },
    });

    const result = await showValidateTool.handler(
      { template: 'two-person-podcast', participantCount: 2 },
      ctx
    );
    const text = result.content[0]?.text ?? '';

    expect(text).toContain('Lower third found: "Lower Third"');
    expect(text).toContain('Errors: 0');
  });
});
