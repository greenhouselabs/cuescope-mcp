/**
 * Tests for vmix_find_input
 */

import { describe, expect, it } from 'vitest';
import { findInputTool } from '../../../../src/tools/brain/find-input.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

function createFinderContext() {
  return createMockToolContext({
    initialState: {
      inputs: [
        {
          key: '{host-camera-key}',
          number: 1,
          type: 'Capture',
          title: 'Host Camera',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{guest-call-key}',
          number: 2,
          type: 'vMixCall',
          title: 'Remote Guest',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{lower-third-key}',
          number: 3,
          type: 'GT',
          title: 'Lower Third',
          state: '',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
          fields: {
            'Name.Text': 'Jane Host',
            'Title.Text': 'Producer',
          },
        },
        {
          key: '{intro-key}',
          number: 4,
          type: 'Video',
          title: 'Intro Video',
          state: 'Paused',
          position: 0,
          duration: 30000,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
      ],
    },
  });
}

function createManyTitleContext() {
  return createMockToolContext({
    initialState: {
      inputs: Array.from({ length: 12 }, (_, index) => ({
        key: `{title-key-${index + 1}}`,
        number: index + 1,
        type: 'GT',
        title: `TEMP - LABEL - CAM ${index + 1}`,
        state: '',
        position: 0,
        duration: 0,
        muted: false,
        loop: false,
        audioBuses: '',
        fields: {
          'Message.Text': `CAM ${index + 1}`,
        },
      })),
    },
  });
}

describe('vmix_find_input', () => {
  it('has the expected tool name', () => {
    expect(findInputTool.name).toBe('vmix_find_input');
  });

  it('finds by stable input key', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'key:{guest-call-key}' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.count).toBe(1);
    expect(data.matches[0].input.title).toBe('Remote Guest');
    expect(data.matches[0].confidence).toBe(1);
    expect(data.matches[0].recommendation.preferredReference).toBe('{guest-call-key}');
    expect(data.analysisConfidence.level).toBe('high');
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('bestMatch');
    expect(data.assumptionDetails.length).toBeGreaterThan(0);
  });

  it('finds by input number', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'number:3' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(1);
    expect(data.matches[0].input.title).toBe('Lower Third');
    expect(data.matches[0].matchedOn[0].field).toBe('number');
  });

  it('finds partial title matches', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'lower' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.matches[0].input.title).toBe('Lower Third');
    expect(data.matches[0].matchedOn.some((match: { field: string }) => match.field === 'title')).toBe(true);
  });

  it('finds by type', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'type:GT' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(1);
    expect(data.matches[0].input.role).toBe('titleGraphic');
  });

  it('finds by role aliases', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'role:guest' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(1);
    expect(data.matches[0].input.title).toBe('Remote Guest');
    expect(data.matches[0].matchedOn[0].kind).toBe('alias');
  });

  it('finds by title field name', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'field:Name.Text' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(1);
    expect(data.matches[0].input.title).toBe('Lower Third');
    expect(data.matches[0].input.fieldNames).toContain('Name.Text');
  });

  it('returns no-match hints when nothing matches', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'does-not-exist' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(0);
    expect(data.analysisConfidence.level).toBe('low');
    expect(data.noMatchHints.length).toBeGreaterThan(0);
    expect(data.noMatchHints.join('\n')).toContain('role:camera');
  });

  it('honors result limits', async () => {
    const ctx = createFinderContext();
    const result = await findInputTool.handler({ query: 'role:camera', limit: 1 }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(1);
  });

  it('reports total matches when the result limit truncates the output', async () => {
    const ctx = createManyTitleContext();
    const result = await findInputTool.handler({ query: 'field:Message.Text' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.count).toBe(10);
    expect(data.returned).toBe(10);
    expect(data.totalMatches).toBe(12);
    expect(data.limit).toBe(10);
    expect(data.truncated).toBe(true);
    expect(data.warnings[0]).toContain('returned 10 of 12');
    expect(data.noMatchHints).toEqual([]);
    expect(
      data.analysisConfidence.signals.find((signal: { name: string }) => signal.name === 'ambiguity')
        ?.reason
    ).toContain('Returned 10 of 12');
  });
});
