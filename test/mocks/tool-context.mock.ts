/**
 * Mock tool context for testing tools
 */

import type { ToolContext } from '../../src/tools/base.js';
import { createMockVmixClient, type MockVmixClient } from './vmix-client.mock.js';
import { createTestConfig } from '../../src/config/index.js';
import type { IStateCache, VmixState } from '../../src/state/types.js';
import { vi } from 'vitest';

/**
 * Create a mock state cache
 */
export function createMockStateCache(initialState?: Partial<VmixState>): IStateCache & {
  _setState: (state: Partial<VmixState>) => void;
} {
  let state: VmixState = {
    version: '29.0.0.0',
    edition: '4K Plus',
    active: 1,
    preview: 2,
    fadeToBlack: false,
    recording: false,
    recordingDuration: 0,
    streaming: false,
    external: false,
    inputs: [
      {
        key: '{guid-1}',
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
      {
        key: '{guid-2}',
        number: 2,
        type: 'Capture',
        title: 'Camera 2',
        state: 'Running',
        position: 0,
        duration: 0,
        muted: false,
        loop: false,
        audioBuses: 'M',
      },
    ],
    overlays: [null, null, null, null],
    audio: {
      master: { volume: 100, muted: false },
    },
    ...initialState,
  };

  return {
    getState: vi.fn(async () => state),
    getRawXml: vi.fn(async () => '<vmix>...</vmix>'),
    invalidate: vi.fn(),
    _setState: (newState: Partial<VmixState>) => {
      state = { ...state, ...newState };
    },
  };
}

/**
 * Mock tool context type - exposes the mock-specific helpers on vmix/state
 * (call recording, error injection, state mutation) while staying assignable
 * to ToolContext.
 */
export type MockToolContext = ToolContext & {
  vmix: MockVmixClient;
  state: ReturnType<typeof createMockStateCache>;
  _setStateProperty: <K extends keyof VmixState>(key: K, value: VmixState[K]) => void;
};

/**
 * Create a complete mock tool context
 */
export function createMockToolContext(options?: {
  initialState?: Partial<VmixState>;
}): MockToolContext {
  const vmix = createMockVmixClient();
  const stateCache = createMockStateCache(options?.initialState);
  const config = createTestConfig();

  return {
    vmix,
    state: stateCache,
    config,
    _setStateProperty: <K extends keyof VmixState>(key: K, value: VmixState[K]) => {
      stateCache._setState({ [key]: value });
    },
  };
}
