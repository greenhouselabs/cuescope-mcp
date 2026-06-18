/**
 * Tests for curated docs resources
 */

import { describe, expect, it } from 'vitest';
import {
  allResources,
  apiDocsResource,
  audioRoutingDocsResource,
  docsResources,
  examplesDocsResource,
  docsIndexResource,
  forumPatternsDocsResource,
  getResourceStats,
  mcpCapabilitiesDocsResource,
  productionPatternsDocsResource,
  scriptingDocsResource,
} from '../../../src/resources/index.js';
import { createMockStateCache } from '../../mocks/tool-context.mock.js';
import { createMockVmixClient } from '../../mocks/vmix-client.mock.js';
import { createTestConfig } from '../../../src/config/index.js';
import type { ResourceContext } from '../../../src/resources/base.js';

const ctx: ResourceContext = {
  state: createMockStateCache(),
  vmix: createMockVmixClient(),
  config: createTestConfig(),
};

describe('curated docs resources', () => {
  it('registers the planned docs resource URIs', () => {
    expect(docsResources.map((resource) => resource.uri)).toEqual([
      'vmix://docs/index',
      'vmix://docs/mcp-capabilities',
      'vmix://docs/api',
      'vmix://docs/scripting',
      'vmix://docs/audio-routing',
      'vmix://docs/production-patterns',
      'vmix://docs/forum-patterns',
      'vmix://docs/examples',
    ]);
    expect(allResources).toContain(docsIndexResource);
    expect(allResources).toContain(mcpCapabilitiesDocsResource);
    expect(allResources).toContain(apiDocsResource);
    expect(allResources).toContain(examplesDocsResource);
    expect(getResourceStats().total).toBe(21);
  });

  it('returns a generated docs index with source files and usage notes', async () => {
    const result = await docsIndexResource.handler(ctx);
    const content = result.contents[0];
    const text = content?.text ?? '';

    expect(content?.mimeType).toBe('text/markdown');
    expect(text).toContain('# vMix Docs Index');
    expect(text).toContain('## Resources');
    expect(text).toContain('## Source Files');
    expect(text).toContain('knowledge');
    expect(text).toContain('official/developer-api.md');
    expect(text).toContain('official/preset-files.md');
    expect(text).toContain('official/titles.md');
    expect(text).toContain('mcp/knowledge-model.md');
    expect(text).toContain('patterns/production/troubleshooting-logs-and-hardware.md');
    expect(text).toContain('examples/troubleshooting/README.md');
    expect(text).toContain('vmix://docs/mcp-capabilities');
    expect(text).toContain('vmix://docs/examples');
  });

  it('returns MCP capability knowledge with confidence and roadmap guidance', async () => {
    const result = await mcpCapabilitiesDocsResource.handler(ctx);
    const content = result.contents[0];
    const text = content?.text ?? '';

    expect(content?.mimeType).toBe('text/markdown');
    expect(text).toContain('# vMix MCP Capabilities And Confidence');
    expect(text).toContain('Knowledge Layers');
    expect(text).toContain('Source Priority');
    expect(text).toContain('Current Blind Spots');
    expect(text).toContain('Professional Readiness Roadmap');
    expect(text).toContain('Level 5: Professional Copilot');
  });

  it('returns API knowledge with source metadata', async () => {
    const result = await apiDocsResource.handler(ctx);
    const content = result.contents[0];
    const text = content?.text ?? '';

    expect(content?.mimeType).toBe('text/markdown');
    expect(text).toContain('# vMix API Knowledge');
    expect(text).toContain('## Source Metadata');
    expect(text).toContain('official-distilled');
    expect(text).toContain('Function=');
    expect(text).toContain('DataSourceNextRow');
    expect(text).toContain('Preset Files');
    expect(text).not.toContain('Missing knowledge file');
  });

  it('returns scripting knowledge with safe VB.NET guidance', async () => {
    const result = await scriptingDocsResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('# vMix Scripting Knowledge');
    expect(text).toContain('Sleep()');
    expect(text).toContain('Input reference preference');
    expect(text).toContain('vmix_generate_script');
    expect(text).toContain('Data Source Control');
    expect(text).toContain('List Control');
    expect(text).toContain('Mix Input Control');
    expect(text).toContain('Complex Script Design');
    expect(text).toContain('Production Audio Workflow Patterns');
    expect(text).toContain('Real-World Script Corpus');
    expect(text).toContain('Example: Video End Trigger');
  });

  it('returns audio-routing knowledge with mix-minus guidance', async () => {
    const result = await audioRoutingDocsResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('# vMix Audio Routing Knowledge');
    expect(text).toContain('Mix Minus');
    expect(text).toContain('`A` through `G`');
    expect(text).toContain('vMix Call Audio');
    expect(text).toContain('Remote Guests');
    expect(text).toContain('Talkback');
    expect(text).toContain('reset-then-promote');
    expect(text).toContain('Production Audio Workflow Patterns');
  });

  it('returns production pattern knowledge', async () => {
    const result = await productionPatternsDocsResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('# vMix Production Pattern Knowledge');
    expect(text).toContain('Overlays');
    expect(text).toContain('Lower Thirds');
    expect(text).toContain('Virtual Sets');
    expect(text).toContain('official/titles.md');
    expect(text).not.toContain('Missing knowledge file');
    expect(text).toContain('Multi-Mix Shows');
    expect(text).toContain('Timers');
    expect(text).toContain('Paired-Audio Video Shows');
    expect(text).toContain('Remote Guest Mix-Minus Shows');
    expect(text).toContain('Sports Replay Scorebug Shows');
    expect(text).toContain('Troubleshooting Logs And Hardware Errors');
    expect(text).toContain('Blackmagic');
    expect(text).toContain('State-Aware Troubleshooting Contract');
    expect(text).toContain('Evidence lanes');
    expect(text).toContain('Troubleshooting Handoff Report');
    expect(text).toContain('vmix_diagnose_logs');
    expect(text).toContain('vmix_connection_test');
    expect(text).toContain('vmix_diagnose_audio');
  });

  it('labels forum knowledge as curated summaries', async () => {
    const result = await forumPatternsDocsResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('# vMix Forum Pattern Digests');
    expect(text).toContain('curated-forum-summary');
    expect(text).toContain('not raw forum content');
    expect(text).toContain('Triggers');
    expect(text).toContain('API Edge Cases');
  });

  it('returns review-first examples for presets, XML snapshots, routing, and scripts', async () => {
    const result = await examplesDocsResource.handler(ctx);
    const text = result.contents[0]?.text ?? '';

    expect(text).toContain('# vMix Example Knowledge');
    expect(text).toContain('example');
    expect(text).toContain('Podcast Preset Notes');
    expect(text).toContain('Paired-Audio Aux-Bus Video Show');
    expect(text).toContain('Input Key Change Snapshot');
    expect(text).toContain('Podcast Mix-Minus Routing');
    expect(text).toContain('Timed Lower Third');
    expect(text).toContain('Real-World Script Corpus');
    expect(text).toContain('Troubleshooting Corpus');
    expect(text).toContain('TR-007 MCP Client Cannot Spawn npx');
  });
});
