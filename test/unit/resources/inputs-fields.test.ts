/**
 * Tests for vmix://inputs/fields resource
 */

import { describe, expect, it } from 'vitest';
import { inputsFieldsResource } from '../../../src/resources/inputs-fields.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';
import type { VmixInput } from '../../../src/state/types.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';

function titleInput(partial: Partial<VmixInput> & Pick<VmixInput, 'number'>): VmixInput {
  return {
    key: `{timer-${partial.number}}`,
    number: partial.number,
    type: 'GT',
    title: 'Timer Centre.gtzip',
    state: 'Paused',
    position: 0,
    duration: 0,
    muted: false,
    loop: false,
    audioBuses: 'M',
    fields: {
      'Time.Text': '{0:hh:mm:ss tt}',
    },
    ...partial,
  };
}

function createContext(inputs: VmixInput[]): ResourceContext {
  return {
    state: createMockStateCache({ inputs }),
    vmix: createMockVmixClient(),
    config: createTestConfig(),
  };
}

describe('vmix://inputs/fields', () => {
  it('has the expected URI', () => {
    expect(inputsFieldsResource.uri).toBe('vmix://inputs/fields');
  });

  it('preserves duplicate title inputs with number and key identity', async () => {
    const ctx = createContext([
      titleInput({ number: 5 }),
      titleInput({ number: 6 }),
      titleInput({ number: 7 }),
      titleInput({ number: 8 }),
    ]);

    const result = await inputsFieldsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.count).toBe(4);
    expect(data.inputs.map((input: { number: number }) => input.number)).toEqual([5, 6, 7, 8]);
    expect(
      data.inputs.find((input: { number: number }) => input.number === 5).fields['Time.Text']
    ).toBe('{0:hh:mm:ss tt}');
    expect(data.inputs.find((input: { number: number }) => input.number === 8).key).toBe(
      '{timer-8}'
    );
    expect(data.byTitle['Timer Centre.gtzip'].duplicateTitle).toBe(true);
    expect(data.byTitle['Timer Centre.gtzip'].inputNumbers).toEqual([5, 6, 7, 8]);
    expect(data.notes.join('\n')).toContain('do not assume a title uniquely identifies an input');
  });

  it('handles inputs titled "__proto__" without prototype pollution', async () => {
    const ctx = createContext([
      titleInput({ number: 1, title: '__proto__' }),
      titleInput({ number: 2, title: '__proto__' }),
      titleInput({ number: 3, title: 'constructor' }),
    ]);

    const result = await inputsFieldsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.count).toBe(3);
    // The grouped entries must be real own data, not prototype hits
    expect(Object.getOwnPropertyDescriptor(data.byTitle, '__proto__')?.value).toEqual({
      inputNumbers: [1, 2],
      duplicateTitle: true,
    });
    expect(data.byTitle['constructor']).toEqual({
      inputNumbers: [3],
      duplicateTitle: false,
    });
    // Object.prototype must not have been polluted
    expect(({} as Record<string, unknown>)['inputNumbers']).toBeUndefined();
  });

  it('returns an empty indexed shape when no fields are visible', async () => {
    const ctx = createContext([
      {
        key: '{camera}',
        number: 1,
        type: 'Capture',
        title: 'Camera 1',
        state: 'Running',
        position: 0,
        duration: 0,
        muted: false,
        loop: false,
        audioBuses: 'M',
      },
    ]);

    const result = await inputsFieldsResource.handler(ctx);
    const data = JSON.parse(result.contents[0]?.text ?? '{}');

    expect(data.count).toBe(0);
    expect(data.inputs).toEqual([]);
    expect(data.byTitle).toEqual({});
  });
});
