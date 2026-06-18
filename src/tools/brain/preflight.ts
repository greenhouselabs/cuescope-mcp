/**
 * vmix_preflight - Go-live readiness report.
 * Composes existing read-only logic into one prioritized verdict.
 * Never mutates vMix.
 */
import { z } from 'zod';
import { createTool, toolJsonContent, errorResult, type ToolContext } from '../base.js';
import {
  analyzeInput,
  findInputByNumber,
  isLikelyAudioSource,
  isLikelyOfflinePlaceholder,
} from './analysis-helpers.js';
import { loadPresetFile } from '../../state/preset/preset-loader.js';
import { parsePresetFile } from '../../state/preset/preset-parser.js';
import { redactPresetFile } from '../../state/preset/preset-redaction.js';
import { crossReferencePreset } from '../../state/preset/cross-reference.js';
import { formatErrorMessage } from '../../errors/index.js';

interface PreflightFinding {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  detail?: string;
}

const schema = z.object({
  presetPath: z
    .string()
    .optional()
    .describe(
      'Optional .vmix path to also cross-reference saved scripts/triggers against live state.'
    ),
  presetContent: z
    .string()
    .optional()
    .describe('Optional raw .vmix content, alternative to presetPath.'),
});

export const preflightTool = createTool({
  name: 'vmix_preflight',
  description:
    'Go-live readiness report: reads live vMix state, runs heuristic checks on program, preview, ' +
    'audio, fade to black, overlays, and input roles, and returns a prioritized verdict ' +
    '(ready / caution / not-ready). Optionally cross-references a saved .vmix preset file. ' +
    'Read-only — never mutates vMix.',
  schema,
  handler: async (
    params: { presetPath?: string; presetContent?: string },
    ctx: ToolContext
  ) => {
    try {
      const state = await ctx.state.getState();
      const findings: PreflightFinding[] = [];

      // --- program check ---
      if (!state.active || state.active <= 0) {
        findings.push({
          severity: 'warning',
          category: 'program',
          message: 'No input is on Program.',
        });
      } else {
        const programInput = findInputByNumber(state, state.active);
        if (!programInput) {
          findings.push({
            severity: 'error',
            category: 'program',
            message: `Program input number ${state.active} is set but cannot be found in the current state.`,
          });
        } else {
          const analysis = analyzeInput(programInput);
          if (analysis.muted && isLikelyAudioSource(analysis.role)) {
            findings.push({
              severity: 'error',
              category: 'program',
              message: `Program input "${analysis.title}" is muted — no audio is going to air.`,
              detail: `Input #${analysis.number} (role: ${analysis.role}) is muted while on Program.`,
            });
          }
          if (isLikelyOfflinePlaceholder(analysis)) {
            findings.push({
              severity: 'warning',
              category: 'program',
              message: `Program input "${analysis.title}" looks like an offline/slate placeholder.`,
              detail: `Input #${analysis.number} (type: ${analysis.type}) is on Program; confirm this is intentional before treating Program as show-ready.`,
            });
          }
          if (analysis.role === 'mediaPlayback' && analysis.state !== 'Running') {
            findings.push({
              severity: 'warning',
              category: 'program',
              message: `Program input "${analysis.title}" is ${analysis.state || 'stopped'} (media not playing).`,
              detail: `Input #${analysis.number} is on Program but not in the Running state.`,
            });
          }
        }
      }

      // --- preview check ---
      if (state.preview && state.preview > 0) {
        const previewInput = findInputByNumber(state, state.preview);
        if (!previewInput) {
          findings.push({
            severity: 'warning',
            category: 'preview',
            message: `Preview input number ${state.preview} is set but cannot be found in the current state.`,
          });
        } else {
          const analysis = analyzeInput(previewInput);
          if (analysis.role === 'mediaPlayback' && analysis.state !== 'Running') {
            findings.push({
              severity: 'warning',
              category: 'preview',
              message: `Preview input "${analysis.title}" is ${analysis.state || 'stopped'} — it will not be playing when you cut to it.`,
              detail: `Input #${analysis.number} is on Preview but not in the Running state.`,
            });
          }
        }
      }

      // --- audio checks ---
      if (state.audio?.master?.muted) {
        findings.push({
          severity: 'error',
          category: 'audio',
          message: 'Master audio is muted.',
        });
      }

      const mutedAudioInputs = (state.inputs ?? []).filter((input) => {
        const analysis = analyzeInput(input);
        return analysis.muted && analysis.audioBuses.length > 0;
      });
      if (mutedAudioInputs.length > 0) {
        const names = mutedAudioInputs
          .map((i) => `"${i.title}" (#${i.number})`)
          .join(', ');
        findings.push({
          severity: 'warning',
          category: 'audio',
          message: `${mutedAudioInputs.length} input(s) are muted but routed to audio buses: ${names}.`,
          detail: 'These inputs have bus assignments but are muted — intentional monitoring mutes are fine, but check if any should be audible.',
        });
      }

      // --- state checks ---
      if (state.fadeToBlack) {
        findings.push({
          severity: 'warning',
          category: 'state',
          message: 'Fade to Black is active.',
          detail: 'All program output is faded to black. Disable before going live.',
        });
      }

      findings.push({
        severity: 'info',
        category: 'state',
        message: `Recording: ${state.recording ? 'ON' : 'OFF'} | Streaming: ${state.streaming ? 'ON' : 'OFF'} | External: ${state.external ? 'ON' : 'OFF'}.`,
        detail: 'Status reported for awareness; not used to determine readiness.',
      });

      // --- overlay checks ---
      const overlays = state.overlays ?? [];
      for (let i = 0; i < overlays.length; i++) {
        const inputNumber = overlays[i];
        if (inputNumber !== null && inputNumber !== undefined) {
          const overlayInput = findInputByNumber(state, inputNumber);
          if (!overlayInput) {
            findings.push({
              severity: 'warning',
              category: 'overlay',
              message: `Overlay channel ${i + 1} references input #${inputNumber}, which is not found in the current state.`,
            });
          } else {
            findings.push({
              severity: 'info',
              category: 'overlay',
              message: `Overlay channel ${i + 1} is showing "${overlayInput.title}".`,
            });
          }
        }
      }

      // --- inputs check: live source detection ---
      const inputAnalyses = (state.inputs ?? []).map((input) => analyzeInput(input));
      const hasLiveSource = inputAnalyses.some(
        (a) => a.role === 'camera' || a.role === 'remoteGuest'
      );
      if (!hasLiveSource) {
        findings.push({
          severity: 'warning',
          category: 'inputs',
          message: 'No live camera or remote-guest source detected.',
          detail: 'No inputs with a camera or remote-guest role were found. If this is an expected configuration, ignore this warning.',
        });
      }

      // --- preset cross-reference (optional) ---
      if (params.presetPath || params.presetContent) {
        try {
          const loaded = loadPresetFile({
            path: params.presetPath,
            content: params.presetContent,
          });
          const preset = redactPresetFile(parsePresetFile(loaded));
          const crossFindings = crossReferencePreset(preset, state);
          for (const f of crossFindings) {
            findings.push({
              severity: f.severity,
              category: 'preset',
              message: f.message,
              detail: f.detail,
            });
          }
        } catch (presetError) {
          findings.push({
            severity: 'warning',
            category: 'preset',
            message: 'Could not read the provided preset file.',
            detail: formatErrorMessage(presetError),
          });
        }
      }

      // --- verdict ---
      const errors = findings.filter((f) => f.severity === 'error').length;
      const warnings = findings.filter((f) => f.severity === 'warning').length;
      const info = findings.filter((f) => f.severity === 'info').length;

      const verdict: 'not-ready' | 'caution' | 'ready' =
        errors > 0 ? 'not-ready' : warnings > 0 ? 'caution' : 'ready';

      // Program/preview title lookup for the summary
      const programInput =
        state.active > 0 ? findInputByNumber(state, state.active) : null;
      const previewInput =
        state.preview > 0 ? findInputByNumber(state, state.preview) : null;

      return toolJsonContent({
        verdict,
        summary: { errors, warnings, info },
        program: {
          inputNumber: state.active ?? null,
          title: programInput?.title ?? null,
        },
        preview: {
          inputNumber: state.preview ?? null,
          title: previewInput?.title ?? null,
        },
        findings,
        note: 'Read-only go-live readiness report. No vMix state was mutated.',
        assumptions: [
          'Heuristic readiness checks; confirm against your rundown.',
          'Recording/streaming/FTB states are reported for awareness, not judged.',
        ],
      });
    } catch (error) {
      return errorResult(formatErrorMessage(error));
    }
  },
});
