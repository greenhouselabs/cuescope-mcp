/**
 * Curated vMix knowledge resources
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createResource, markdownContent, type ResourceDefinition } from './base.js';

interface KnowledgeSource {
  path: string;
  label: string;
  sourceType: 'official-distilled' | 'internal-pattern' | 'curated-forum-summary' | 'example';
}

interface DocsResourceSpec {
  uri: string;
  title: string;
  description: string;
  summary: string;
  sources: KnowledgeSource[];
}

const RESOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(RESOURCE_DIR, '..', '..');
const KNOWLEDGE_ROOT = join(PACKAGE_ROOT, 'knowledge');

const DOC_SPECS: DocsResourceSpec[] = [
  {
    uri: 'vmix://docs/mcp-capabilities',
    title: 'vMix MCP Capabilities And Confidence',
    description:
      'Explains what CueScope knows, how it uses live state and curated knowledge, confidence rules, blind spots, and professional-readiness priorities.',
    summary:
      'Project-specific guidance for assistants answering what this MCP knows, what it can infer, and what still needs verification.',
    sources: [
      {
        path: 'mcp/knowledge-model.md',
        label: 'MCP Knowledge Model And Confidence',
        sourceType: 'internal-pattern',
      },
      {
        path: 'mcp/professional-readiness-roadmap.md',
        label: 'Professional Readiness Roadmap',
        sourceType: 'internal-pattern',
      },
    ],
  },
  {
    uri: 'vmix://docs/api',
    title: 'vMix API Knowledge',
    description: 'Curated vMix API notes for HTTP commands, state XML, input references, and function usage.',
    summary:
      'Concise API reference for MCP clients that need to reason about vMix state and command plans.',
    sources: [
      {
        path: 'official/developer-api.md',
        label: 'Developer API',
        sourceType: 'official-distilled',
      },
      {
        path: 'official/shortcut-functions.md',
        label: 'Shortcut Functions',
        sourceType: 'official-distilled',
      },
      {
        path: 'official/data-sources.md',
        label: 'Data Sources',
        sourceType: 'official-distilled',
      },
      {
        path: 'official/preset-files.md',
        label: 'Preset Files',
        sourceType: 'official-distilled',
      },
    ],
  },
  {
    uri: 'vmix://docs/scripting',
    title: 'vMix Scripting Knowledge',
    description: 'Curated VB.NET scripting guidance for safe vMix automation generation and review.',
    summary:
      'Script-generation context focused on VB.NET syntax, XML polling, stable input references, and title fields.',
    sources: [
      {
        path: 'official/scripting-and-automation.md',
        label: 'Scripting and Automation',
        sourceType: 'official-distilled',
      },
      {
        path: 'patterns/scripting/vbnet-basics.md',
        label: 'VB.NET Basics',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/complex-script-design.md',
        label: 'Complex Script Design',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/production-script-workflows.md',
        label: 'Production Script Workflow Patterns',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/input-key-vs-name.md',
        label: 'Input Keys vs Names',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/loops-and-waits.md',
        label: 'Loops and Waits',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/xml-parsing.md',
        label: 'XML Parsing',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/title-fields.md',
        label: 'Title Fields',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/data-source-control.md',
        label: 'Data Source Control',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/list-control.md',
        label: 'List Control',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/mix-input-control.md',
        label: 'Mix Input Control',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/audio/production-audio-workflows.md',
        label: 'Production Audio Workflow Patterns',
        sourceType: 'internal-pattern',
      },
      {
        path: 'examples/scripts/video-end-trigger.md',
        label: 'Example: Video End Trigger',
        sourceType: 'internal-pattern',
      },
      {
        path: 'examples/scripts/lower-third-timed.md',
        label: 'Example: Timed Lower Third',
        sourceType: 'internal-pattern',
      },
      {
        path: 'examples/scripts/real-world/README.md',
        label: 'Real-World Script Corpus',
        sourceType: 'example',
      },
    ],
  },
  {
    uri: 'vmix://docs/audio-routing',
    title: 'vMix Audio Routing Knowledge',
    description: 'Curated audio routing notes for buses, mix-minus, monitoring, and safe diagnostics.',
    summary:
      'Audio knowledge for diagnosing bus routing, mix-minus setups, monitoring feeds, and common mistakes.',
    sources: [
      {
        path: 'official/audio-buses.md',
        label: 'Audio Buses',
        sourceType: 'official-distilled',
      },
      {
        path: 'official/vmix-call-audio.md',
        label: 'vMix Call Audio',
        sourceType: 'official-distilled',
      },
      {
        path: 'patterns/audio/mix-minus.md',
        label: 'Mix Minus',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/audio/remote-guests.md',
        label: 'Remote Guests',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/audio/green-room.md',
        label: 'Green Room Audio',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/audio/talkback.md',
        label: 'Talkback',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/audio/bus-routing-recipes.md',
        label: 'Bus Routing Recipes',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/audio/production-audio-workflows.md',
        label: 'Production Audio Workflow Patterns',
        sourceType: 'internal-pattern',
      },
    ],
  },
  {
    uri: 'vmix://docs/production-patterns',
    title: 'vMix Production Pattern Knowledge',
    description:
      'Curated production patterns for overlays, lower thirds, replay, troubleshooting, timers, and show structure.',
    summary:
      'Production-oriented notes that help Review Mode explain, troubleshoot, diagnose, and generate reviewable plans.',
    sources: [
      {
        path: 'patterns/production/overlays.md',
        label: 'Overlays',
        sourceType: 'internal-pattern',
      },
      {
        path: 'official/virtual-sets.md',
        label: 'Virtual Sets',
        sourceType: 'official-distilled',
      },
      {
        path: 'official/titles.md',
        label: 'Titles',
        sourceType: 'official-distilled',
      },
      {
        path: 'patterns/production/virtual-set-host-guest-patterns.md',
        label: 'Virtual Set Host Guest Patterns',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/multi-mix-shows.md',
        label: 'Multi-Mix Shows',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/lower-thirds.md',
        label: 'Lower Thirds',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/scripting/production-script-workflows.md',
        label: 'Production Script Workflow Patterns',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/timers.md',
        label: 'Timers',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/paired-audio-video-shows.md',
        label: 'Paired-Audio Video Shows',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/remote-guest-mix-minus-shows.md',
        label: 'Remote Guest Mix-Minus Shows',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/sports-replay-scorebug-shows.md',
        label: 'Sports Replay Scorebug Shows',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/replay.md',
        label: 'Replay',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/troubleshooting-logs-and-hardware.md',
        label: 'Troubleshooting Logs And Hardware Errors',
        sourceType: 'internal-pattern',
      },
      {
        path: 'patterns/production/output-stream-readiness.md',
        label: 'Output And Stream Readiness',
        sourceType: 'internal-pattern',
      },
    ],
  },
  {
    uri: 'vmix://docs/forum-patterns',
    title: 'vMix Forum Pattern Digests',
    description: 'Curated forum-derived summaries for recurring vMix gotchas and edge cases.',
    summary:
      'Clean summaries of repeated community patterns. These are curated notes, not raw forum content.',
    sources: [
      {
        path: 'forum-digests/scripting-gotchas.md',
        label: 'Scripting Gotchas',
        sourceType: 'curated-forum-summary',
      },
      {
        path: 'forum-digests/mix-input-limitations.md',
        label: 'Mix Input Limitations',
        sourceType: 'curated-forum-summary',
      },
      {
        path: 'forum-digests/list-playback.md',
        label: 'List Playback',
        sourceType: 'curated-forum-summary',
      },
      {
        path: 'forum-digests/triggers.md',
        label: 'Triggers',
        sourceType: 'curated-forum-summary',
      },
      {
        path: 'forum-digests/api-edge-cases.md',
        label: 'API Edge Cases',
        sourceType: 'curated-forum-summary',
      },
    ],
  },
  {
    uri: 'vmix://docs/examples',
    title: 'vMix Example Knowledge',
    description:
      'Review-first examples for preset notes, XML snapshots, routing diagrams, scripts, and troubleshooting.',
    summary:
      'Concrete examples that show how Review Mode should explain presets, XML changes, routing, generated scripts, and troubleshooting excerpts.',
    sources: [
      {
        path: 'examples/README.md',
        label: 'Examples Index',
        sourceType: 'example',
      },
      {
        path: 'examples/presets/podcast-review-mode.md',
        label: 'Example: Podcast Preset Notes',
        sourceType: 'example',
      },
      {
        path: 'examples/presets/virtual-set-interview.md',
        label: 'Example: Virtual Set Interview Notes',
        sourceType: 'example',
      },
      {
        path: 'examples/presets/paired-audio-aux-bus-video-show.md',
        label: 'Example: Paired-Audio Aux-Bus Video Show',
        sourceType: 'example',
      },
      {
        path: 'examples/xml-snapshots/input-key-change.md',
        label: 'Example: Input Key Change Snapshot',
        sourceType: 'example',
      },
      {
        path: 'examples/xml-snapshots/audio-routing-before-after.md',
        label: 'Example: Audio Routing Snapshot',
        sourceType: 'example',
      },
      {
        path: 'examples/routing-diagrams/podcast-mix-minus.md',
        label: 'Example: Podcast Mix-Minus Routing',
        sourceType: 'example',
      },
      {
        path: 'examples/routing-diagrams/green-room-talkback.md',
        label: 'Example: Green Room Talkback Routing',
        sourceType: 'example',
      },
      {
        path: 'examples/scripts/video-end-trigger.md',
        label: 'Example: Video End Trigger Script',
        sourceType: 'example',
      },
      {
        path: 'examples/scripts/lower-third-timed.md',
        label: 'Example: Timed Lower Third Script',
        sourceType: 'example',
      },
      {
        path: 'examples/scripts/real-world/README.md',
        label: 'Example: Real-World Script Corpus',
        sourceType: 'example',
      },
      {
        path: 'examples/troubleshooting/README.md',
        label: 'Example: Troubleshooting Corpus',
        sourceType: 'example',
      },
    ],
  },
];

function readKnowledgeFile(source: KnowledgeSource): string {
  const fullPath = join(KNOWLEDGE_ROOT, source.path);

  if (!existsSync(fullPath)) {
    return `> Missing knowledge file: \`${source.path}\``;
  }

  try {
    return readFileSync(fullPath, 'utf-8').trim();
  } catch (error) {
    return `> Error reading \`${source.path}\`: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function buildDocsMarkdown(spec: DocsResourceSpec): string {
  const sourceSummary = spec.sources
    .map((source) => `- ${source.label}: \`${source.path}\` (${source.sourceType})`)
    .join('\n');
  const sections = spec.sources
    .map((source) => {
      const content = readKnowledgeFile(source);
      return `## ${source.label}\n\n_Source type: ${source.sourceType}. Source file: \`${source.path}\`._\n\n${content}`;
    })
    .join('\n\n---\n\n');

  return `# ${spec.title}

${spec.summary}

## Source Metadata

- Resource URI: \`${spec.uri}\`
- Knowledge root: \`knowledge/\`
- Curation note: concise local summaries separated by source type.

${sourceSummary}

---

${sections}
`;
}

function buildDocsIndexMarkdown(): string {
  const resourceLines = DOC_SPECS.map((spec) => {
    const sourceTypes = [...new Set(spec.sources.map((source) => source.sourceType))].join(', ');
    return `- \`${spec.uri}\` - ${spec.title}. Sources: ${spec.sources.length}. Types: ${sourceTypes}.`;
  }).join('\n');
  const sourceLines = DOC_SPECS.flatMap((spec) =>
    spec.sources.map(
      (source) =>
        `- \`${source.path}\` - ${source.label}. Resource: \`${spec.uri}\`. Source type: ${source.sourceType}.`
    )
  ).join('\n');

  return `# vMix Docs Index

Generated source index for the curated vMix knowledge resources.

## Resources

${resourceLines}

## Source Files

${sourceLines}

## Usage Notes

- Use \`vmix://docs/api\` for HTTP API, XML state, shortcut functions, and data-source command context.
- Use \`vmix://docs/mcp-capabilities\` for MCP knowledge scope, confidence rules, blind spots, and professional-readiness roadmap.
- Use \`vmix://docs/scripting\` for VB.NET generation and validation guidance.
- Use \`vmix://docs/audio-routing\` for buses, mix-minus, vMix Call, talkback, and remote guest audio.
- Use \`vmix://docs/production-patterns\` for overlays, lower thirds, replay, virtual sets, multi-mix, timers, and safe troubleshooting patterns.
- Use \`vmix://docs/forum-patterns\` for curated community-pattern summaries.
- Use \`vmix://docs/examples\` for review-first preset, XML, routing, script, and troubleshooting examples.
`;
}

function createDocsResource(spec: DocsResourceSpec): ResourceDefinition {
  return createResource({
    name: spec.title,
    uri: spec.uri,
    description: spec.description,
    mimeType: 'text/markdown',
    handler: () =>
      Promise.resolve({
        contents: [markdownContent(spec.uri, buildDocsMarkdown(spec))],
      }),
  });
}

export const docsIndexResource = createResource({
  name: 'vMix Docs Index',
  uri: 'vmix://docs/index',
  description: 'Index of curated vMix docs resources, source files, and source metadata.',
  mimeType: 'text/markdown',
  handler: () =>
    Promise.resolve({
      contents: [markdownContent('vmix://docs/index', buildDocsIndexMarkdown())],
    }),
});

export const mcpCapabilitiesDocsResource = createDocsResource(DOC_SPECS[0]!);
export const apiDocsResource = createDocsResource(DOC_SPECS[1]!);
export const scriptingDocsResource = createDocsResource(DOC_SPECS[2]!);
export const audioRoutingDocsResource = createDocsResource(DOC_SPECS[3]!);
export const productionPatternsDocsResource = createDocsResource(DOC_SPECS[4]!);
export const forumPatternsDocsResource = createDocsResource(DOC_SPECS[5]!);
export const examplesDocsResource = createDocsResource(DOC_SPECS[6]!);

export const docsResources: ResourceDefinition[] = [
  docsIndexResource,
  mcpCapabilitiesDocsResource,
  apiDocsResource,
  scriptingDocsResource,
  audioRoutingDocsResource,
  productionPatternsDocsResource,
  forumPatternsDocsResource,
  examplesDocsResource,
];
