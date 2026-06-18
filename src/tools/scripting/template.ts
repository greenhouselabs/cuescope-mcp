/**
 * vmix_script_template - Get pre-built VB.NET script templates
 * Provides ready-to-use scripts for common automation tasks
 */

import { z } from 'zod';
import { createTool, type ToolContext } from '../base.js';

const TEMPLATES = {
  'camera-cycle': {
    name: 'Camera Cycle',
    description: 'Automatically cycles through a list of inputs at a set interval',
    params: ['inputs (comma-separated)', 'intervalSeconds'],
    generate: (inputs: string[], intervalMs: number) => `' Camera Cycle Script
' Cycles through: ${inputs.join(', ')} every ${intervalMs / 1000} seconds

Dim inputs() As String = {${inputs.map((i) => `"${i}"`).join(', ')}}
Dim currentIndex As Integer = 0

Do While True
    API.Function("Cut", Input:=inputs(currentIndex))
    currentIndex = (currentIndex + 1) Mod inputs.Length
    Sleep(${intervalMs})
Loop`,
  },

  'auto-record-on-stream': {
    name: 'Auto Record When Streaming',
    description: 'Automatically starts recording when streaming starts, stops when streaming stops',
    params: [],
    generate: () => `' Auto Record When Streaming
' Monitors streaming state and syncs recording

Dim wasStreaming As Boolean = False

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim streaming As Boolean = (x.SelectSingleNode("//streaming").InnerText = "True")
    Dim recording As Boolean = (x.SelectSingleNode("//recording").InnerText = "True")

    If streaming And Not wasStreaming Then
        ' Streaming just started
        If Not recording Then
            API.Function("StartRecording")
        End If
    ElseIf Not streaming And wasStreaming Then
        ' Streaming just stopped
        If recording Then
            API.Function("StopRecording")
        End If
    End If

    wasStreaming = streaming
    Sleep(500)
Loop`,
  },

  'timed-lower-third': {
    name: 'Timed Lower Third',
    description: 'Shows a lower third overlay for a specified duration then hides it',
    params: ['overlayChannel', 'input', 'durationSeconds'],
    generate: (channel: number, input: string, durationMs: number) => `' Timed Lower Third
' Shows "${input}" on overlay ${channel} for ${durationMs / 1000} seconds

API.Function("OverlayInput${channel}In", Input:="${input}")
Sleep(${durationMs})
API.Function("OverlayInput${channel}Out")`,
  },

  'countdown-with-switch': {
    name: 'Countdown With Auto-Switch',
    description: 'Starts a countdown and automatically switches to another input when it reaches zero',
    params: ['countdownInput', 'targetInput', 'seconds'],
    generate: (countdownInput: string, targetInput: string, seconds: number) => `' Countdown With Auto-Switch
' Runs countdown on "${countdownInput}", then cuts to "${targetInput}"

' Set countdown to ${seconds} seconds
API.Function("SetCountdown", Input:="${countdownInput}", Value:="00:00:${seconds.toString().padStart(2, '0')}")
API.Function("StartCountdown", Input:="${countdownInput}")

' Wait for countdown
Sleep(${seconds * 1000})

' Switch to target
API.Function("Cut", Input:="${targetInput}")`,
  },

  'audio-ducking': {
    name: 'Audio Ducking',
    description: 'Monitors an input and ducks background audio when it has audio activity',
    params: ['micInput', 'bgInput', 'normalVolume', 'duckedVolume'],
    generate: (micInput: string, bgInput: string, normalVol: number, duckedVol: number) => `' Audio Ducking Script
' Ducks "${bgInput}" when "${micInput}" has audio

Dim isDucked As Boolean = False

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    ' Find mic input and check audio level
    Dim micNode As System.Xml.XmlNode = x.SelectSingleNode("//input[@title='${micInput}']")
    If micNode IsNot Nothing Then
        Dim meterF1 As Double = CDbl(micNode.Attributes("meterF1").Value)
        Dim meterF2 As Double = CDbl(micNode.Attributes("meterF2").Value)
        Dim avgLevel As Double = (meterF1 + meterF2) / 2

        If avgLevel > 0.01 And Not isDucked Then
            ' Mic active, duck background
            API.Function("SetVolume", Input:="${bgInput}", Value:="${duckedVol}")
            isDucked = True
        ElseIf avgLevel <= 0.01 And isDucked Then
            ' Mic silent, restore background
            API.Function("SetVolume", Input:="${bgInput}", Value:="${normalVol}")
            isDucked = False
        End If
    End If

    Sleep(50)
Loop`,
  },

  'video-end-switch': {
    name: 'Video End Auto-Switch',
    description: 'Monitors a video input and switches to another input when the video ends',
    params: ['videoInput', 'targetInput', 'prerollMs'],
    generate: (videoInput: string, targetInput: string, prerollMs: number) => `' Video End Auto-Switch
' Switches to "${targetInput}" when "${videoInput}" is about to end

Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim videoNode As System.Xml.XmlNode = x.SelectSingleNode("//input[@title='${videoInput}']")
    If videoNode IsNot Nothing Then
        Dim position As Integer = CInt(videoNode.Attributes("position").Value)
        Dim duration As Integer = CInt(videoNode.Attributes("duration").Value)
        Dim remaining As Integer = duration - position

        If remaining > 0 And remaining <= ${prerollMs} Then
            API.Function("Cut", Input:="${targetInput}")
            ' Wait before checking again to avoid multiple triggers
            Sleep(2000)
        End If
    End If

    Sleep(100)
Loop`,
  },

  'scheduled-action': {
    name: 'Scheduled Action',
    description: 'Executes an action at a specific time',
    params: ['hour', 'minute', 'action', 'actionInput'],
    generate: (hour: number, minute: number, action: string, input: string) => `' Scheduled Action
' Executes ${action} on "${input}" at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}

Dim triggered As Boolean = False

Do While True
    Dim now As DateTime = DateTime.Now

    If now.Hour = ${hour} And now.Minute = ${minute} And Not triggered Then
        API.Function("${action}", Input:="${input}")
        triggered = True
    ElseIf now.Minute <> ${minute} Then
        triggered = False
    End If

    Sleep(1000)
Loop`,
  },

  'recording-timer': {
    name: 'Recording Timer',
    description: 'Automatically stops recording after a specified duration',
    params: ['durationMinutes'],
    generate: (minutes: number) => `' Recording Timer
' Stops recording after ${minutes} minutes

' Start recording
API.Function("StartRecording")

' Wait for duration
Sleep(${minutes * 60 * 1000})

' Stop recording
API.Function("StopRecording")`,
  },
} as const;

type TemplateName = keyof typeof TEMPLATES;

export const templateTool = createTool({
  name: 'vmix_script_template',
  description: `Get pre-built VB.NET script templates for common vMix automation tasks.
Available templates: ${Object.keys(TEMPLATES).join(', ')}.
Use 'list' action to see all templates with descriptions, or 'get' to retrieve a specific template.`,
  schema: z.object({
    action: z.enum(['list', 'get']).describe("'list' to see available templates, 'get' to retrieve one"),
    template: z
      .string()
      .optional()
      .describe('Template name (required for get action)'),
    params: z
      .record(z.string())
      .optional()
      .describe('Parameters for the template (e.g., {"inputs": "Camera 1,Camera 2", "intervalSeconds": "10"})'),
  }),
  handler: async (
    {
      action,
      template,
      params,
    }: { action: 'list' | 'get'; template?: string; params?: Record<string, string> },
    _ctx: ToolContext
  ): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
    // Templates are generated synchronously but handler must be async for MCP SDK
    await Promise.resolve();

    if (action === 'list') {
      const list = Object.entries(TEMPLATES)
        .map(([key, t]) => {
          const paramList = t.params.length > 0 ? `\n   Params: ${t.params.join(', ')}` : '';
          return `- **${key}**: ${t.description}${paramList}`;
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `# Available Script Templates\n\n${list}\n\nUse action='get' with template name and params to generate a script.`,
          },
        ],
      };
    }

    // action === 'get'
    if (!template) {
      return {
        content: [{ type: 'text' as const, text: 'Error: template name is required for get action' }],
        isError: true,
      };
    }

    const templateDef = TEMPLATES[template as TemplateName];
    if (!templateDef) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Unknown template '${template}'. Available: ${Object.keys(TEMPLATES).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    // Generate script based on template
    let script: string;
    const p = params ?? {};

    // Numeric params must parse cleanly, otherwise generated scripts contain
    // NaN (e.g., Sleep(NaN)). Collect invalid params and reject before generating.
    const invalidParams: string[] = [];
    const numericParam = (key: string, defaultValue: number): number => {
      const raw = p[key];
      if (raw === undefined) return defaultValue;
      const trimmed = raw.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        invalidParams.push(`${key}="${raw}"`);
        return defaultValue;
      }
      return parseInt(trimmed, 10);
    };

    switch (template) {
      case 'camera-cycle': {
        const inputs = (p['inputs'] ?? 'Camera 1,Camera 2').split(',').map((s) => s.trim());
        const interval = numericParam('intervalSeconds', 10) * 1000;
        script = TEMPLATES['camera-cycle'].generate(inputs, interval);
        break;
      }
      case 'auto-record-on-stream':
        script = TEMPLATES['auto-record-on-stream'].generate();
        break;
      case 'timed-lower-third': {
        const channel = numericParam('overlayChannel', 1);
        const input = p['input'] ?? 'Lower Third';
        const duration = numericParam('durationSeconds', 5) * 1000;
        script = TEMPLATES['timed-lower-third'].generate(channel, input, duration);
        break;
      }
      case 'countdown-with-switch': {
        const countdownInput = p['countdownInput'] ?? 'Countdown';
        const targetInput = p['targetInput'] ?? 'Camera 1';
        const seconds = numericParam('seconds', 10);
        script = TEMPLATES['countdown-with-switch'].generate(countdownInput, targetInput, seconds);
        break;
      }
      case 'audio-ducking': {
        const micInput = p['micInput'] ?? 'Mic';
        const bgInput = p['bgInput'] ?? 'Background Music';
        const normalVol = numericParam('normalVolume', 100);
        const duckedVol = numericParam('duckedVolume', 30);
        script = TEMPLATES['audio-ducking'].generate(micInput, bgInput, normalVol, duckedVol);
        break;
      }
      case 'video-end-switch': {
        const videoInput = p['videoInput'] ?? 'Video';
        const targetInput = p['targetInput'] ?? 'Camera 1';
        const preroll = numericParam('prerollMs', 500);
        script = TEMPLATES['video-end-switch'].generate(videoInput, targetInput, preroll);
        break;
      }
      case 'scheduled-action': {
        const hour = numericParam('hour', 12);
        const minute = numericParam('minute', 0);
        const actionName = p['action'] ?? 'Cut';
        const actionInput = p['actionInput'] ?? 'Camera 1';
        script = TEMPLATES['scheduled-action'].generate(hour, minute, actionName, actionInput);
        break;
      }
      case 'recording-timer': {
        const minutes = numericParam('durationMinutes', 60);
        script = TEMPLATES['recording-timer'].generate(minutes);
        break;
      }
      default:
        return {
          content: [{ type: 'text' as const, text: `Error: Template '${template}' not implemented` }],
          isError: true,
        };
    }

    if (invalidParams.length > 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Error: non-numeric value(s) for numeric template parameter(s): ${invalidParams.join(', ')}. ` +
              'Provide whole numbers (as strings), e.g., {"intervalSeconds": "10"}.',
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `# ${templateDef.name}\n\n${templateDef.description}\n\n\`\`\`vb\n${script}\n\`\`\`\n\nReview this template before use. High-Impact Control exposes vmix_script_run for intentional execution.`,
        },
      ],
    };
  },
});
