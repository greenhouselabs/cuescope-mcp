/**
 * Shared input role inference for normalized vMix state
 */

import type { VmixInput } from './types.js';

export const INPUT_ROLES = [
  'camera',
  'remoteGuest',
  'titleGraphic',
  'imageGraphic',
  'audioOnly',
  'mediaPlayback',
  'browser',
  'virtualSet',
  'utility',
  'presentation',
  'unknown',
] as const;

export type InputRole = (typeof INPUT_ROLES)[number];

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function titleLooksAudioOnly(title: string): boolean {
  return (
    /\b(mic|microphone|audio|ifb|bus|mix[-\s]?minus|talkback)\b/.test(title) ||
    /\bcable[-\s]?[a-g]\b/.test(title)
  );
}

function titleLooksGraphicFeed(title: string): boolean {
  return /\b(gfx|graphic|graphics|playout|scorebug|scoreboard|lower[-\s]?third)\b/.test(title);
}

export function inferInputRole(input: VmixInput): InputRole {
  const type = input.type.toLowerCase();
  const title = input.title.toLowerCase();
  const hasFields = input.fields !== undefined && Object.keys(input.fields).length > 0;

  if (type.includes('call')) return 'remoteGuest';
  if (type.includes('ndi') && hasAny(title, ['guest', 'caller', 'remote'])) return 'remoteGuest';
  if (titleLooksAudioOnly(title)) return 'audioOnly';
  if (type.includes('ndi') && titleLooksGraphicFeed(title)) return 'imageGraphic';
  if (type.includes('capture') || type.includes('camera') || type.includes('webcam')) return 'camera';
  if (type.includes('ndi')) return 'camera';
  if (type === 'gt' || type === 'title' || type === 'xaml' || hasFields) return 'titleGraphic';
  if (type === 'image' || type === 'photos') return 'imageGraphic';
  if (type.includes('audio')) return 'audioOnly';
  if (type === 'video' || type === 'videolist' || input.duration > 0) return 'mediaPlayback';
  if (type === 'browser') return 'browser';
  if (type === 'virtualset' || type.includes('virtual')) return 'virtualSet';
  if (type === 'powerpoint') return 'presentation';
  if (type === 'colour' || type === 'color') return 'utility';

  return 'unknown';
}
