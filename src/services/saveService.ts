/**
 * THE SIGNAL — versioned save service.
 *
 * Single authoritative save model (v1) with:
 *  - progress (stars, best times/moves, unlocks)
 *  - mid-level checkpoint (resume where you quit)
 *  - map position/zoom
 *  - settings
 *  - corruption-safe load (sanitize → recover → fresh)
 *  - debounced ordinary writes; immediate writes for important events;
 *    flush on pagehide/visibilitychange.
 *  - optional CrazyGames Data sync when the SDK is present (never required).
 */

const SAVE_KEY = 'the-signal-save-v1';
export const SAVE_VERSION = 1;

declare global {
  interface Window {
    crazyGames?: {
      saveData?(key: string, value: string): void;
      loadDataSync?(key: string): string | null;
    };
  }
}

export interface LevelBest {
  stars: 0 | 1 | 2 | 3;
  bestMoves: number;
  bestTimeMs: number;
}

export interface Checkpoint {
  levelId: string;
  cells: string[];
  moves: number;
  elapsedMs: number;
  hintsUsed: number;
  savedAt: number;
}

export interface MapPos {
  x: number;
  y: number;
  zoom: number;
}

/** Daily spin wheel state — crystals are the collectible currency. */
export interface SpinState {
  crystals: number;
  /** Timestamp of the last free spin; a new one matures 24h later. */
  lastFreeSpinAt: number;
  /** Extra spins earned from rewarded ads, spendable any time. */
  bonusSpins: number;
}

/** Level-rescue tools, bought with crystals. */
export interface WeaponState {
  hammer: number;
  magic: number;
  swap: number;
}

export type WeaponId = 'hammer' | 'magic' | 'swap';

export const WEAPON_PRICES: Record<WeaponId, number> = { hammer: 50, magic: 75, swap: 40 };

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure daily gate: when does the next free spin mature (0 = ready now)? */
export function freeSpinWaitMs(lastFreeSpinAt: number, now = Date.now()): number {
  return Math.max(0, lastFreeSpinAt + DAY_MS - now);
}

export interface SignalSave {
  version: number;
  highestUnlocked: number;
  completed: Record<string, LevelBest>;
  checkpoint: Checkpoint | null;
  map: MapPos | null;
  settings: { muted: boolean; music: boolean; language: string; gameSpeed: number };
  stats: { totalMoves: number; hintsUsed: number; levelsCompleted: number };
  spin: SpinState;
  weapons: WeaponState;
  savedAt: number;
}

const FRESH: SignalSave = {
  version: SAVE_VERSION,
  highestUnlocked: 1,
  completed: {},
  checkpoint: null,
  map: null,
  settings: { muted: false, music: false, language: 'en', gameSpeed: 1 },
  stats: { totalMoves: 0, hintsUsed: 0, levelsCompleted: 0 },
  spin: { crystals: 0, lastFreeSpinAt: 0, bonusSpins: 0 },
  weapons: { hammer: 1, magic: 0, swap: 1 },
  savedAt: 0,
};

function sanitize(raw: unknown): SignalSave {
  const d = (raw ?? {}) as Partial<SignalSave>;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const completed: Record<string, LevelBest> = {};
  if (d.completed && typeof d.completed === 'object') {
    for (const [id, best] of Object.entries(d.completed)) {
      const b = best as Partial<LevelBest>;
      completed[id] = {
        stars: (Math.min(3, Math.max(0, num(b.stars, 0))) as 0 | 1 | 2 | 3),
        bestMoves: num(b.bestMoves, Number.POSITIVE_INFINITY),
        bestTimeMs: num(b.bestTimeMs, Number.POSITIVE_INFINITY),
      };
    }
  }
  const checkpoint =
    d.checkpoint && typeof d.checkpoint === 'object' && Array.isArray((d.checkpoint as Checkpoint).cells)
      ? {
          levelId: String((d.checkpoint as Checkpoint).levelId),
          cells: (d.checkpoint as Checkpoint).cells.map(String),
          moves: num((d.checkpoint as Checkpoint).moves, 0),
          elapsedMs: num((d.checkpoint as Checkpoint).elapsedMs, 0),
          hintsUsed: num((d.checkpoint as Checkpoint).hintsUsed, 0),
          savedAt: num((d.checkpoint as Checkpoint).savedAt, 0),
        }
      : null;
  const map =
    d.map && typeof d.map === 'object'
      ? { x: num((d.map as MapPos).x, 0), y: num((d.map as MapPos).y, 0), zoom: Math.min(2, Math.max(0.5, num((d.map as MapPos).zoom, 1))) }
      : null;
  return {
    version: SAVE_VERSION,
    highestUnlocked: Math.max(1, num(d.highestUnlocked, 1)),
    completed,
    checkpoint,
    map,
    settings: {
      muted: Boolean(d.settings?.muted),
      music: Boolean(d.settings?.music),
      language: typeof d.settings?.language === 'string' ? d.settings.language : 'en',
      gameSpeed: Math.min(1.5, Math.max(1, num(d.settings?.gameSpeed, 1))),
    },
    stats: {
      totalMoves: num(d.stats?.totalMoves, 0),
      hintsUsed: num(d.stats?.hintsUsed, 0),
      levelsCompleted: num(d.stats?.levelsCompleted, 0),
    },
    spin: {
      // TESTING ONLY: every save is topped up to this balance so all weapons
      // can be exercised freely. REMOVE THIS FLOOR BEFORE RELEASE.
      crystals: Math.max(10000, Math.floor(num(d.spin?.crystals, 0))),
      lastFreeSpinAt: num(d.spin?.lastFreeSpinAt, 0),
      bonusSpins: Math.max(0, Math.min(99, Math.floor(num(d.spin?.bonusSpins, 0)))),
    },
    weapons: {
      hammer: Math.max(0, Math.min(99, Math.floor(num(d.weapons?.hammer, 0)))),
      magic: Math.max(0, Math.min(99, Math.floor(num(d.weapons?.magic, 0)))),
      swap: Math.max(0, Math.min(99, Math.floor(num(d.weapons?.swap, 0)))),
    },
    savedAt: num(d.savedAt, 0),
  };
}

let writeTimer: number | null = null;
let pending: SignalSave | null = null;
let dirty = false;

function writeThrough(save: SignalSave): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // storage denied — the game keeps running, progress lives in memory
  }
  void window.crazyGames?.saveData?.(SAVE_KEY, JSON.stringify(save));
  dirty = false;
}

export function loadSave(): SignalSave {
  let local: SignalSave | null = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) local = sanitize(JSON.parse(raw));
  } catch {
    local = null; // malformed → fresh save below
  }
  const cloud = window.crazyGames?.loadDataSync?.(SAVE_KEY);
  let cloudSave: SignalSave | null = null;
  if (typeof cloud === 'string') {
    try {
      cloudSave = sanitize(JSON.parse(cloud));
    } catch {
      cloudSave = null;
    }
  }
  // Prefer whichever is newer when both exist.
  if (local && cloudSave) return (cloudSave.savedAt > local.savedAt ? cloudSave : local) as SignalSave;
  const chosen = cloudSave ?? local ?? { ...FRESH, savedAt: Date.now() };
  writeThrough(chosen);
  return chosen;
}

export function saveProgress(mutate: (s: SignalSave) => SignalSave): SignalSave {
  pending = mutate(pending ?? loadSave());
  pending.savedAt = Date.now();
  dirty = true;
  if (writeTimer !== null) window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    if (pending && dirty) writeThrough(pending);
    writeTimer = null;
  }, 800);
  return pending;
}

export function saveNow(mutate: (s: SignalSave) => SignalSave): SignalSave {
  pending = mutate(pending ?? loadSave());
  pending.savedAt = Date.now();
  writeThrough(pending);
  return pending;
}

/** Writes only if something actually changed since the last write. */
export function flushSave(): void {
  if (pending && dirty) {
    writeThrough(pending);
  }
}

export function resetProgress(): SignalSave {
  pending = { ...FRESH, savedAt: Date.now() };
  writeThrough(pending);
  return pending;
}

export function recordCompletion(
  save: SignalSave,
  levelId: string,
  index: number,
  stars: 0 | 1 | 2 | 3,
  moves: number,
  timeMs: number,
): SignalSave {
  return saveProgress((s) => {
    const old = s.completed[levelId];
    const completed = {
      ...s.completed,
      [levelId]: {
        stars: Math.max(old?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
        bestMoves: Math.min(old?.bestMoves ?? Number.POSITIVE_INFINITY, moves),
        bestTimeMs: Math.min(old?.bestTimeMs ?? Number.POSITIVE_INFINITY, timeMs),
      },
    };
    return {
      ...s,
      completed,
      highestUnlocked: Math.max(s.highestUnlocked, Math.min(60, index + 1)),
      checkpoint: null, // completing the level clears its checkpoint
      stats: {
        ...s.stats,
        totalMoves: s.stats.totalMoves + moves,
        levelsCompleted: Object.keys(completed).length,
      },
    };
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}
