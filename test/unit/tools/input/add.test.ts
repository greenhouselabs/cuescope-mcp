/**
 * Tests for vmix_input_add tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { addInputTool } from '../../../../src/tools/input/add.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';

describe('vmix_input_add', () => {
  let ctx: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('has correct name', () => {
    expect(addInputTool.name).toBe('vmix_input_add');
  });

  describe('adding inputs by type', () => {
    // vMix uses AddInput with Value=Type|Path format
    it('adds video input', async () => {
      await addInputTool.handler({ type: 'Video', path: 'C:\\Videos\\intro.mp4' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Video|C:\\Videos\\intro.mp4',
      });
    });

    it('adds image input', async () => {
      await addInputTool.handler({ type: 'Image', path: 'C:\\Images\\logo.png' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Image|C:\\Images\\logo.png',
      });
    });

    it('adds title input', async () => {
      await addInputTool.handler({ type: 'Title', path: 'C:\\Titles\\lower-third.gtzip' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Title|C:\\Titles\\lower-third.gtzip',
      });
    });

    it('adds GT input', async () => {
      await addInputTool.handler({ type: 'GT', path: 'C:\\GT\\scorebug.gt' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'GT|C:\\GT\\scorebug.gt',
      });
    });

    it('adds colour input with hex conversion', async () => {
      await addInputTool.handler({ type: 'Colour', path: '#FF0000' }, ctx);

      // #FF0000 (red) converts to signed Int32: 0xFFFF0000 = -65536
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Colour|-65536',
      });
    });

    it('adds colour input with raw Int32 value', async () => {
      await addInputTool.handler({ type: 'Colour', path: '-16776961' }, ctx);

      // Already Int32, pass through as-is
      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Colour|-16776961',
      });
    });

    it('adds NDI input', async () => {
      await addInputTool.handler({ type: 'NDI', path: 'HOSTNAME (Source Name)' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'NDI|HOSTNAME (Source Name)',
      });
    });

    it('adds browser input', async () => {
      await addInputTool.handler({ type: 'Browser', path: 'https://example.com' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Browser|https://example.com',
      });
    });

    it('adds audio file input', async () => {
      await addInputTool.handler({ type: 'AudioFile', path: 'C:\\Audio\\music.mp3' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'AudioFile|C:\\Audio\\music.mp3',
      });
    });

    it('adds photos input', async () => {
      await addInputTool.handler({ type: 'Photos', path: 'C:\\Photos' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Photos|C:\\Photos',
      });
    });

    it('adds VideoList input', async () => {
      await addInputTool.handler({ type: 'VideoList', path: 'C:\\Playlists\\show.m3u' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'VideoList|C:\\Playlists\\show.m3u',
      });
    });

    it('adds Stream input', async () => {
      await addInputTool.handler({ type: 'Stream', path: 'rtmp://server/live/stream' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Stream|rtmp://server/live/stream',
      });
    });

    it('adds PowerPoint input', async () => {
      await addInputTool.handler({ type: 'PowerPoint', path: 'C:\\Presentations\\slides.pptx' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'PowerPoint|C:\\Presentations\\slides.pptx',
      });
    });

    it('adds VirtualSet input', async () => {
      await addInputTool.handler({ type: 'VirtualSet', path: 'News Desk' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'VirtualSet|News Desk',
      });
    });

    it('adds Xaml input', async () => {
      await addInputTool.handler({ type: 'Xaml', path: 'C:\\Templates\\custom.xaml' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', {
        Value: 'Xaml|C:\\Templates\\custom.xaml',
      });
    });

    it('adds Call input without returning the generated link by default', async () => {
      // Mock getState to return XML with a Call input
      ctx.vmix.http.getState.mockResolvedValue(`
        <vmix>
          <inputs>
            <input type="VmixCall" key="abc123">
              <CallPassword>pass456</CallPassword>
            </input>
          </inputs>
        </vmix>
      `);

      const result = await addInputTool.handler({ type: 'Call' }, ctx);

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', { Value: 'Call' });
      expect(ctx.vmix.http.getState).not.toHaveBeenCalled();
      expect(result.content[0]?.text).not.toContain('vmixcall.com');
      expect(result.content[0]?.text).not.toContain('abc123');
      expect(result.content[0]?.text).toContain('return_join_url=true');
    });

    it('returns Call join URL only when explicitly requested', async () => {
      ctx.vmix.http.getState.mockResolvedValue(`
        <vmix>
          <inputs>
            <input type="VmixCall" key="abc123">
              <CallPassword>pass456</CallPassword>
            </input>
          </inputs>
        </vmix>
      `);

      const result = await addInputTool.handler(
        { type: 'Call', return_join_url: true },
        ctx
      );

      expect(ctx.vmix.http.execute).toHaveBeenCalledWith('AddInput', { Value: 'Call' });
      expect(result.content[0]?.text).toContain('vmixcall.com');
      expect(result.content[0]?.text).toContain('abc123');
      expect(result.content[0]?.text).toContain('pass456');
    });

    it('rejects browser inputs that do not use http or https', async () => {
      const result = await addInputTool.handler({ type: 'Browser', path: 'file:///C:/secret.html' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('http:// or https://');
      expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    });
  });

  describe('handler validation', () => {
    it('returns error when path missing for non-Call types', async () => {
      const result = await addInputTool.handler({ type: 'Video' }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Path is required');
    });
  });

  describe('schema validation', () => {
    it('requires type', () => {
      expect(addInputTool.schema.safeParse({ path: 'test.mp4' }).success).toBe(false);
    });

    it('allows path to be optional at schema level (for Call type)', () => {
      // Path is optional at schema level to support Call type which auto-generates a link
      expect(addInputTool.schema.safeParse({ type: 'Video' }).success).toBe(true);
      expect(addInputTool.schema.safeParse({ type: 'Call' }).success).toBe(true);
    });

    it('accepts all valid types', () => {
      const types = [
        'Video',
        'Image',
        'Photos',
        'Title',
        'GT',
        'Colour',
        'NDI',
        'Browser',
        'AudioFile',
        'Call',
        'VideoList',
        'Stream',
        'PowerPoint',
        'VirtualSet',
        'Xaml',
      ] as const;
      for (const type of types) {
        expect(addInputTool.schema.safeParse({ type, path: 'test' }).success).toBe(true);
      }
    });

    it('rejects invalid types', () => {
      expect(addInputTool.schema.safeParse({ type: 'Camera', path: 'test' }).success).toBe(false);
    });
  });

  describe('result messages', () => {
    it('returns success message with type and path', async () => {
      const result = await addInputTool.handler({ type: 'Video', path: 'intro.mp4' }, ctx);
      expect(result.content[0]?.text).toContain('Video');
      expect(result.content[0]?.text).toContain('intro.mp4');
    });
  });
});
