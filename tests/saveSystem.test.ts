/**
 * Save-system tests: identity of tile values through save/load, corruption
 * recovery, migration, completion bookkeeping, and checkpoint restore.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DAY_MS,
  freeSpinWaitMs,
  loadSave,
  recordCompletion,
  saveProgress,
  saveNow,
  flushSave,
  type SignalSave,
} from '../src/services/saveService';
import {
  hashSeed,
  mulberry32,
  restoreBoard,
  scrambleFromSolved,
  type SignalLevelDef,
} from '../src/engine/signalEngine';

// Minimal localStorage stub (vitest node environment has none).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    addEventListener: () => undefined,
    crazyGames: undefined,
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: { addEventListener: () => undefined, visibilityState: 'visible' },
  configurable: true,
});

const def: SignalLevelDef = {
  id: 'S01',
  chapter: 1,
  index: 1,
  name: 'The Signal',
  subtitle: 'test',
  size: 3,
  solvedValues: [...'CATDOGSUN'],
  startCells: [],
  lockedCells: [],
  wildcardCells: [],
  targets: [
    { kind: 'line', orientation: 'row', index: 0, values: [...'CAT'] },
    { kind: 'line', orientation: 'row', index: 1, values: [...'DOG'] },
    { kind: 'line', orientation: 'row', index: 2, values: [...'SUN'] },
  ],
  maxMoves: 12,
  parMoves: 8,
  timeLimitMs: 90_000,
  starMoves: { three: 8, two: 11 },
  difficulty: 'very easy',
  background: 'signal-01',
};

beforeEach(() => {
  store.clear();
});

describe('saveService', () => {
  it('fresh save is safe for a new player', () => {
    const s = loadSave();
    expect(s.highestUnlocked).toBe(1);
    expect(s.completed).toEqual({});
  });

  it('malformed saves never crash — they recover to a safe state', () => {
    store.set('the-signal-save-v1', '{not json at all!!');
    const s = loadSave();
    expect(s.highestUnlocked).toBe(1);
  });

  it('sanitizes partially-corrupt fields instead of crashing', () => {
    store.set(
      'the-signal-save-v1',
      JSON.stringify({ version: 1, highestUnlocked: 'banana', completed: { S01: { stars: 9, bestMoves: 'x' } } }),
    );
    const s = loadSave();
    expect(s.highestUnlocked).toBe(1);
    expect(s.completed.S01.stars).toBe(3);
  });

  it('completion unlocks the next level and survives reload', () => {
    let s: SignalSave = loadSave();
    s = recordCompletion(s, 'S01', 1, 3, 8, 51_000);
    saveNow((cur) => ({ ...cur, ...s }));
    const reloaded = loadSave();
    expect(reloaded.highestUnlocked).toBe(2);
    expect(reloaded.completed.S01).toMatchObject({ stars: 3, bestMoves: 8 });
  });

  it('mid-level checkpoint restores the exact tile permutation', () => {
    const rng = mulberry32(hashSeed('cp-test'));
    const { state } = scrambleFromSolved(def, 8, rng);
    saveProgress((s) => ({
      ...s,
      checkpoint: { levelId: 'S01', cells: [...state.cells], moves: 3, elapsedMs: 21_500, hintsUsed: 1, savedAt: Date.now() },
    }));
    flushSave();
    const reloaded = loadSave();
    expect(reloaded.checkpoint).not.toBeNull();
    const board = restoreBoard(def, reloaded.checkpoint!.cells);
    // Tile values come from the level definition keyed by tile id — identical.
    for (const id of Object.keys(state.tiles)) {
      expect(board.tiles[id].value).toBe(state.tiles[id].value);
    }
    expect(reloaded.checkpoint!.moves).toBe(3);
  });

  it('completing a level clears its checkpoint', () => {
    let s: SignalSave = loadSave();
    s = saveNow((cur) => ({ ...cur, checkpoint: { levelId: 'S01', cells: ['t00'], moves: 2, elapsedMs: 1, hintsUsed: 0, savedAt: 1 } }));
    s = recordCompletion(s, 'S01', 1, 2, 9, 60_000);
    expect(s.checkpoint).toBeNull();
  });
});

describe('daily spin state', () => {
  beforeEach(() => {
    saveNow((s) => ({ ...s, spin: { crystals: 0, lastFreeSpinAt: 0, bonusSpins: 0 } }));
  });

  it('a fresh save starts with the 10000 dev test balance and a ready free spin', () => {
    const s = loadSave();
    // TESTING ONLY: sanitize floors crystals at 10000 until release.
    expect(s.spin.crystals).toBe(10000);
    expect(s.spin.bonusSpins).toBe(0);
    expect(freeSpinWaitMs(s.spin.lastFreeSpinAt)).toBe(0);
  });

  it('a free spin matures exactly 24h after the last one', () => {
    const now = 1_000_000_000;
    expect(freeSpinWaitMs(now, now)).toBe(DAY_MS);
    expect(freeSpinWaitMs(now, now + DAY_MS - 1)).toBe(1);
    expect(freeSpinWaitMs(now, now + DAY_MS)).toBe(0);
    expect(freeSpinWaitMs(now, now + 3 * DAY_MS)).toBe(0);
  });

  it('spin fields survive save/load sanitization', () => {
    saveNow((s) => ({ ...s, spin: { crystals: 32000, lastFreeSpinAt: 555, bonusSpins: 2 } }));
    const loaded = loadSave().spin;
    expect(loaded.lastFreeSpinAt).toBe(555);
    expect(loaded.bonusSpins).toBe(2);
    expect(loaded.crystals).toBeGreaterThanOrEqual(10000); // dev floor
    // Corrupt input clamps to sane values instead of poisoning the save.
    saveNow((s) => ({ ...s, spin: { crystals: -50, lastFreeSpinAt: 555, bonusSpins: 4000 } }));
    expect(loadSave().spin.bonusSpins).toBe(99);
    expect(loadSave().spin.crystals).toBe(10000); // floored, never negative
  });
});
