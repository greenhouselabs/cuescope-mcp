/**
 * Helpers for detecting "silent video + paired music bed" patterns.
 */

import type { AudioBusName, VmixInput, VmixState } from '../../state/types.js';
import { analyzeInput, parseAudioBuses } from './analysis-helpers.js';

export interface PairedAudioMapping {
  bus: AudioBusName;
  video: VmixInput;
  music: VmixInput;
}

export type PairedAudioPlaybackBehavior = 'restart' | 'resume';
export type PairedAudioUnmappedBehavior = 'continueLast' | 'pauseAll';

export interface PairedAudioGenerationOptions {
  playbackBehavior: PairedAudioPlaybackBehavior;
  unmappedBehavior: PairedAudioUnmappedBehavior;
}

const GOAL_WORDS = [
  'matching music',
  'paired music',
  'music track',
  'audio bed',
  'music bed',
  'follow audio',
  'follow program',
  'goes to program',
  'hits program',
  'on program',
];
const AUDIO_BUS_NAMES = new Set<AudioBusName>(['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);

export function isPairedAudioGoal(goal: string): boolean {
  const lowerGoal = goal.toLowerCase();
  const mentionsMusic =
    /\b(music|bed|song|soundtrack)\b/.test(lowerGoal) ||
    /\baudio\s+(bed|track|file|follow)\b/.test(lowerGoal) ||
    /\b(matching|paired|follow)\s+audio\b/.test(lowerGoal);
  const mentionsProgram = /program|active|on\s+air|pgm/.test(lowerGoal);
  const mentionsVideo = /\b(video|clip|media)\b/.test(lowerGoal);
  const mentionsAutomation = /match|pair|follow|auto|when|whenever|correspond/.test(lowerGoal);
  const mentionsPairedAudioPhrase = GOAL_WORDS.some((word) => lowerGoal.includes(word));

  return mentionsMusic && mentionsAutomation && (mentionsProgram || mentionsVideo || mentionsPairedAudioPhrase);
}

export function parsePairedAudioGenerationOptions(goal: string): PairedAudioGenerationOptions {
  const lowerGoal = goal.toLowerCase();
  const resumeRequested =
    /\bresume\b/.test(lowerGoal) ||
    /current position/.test(lowerGoal) ||
    /keep (?:its |their )?position/.test(lowerGoal) ||
    /without restart/.test(lowerGoal) ||
    /no restart/.test(lowerGoal) ||
    /instead of restart/.test(lowerGoal);
  const mentionsUnmapped =
    /unmapped/.test(lowerGoal) ||
    /not mapped/.test(lowerGoal) ||
    /non[-\s]?mapped/.test(lowerGoal) ||
    /anything else/.test(lowerGoal) ||
    /other input/.test(lowerGoal) ||
    /non[-\s]?video/.test(lowerGoal);
  const asksPauseAll =
    /pause all/.test(lowerGoal) ||
    /pause every/.test(lowerGoal) ||
    /play none/.test(lowerGoal) ||
    /stop all/.test(lowerGoal) ||
    /silence/.test(lowerGoal) ||
    /kill (?:all )?music/.test(lowerGoal);

  return {
    playbackBehavior: resumeRequested ? 'resume' : 'restart',
    unmappedBehavior: mentionsUnmapped && asksPauseAll ? 'pauseAll' : 'continueLast',
  };
}

function inputBusList(input: VmixInput): AudioBusName[] {
  return (input.audioBusList ?? parseAudioBuses(input.audioBuses)).filter(
    (bus): bus is AudioBusName => AUDIO_BUS_NAMES.has(bus as AudioBusName)
  );
}

function nonMasterBuses(input: VmixInput): AudioBusName[] {
  return inputBusList(input).filter((bus) => bus !== 'M');
}

function textSignals(input: VmixInput): string {
  return `${input.title} ${input.type}`.toLowerCase().replace(/[_-]+/g, ' ');
}

function isCallerOrReturnPath(input: VmixInput, analysis = analyzeInput(input)): boolean {
  const signals = textSignals(input);
  const isCallInput =
    analysis.role === 'remoteGuest' ||
    analysis.productionRole.primary.role === 'callInput' ||
    analysis.productionRole.matches.some((match) => match.role === 'callInput' && match.confidence >= 0.8);
  const isReturnOrTalkback =
    /\b(return feed|return audio|caller return|call return|guest return|mix minus|ifb|talkback|green room|greenroom)\b/.test(
      signals
    );

  return isCallInput || isReturnOrTalkback;
}

function hasMusicBedSignal(input: VmixInput): boolean {
  const signals = textSignals(input);

  return (
    /\b(music|bed|song|theme|soundtrack|stinger|bumper|walk on|walkup)\b/.test(signals) ||
    /\.(mp3|wav|aac|m4a|flac)\b/i.test(input.title)
  );
}

function titleLooksLikeLiveAudioSource(title: string): boolean {
  return /\b(mic|microphone|ifb|talkback|return|call|caller|bus|mix[-\s]?minus|program|prod|op)\b/.test(title);
}

function isVideoCandidate(input: VmixInput): boolean {
  const analysis = analyzeInput(input);
  const type = input.type.toLowerCase();

  if (isCallerOrReturnPath(input, analysis)) return false;

  return (
    analysis.role === 'mediaPlayback' ||
    analysis.productionRole.primary.role === 'mediaPlayback' ||
    type.includes('video') ||
    input.duration > 0
  );
}

function isMusicCandidate(input: VmixInput): boolean {
  const analysis = analyzeInput(input);
  const title = input.title.toLowerCase();
  const type = input.type.toLowerCase();

  if (isCallerOrReturnPath(input, analysis)) return false;

  return (
    analysis.productionRole.primary.role === 'music' ||
    hasMusicBedSignal(input) ||
    /\.(mp3|wav|aac|m4a|flac)\b/i.test(title) ||
    title.includes('music') ||
    title.includes('bed') ||
    (type.includes('audio') && input.duration > 0 && !titleLooksLikeLiveAudioSource(title))
  );
}

function scoreMusicCandidate(video: VmixInput, music: VmixInput, bus: AudioBusName): number {
  const videoBuses = nonMasterBuses(video);
  const musicBuses = nonMasterBuses(music);
  let score = 0;

  if (musicBuses.includes(bus)) score += 4;
  if (videoBuses.length === 1 && musicBuses.length === 1) score += 2;
  if (!music.muted) score += 1;
  if (music.number > video.number) score += 0.5;
  if (music.state === 'Paused') score += 0.25;

  return score;
}

// findPairedAudioMappings is recomputed up to ~4x per request (production-summary
// risks + patterns, diagnose-audio, generators) and is pure over the state object.
// Memoize per VmixState; the returned array is treated read-only by all callers.
const pairedAudioCache = new WeakMap<VmixState, PairedAudioMapping[]>();

export function findPairedAudioMappings(state: VmixState): PairedAudioMapping[] {
  const cached = pairedAudioCache.get(state);
  if (cached) return cached;

  const mappings = computePairedAudioMappings(state);
  pairedAudioCache.set(state, mappings);
  return mappings;
}

function computePairedAudioMappings(state: VmixState): PairedAudioMapping[] {
  const videos = state.inputs.filter((input) => isVideoCandidate(input) && nonMasterBuses(input).length > 0);
  const musicInputs = state.inputs.filter(isMusicCandidate);
  const mappings: PairedAudioMapping[] = [];
  const usedMusicKeys = new Set<string>();

  for (const video of videos) {
    const candidateMappings = nonMasterBuses(video)
      .map((bus) => {
        const candidates = musicInputs
          .filter((music) => music.number !== video.number)
          .filter((music) => !usedMusicKeys.has(music.key || String(music.number)))
          .filter((music) => nonMasterBuses(music).includes(bus))
          .sort((left, right) => scoreMusicCandidate(video, right, bus) - scoreMusicCandidate(video, left, bus));

        const music = candidates[0];
        return music ? { bus, video, music } : null;
      })
      .filter((mapping): mapping is PairedAudioMapping => mapping !== null)
      .sort((left, right) => scoreMusicCandidate(video, right.music, right.bus) - scoreMusicCandidate(video, left.music, left.bus));

    const mapping = candidateMappings[0];
    if (!mapping) continue;

    mappings.push(mapping);
    usedMusicKeys.add(mapping.music.key || String(mapping.music.number));
  }

  return mappings.sort((left, right) => left.video.number - right.video.number);
}

export function findCurrentProgramPairedAudioMapping(
  state: VmixState,
  mappings: PairedAudioMapping[]
): PairedAudioMapping | null {
  return mappings.find((mapping) => mapping.video.number === state.active) ?? null;
}

export function mappingUsesMaster(mapping: PairedAudioMapping): boolean {
  return inputBusList(mapping.music).includes('M');
}
