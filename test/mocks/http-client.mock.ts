/**
 * Mock HTTP client for testing
 */

import { vi } from 'vitest';
import type { IVmixHttpClient } from '../../src/clients/types.js';

/**
 * A recorded execute() call
 */
export interface RecordedExecuteCall {
  func: string;
  params?: Record<string, string | number | undefined>;
}

export type MockHttpClient = IVmixHttpClient & {
  _setConnected: (connected: boolean) => void;
  _setStateXml: (xml: string) => void;
  /** Throw this error on EVERY call (execute and getState) */
  _simulateError: (error: Error) => void;
  /** Throw this error whenever the given function name is executed (case-insensitive) */
  _failOnFunction: (funcName: string, error: Error) => void;
  /** Throw this error on the Nth execute() call (1-based, counts every call) */
  _failOnCall: (callNumber: number, error: Error) => void;
  /** Clear all injected errors (_simulateError, _failOnFunction, _failOnCall) */
  _clearInjectedErrors: () => void;
  /** All execute() calls, in order, including ones that threw */
  _getExecutedCalls: () => RecordedExecuteCall[];
  /** Function names of all execute() calls, in order */
  _getExecutedFunctions: () => string[];
};

/**
 * Create a mock HTTP client
 */
export function createMockHttpClient(): MockHttpClient {
  let isConnected = true;
  let stateXml = createBasicStateXml();
  let errorToThrow: Error | null = null;
  let executeCallCount = 0;
  const executedCalls: RecordedExecuteCall[] = [];
  const functionErrors = new Map<string, Error>();
  const callErrors = new Map<number, Error>();

  const mock: MockHttpClient = {
    baseUrl: 'http://localhost:8088/api',

    execute: vi.fn(
      async (func: string, params?: Record<string, string | number | undefined>) => {
        executeCallCount++;
        executedCalls.push({ func, params });

        if (errorToThrow) {
          throw errorToThrow;
        }
        if (!isConnected) {
          throw new Error('Not connected');
        }

        const callError = callErrors.get(executeCallCount);
        if (callError) {
          throw callError;
        }

        const functionError = functionErrors.get(func.toLowerCase());
        if (functionError) {
          throw functionError;
        }
      }
    ),

    getState: vi.fn(async () => {
      if (errorToThrow) {
        throw errorToThrow;
      }
      if (!isConnected) {
        throw new Error('Not connected');
      }
      return stateXml;
    }),

    isConnected: vi.fn(async () => isConnected),

    _setConnected: (connected: boolean) => {
      isConnected = connected;
    },

    _setStateXml: (xml: string) => {
      stateXml = xml;
    },

    _simulateError: (error: Error) => {
      errorToThrow = error;
    },

    _failOnFunction: (funcName: string, error: Error) => {
      functionErrors.set(funcName.toLowerCase(), error);
    },

    _failOnCall: (callNumber: number, error: Error) => {
      callErrors.set(callNumber, error);
    },

    _clearInjectedErrors: () => {
      errorToThrow = null;
      functionErrors.clear();
      callErrors.clear();
    },

    _getExecutedCalls: () => [...executedCalls],

    _getExecutedFunctions: () => executedCalls.map((call) => call.func),
  };

  return mock;
}

/**
 * Create basic state XML for testing
 */
export function createBasicStateXml(options: {
  active?: number;
  preview?: number;
  recording?: boolean;
  streaming?: boolean;
  inputs?: Array<{ number: number; title: string; type: string }>;
} = {}): string {
  const {
    active = 1,
    preview = 2,
    recording = false,
    streaming = false,
    inputs = [
      { number: 1, title: 'Camera 1', type: 'Capture' },
      { number: 2, title: 'Camera 2', type: 'Capture' },
      { number: 3, title: 'Video', type: 'Video' },
    ],
  } = options;

  const inputsXml = inputs
    .map(
      (i) =>
        `<input key="{guid-${i.number}}" number="${i.number}" type="${i.type}" ` +
        `title="${i.title}" state="Running" position="0" duration="0" ` +
        `muted="False" loop="False" audiobusses="M"></input>`
    )
    .join('\n    ');

  return `<?xml version="1.0" encoding="utf-8"?>
<vmix>
  <version>29.0.0.0</version>
  <edition>4K Plus</edition>
  <inputs>
    ${inputsXml}
  </inputs>
  <overlays>
    <overlay number="1"/>
    <overlay number="2"/>
    <overlay number="3"/>
    <overlay number="4"/>
  </overlays>
  <preview>${preview}</preview>
  <active>${active}</active>
  <fadeToBlack>False</fadeToBlack>
  <recording>${recording ? 'True' : 'False'}</recording>
  <streaming>${streaming ? 'True' : 'False'}</streaming>
  <external>False</external>
  <audio>
    <master volume="100" muted="False"/>
  </audio>
</vmix>`;
}
