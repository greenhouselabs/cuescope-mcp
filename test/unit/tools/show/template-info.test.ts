/**
 * Tests for vmix_show_template_list and vmix_show_template_details
 * (read-only template catalog tools).
 */

import { describe, it, expect } from 'vitest';
import { showTemplateListTool } from '../../../../src/tools/show/template-list.js';
import { showTemplateDetailsTool } from '../../../../src/tools/show/template-details.js';
import { SHOW_TEMPLATES } from '../../../../src/tools/show/templates.js';

describe('vmix_show_template_list', () => {
  it('lists every registered template with its ID', async () => {
    const result = await showTemplateListTool.handler({}, undefined as never);
    const text = result.content[0]?.text ?? '';

    expect(result.isError).toBeUndefined();
    for (const id of Object.keys(SHOW_TEMPLATES)) {
      expect(text).toContain(`\`${id}\``);
    }
    expect(text).toContain('vmix_show_template_details');
    expect(text).toContain('vmix_show_build');
  });
});

describe('vmix_show_template_details', () => {
  it('returns the full specification for a known template', async () => {
    const result = await showTemplateDetailsTool.handler(
      { template: 'four-person-podcast' },
      undefined as never
    );
    const text = result.content[0]?.text ?? '';

    expect(result.isError).toBeUndefined();
    expect(text).toContain('Four Person Podcast');
    // Spec sections users rely on before building
    expect(text).toContain('## Participants');
    expect(text).toContain('## Audio Routing');
    expect(text).toContain('## Overlay Assignments');
    expect(text).toContain('## Multi-View Layouts');
    // Overlay channels 1-4 per vMix rules
    expect(text).toContain('Channel 1:');
    expect(text).toContain('Channel 4:');
    // Example config is valid JSON
    const jsonBlock = text.match(/```json\n([\s\S]*?)```/);
    expect(jsonBlock).toBeTruthy();
    const example: unknown = JSON.parse(jsonBlock![1]!);
    expect((example as { template: string }).template).toBe('four-person-podcast');
  });

  it('rejects unknown templates and lists available IDs', async () => {
    const result = await showTemplateDetailsTool.handler(
      { template: 'cooking-show' },
      undefined as never
    );

    expect(result.isError).toBe(true);
    for (const id of Object.keys(SHOW_TEMPLATES)) {
      expect(result.content[0]?.text).toContain(id);
    }
  });
});
