/**
 * Phase 0 gate: solver + validator + transform engine tests against
 * hand-built fixtures. These must pass before any UI work ships.
 */
import { describe, expect, it } from 'vitest';
import { WordGraph, diffPosition } from '../src/engine/wordGraph';
import { isGoal, tryMove } from '../src/engine/transformEngine';
import { solve } from '../src/engine/puzzleSolver';
import { validateLevel } from '../src/engine/puzzleValidator';
import { starsFor } from '../src/engine/scoreSystem';
import type { LevelData } from '../src/engine/types';

const WORDS = [
  // 3-letter ladder soup
  'cat', 'cot', 'dot', 'dog', 'cog', 'log', 'hog', 'got', 'not', 'hat', 'rat',
  'mat', 'can', 'man', 'fan', 'big', 'bag', 'beg', 'bit', 'bat', 'bet', 'sat',
  'set', 'sit', 'sin', 'pin', 'tin', 'win', 'won', 'ran', 'run', 'sun', 'fun',
  'car', 'bar', 'far', 'tar', 'cap', 'cup', 'pup', 'pop', 'top', 'tap', 'nap',
  // 4-letter ladder soup
  'cold', 'cord', 'card', 'ward', 'warm', 'word', 'wood', 'mood', 'cook',
  'cool', 'curd', 'hate', 'have', 'hove', 'love', 'late', 'lane', 'land',
  'bond', 'band', 'bend', 'send', 'sent', 'tent', 'tend', 'wove', 'wave',
  'cave', 'cane', 'dine', 'line', 'lime', 'time', 'tame', 'name', 'same',
  'sand', 'wand', 'care', 'fare', 'farm', 'form', 'from', 'ford', 'bold',
  'bald', 'ball', 'bell', 'belt', 'melt', 'molt', 'malt', 'halt',
];

const graph = new WordGraph(WORDS);

const level = (partial: Partial<LevelData>): LevelData => ({
  id: 'test',
  world: 1,
  name: 'Test',
  slots: [{ startWord: 'cat', targetWord: 'dog', lockedPositions: [] }],
  wildcardCount: 0,
  optimalMoveCount: 0,
  ...partial,
});

function replayIsValid(lvl: LevelData, path: ReturnType<typeof solve> extends null ? never : NonNullable<ReturnType<typeof solve>>['path']) {
  let state = { words: lvl.slots.map((s) => s.startWord), wildUsed: 0 };
  for (const m of path) {
    const res = tryMove(lvl, state, m.slot, m.position, m.toLetter, graph);
    expect(res.ok, `move ${JSON.stringify(m)} rejected: ${res.ok ? '' : res.reason}`).toBe(true);
    if (res.ok) state = res.nextState;
  }
  expect(isGoal(lvl, state)).toBe(true);
}

describe('wordGraph', () => {
  it('finds single-position-diff edges only', () => {
    expect(diffPosition('cold', 'cord')).toBe(2);
    expect(diffPosition('cat', 'dog')).toBe(-1);
    expect(diffPosition('cold', 'cold')).toBe(-1);
    expect(graph.neighbors('cold')).toContain('cord');
    expect(graph.neighbors('cold')).not.toContain('warm');
    expect(graph.neighbors('cat')).toContain('cot');
  });
});

describe('puzzleSolver (unconstrained)', () => {
  it('solves CAT→DOG in 3 moves', () => {
    const r = solve(level({}), graph);
    expect(r).not.toBeNull();
    expect(r!.path.length).toBe(3);
    replayIsValid(level({}), r!.path);
  });

  it('solves COLD→WARM in 4 moves', () => {
    const lvl = level({ slots: [{ startWord: 'cold', targetWord: 'warm', lockedPositions: [] }] });
    const r = solve(lvl, graph);
    expect(r).not.toBeNull();
    expect(r!.path.length).toBe(4);
    replayIsValid(lvl, r!.path);
  });

  it('returns an empty path when already solved', () => {
    const lvl = level({ slots: [{ startWord: 'dog', targetWord: 'dog', lockedPositions: [] }] });
    expect(solve(lvl, graph)!.path).toHaveLength(0);
  });
});

describe('transformEngine (locks & wildcards)', () => {
  const locked = level({
    slots: [{ startWord: 'cold', targetWord: 'warm', lockedPositions: [0] }],
    wildcardCount: 0,
  });
  const wild = { ...locked, wildcardCount: 1 };
  const start = { words: ['cold'], wildUsed: 0 };

  it('rejects changing a locked position without a wildcard', () => {
    expect(tryMove(locked, start, 0, 0, 'w', graph)).toMatchObject({ ok: false, reason: 'locked-position' });
  });

  it('allows a wildcard to break a lock exactly once', () => {
    // Route like the solver does: cold→cord→card, then wildcard card→ward.
    let state = start;
    for (const [pos, letter] of [[2, 'r'], [1, 'a']] as const) {
      const step = tryMove(wild, state, 0, pos, letter, graph);
      expect(step.ok).toBe(true);
      if (step.ok) state = step.nextState;
    }
    const res = tryMove(wild, state, 0, 0, 'w', graph);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.move.usedWildcard).toBe(true);
      expect(res.nextState.wildUsed).toBe(1);
    }
    // Wildcard budget is spent: another locked change is refused…
    const state2 = { words: ['ward'], wildUsed: 1 };
    expect(tryMove(wild, state2, 0, 0, 'c', graph)).toMatchObject({ ok: false, reason: 'no-wildcard-left' });
    // …but unlocked positions keep working.
    expect(tryMove(wild, state2, 0, 3, 'm', graph)).toMatchObject({ ok: true });
  });

  it('rejects words outside the curated dictionary', () => {
    expect(tryMove(locked, start, 0, 1, 'u', graph)).toMatchObject({ ok: false, reason: 'invalid-word' });
  });

  it('rejects no-op letter changes', () => {
    expect(tryMove(locked, start, 0, 0, 'c', graph)).toMatchObject({ ok: false, reason: 'not-a-change' });
  });
});

describe('puzzleSolver (locks + wildcard)', () => {
  it('solves a locked level only via the wildcard', () => {
    const lvl = level({
      slots: [{ startWord: 'cold', targetWord: 'warm', lockedPositions: [0] }],
      wildcardCount: 1,
    });
    const r = solve(lvl, graph);
    expect(r).not.toBeNull();
    expect(r!.path.length).toBe(4); // cold→cord→card→(wild)ward→warm
    expect(r!.path.some((m) => m.usedWildcard)).toBe(true);
    replayIsValid(lvl, r!.path);
  });

  it('reports unreachable when a lock can never be crossed', () => {
    const lvl = level({
      slots: [{ startWord: 'cold', targetWord: 'warm', lockedPositions: [0] }],
      wildcardCount: 0,
    });
    expect(solve(lvl, graph)).toBeNull();
  });
});

describe('word reactions (two slots)', () => {
  // Editing slot A's letter 0 to L forces slot B's letter 0 to W.
  const rule = { triggerSlot: 0, triggerPosition: 0, triggerLetter: 'l', resultSlot: 1, resultPosition: 0, resultLetter: 'w' };
  const reactive = level({
    world: 3,
    slots: [
      { startWord: 'hate', targetWord: 'love', lockedPositions: [] },
      { startWord: 'cold', targetWord: 'warm', lockedPositions: [] },
    ],
    reactionRules: [rule],
  });

  it('fires the forced change when the trigger edit happens', () => {
    const state = { words: ['hove', 'card'], wildUsed: 0 };
    const res = tryMove(reactive, state, 0, 0, 'l', graph);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.move.reactions).toEqual([{ slot: 1, position: 0, fromLetter: 'c', toLetter: 'w' }]);
      expect(res.nextState.words).toEqual(['love', 'ward']);
    }
  });

  it('rejects a move whose forced reaction would leave a non-word', () => {
    const bad = { ...reactive, reactionRules: [{ ...rule, resultLetter: 'x' }] };
    const state = { words: ['hove', 'card'], wildUsed: 0 };
    expect(tryMove(bad, state, 0, 0, 'l', graph)).toMatchObject({ ok: false, reason: 'reaction-invalid-word' });
  });

  it('treats an already-satisfied rule as a no-op', () => {
    const state = { words: ['hove', 'word'], wildUsed: 0 };
    const res = tryMove(reactive, state, 0, 0, 'l', graph);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.move.reactions).toBeUndefined();
      expect(res.nextState.words[1]).toBe('word');
    }
  });

  it('solves the coupled puzzle in fewer moves than the slots independently', () => {
    // Independently: A needs 3, B needs 4 → 7. The reaction saves one move.
    const r = solve(reactive, graph);
    expect(r).not.toBeNull();
    expect(r!.path.length).toBe(6);
    expect(r!.path.some((m) => (m.reactions?.length ?? 0) > 0)).toBe(true);
    replayIsValid(reactive, r!.path);
  });
});

describe('puzzleValidator', () => {
  it('accepts a good level and records the true optimum', () => {
    const lvl = level({ intendedMoveCount: 3, optimalMoveCount: 0 });
    const v = validateLevel(lvl, graph);
    expect(v.ok).toBe(true);
    expect(v.optimalMoveCount).toBe(3);
    expect(v.issues).toHaveLength(0);
  });

  it('rejects unreachable levels', () => {
    const lvl = level({
      slots: [{ startWord: 'cat', targetWord: 'dog', lockedPositions: [0, 1, 2] }],
      wildcardCount: 0,
    });
    const v = validateLevel(lvl, graph);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === 'unreachable')).toBe(true);
  });

  it('flags unintended shortcuts', () => {
    const lvl = level({ intendedMoveCount: 5 });
    const v = validateLevel(lvl, graph);
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === 'unintended-shortcut')).toBe(true);
  });

  it('marks levels where the wildcard is mandatory', () => {
    const lvl = level({
      slots: [{ startWord: 'cold', targetWord: 'warm', lockedPositions: [0] }],
      wildcardCount: 1,
    });
    const v = validateLevel(lvl, graph);
    expect(v.ok).toBe(true);
    expect(v.wildcardRequired).toBe(true);
    expect(v.optimalWithoutWildcard).toBeNull();
  });

  it('rejects start words outside the dictionary', () => {
    const lvl = level({ slots: [{ startWord: 'zzzz', targetWord: 'warm', lockedPositions: [] }] });
    const v = validateLevel(lvl, graph);
    expect(v.issues.some((i) => i.code === 'start-not-in-dictionary')).toBe(true);
  });
});

describe('scoreSystem', () => {
  it('rates stars against optimal', () => {
    expect(starsFor(3, 3)).toBe(3);
    expect(starsFor(5, 3)).toBe(2);
    expect(starsFor(6, 3)).toBe(1);
  });
});
