/**
 * Normalized overlay and audio-routing topology helpers
 */

import type {
  AudioBusName,
  AudioChannel,
  VmixAudioRouting,
  VmixAudioRoutingInput,
  VmixAudioRoutingOutput,
  VmixAudioState,
  VmixInput,
  VmixOverlayChannel,
} from './types.js';
import { createInputLookup } from './input-lookup.js';

export const AUDIO_BUS_NAMES = ['M', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export function parseAudioBusList(audioBuses: string): AudioBusName[] {
  const seen = new Set<AudioBusName>();
  const parsed: AudioBusName[] = [];

  for (const rawBus of audioBuses.split(',')) {
    // Validate before narrowing — never cast an arbitrary string to AudioBusName.
    const bus = rawBus.trim().toUpperCase();
    if (!isAudioBusName(bus) || seen.has(bus)) continue;

    seen.add(bus);
    parsed.push(bus);
  }

  return parsed;
}

export function createOverlayChannels(
  overlays: (number | null)[],
  inputs: VmixInput[]
): VmixOverlayChannel[] {
  const lookup = createInputLookup(inputs);

  return overlays.map((inputNumber, index) => {
    const input = inputNumber !== null ? lookup.byNumber[String(inputNumber)] : undefined;
    const channel: VmixOverlayChannel = {
      channel: index + 1,
      inputNumber,
      active: inputNumber !== null,
    };

    if (input !== undefined) {
      channel.inputKey = input.key;
      channel.inputTitle = input.title;
    }

    return channel;
  });
}

export function createAudioRouting(inputs: VmixInput[], audio: VmixAudioState): VmixAudioRouting {
  const routing: VmixAudioRouting = {
    buses: createEmptyRoutingBuses(audio),
    unrouted: [],
  };

  for (const input of inputs) {
    const inputSummary = summarizeRoutingInput(input);
    const buses = input.audioBusList ?? parseAudioBusList(input.audioBuses);

    if (buses.length === 0) {
      routing.unrouted.push(inputSummary);
      continue;
    }

    for (const bus of buses) {
      routing.buses[bus].inputs.push(inputSummary);
    }
  }

  return routing;
}

function isAudioBusName(bus: string): bus is AudioBusName {
  return (AUDIO_BUS_NAMES as readonly string[]).includes(bus);
}

function createEmptyRoutingBuses(audio: VmixAudioState): VmixAudioRouting['buses'] {
  const buses = {} as VmixAudioRouting['buses'];

  for (const bus of AUDIO_BUS_NAMES) {
    buses[bus] = {
      bus,
      output: getRoutingOutput(audio, bus),
      inputs: [],
    };
  }

  return buses;
}

function getRoutingOutput(audio: VmixAudioState, bus: AudioBusName): VmixAudioRoutingOutput {
  const channel = getAudioChannel(audio, bus);

  return {
    parsed: channel !== null,
    volume: channel?.volume ?? null,
    muted: channel?.muted ?? null,
  };
}

export function getAudioChannel(audio: VmixAudioState, bus: AudioBusName): AudioChannel | null {
  switch (bus) {
    case 'M':
      // masterParsed === false means the parser assumed defaults because no
      // <master> element was present; report it like any other unparsed bus.
      return audio.masterParsed === false ? null : audio.master;
    case 'A':
      return audio.busA ?? null;
    case 'B':
      return audio.busB ?? null;
    case 'C':
      return audio.busC ?? null;
    case 'D':
      return audio.busD ?? null;
    case 'E':
      return audio.busE ?? null;
    case 'F':
      return audio.busF ?? null;
    case 'G':
      return audio.busG ?? null;
  }
}

function summarizeRoutingInput(input: VmixInput): VmixAudioRoutingInput {
  return {
    number: input.number,
    key: input.key,
    title: input.title,
    type: input.type,
    muted: input.muted,
  };
}
