/**
 * vmix_script_generate - Generate VB.NET scripts from natural language
 *
 * Preserved High-Impact Control script generator.
 * Default Review Mode uses vmix_generate_script for reviewable scripts without execution.
 */

import { z } from 'zod';
import { createTool, type ToolContext } from '../base.js';
import { validateVmixScript, VMIX_SCRIPT_PATTERNS } from '../../validation/script-validator.js';
import type { VmixState, VmixInput } from '../../state/types.js';

/**
 * Escape a string for use in VB.NET string literals
 * Doubles any quotes and handles special characters
 */
function escapeVbString(value: string): string {
  return value.replace(/"/g, '""');
}

/**
 * Escape a string for use in XPath expressions within VB.NET
 * For XPath in VB.NET, we need to handle both VB string escaping AND XPath escaping
 */
function escapeXPathInVb(value: string): string {
  // First escape for VB.NET string (double the quotes)
  // Then handle XPath: if contains single quote, we need to use concat or double quotes
  const vbEscaped = escapeVbString(value);

  if (!vbEscaped.includes("'")) {
    // Safe to use single quotes in XPath
    return `'${vbEscaped}'`;
  }

  // Contains single quotes - use XPath concat function
  // Split by single quotes and rebuild with concat
  const parts = vbEscaped.split("'");
  const xpathParts = parts.map((part, i) => {
    if (i === parts.length - 1) {
      return part ? `'${part}'` : '';
    }
    return part ? `'${part}',""'"",'` : `""'""`;
  }).filter(p => p);

  if (xpathParts.length === 1) {
    return xpathParts[0]!;
  }
  return `concat(${xpathParts.join(',').replace(/,'/g, ", '").replace(/,""/, ', ""')})`;
}

/**
 * Build comprehensive context about the vMix setup for script generation
 */
function buildGenerationContext(state: VmixState): string {
  const sections: string[] = [];

  // Input summary
  sections.push('## Available Inputs');
  for (const input of state.inputs) {
    let line = `- Input ${input.number}: "${input.title}" (${input.type})`;
    if (input.duration && input.duration > 0) {
      line += ` [Duration: ${Math.round(input.duration / 1000)}s]`;
    }
    sections.push(line);
  }

  // Title/GT inputs with fields
  const titleInputs = state.inputs.filter(
    (i) => (i.type === 'GT' || i.type === 'Title') && i.fields && Object.keys(i.fields).length > 0
  );
  if (titleInputs.length > 0) {
    sections.push('\n## Title Fields (for SetText)');
    for (const input of titleInputs) {
      sections.push(`"${input.title}":`);
      for (const [field, value] of Object.entries(input.fields ?? {})) {
        sections.push(`  - ${field}: "${value}"`);
      }
    }
  }

  // Audio inputs (those with audio buses assigned)
  const audioInputs = state.inputs.filter((i) => i.audioBuses && i.audioBuses.length > 0);
  if (audioInputs.length > 0) {
    sections.push('\n## Audio-Enabled Inputs');
    for (const input of audioInputs) {
      const muted = input.muted ? ' [MUTED]' : '';
      sections.push(`- "${input.title}": Buses ${input.audioBuses}${muted}`);
    }
  }

  // Current state
  sections.push('\n## Current State');
  sections.push(`- Program (Live): Input ${state.active}`);
  sections.push(`- Preview: Input ${state.preview}`);
  sections.push(`- Recording: ${state.recording ? 'Active' : 'Stopped'}`);
  sections.push(`- Streaming: ${state.streaming ? 'Active' : 'Stopped'}`);
  sections.push(`- Fade To Black: ${state.fadeToBlack ? 'ON' : 'OFF'}`);

  return sections.join('\n');
}

/**
 * Generate VB.NET code for common operations
 */
const CODE_GENERATORS = {
  /**
   * Generate code to switch between inputs
   */
  switchInputs: (inputs: VmixInput[], intervalMs: number, useTransition = false): string => {
    const inputNames = inputs.map((i) => `"${escapeVbString(i.title)}"`).join(', ');
    const func = useTransition ? 'Fade' : 'Cut';

    return `' Auto-switch between inputs
Dim inputs() As String = {${inputNames}}
Dim idx As Integer = 0

Do While True
    API.Function("${func}", Input:=inputs(idx))
    idx = (idx + 1) Mod inputs.Length
    Sleep(${intervalMs})
Loop`;
  },

  /**
   * Generate code to show/hide overlay with timing
   */
  timedOverlay: (input: VmixInput, channel: number, durationMs: number): string => {
    const titleEscaped = escapeVbString(input.title);
    return `' Show overlay for ${durationMs / 1000} seconds
API.Function("OverlayInput${channel}In", Input:="${titleEscaped}")
Sleep(${durationMs})
API.Function("OverlayInput${channel}Out")`;
  },

  /**
   * Generate code to update title text
   */
  setText: (input: VmixInput, field: string, value: string): string => {
    return `API.Function("SetText", Input:="${escapeVbString(input.title)}", SelectedName:="${escapeVbString(field)}", Value:="${escapeVbString(value)}")`;
  },

  /**
   * Generate code for countdown with action
   */
  countdownWithAction: (
    countdownInput: VmixInput,
    seconds: number,
    action: string,
    targetInput?: VmixInput
  ): string => {
    const countdownTitleEscaped = escapeVbString(countdownInput.title);
    const targetParam = targetInput ? `, Input:="${escapeVbString(targetInput.title)}"` : '';
    return `' Countdown then ${action}
API.Function("SetCountdown", Input:="${countdownTitleEscaped}", Value:="00:00:${seconds.toString().padStart(2, '0')}")
API.Function("StartCountdown", Input:="${countdownTitleEscaped}")
Sleep(${seconds * 1000})
API.Function("${action}"${targetParam})`;
  },

  /**
   * Generate code to monitor and react to video position
   */
  videoEndTrigger: (videoInput: VmixInput, action: string, targetInput?: VmixInput, prerollMs = 500): string => {
    const targetParam = targetInput ? `, Input:="${escapeVbString(targetInput.title)}"` : '';
    const xpathTitle = escapeXPathInVb(videoInput.title);
    return `' Switch when video ends
Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim node As System.Xml.XmlNode = x.SelectSingleNode("//input[@title=${xpathTitle}]")
    If node IsNot Nothing Then
        Dim pos As Integer = CInt(node.Attributes("position").Value)
        Dim dur As Integer = CInt(node.Attributes("duration").Value)

        If dur > 0 And (dur - pos) <= ${prerollMs} Then
            API.Function("${action}"${targetParam})
            Sleep(2000) ' Prevent re-trigger
        End If
    End If

    Sleep(100)
Loop`;
  },

  /**
   * Generate code for audio ducking
   */
  audioDucking: (
    triggerInput: VmixInput,
    duckInput: VmixInput,
    normalVol: number,
    duckedVol: number
  ): string => {
    const triggerTitleEscaped = escapeVbString(triggerInput.title);
    const duckTitleEscaped = escapeVbString(duckInput.title);
    const xpathTitle = escapeXPathInVb(triggerInput.title);
    return `' Audio ducking - lower "${duckTitleEscaped}" when "${triggerTitleEscaped}" has audio
Dim isDucked As Boolean = False

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim node As System.Xml.XmlNode = x.SelectSingleNode("//input[@title=${xpathTitle}]")
    If node IsNot Nothing Then
        Dim level As Double = (CDbl(node.Attributes("meterF1").Value) + CDbl(node.Attributes("meterF2").Value)) / 2

        If level > 0.01 And Not isDucked Then
            API.Function("SetVolume", Input:="${duckTitleEscaped}", Value:="${duckedVol}")
            isDucked = True
        ElseIf level <= 0.01 And isDucked Then
            API.Function("SetVolume", Input:="${duckTitleEscaped}", Value:="${normalVol}")
            isDucked = False
        End If
    End If

    Sleep(50)
Loop`;
  },

  /**
   * Generate code for recording/streaming control
   */
  recordingControl: (action: 'start' | 'stop' | 'toggle', forStreaming = false): string => {
    const what = forStreaming ? 'Streaming' : 'Recording';
    const actions: Record<string, string> = {
      start: `Start${what}`,
      stop: `Stop${what}`,
      toggle: `StartStop${what}`,
    };
    return `API.Function("${actions[action]}")`;
  },
};

/**
 * Find inputs by partial name match (case-insensitive)
 */
function findInputs(state: VmixState, query: string): VmixInput[] {
  const lowerQuery = query.toLowerCase();
  return state.inputs.filter(
    (i) =>
      i.title.toLowerCase().includes(lowerQuery) ||
      i.type.toLowerCase().includes(lowerQuery) ||
      i.number.toString() === query
  );
}

/**
 * Find a single input by name or number
 */
function findInput(state: VmixState, query: string): VmixInput | undefined {
  // Exact match first
  const exact = state.inputs.find(
    (i) => i.title.toLowerCase() === query.toLowerCase() || i.number.toString() === query
  );
  if (exact) return exact;

  // Partial match
  const matches = findInputs(state, query);
  return matches[0];
}

export const generateTool = createTool({
  name: 'vmix_script_generate',
  description: `High-Impact Control only: generate a VB.NET script from a natural language description, with optional gated execution.
This tool reads your current vMix setup (input names, title fields, audio levels) and generates
a valid VB.NET script that uses your ACTUAL input names.

Example requests:
- "Cycle through my cameras every 10 seconds"
- "Show the lower third for 5 seconds then hide it"
- "When the intro video ends, cut to Camera 1"
- "Duck the background music when the host mic is active"
- "Update the scoreboard - home team 3, away team 2"

The generated script is validated for VB.NET syntax before returning.`,
  schema: z.object({
    description: z.string().describe('Natural language description of what the script should do'),
    execute: z
      .boolean()
      .optional()
      .default(false)
      .describe('High-Impact Control only. If true, execute the generated script after validation.'),
  }),
  handler: async (
    { description, execute }: { description: string; execute: boolean },
    ctx: ToolContext
  ) => {
    // Get current vMix state
    const state = await ctx.state.getState();

    // Build context for the response
    const vmixContext = buildGenerationContext(state);

    // Analyze the description and generate appropriate code
    const lowerDesc = description.toLowerCase();
    let script = '';
    let explanation = '';

    // =========================================================================
    // Pattern matching for common requests
    // =========================================================================

    // Camera/input cycling
    if (
      (lowerDesc.includes('cycle') || lowerDesc.includes('rotate') || lowerDesc.includes('switch between')) &&
      (lowerDesc.includes('camera') || lowerDesc.includes('input'))
    ) {
      // Extract interval
      const intervalMatch = lowerDesc.match(/(\d+)\s*(second|sec|s)/);
      const intervalMs = intervalMatch?.[1] ? parseInt(intervalMatch[1], 10) * 1000 : 10000;

      // Find camera inputs
      let cameras = state.inputs.filter(
        (i) =>
          i.type === 'Capture' ||
          i.type === 'NDI' ||
          i.title.toLowerCase().includes('cam') ||
          i.title.toLowerCase().includes('camera')
      );

      // If no cameras found, use all inputs except titles
      if (cameras.length === 0) {
        cameras = state.inputs.filter((i) => i.type !== 'GT' && i.type !== 'Title');
      }

      if (cameras.length < 2) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Not enough inputs found to cycle between. Found: ${cameras.map((c) => c.title).join(', ') || 'none'}\n\n${vmixContext}`,
            },
          ],
          isError: true,
        };
      }

      const useFade = lowerDesc.includes('fade') || lowerDesc.includes('dissolve');
      script = CODE_GENERATORS.switchInputs(cameras, intervalMs, useFade);
      explanation = `Cycles through ${cameras.length} inputs (${cameras.map((c) => c.title).join(', ')}) every ${intervalMs / 1000} seconds using ${useFade ? 'fade' : 'cut'} transitions.`;
    }

    // Timed overlay / lower third
    else if (
      (lowerDesc.includes('show') || lowerDesc.includes('display')) &&
      (lowerDesc.includes('lower third') ||
        lowerDesc.includes('overlay') ||
        lowerDesc.includes('graphic')) &&
      (lowerDesc.includes('second') || lowerDesc.includes('sec'))
    ) {
      const durationMatch = lowerDesc.match(/(\d+)\s*(second|sec|s)/);
      const durationMs = durationMatch?.[1] ? parseInt(durationMatch[1], 10) * 1000 : 5000;

      const channelMatch = lowerDesc.match(/overlay\s*(\d)/i) ?? lowerDesc.match(/channel\s*(\d)/i);
      const channel = channelMatch?.[1] ? parseInt(channelMatch[1], 10) : 1;

      // Find lower third or GT input
      const overlay = state.inputs.find(
        (i) =>
          i.type === 'GT' ||
          i.type === 'Title' ||
          i.title.toLowerCase().includes('lower') ||
          i.title.toLowerCase().includes('graphic') ||
          i.title.toLowerCase().includes('overlay')
      );

      if (!overlay) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No suitable overlay input found. Add a GT or Title input to your vMix setup.\n\n${vmixContext}`,
            },
          ],
          isError: true,
        };
      }

      script = CODE_GENERATORS.timedOverlay(overlay, channel, durationMs);
      explanation = `Shows "${overlay.title}" on overlay channel ${channel} for ${durationMs / 1000} seconds, then hides it.`;
    }

    // Video end trigger
    else if (
      (lowerDesc.includes('when') || lowerDesc.includes('after')) &&
      (lowerDesc.includes('video') || lowerDesc.includes('ends') || lowerDesc.includes('finishes'))
    ) {
      // Find video input
      const videoInput = state.inputs.find(
        (i) =>
          i.type === 'Video' ||
          i.type === 'VideoList' ||
          (i.duration && i.duration > 0) ||
          i.title.toLowerCase().includes('video') ||
          i.title.toLowerCase().includes('intro') ||
          i.title.toLowerCase().includes('outro')
      );

      if (!videoInput) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No video input found. Add a video file to your vMix setup.\n\n${vmixContext}`,
            },
          ],
          isError: true,
        };
      }

      // Find target input
      const targetMatch = lowerDesc.match(/(?:cut|switch|fade)\s+to\s+["']?([^"'\n,]+)["']?/i);
      let targetInput: VmixInput | undefined;

      if (targetMatch?.[1]) {
        targetInput = findInput(state, targetMatch[1].trim());
      } else {
        // Default to first camera
        targetInput = state.inputs.find(
          (i) => i.type === 'Capture' || i.type === 'NDI' || i.title.toLowerCase().includes('cam')
        );
      }

      const action = lowerDesc.includes('fade') ? 'Fade' : 'Cut';
      script = CODE_GENERATORS.videoEndTrigger(videoInput, action, targetInput);
      explanation = `Monitors "${videoInput.title}" and ${action.toLowerCase()}s to ${targetInput ? `"${targetInput.title}"` : 'the next input'} when it ends.`;
    }

    // Audio ducking
    else if (lowerDesc.includes('duck') || (lowerDesc.includes('lower') && lowerDesc.includes('audio'))) {
      // Find mic input
      const micInput = state.inputs.find(
        (i) =>
          i.title.toLowerCase().includes('mic') ||
          i.title.toLowerCase().includes('host') ||
          i.title.toLowerCase().includes('voice')
      );

      // Find background audio input
      const bgInput = state.inputs.find(
        (i) =>
          i.title.toLowerCase().includes('music') ||
          i.title.toLowerCase().includes('background') ||
          i.title.toLowerCase().includes('audio') ||
          i.type === 'AudioFile'
      );

      if (!micInput || !bgInput) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Could not find mic and background audio inputs. Found: ${state.inputs.map((i) => i.title).join(', ')}\n\n${vmixContext}`,
            },
          ],
          isError: true,
        };
      }

      script = CODE_GENERATORS.audioDucking(micInput, bgInput, 100, 30);
      explanation = `Lowers "${bgInput.title}" to 30% when "${micInput.title}" is active, restores to 100% when silent.`;
    }

    // Set text on title
    else if (
      (lowerDesc.includes('set') || lowerDesc.includes('update') || lowerDesc.includes('change')) &&
      (lowerDesc.includes('text') || lowerDesc.includes('title') || lowerDesc.includes('score'))
    ) {
      // Find title input
      const titleInput = state.inputs.find((i) => i.type === 'GT' || i.type === 'Title');

      if (!titleInput?.fields || Object.keys(titleInput.fields).length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No title input with text fields found.\n\n${vmixContext}`,
            },
          ],
          isError: true,
        };
      }

      // Try to extract field and value from description
      const fieldNames = Object.keys(titleInput.fields);
      const lines: string[] = ["' Update title text"];

      // Look for patterns like "name to John" or "name: John" or "name = John"
      for (const field of fieldNames) {
        const fieldLower = field.toLowerCase().replace('.text', '');
        const pattern = new RegExp(`${fieldLower}[\\s:=]+["']?([^"'\\n,]+)["']?`, 'i');
        const match = lowerDesc.match(pattern);

        if (match?.[1]) {
          lines.push(CODE_GENERATORS.setText(titleInput, field, match[1].trim()));
        }
      }

      if (lines.length === 1) {
        // No specific fields found, generate template
        lines.push(`' Available fields: ${fieldNames.join(', ')}`);
        for (const field of fieldNames.slice(0, 3)) {
          lines.push(CODE_GENERATORS.setText(titleInput, field, `New ${field} value`));
        }
      }

      script = lines.join('\n');
      explanation = `Updates text fields on "${titleInput.title}". Available fields: ${fieldNames.join(', ')}.`;
    }

    // Recording/streaming control
    else if (
      lowerDesc.includes('record') ||
      lowerDesc.includes('stream') ||
      lowerDesc.includes('recording') ||
      lowerDesc.includes('streaming')
    ) {
      const isStreaming =
        lowerDesc.includes('stream') && !lowerDesc.includes('record');
      const action: 'start' | 'stop' | 'toggle' = lowerDesc.includes('stop')
        ? 'stop'
        : lowerDesc.includes('start')
          ? 'start'
          : 'toggle';

      script = CODE_GENERATORS.recordingControl(action, isStreaming);
      explanation = `${action.charAt(0).toUpperCase() + action.slice(1)}s ${isStreaming ? 'streaming' : 'recording'}.`;
    }

    // Generic/unrecognized request - provide template and context
    else {
      script = `' Custom script for: ${description}
' Use this as a starting point

' Available API functions:
' API.Function("Cut", Input:="InputName")
' API.Function("Fade", Input:="InputName", Duration:=1000)
' API.Function("SetText", Input:="Title", SelectedName:="Field.Text", Value:="New Text")
' API.Function("SetVolume", Input:="InputName", Value:="80")
' API.Function("OverlayInput1In", Input:="InputName")
' API.Function("StartRecording")
' API.Function("StopRecording")
' Sleep(1000) ' Wait 1 second

${VMIX_SCRIPT_PATTERNS.readState()}

' Your logic here
' Remember: Use Sleep() in loops!
`;
      explanation = `Generated a template script. Customize it based on your needs. Here's your vMix setup for reference.`;
    }

    // Validate the generated script
    const validation = validateVmixScript(script);

    // Build response
    let response = `# Generated Script\n\n${explanation}\n\n`;
    response += `\`\`\`vb\n${script}\n\`\`\`\n\n`;

    if (!validation.valid) {
      response += `## Validation Errors\n${validation.errors.map((e) => `- ${e}`).join('\n')}\n\n`;
    }
    if (validation.warnings.length > 0) {
      response += `## Warnings\n${validation.warnings.map((w) => `- ${w}`).join('\n')}\n\n`;
    }

    response += `## Your vMix Setup\n${vmixContext}\n`;

    // Execute if requested and valid
    if (execute && validation.valid) {
      try {
        await ctx.vmix.http.execute('ScriptStartDynamic', { Value: script });
        response += `\n**Script executed successfully!**`;
      } catch (error) {
        response += `\n**Execution failed:** ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } else if (execute && !validation.valid) {
      response += `\n**Script NOT executed due to validation errors. Fix the errors and try again.**`;
    }

    return {
      content: [{ type: 'text' as const, text: response }],
      isError: !validation.valid,
    };
  },
});
