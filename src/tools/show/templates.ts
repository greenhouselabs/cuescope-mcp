/**
 * Show Templates - Predefined configurations for common production setups
 */

export interface ParticipantConfig {
  name: string;
  title?: string;
  camera: {
    type: 'ndi' | 'capture' | 'existing' | 'webcam';
    source: string;
  };
  microphone: {
    type: 'embedded' | 'separate' | 'existing';
    source?: string;
    bus: string[];
  };
}

export interface ShowOptions {
  lowerThirdPath?: string;
  logoBugPath?: string;
  startingSoonPath?: string;
  brbPath?: string;
  includeMusic?: boolean;
  musicPath?: string;
  musicDuckLevel?: number;
  includeIntro?: boolean;
  introPath?: string;
  includeOutro?: boolean;
  outroPath?: string;
  includeStinger?: boolean;
  stingerPath?: string;
}

export interface ShowConfig {
  template: string;
  name: string;
  participants: ParticipantConfig[];
  options: ShowOptions;
}

export interface ShowTemplate {
  id: string;
  name: string;
  description: string;
  participantCount: { min: number; max: number };
  features: string[];
  defaultOptions: ShowOptions;
  audioRouting: {
    master: string[];
    busA?: string[];
    busB?: string[];
    busC?: string[];
  };
  overlayAssignments: {
    channel1: string;
    channel2: string;
    channel3: string;
    channel4: string;
  };
  multiviews: {
    name: string;
    layout: 'quad' | 'side-by-side' | 'pip-corner' | 'thirds';
    description: string;
  }[];
}

/**
 * Available show templates
 */
export const SHOW_TEMPLATES: Record<string, ShowTemplate> = {
  'four-person-podcast': {
    id: 'four-person-podcast',
    name: 'Four Person Podcast',
    description: 'Complete 4-person podcast setup with quad view, individual mics, lower thirds, and music ducking',
    participantCount: { min: 2, max: 4 },
    features: [
      'Quad split view (2x2 grid)',
      'Individual camera inputs',
      'Per-participant lower thirds',
      'Background music with auto-ducking',
      'Starting soon / BRB screens',
      'Intro/outro videos',
      'Stinger transitions',
      'ISO audio recording bus',
    ],
    defaultOptions: {
      includeMusic: true,
      musicDuckLevel: 20,
      includeIntro: true,
      includeStinger: true,
    },
    audioRouting: {
      master: ['all-mics', 'music'],
      busA: ['all-mics'], // ISO recording
      busB: ['others-only'], // Host headphones
    },
    overlayAssignments: {
      channel1: 'Lower thirds',
      channel2: 'Logo bug (persistent)',
      channel3: 'Alerts',
      channel4: 'Full-screen (Starting Soon, BRB)',
    },
    multiviews: [
      {
        name: 'Quad View',
        layout: 'quad',
        description: 'All 4 participants in 2x2 grid',
      },
    ],
  },

  'two-person-podcast': {
    id: 'two-person-podcast',
    name: 'Two Person Podcast',
    description: 'Simple 2-person podcast with side-by-side view',
    participantCount: { min: 2, max: 2 },
    features: [
      'Side-by-side split view',
      'Individual camera inputs',
      'Per-participant lower thirds',
      'Background music with auto-ducking',
    ],
    defaultOptions: {
      includeMusic: true,
      musicDuckLevel: 30,
    },
    audioRouting: {
      master: ['all-mics', 'music'],
    },
    overlayAssignments: {
      channel1: 'Lower thirds',
      channel2: 'Logo bug',
      channel3: 'Unused',
      channel4: 'Full-screen graphics',
    },
    multiviews: [
      {
        name: 'Side by Side',
        layout: 'side-by-side',
        description: 'Host and guest side by side',
      },
    ],
  },

  'talk-show': {
    id: 'talk-show',
    name: 'Talk Show',
    description: 'Multi-camera talk show with host desk and guest area',
    participantCount: { min: 2, max: 6 },
    features: [
      'Multiple camera angles',
      'Wide shot + individual shots',
      'Over-the-shoulder graphics',
      'Full show package (intro, bumpers, stingers)',
      'Multi-view layouts',
    ],
    defaultOptions: {
      includeMusic: true,
      musicDuckLevel: 15,
      includeIntro: true,
      includeOutro: true,
      includeStinger: true,
    },
    audioRouting: {
      master: ['all-mics', 'music', 'sfx'],
      busA: ['all-mics'],
      busB: ['music', 'sfx'],
    },
    overlayAssignments: {
      channel1: 'Lower thirds',
      channel2: 'Logo bug',
      channel3: 'OTS graphics',
      channel4: 'Full-screen',
    },
    multiviews: [
      {
        name: 'Wide Shot',
        layout: 'quad',
        description: 'Full set view',
      },
      {
        name: 'Two Shot',
        layout: 'side-by-side',
        description: 'Host + Guest',
      },
    ],
  },
};

/**
 * Get a template by ID
 */
export function getTemplate(id: string): ShowTemplate | undefined {
  return SHOW_TEMPLATES[id];
}

/**
 * List all available templates
 */
export function listTemplates(): { id: string; name: string; description: string }[] {
  return Object.values(SHOW_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
}
