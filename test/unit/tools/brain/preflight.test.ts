/**
 * Tests for vmix_preflight
 */

import { describe, expect, it } from 'vitest';
import { preflightTool } from '../../../../src/tools/brain/preflight.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_preflight', () => {
  it('has the expected tool name', () => {
    expect(preflightTool.name).toBe('vmix_preflight');
  });

  it('returns not-ready when program camera is muted', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{cam1}',
            number: 1,
            type: 'Capture',
            title: 'Studio Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: true,       // muted on program!
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{cam2}',
            number: 2,
            type: 'Capture',
            title: 'Guest Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.verdict).toBe('not-ready');
    expect(data.summary.errors).toBeGreaterThanOrEqual(1);

    const programError = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'error' && f.category === 'program' && /muted/i.test(f.message)
    );
    expect(programError).toBeDefined();
    expect(programError.message).toContain('Studio Camera');
  });

  it('returns caution when Fade to Black is active', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: true,   // FTB active
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{cam1}',
            number: 1,
            type: 'Capture',
            title: 'Main Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{cam2}',
            number: 2,
            type: 'Capture',
            title: 'B Roll Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    // Verdict must be caution or not-ready (not ready because FTB is a warning)
    expect(['caution', 'not-ready']).toContain(data.verdict);

    const ftbFinding = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'warning' && f.category === 'state' && /fade to black/i.test(f.message)
    );
    expect(ftbFinding).toBeDefined();
  });

  it('warns when Program is an offline slate placeholder', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{offline-slate}',
            number: 1,
            type: 'GT',
            title: 'Offline - GFX - SHOW SLATE',
            state: '',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: '',
          },
          {
            key: '{cam1}',
            number: 2,
            type: 'Capture',
            title: 'Host Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.verdict).toBe('caution');
    const slateFinding = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'warning' && f.category === 'program' && /offline\/slate/i.test(f.message)
    );
    expect(slateFinding).toBeDefined();
  });

  it('returns ready for a clean one-camera-on-program state', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{cam1}',
            number: 1,
            type: 'Capture',
            title: 'Host Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{cam2}',
            number: 2,
            type: 'Capture',
            title: 'Guest Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    // No errors — must be ready or at most caution
    expect(data.summary.errors).toBe(0);
    expect(['ready', 'caution']).toContain(data.verdict);

    // Confirm required output fields exist
    expect(data.program.inputNumber).toBe(1);
    expect(data.program.title).toBe('Host Camera');
    expect(data.preview.inputNumber).toBe(2);
    expect(data.findings).toBeInstanceOf(Array);
    expect(data.note).toContain('Read-only');
    expect(data.assumptions).toHaveLength(2);
  });

  it('reports master audio muted as an error', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: true } },
        inputs: [
          {
            key: '{cam1}',
            number: 1,
            type: 'Capture',
            title: 'Host Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{cam2}',
            number: 2,
            type: 'Capture',
            title: 'Guest Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.verdict).toBe('not-ready');
    const audioError = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'error' && f.category === 'audio' && /master audio/i.test(f.message)
    );
    expect(audioError).toBeDefined();
  });

  it('warns when no program input is set', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 0,
        preview: 0,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{cam1}',
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
        ],
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    const noProgramFinding = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'warning' && f.category === 'program' && /no input/i.test(f.message)
    );
    expect(noProgramFinding).toBeDefined();
  });

  it('warns when no live camera or remote-guest source is present', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{vid1}',
            number: 1,
            type: 'Video',
            title: 'Intro Video',
            state: 'Running',
            position: 0,
            duration: 60000,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{vid2}',
            number: 2,
            type: 'Video',
            title: 'Outro Video',
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

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    const noLiveFinding = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'warning' &&
        f.category === 'inputs' &&
        /live camera/i.test(f.message)
    );
    expect(noLiveFinding).toBeDefined();
  });

  it('handles invalid preset path gracefully (warning, not error)', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        fadeToBlack: false,
        recording: false,
        streaming: false,
        external: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{cam1}',
            number: 1,
            type: 'Capture',
            title: 'Host Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
          {
            key: '{cam2}',
            number: 2,
            type: 'Capture',
            title: 'Guest Camera',
            state: 'Running',
            position: 0,
            duration: 0,
            muted: false,
            loop: false,
            audioBuses: 'M',
          },
        ],
      },
    });

    const result = await preflightTool.handler(
      { presetPath: '/nonexistent/path/does-not-exist.vmix' },
      ctx
    );
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    // Should still return a verdict (no throw)
    expect(data.verdict).toBeDefined();

    const presetWarning = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'warning' && f.category === 'preset' && /could not read/i.test(f.message)
    );
    expect(presetWarning).toBeDefined();
  });

  it('includes recording/streaming/external info finding', async () => {
    const ctx = createMockToolContext({
      initialState: {
        active: 1,
        preview: 2,
        recording: true,
        streaming: true,
        external: false,
        fadeToBlack: false,
        overlays: [null, null, null, null],
        audio: { master: { volume: 100, muted: false } },
        inputs: [
          {
            key: '{cam1}',
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
            key: '{cam2}',
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
      },
    });

    const result = await preflightTool.handler({}, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    const stateFinding = data.findings.find(
      (f: { severity: string; category: string; message: string }) =>
        f.severity === 'info' && f.category === 'state' && /recording/i.test(f.message)
    );
    expect(stateFinding).toBeDefined();
    expect(stateFinding.message).toContain('ON');
  });
});
