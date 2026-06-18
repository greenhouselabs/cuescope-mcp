/**
 * Tests for MCP prompts
 */

import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  allPrompts,
  getPromptCount,
  registerAllPrompts,
  showReviewPrompt,
  preflightCheckPrompt,
  diagnoseAudioPrompt,
  outputReadinessPrompt,
  explainMySetupPrompt,
  auditPresetPrompt,
  goLiveChecklistPrompt,
} from '../../../src/prompts/index.js';

describe('prompt registry', () => {
  it('exposes 7 prompts with unique names', () => {
    expect(allPrompts).toHaveLength(7);
    expect(getPromptCount()).toBe(7);
    const names = allPrompts.map((prompt) => prompt.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      'show-review',
      'preflight-check',
      'diagnose-audio',
      'output-readiness',
      'explain-my-setup',
      'audit-preset',
      'go-live-checklist',
    ]);
  });

  it('every prompt has a title, description, and non-empty text with and without args', () => {
    for (const prompt of allPrompts) {
      expect(prompt.title, prompt.name).toBeTruthy();
      expect(prompt.description, prompt.name).toBeTruthy();
      expect(prompt.build({}).length, prompt.name).toBeGreaterThan(20);
      expect(
        prompt.build({ input: 'Camera 1', path: 'C:\\shows\\show.vmix', phase: 'rehearsal' }).length,
        prompt.name
      ).toBeGreaterThan(20);
    }
  });

  it('registers all prompts on the server via registerPrompt', () => {
    const server = {
      registerPrompt: vi.fn(),
    } as unknown as McpServer;

    registerAllPrompts(server);

    expect(server.registerPrompt).toHaveBeenCalledTimes(7);
    for (const prompt of allPrompts) {
      expect(server.registerPrompt).toHaveBeenCalledWith(
        prompt.name,
        expect.objectContaining({
          title: prompt.title,
          description: prompt.description,
        }),
        expect.any(Function)
      );
    }
  });

  it('registered callbacks return MCP GetPromptResult messages', () => {
    const server = {
      registerPrompt: vi.fn(),
    } as unknown as McpServer;

    registerAllPrompts(server);

    for (const call of vi.mocked(server.registerPrompt).mock.calls) {
      const callback = call[2] as (args: Record<string, string>) => {
        description?: string;
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };
      const result = callback({ path: 'C:\\shows\\show.vmix' });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe('user');
      expect(result.messages[0]?.content.type).toBe('text');
      expect(result.messages[0]?.content.text.length).toBeGreaterThan(20);
    }
  });
});

describe('individual prompts', () => {
  it('show-review references the natural-language review tool and optional saved preset path', () => {
    const generic = showReviewPrompt.build({});
    expect(generic).toContain('vmix_show_review');
    expect(generic).toMatch(/saved \.vmix path/i);
    expect(generic).toMatch(/output readiness/i);
    expect(generic).toMatch(/presentationGuidance/i);
    expect(generic).toMatch(/reserve blocker or red-alert language/i);
    expect(generic).toMatch(/readinessSummary headline/i);
    expect(generic).toMatch(/Do not execute/i);

    const withPath = showReviewPrompt.build({ path: 'D:\\shows\\event.vmix', intent: 'goLive' });
    expect(withPath).toContain('D:\\shows\\event.vmix');
    expect(withPath).toContain('intent "goLive"');
  });

  it('preflight-check references the vmix_preflight tool and readiness verdict', () => {
    const text = preflightCheckPrompt.build({});
    expect(text).toContain('vmix_preflight');
    expect(text).toMatch(/ready \/ caution \/ not-ready/);
    expect(text).toMatch(/do not execute/i);
  });

  it('diagnose-audio matches the documented workflow and accepts an optional input', () => {
    const generic = diagnoseAudioPrompt.build({});
    expect(generic).toContain('vmix_diagnose_audio');
    expect(generic).toMatch(/muted sources/i);
    expect(generic).toMatch(/mix-minus/i);
    expect(generic).toMatch(/feedback/i);

    const focused = diagnoseAudioPrompt.build({ input: 'Guest Call' });
    expect(focused).toContain('"Guest Call"');
    expect(focused).toMatch(/mute state/i);
  });

  it('output-readiness references the output diagnostic and protects destination secrets', () => {
    const generic = outputReadinessPrompt.build({});
    expect(generic).toContain('vmix_diagnose_outputs');
    expect(generic).toContain('focus "goLive"');
    expect(generic).toMatch(/recording\/streaming\/external/i);
    expect(generic).toMatch(/readinessSummary/i);
    expect(generic).toMatch(/not armed yet/i);
    expect(generic).toMatch(/instead of using failure language/i);
    expect(generic).toMatch(/live XML proves/i);
    expect(generic).toMatch(/stream keys/i);
    expect(generic).toMatch(/Do not execute/i);

    const focused = outputReadinessPrompt.build({ focus: 'streaming' });
    expect(focused).toContain('focus "streaming"');
  });

  it('explain-my-setup reads state resources and explains roles and risks', () => {
    const text = explainMySetupPrompt.build({});
    expect(text).toContain('vmix://state/summary');
    expect(text).toContain('vmix://state/relationships');
    expect(text).toMatch(/production roles/i);
    expect(text).toMatch(/risks/i);
  });

  it('audit-preset interpolates the path argument', () => {
    const text = auditPresetPrompt.build({ path: 'D:\\presets\\sunday.vmix' });
    expect(text).toContain('vmix_audit_preset_file');
    expect(text).toContain('D:\\presets\\sunday.vmix');
    expect(text).toMatch(/read-only/i);

    // Without args it still renders with a placeholder
    expect(auditPresetPrompt.build({})).toContain('<path to .vmix file>');
  });

  it('go-live-checklist defaults to go-live and honors the phase argument', () => {
    expect(goLiveChecklistPrompt.build({})).toContain('go-live checklist');
    expect(goLiveChecklistPrompt.build({ phase: 'rehearsal' })).toContain('rehearsal checklist');
    expect(goLiveChecklistPrompt.build({})).toContain('vmix_generate_show_checklist');
  });
});
