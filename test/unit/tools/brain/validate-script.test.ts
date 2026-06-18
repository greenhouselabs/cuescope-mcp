/**
 * Tests for vmix_validate_script
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { validateScriptAgainstState, validateScriptTool } from '../../../../src/tools/brain/validate-script.js';
import { createMockToolContext } from '../../../mocks/tool-context.mock.js';
import type { VmixState } from '../../../../src/state/types.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../mocks/fixtures/scripts');

function readScriptFixture(fileName: string): string {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

function createValidationContext() {
  return createMockToolContext({
    initialState: {
      active: 1,
      preview: 2,
      inputs: [
        {
          key: '{host-camera-key}',
          number: 1,
          type: 'Capture',
          title: 'Host Camera',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M,A',
        },
        {
          key: '{guest-camera-key}',
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
        {
          key: '{lower-third-key}',
          number: 3,
          type: 'GT',
          title: 'Lower Third',
          state: '',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
          fields: {
            'Name.Text': 'Jane Host',
            'Title.Text': 'Producer',
          },
        },
      ],
    },
  });
}

function createLayoutValidationContext() {
  return createMockToolContext({
    initialState: {
      active: 10,
      preview: 11,
      inputs: [
        {
          key: '{layout-key}',
          number: 10,
          type: 'Mix',
          title: 'Guest Layout',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{clear-key}',
          number: 11,
          type: 'Colour',
          title: 'Clear',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{guest-key}',
          number: 12,
          type: 'VideoCall',
          title: 'Guest A',
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
}

function createLowerThirdSlotContext() {
  return createMockToolContext({
    initialState: {
      active: 20,
      preview: 21,
      inputs: [
        {
          key: '{slot-map-key}',
          number: 20,
          type: 'Mix',
          title: 'Slot Map',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
        },
        {
          key: '{lower-third-key}',
          number: 21,
          type: 'GT',
          title: 'Lower Third',
          state: '',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: '',
          fields: {
            'Name.Text': 'Host A',
            'Title.Text': 'Moderator',
          },
        },
        {
          key: '{host-a-key}',
          number: 22,
          type: 'Capture',
          title: 'Host A',
          state: 'Running',
          position: 0,
          duration: 0,
          muted: false,
          loop: false,
          audioBuses: 'M',
        },
        {
          key: '{guest-a-key}',
          number: 23,
          type: 'VideoCall',
          title: 'Guest A',
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
}

describe('vmix_validate_script', () => {
  it('has the expected tool name', () => {
    expect(validateScriptTool.name).toBe('vmix_validate_script');
  });

  it('validates a clean key-based title update without execution', async () => {
    const ctx = createValidationContext();
    const code = `API.Function("SetText", Input:="{lower-third-key}", SelectedName:="Name.Text", Value:="Steve Director")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(ctx.vmix.http.execute).not.toHaveBeenCalled();
    expect(data.execution.executed).toBe(false);
    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(data.scriptingDiagnostics.overallRisk).toBe('clear');
    expect(data.scriptingDiagnostics.titleFields.count).toBe(0);
    expect(data.analysisConfidence.signals.map((signal: { name: string }) => signal.name))
      .toContain('staticScriptParsing');
    expect(data.assumptionDetails.map((assumption: { statement: string }) => assumption.statement).join('\n'))
      .toContain('Dynamic variables');
    expect(data.apiCalls[0].functionName).toBe('SetText');
    expect(data.apiCalls[0].known).toBe(true);
    expect(data.stateContext.inputCount).toBe(3);
  });

  it('extracts multi-line API.Function calls with VB line continuations', async () => {
    const ctx = createValidationContext();
    const code = `API.Function("SetText", _
    Input:="{lower-third-key}", _
    SelectedName:="Name.Text", _
    Value:="Steve Director")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(data.apiCalls).toHaveLength(1);
    expect(data.apiCalls[0].functionName).toBe('SetText');
    expect(data.apiCalls[0].params.Input).toBe('{lower-third-key}');
    expect(data.apiCalls[0].params.SelectedName).toBe('Name.Text');
    expect(data.apiCalls[0].params.Value).toBe('Steve Director');
  });

  it('reports VB.NET syntax and unsafe loop errors', async () => {
    const ctx = createValidationContext();
    const code = `Do While True
    API.Function("Cut", Input:="{host-camera-key}")
Loop
Thread.Sleep(1000)`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(result.isError).toBe(true);
    expect(data.valid).toBe(false);
    expect(data.analysisConfidence.level).toMatch(/medium|low/);
    expect(data.issueSummary.errors).toBeGreaterThanOrEqual(2);
    expect(data.scriptingDiagnostics.overallRisk).toBe('blocked');
    expect(data.scriptingDiagnostics.polling.count).toBeGreaterThanOrEqual(1);
    expect(messages).toContain('Infinite loop');
    expect(messages).toContain('Thread.Sleep');
  });

  it('reports unknown functions, missing inputs, bad fields, and invalid buses', async () => {
    const ctx = createValidationContext();
    const code = `API.Function("BadCommand", Input:="Missing Camera")
API.Function("SetText", Input:="{lower-third-key}", SelectedName:="Missing.Text", Value:="Oops")
API.Function("AudioBusOn", Input:="{host-camera-key}", Value:="Z")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(result.isError).toBe(true);
    expect(data.valid).toBe(false);
    expect(messages).toContain('Unknown vMix function: BadCommand');
    expect(messages).toContain('Input reference not found');
    expect(messages).toContain('Title field not found');
    expect(messages).toContain('Invalid audio bus');
    expect(data.scriptingDiagnostics.functions.errors).toBe(1);
    expect(data.scriptingDiagnostics.titleFields.errors).toBe(1);
    expect(data.scriptingDiagnostics.audioAndOverlays.errors).toBe(1);
    expect(data.recommendations.join('\n')).toContain('unknown function');
  });

  it('recognizes official vMix functions beyond the legacy curated set', async () => {
    const ctx = createValidationContext();
    const code = `API.Function("AudioBusOff", Value:="A")
API.Function("SetBusAVolume", Value:="50")
API.Function("BusXSendToMasterOn", Value:="A")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const functionErrors = data.issues.filter(
      (issue: { category: string }) => issue.category === 'function'
    );
    expect(functionErrors).toHaveLength(0);
  });

  it('distinguishes vMix Call audio-source bus syntax from AudioBus letters', async () => {
    const ctx = createValidationContext();
    const code = `API.Function("VideoCallAudioSource", Input:="{guest-camera-key}", Value:="E")
API.Function("VideoCallAudioSource", Input:="{guest-camera-key}", Value:="BusC")
API.Function("AudioBusOn", Input:="{guest-camera-key}", Value:="C")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(messages).toContain('VideoCallAudioSource value "E" looks like an AudioBusOn/Off bus letter');
    expect(messages).not.toContain('VideoCallAudioSource value "BusC"');
    expect(messages).not.toContain('Invalid audio bus "C"');
  });

  it('checks SetLayer value shape and source input references', async () => {
    const ctx = createLayoutValidationContext();
    const code = `API.Function("SetLayer", Input:="{layout-key}", Value:="1,{clear-key}")
API.Function("SetLayer", Input:="{layout-key}", Value:="2,Clear")
API.Function("SetLayer", Input:="{layout-key}", Value:="LayerA,Clear")
API.Function("SetLayer", Input:="{layout-key}", Value:="3")
API.Function("SetLayer", Input:="{layout-key}", Value:="4,Missing Source")
Dim layerValue As String = (5) & "," & "{clear-key}"
API.Function("SetLayer", Input:="{layout-key}", Value:=layerValue)`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(false);
    expect(data.scriptingDiagnostics.layoutMapping.count).toBeGreaterThanOrEqual(4);
    expect(messages).toContain('SetLayer source "Clear" resolves by title');
    expect(messages).toContain('SetLayer layer "LayerA" is not a positive integer');
    expect(messages).toContain('SetLayer Value should use "LayerIndex,SourceInput"');
    expect(messages).toContain('SetLayer source input not found');
    expect(messages).toContain('SetLayer Value is dynamic');
    expect(data.recommendations.join('\n')).toContain('Review SetLayer and layout-mapping scripts');
  });

  it('warns when polling loops mix layout mutation with audio routing', async () => {
    const ctx = createLayoutValidationContext();
    const code = `Do While True
    Dim xml As String = API.XML()
    API.Function("SetLayer", Input:="{layout-key}", Value:="1,{clear-key}")
    API.Function("SetLayer1PanX", Input:="{layout-key}", Value:="0")
    API.Function("AudioBusOn", Input:="{guest-key}", Value:="A")
    Sleep(250)
Loop`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.scriptingDiagnostics.overallRisk).toBe('review');
    expect(data.scriptingDiagnostics.layoutMapping.warnings).toBeGreaterThanOrEqual(1);
    expect(messages).toContain('Polling loop mixes layout layer updates with audio/routing changes');
    expect(messages).not.toContain('Input parameter for SetLayer1PanX is dynamic');
  });

  it('classifies preset-only inputs as info and unknown inputs as warnings for saved scripts', () => {
    const liveState = {
      inputs: [
        { key: '{live}', number: 1, title: 'Live Cam', type: 'Capture', state: 'Running', position: 0, duration: 0, muted: false, loop: false, audioBuses: 'M' },
      ],
    } as unknown as VmixState;
    const code = [
      'API.Function("Cut", Input:="Live Cam")',
      'API.Function("Cut", Input:="Preset Segment")',
      'API.Function("Cut", Input:="Ghost Input")',
    ].join('\n');
    const result = validateScriptAgainstState(liveState, code, {
      presetInputs: [{ key: '{preset}', title: 'Preset Segment' }],
      unresolvedInputSeverity: 'warning',
    });
    const inputIssues = result.issues.filter((issue) => issue.category === 'inputReference');
    expect(inputIssues.some((issue) => issue.severity === 'info' && /Preset Segment/.test(issue.message))).toBe(true);
    expect(inputIssues.some((issue) => issue.severity === 'warning' && /Ghost Input/.test(issue.message))).toBe(true);
    expect(inputIssues.some((issue) => issue.severity === 'error')).toBe(false);
  });

  it('keeps input references as errors when no preset options are supplied', () => {
    const liveState = { inputs: [] } as unknown as VmixState;
    const result = validateScriptAgainstState(liveState, 'API.Function("Cut", Input:="Ghost Input")');
    expect(
      result.issues.some(
        (issue) => issue.category === 'inputReference' && issue.severity === 'error' && /Ghost Input/.test(issue.message)
      )
    ).toBe(true);
  });

  it('treats dynamically-built XPath references as advisory, not errors', () => {
    const liveState = { inputs: [] } as unknown as VmixState;
    const code = `Dim n As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='" & MNumber1 & "']")`;
    const result = validateScriptAgainstState(liveState, code);
    expect(result.issues.some((issue) => issue.category === 'inputReference' && issue.severity === 'error')).toBe(false);
    expect(result.issues.some((issue) => issue.category === 'dynamic' && /built dynamically/i.test(issue.message))).toBe(true);
  });

  it('classifies a saved-preset XPath key as info in preset context', () => {
    const liveState = { inputs: [] } as unknown as VmixState;
    const code = `Dim n As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='{preset-key}']")`;
    const result = validateScriptAgainstState(liveState, code, {
      presetInputs: [{ key: '{preset-key}', title: 'Preset Cam' }],
      unresolvedInputSeverity: 'warning',
    });
    expect(result.issues.some((issue) => issue.severity === 'info' && /defined in the saved preset/i.test(issue.message))).toBe(true);
    expect(result.issues.some((issue) => issue.category === 'inputReference' && issue.severity === 'error')).toBe(false);
  });

  it('warns for fragile title references and dynamic input parameters', async () => {
    const ctx = createValidationContext();
    const code = `Dim inputs() As String = {"{host-camera-key}", "{guest-camera-key}"}
Dim index As Integer = 0
API.Function("Cut", Input:=inputs(index))
API.Function("Fade", Input:="Host Camera")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(data.issueSummary.warnings).toBeGreaterThanOrEqual(2);
    expect(data.scriptingDiagnostics.fragileReferences.count).toBeGreaterThanOrEqual(2);
    expect(messages).toContain('dynamic');
    expect(messages).toContain('resolves by title');
  });

  it('warns for multiline array continuations and dynamic AudioOn inputs', async () => {
    const ctx = createValidationContext();
    const code = `Dim liveKeys() As String = { _
    "{mic-1-key}", _
    "{host-camera-key}" _
}
Dim i As Integer = 0
API.Function("AudioOn", Input:=liveKeys(i))
Sleep(50)`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(data.issueSummary.warnings).toBeGreaterThanOrEqual(2);
    expect(data.scriptingDiagnostics.overallRisk).toBe('review');
    expect(messages).toContain('Multiline array initializer');
    expect(messages).toContain('Input parameter for AudioOn is dynamic');
  });

  it('warns on show-critical functions without blocking validation', async () => {
    const ctx = createValidationContext();
    const result = await validateScriptTool.handler({ code: 'API.Function("StopStreaming")' }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(data.issues[0].category).toBe('risk');
    expect(data.issues[0].message).toContain('show-critical');
    expect(data.scriptingDiagnostics.functions.count).toBe(1);
  });

  it('warns for output, overlay, bus master, and script-control show-critical functions', async () => {
    const ctx = createValidationContext();
    const code = [
      'API.Function("SetOutput2", Value:="1")',
      'API.Function("OverlayInputAllOff")',
      'API.Function("BusXSendToMasterOn", Value:="A")',
      'API.Function("ScriptStop", Value:="Watcher")',
    ].join('\n');
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(data.scriptingDiagnostics.functions.count).toBe(4);
    expect(messages).toContain('SetOutput2 is show-critical');
    expect(messages).toContain('OverlayInputAllOff is show-critical');
    expect(messages).toContain('BusXSendToMasterOn is show-critical');
    expect(messages).toContain('ScriptStop is show-critical');
  });

  it('warns for smart quotes and missing Then in sanitized script fixtures', async () => {
    const ctx = createValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p0-smart-quotes-missing-then.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(messages).toContain('Smart or curly quotes');
    expect(messages).toContain('missing Then');
  });

  it('warns for unguarded XML chains in sanitized script fixtures', async () => {
    const ctx = createValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p0-unguarded-xml.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(messages).toContain('SelectSingleNode result is chained into SelectNodes');
    expect(messages).toContain('XML node-list item is dereferenced');
    expect(messages).toContain('XML attribute lookup is dereferenced');
  });

  it('warns for high-impact exact-time polling in sanitized script fixtures', async () => {
    const ctx = createValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p0-high-impact-time-loop.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(messages).toContain('Polling loop uses a 12-hour clock string');
    expect(messages).toContain('Polling loop uses exact wall-clock string equality');
    expect(messages).toContain('High-impact function appears inside a polling loop: StartStreaming');
  });

  it('warns for high-impact show-control functions in sanitized script fixtures', async () => {
    const ctx = createValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p0-show-control-high-impact.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(result.issueSummary.errors).toBe(0);
    expect(result.scriptingDiagnostics.overallRisk).toBe('review');
    expect(result.scriptingDiagnostics.functions.warnings).toBeGreaterThanOrEqual(9);
    expect(messages).toContain('OverlayInputAllOff is show-critical');
    expect(messages).toContain('SetOutput2 is show-critical');
    expect(messages).toContain('SetOutput3 is show-critical');
    expect(messages).toContain('BusXSendToMasterOn is show-critical');
    expect(messages).toContain('BusXSoloOff is show-critical');
    expect(messages).toContain('ScriptStop is show-critical');
    expect(messages).toContain('ScriptStart is show-critical');
    expect(messages).toContain('StartRecording is show-critical');
    expect(messages).toContain('StartStreaming is show-critical');
    expect(result.recommendations.join('\n')).toContain('Treat show-critical functions as manual-review only');
  });

  it('accepts watcher fixtures with fresh XML, latch, and Sleep', async () => {
    const ctx = createValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p0-watcher-with-latch.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(result.issueSummary.errors).toBe(0);
    expect(result.scriptingDiagnostics.polling.warnings).toBe(0);
    expect(result.scriptingDiagnostics.overallRisk).toBe('clear');
    expect(messages).not.toContain('Polling loop does not include Sleep');
    expect(messages).not.toContain('without refreshing API.XML() inside the loop');
    expect(messages).not.toContain('Polling loop performs');
  });

  it('warns for repeated API update churn inside polling loops', async () => {
    const ctx = createValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p2-loop-update-churn.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(messages).toContain('Polling loop performs 5 API.Function calls without an obvious change guard');
  });

  it('warns for layout cleanup and mapping risks in sanitized script fixtures', async () => {
    const ctx = createLayoutValidationContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p1-layout-cleanup-mapping.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(result.issueSummary.errors).toBe(0);
    expect(result.scriptingDiagnostics.overallRisk).toBe('review');
    expect(result.scriptingDiagnostics.layoutMapping.warnings).toBeGreaterThanOrEqual(3);
    expect(messages).toContain('Input parameter for SetLayer is dynamic');
    expect(messages).toContain('SetLayer Value is dynamic');
    expect(messages).toContain('SetLayer source "Clear" resolves by title');
    expect(messages).toContain('Polling loop mixes layout layer updates with audio/routing changes');
    expect(result.recommendations.join('\n')).toContain('Review SetLayer and layout-mapping scripts');
  });

  it('warns for slot-driven lower-third row maps in sanitized script fixtures', async () => {
    const ctx = createLowerThirdSlotContext();
    const state = await ctx.state.getState();
    const result = validateScriptAgainstState(state, readScriptFixture('p1-slot-lower-third-row-map.vb'));
    const messages = result.issues.map((issue) => issue.message).join('\n');

    expect(result.valid).toBe(true);
    expect(result.issueSummary.errors).toBe(0);
    expect(result.scriptingDiagnostics.overallRisk).toBe('review');
    expect(result.scriptingDiagnostics.dataSources.warnings).toBeGreaterThanOrEqual(1);
    expect(messages).toContain('DataSourceSelectRow Value is dynamic and cannot be fully checked');
    expect(messages).toContain('Input parameter for OverlayInput1In is dynamic');
    expect(messages).toContain('XPath input key is built dynamically');
    expect(messages).not.toContain('XML node-list item is dereferenced');
    expect(result.recommendations.join('\n')).toContain('Review data-source row maps');
  });

  it('checks XPath key/title references against current state', async () => {
    const ctx = createValidationContext();
    const code = `Dim nodeA As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='{missing-key}']")
Dim nodeB As System.Xml.XmlNode = x.SelectSingleNode("//input[@title='Host Camera']")
Dim valueC As String = x.SelectSingleNode("//input[@number='1']").InnerText
Dim nodeD As System.Xml.XmlNode = x.SelectSingleNode("//input[1]")
Dim nodeE As System.Xml.XmlNode = x.SelectSingleNode("//input[contains(@title,'Camera')]")
Dim nodeF As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='{lower-third-key}']/text[@name='Missing.Text']")`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(false);
    expect(messages).toContain('XPath input key not found');
    expect(messages).toContain('XPath uses title');
    expect(messages).toContain('XPath uses input number');
    expect(messages).toContain('XPath selects an input by position');
    expect(messages).toContain('XPath uses partial title matching');
    expect(messages).toContain('XPath result is dereferenced');
    expect(messages).toContain('XPath title field not found');
    expect(data.scriptingDiagnostics.xpath.count).toBeGreaterThanOrEqual(5);
    expect(data.scriptingDiagnostics.titleFields.errors).toBe(1);
    expect(data.recommendations.join('\n')).toContain('key-based XPath');
  });

  it('warns for tight polling and stale XML reads', async () => {
    const ctx = createValidationContext();
    const code = `Dim xml As String = API.XML()
Dim x As New System.Xml.XmlDocument
x.LoadXml(xml)
Do While True
    Dim active As String = x.SelectSingleNode("//active").InnerText
    Sleep(10)
Loop`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.scriptingDiagnostics.overallRisk).toBe('review');
    expect(data.scriptingDiagnostics.polling.warnings).toBeGreaterThanOrEqual(2);
    expect(messages).toContain('very short Sleep(10)');
    expect(messages).toContain('without refreshing API.XML() inside the loop');
    expect(data.recommendations.join('\n')).toContain('polling loops');
  });

  it('does not treat comments containing loop as loop terminators before Sleep', async () => {
    const ctx = createValidationContext();
    const code = `Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)
    Dim activeNode As System.Xml.XmlNode = x.SelectSingleNode("/vmix/active")

    If activeNode IsNot Nothing Then
        Dim activeNumber As String = activeNode.InnerText
    End If

    ' Required pacing so this watcher loop never busy-spins.
    Sleep(200)
Loop`;
    const result = await validateScriptTool.handler({ code }, ctx);
    const data = JSON.parse(result.content[0]?.text ?? '{}');
    const messages = data.issues.map((issue: { message: string }) => issue.message).join('\n');

    expect(data.valid).toBe(true);
    expect(data.issueSummary.errors).toBe(0);
    expect(messages).not.toContain('Infinite loop');
    expect(messages).not.toContain('Polling loop does not include Sleep');
  });
});
