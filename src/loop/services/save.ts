/**
 * THE LAST LOOP — versioned save with a CrazyGames Data mirror.
 *
 * localStorage is the always-available base; when the CrazyGames SDK is
 * present its Data module acts as the authoritative cloud copy (newest wins).
 * No login is required; everything degrades to plain localStorage.
 */

import { getCrazyGamesData, setCrazyGamesData } from './crazygames';
import { PLAYER_START } from '../core/constants';
import type { InvestigationState, LoopState, PlayerState, Recording, GhostState } from '../core/types';

const SAVE_KEY = 'the-last-loop-save-v1';
export const SAVE_VERSION = 2;

export interface LevelResult {
  bestTimeMs: number | null;
  bestLoops: number | null;
}

export interface Level01Checkpoint {
  loop: number;
  t: number;
  totalTimeMs: number;
  player: PlayerState;
  investigation: InvestigationState;
  hasCard: boolean;
  playerSwitchOn: boolean;
  ghostSwitchOn: boolean;
  boxUnlocked: boolean;
  boxOpen: boolean;
  cardAvailable: boolean;
  door: 'locked' | 'unlocked' | 'open';
  doorTimerMs: number;
  warningFired: 0 | 1 | 2;
  currentRecording: Recording;
  pastSelves: Recording[];
}

export interface LastLoopSave {
  version: number;
  currentLevel: number;
  unlockedLevels: number[];
  results: Record<string, LevelResult>;
  settings: { music: boolean; sfx: boolean };
  tutorialCompleted: boolean;
  level01Investigation: InvestigationState;
  checkpoint: Level01Checkpoint | null;
  savedAt: number;
}

export function freshSave(): LastLoopSave {
  return {
    version: SAVE_VERSION,
    currentLevel: 1,
    unlockedLevels: [1],
    results: { '1': { bestTimeMs: null, bestLoops: null } },
    settings: { music: true, sfx: true },
    tutorialCompleted: false,
    level01Investigation: { note: false, clock: false, accessCard: false, terminal: false, cctv: false, badge07: false, suspectMara: false, timeline: false, recorder: false, finalRecording: false, exitCodeSolved: false },
    checkpoint: null,
    savedAt: 0,
  };
}


function sanitizeCheckpoint(raw: unknown): Level01Checkpoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<Level01Checkpoint>;
  const num = (v: unknown, f = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : f);
  if (!d.player || !d.currentRecording || !Array.isArray(d.pastSelves)) return null;
  return {
    loop: Math.max(0, Math.floor(num(d.loop))),
    t: Math.max(0, num(d.t)),
    totalTimeMs: Math.max(0, num(d.totalTimeMs)),
    player: {
      x: num(d.player.x, PLAYER_START.x), y: num(d.player.y, PLAYER_START.y), vx: num(d.player.vx), vy: num(d.player.vy),
      dir: d.player.dir === 'left' || d.player.dir === 'up' || d.player.dir === 'down' ? d.player.dir : 'right',
      moving: Boolean(d.player.moving), stride: num(d.player.stride),
    },
    investigation: {
      note: Boolean(d.investigation?.note), clock: Boolean(d.investigation?.clock), accessCard: Boolean(d.investigation?.accessCard),
      terminal: Boolean(d.investigation?.terminal), cctv: Boolean(d.investigation?.cctv), badge07: Boolean(d.investigation?.badge07),
      suspectMara: Boolean(d.investigation?.suspectMara), timeline: Boolean(d.investigation?.timeline), recorder: Boolean(d.investigation?.recorder),
      finalRecording: Boolean(d.investigation?.finalRecording), exitCodeSolved: Boolean(d.investigation?.exitCodeSolved),
    },
    hasCard: Boolean(d.hasCard), playerSwitchOn: Boolean(d.playerSwitchOn), ghostSwitchOn: Boolean(d.ghostSwitchOn),
    boxUnlocked: Boolean(d.boxUnlocked), boxOpen: Boolean(d.boxOpen), cardAvailable: Boolean(d.cardAvailable),
    door: d.door === 'unlocked' || d.door === 'open' ? d.door : 'locked', doorTimerMs: Math.max(0, num(d.doorTimerMs)),
    warningFired: d.warningFired === 2 ? 2 : d.warningFired === 1 ? 1 : 0,
    currentRecording: d.currentRecording as Recording,
    pastSelves: d.pastSelves as Recording[],
  };
}

function sanitize(raw: unknown): LastLoopSave {
  const d = (raw ?? {}) as Partial<LastLoopSave>;
  const num = (v: unknown, f: number) => (typeof v === 'number' && Number.isFinite(v) ? v : f);
  const results: Record<string, LevelResult> = {};
  if (d.results && typeof d.results === 'object') {
    for (const [key, value] of Object.entries(d.results)) {
      results[key] = {
        bestTimeMs: typeof value?.bestTimeMs === 'number' ? value.bestTimeMs : null,
        bestLoops: typeof value?.bestLoops === 'number' ? value.bestLoops : null,
      };
    }
  }
  return {
    version: SAVE_VERSION,
    currentLevel: Math.max(1, Math.floor(num(d.currentLevel, 1))),
    unlockedLevels: Array.isArray(d.unlockedLevels) ? d.unlockedLevels.map((n) => Math.max(1, Math.floor(Number(n) || 1))) : [1],
    results,
    settings: {
      music: d.settings ? Boolean(d.settings.music) : true,
      sfx: d.settings ? Boolean(d.settings.sfx) : true,
    },
    tutorialCompleted: Boolean(d.tutorialCompleted),
    level01Investigation: {
      note: Boolean(d.level01Investigation?.note),
      clock: Boolean(d.level01Investigation?.clock),
      accessCard: Boolean(d.level01Investigation?.accessCard),
      terminal: Boolean(d.level01Investigation?.terminal),
      cctv: Boolean(d.level01Investigation?.cctv),
      badge07: Boolean(d.level01Investigation?.badge07),
      suspectMara: Boolean(d.level01Investigation?.suspectMara),
      timeline: Boolean(d.level01Investigation?.timeline),
      recorder: Boolean(d.level01Investigation?.recorder),
      finalRecording: Boolean(d.level01Investigation?.finalRecording),
      exitCodeSolved: Boolean(d.level01Investigation?.exitCodeSolved),
    },
    checkpoint: d.checkpoint && typeof d.checkpoint === 'object' ? sanitizeCheckpoint(d.checkpoint) : null,
    savedAt: num(d.savedAt, 0),
  };
}

export function recordResult(save: LastLoopSave, level: number, timeMs: number, loops: number): LastLoopSave {
  const key = String(level);
  const old = save.results[key] ?? { bestTimeMs: null, bestLoops: null };
  const results = {
    ...save.results,
    [key]: {
      bestTimeMs: old.bestTimeMs === null ? timeMs : Math.min(old.bestTimeMs, timeMs),
      bestLoops: old.bestLoops === null ? loops : Math.min(old.bestLoops, loops),
    },
  };
  return {
    ...save,
    results,
    unlockedLevels: save.unlockedLevels.includes(level + 1) ? save.unlockedLevels : [...save.unlockedLevels, level + 1],
    currentLevel: Math.max(save.currentLevel, level),
    checkpoint: null,
  };
}

let pending: LastLoopSave | null = null;
let writeTimer: number | null = null;

function writeThrough(save: LastLoopSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // storage denied — keep playing from memory
  }
  void setCrazyGamesData(SAVE_KEY, JSON.stringify(save));
}

export function loadLoopSave(): LastLoopSave {
  let local: LastLoopSave | null = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) local = sanitize(JSON.parse(raw));
  } catch {
    local = null;
  }
  const chosen = local ?? { ...freshSave(), savedAt: Date.now() };
  writeThrough(chosen);
  // Cloud mirror loads asynchronously and wins when newer.
  void getCrazyGamesData(SAVE_KEY).then((cloud) => {
    if (!cloud) return;
    try {
      const cloudSave = sanitize(JSON.parse(cloud));
      if (cloudSave.savedAt > chosen.savedAt) {
        writeThrough(cloudSave);
        pending = cloudSave;
      }
    } catch {
      /* malformed cloud copy — ignore */
    }
  });
  return chosen;
}

export function saveLoopSave(mutate: (s: LastLoopSave) => LastLoopSave): LastLoopSave {
  pending = mutate(pending ?? loadLoopSave());
  pending.savedAt = Date.now();
  if (writeTimer !== null) window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    if (pending) writeThrough(pending);
    writeTimer = null;
  }, 500);
  return pending;
}

export function saveLoopSaveNow(mutate: (s: LastLoopSave) => LastLoopSave): LastLoopSave {
  pending = mutate(pending ?? loadLoopSave());
  pending.savedAt = Date.now();
  writeThrough(pending);
  return pending;
}


export function captureLevel01Checkpoint(state: LoopState): Level01Checkpoint {
  return {
    loop: state.loop,
    t: Math.round(state.t),
    totalTimeMs: Math.round(state.totalTimeMs),
    player: { ...state.player },
    investigation: { ...state.investigation },
    hasCard: state.hasCard,
    playerSwitchOn: state.playerSwitchOn,
    ghostSwitchOn: state.ghostSwitchOn,
    boxUnlocked: state.boxUnlocked,
    boxOpen: state.boxOpen,
    cardAvailable: state.cardAvailable,
    door: state.door,
    doorTimerMs: Math.round(state.doorTimerMs),
    warningFired: state.warningFired,
    currentRecording: JSON.parse(JSON.stringify(state.currentRecording)) as Recording,
    pastSelves: JSON.parse(JSON.stringify(state.pastSelves)) as Recording[],
  };
}

export function applyLevel01Checkpoint(state: LoopState, checkpoint: Level01Checkpoint): void {
  state.loop = checkpoint.loop;
  state.t = checkpoint.t;
  state.totalTimeMs = checkpoint.totalTimeMs;
  state.player = { ...checkpoint.player };
  state.investigation = { ...checkpoint.investigation };
  state.hasCard = checkpoint.hasCard;
  state.playerSwitchOn = checkpoint.playerSwitchOn;
  state.ghostSwitchOn = checkpoint.ghostSwitchOn;
  state.boxUnlocked = checkpoint.boxUnlocked;
  state.boxOpen = checkpoint.boxOpen;
  state.cardAvailable = checkpoint.cardAvailable;
  state.door = checkpoint.door;
  state.doorTimerMs = checkpoint.doorTimerMs;
  state.warningFired = checkpoint.warningFired;
  state.currentRecording = JSON.parse(JSON.stringify(checkpoint.currentRecording)) as Recording;
  state.pastSelves = JSON.parse(JSON.stringify(checkpoint.pastSelves)) as Recording[];
  state.ghosts = state.pastSelves.map((recording) => ({ recording, fired: 0, trail: [] }));
  state.phase = 'playing';
}

/** Flush any debounced write (pagehide). */
export function flushLoopSave(): void {
  if (pending) writeThrough(pending);
}
