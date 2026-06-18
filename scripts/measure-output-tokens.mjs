/**
 * Measures brain-tool / resource output sizes (≈ host-model input tokens) against a repo fixture.
 * Usage: npm run build && node scripts/measure-output-tokens.mjs [path-to-fixture.xml]
 * Token estimate: chars / 4 (rough; good enough for tracking relative change).
 */
import { readFileSync } from 'fs';
import { parseVmixState } from '../build/state/parser.js';

const fixturePath = process.argv[2] ?? 'test/mocks/fixtures/state-paired-audio-aux-bus.xml';
const xml = readFileSync(fixturePath, 'utf-8');
const state = parseVmixState(xml);
const ctx = { state: { getState: async () => state }, vmix: {}, config: {} };
const tokens = (s) => Math.round(s.length / 4);

console.log(`fixture: ${fixturePath}`);
console.log(`         ${state.inputs.length} inputs, raw XML ${xml.length} chars (~${tokens(xml)} tok)\n`);

const { analyzePresetTool } = await import('../build/tools/brain/analyze-preset.js');
const { generateScriptTool } = await import('../build/tools/brain/generate-script.js');
const { diagnoseAudioTool } = await import('../build/tools/brain/diagnose-audio.js');
const { validateScriptTool } = await import('../build/tools/brain/validate-script.js');
const { generateApiSequenceTool } = await import('../build/tools/brain/generate-api-sequence.js');
const { generateShowChecklistTool } = await import('../build/tools/brain/generate-show-checklist.js');
const { explainInputTool } = await import('../build/tools/brain/explain-input.js');
const { findInputTool } = await import('../build/tools/brain/find-input.js');
const { stateLiveResource } = await import('../build/resources/state-live.js');

async function measure(label, tool, params) {
  const t0 = performance.now();
  const res = await tool.handler(params, ctx);
  const ms = (performance.now() - t0).toFixed(1);
  const text = res.content[0].text;
  let compactNote = '';
  try {
    compactNote = ` | compact ~${tokens(JSON.stringify(JSON.parse(text)))} tok`;
  } catch { /* non-JSON output */ }
  console.log(`${label}: ~${tokens(text)} tok${compactNote} | ${ms}ms`);
}

await measure('analyze_preset       ', analyzePresetTool, {});
await measure('generate_script      ', generateScriptTool, { goal: 'play the matching music track when a video goes to program' });
await measure('diagnose_audio       ', diagnoseAudioTool, {});
await measure('generate_api_sequence', generateApiSequenceTool, { goal: 'cut to Video A' });
await measure('show_checklist       ', generateShowChecklistTool, { scenario: 'goLive' });
await measure('explain_input        ', explainInputTool, { input: 1 });
await measure('find_input           ', findInputTool, { query: 'music' });
await measure('validate_script      ', validateScriptTool, { code: 'API.Function("Cut", Input:="1")' });

const live = await stateLiveResource.handler(ctx);
console.log(`state/live           : ~${tokens(live.contents[0].text)} tok`);
