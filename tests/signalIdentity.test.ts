/**
 * BLOCKER suite: tile identity must never mutate. Every gameplay scenario —
 * swaps, drags, undo, restart, rapid input, swaps during animation, save and
 * reload — must preserve each tile object's value exactly.
 */
import { describe, expect, it } from 'vitest';
import {
  applyMoves,
  areAdjacent,
  createBoard,
  hashSeed,
  isSolved,
  mulberry32,
  restoreBoard,
  scrambleFromSolved,
  solveBFS,
  swapCells,
  type SignalLevelDef,
} from '../src/engine/signalEngine';

const def: SignalLevelDef = {
  id: 'S01',
  chapter: 1,
  index: 1,
  name: 'The Signal',
  subtitle: 'test',
  size: 3,
  solvedValues: [...'catdogs un'.replace(' ', '')],
  lockedCells: [],
  wildcardCells: [],
  targets: [
    { kind: 'line', orientation: 'row', index: 0, values: [...'cat'] },
    { kind: 'line', orientation: 'row', index: 1, values: [...'dog'] },
    { kind: 'line', orientation: 'row', index: 2, values: [...'sun'] },
  ],
  maxMoves: 12,
  parMoves: 8,
  timeLimitMs: 90_000,
  starMoves: { three: 8, two: 11 },
  difficulty: 'very easy',
  background: 'signal-01',
};

/** Snapshot of tile identities/values, used to assert nothing mutated. */
function tileSnapshot(state: ReturnType<typeof createBoard>) {
  return Object.fromEntries(
    Object.entries(state.tiles).map(([id, t]) => [id, { value: t.value, locked: t.locked, wildcard: t.wildcard }]),
  );
}

describe('tile identity (blocker rules)', () => {
  it('tiles carry immutable values independent of cell index', () => {
    const s = createBoard(def);
    const snap = tileSnapshot(s);
    const s2 = swapCells(s, 0, 1);
    // same tile objects, same values — only cells changed
    expect(tileSnapshot(s2)).toEqual(snap);
    expect(s2.cells[0]).toBe(s.cells[1]);
    expect(s2.cells[1]).toBe(s.cells[0]);
  });

  it('swap then drag back restores the exact board and identities', () => {
    const s = createBoard(def);
    const snap = tileSnapshot(s);
    const forward = swapCells(s, 1, 2);
    const back = swapCells(forward, 1, 2);
    expect(back.cells).toEqual(s.cells);
    expect(tileSnapshot(back)).toEqual(snap);
  });

  it('undo replays inverse moves without value mutation', () => {
    const rng = mulberry32(hashSeed('undo-test'));
    const { state, path } = scrambleFromSolved(def, 8, rng);
    const snap = tileSnapshot(state);
    // undo = apply inverse swaps in reverse order
    let cur = state;
    for (let i = path.length - 1; i >= 0; i--) {
      cur = swapCells(cur, path[i].a, path[i].b);
    }
    expect(tileSnapshot(cur)).toEqual(snap);
    expect(isSolved(cur, def)).toBe(true);
  });

  it('rapid repeated swaps never corrupt values', () => {
    const rng = mulberry32(hashSeed('rapid-test'));
    let s = createBoard(def);
    const snap = tileSnapshot(s);
    const moves = Array.from({ length: 200 }, () => {
      const a = Math.floor(rng() * 9);
      const b = (a + 1) % 9 === a ? a : Math.floor(rng() * 9);
      return areAdjacent(3, a, b) ? { a, b } : { a: 0, b: 1 };
    });
    s = applyMoves(s, moves);
    expect(tileSnapshot(s)).toEqual(snap);
    // board is still a valid permutation of the same tile ids
    expect([...s.cells].sort()).toEqual(Object.keys(s.tiles).sort());
  });

  it('interleaved swaps (input during animation) never mutate values', () => {
    // Simulates: swap → swap → swap fired back-to-back with no render between.
    // The composed permutation is applied exactly once; values never change.
    const s = createBoard(def);
    const snap = tileSnapshot(s);
    const s2 = swapCells(s, 0, 1);
    const s3 = swapCells(s2, 3, 4);
    const s4 = swapCells(s3, 1, 0); // player undoes the first swap mid-flight
    expect(tileSnapshot(s4)).toEqual(snap);
    expect(s4.cells).toEqual(applyMoves(s, [{ a: 3, b: 4 }]).cells);
  });

  it('save during movement and reload restore exact tile values', () => {
    const rng = mulberry32(hashSeed('save-test'));
    const { state } = scrambleFromSolved(def, 7, rng);
    const serialized = [...state.cells]; // saveService stores cells only
    const reloaded = restoreBoard(def, serialized);
    expect(reloaded.cells).toEqual(state.cells);
    // Tile values are reconstructed from the level definition, and each tile
    // keeps a stable value keyed by its id — never from board index.
    for (const id of Object.keys(state.tiles)) {
      expect(reloaded.tiles[id].value).toBe(state.tiles[id].value);
    }
  });

  it('solver never needs to mutate values and finds a legal solution', () => {
    const rng = mulberry32(hashSeed('solver-test'));
    const { state } = scrambleFromSolved(def, 8, rng);
    const snap = tileSnapshot(state);
    const path = solveBFS(state, def);
    expect(path).not.toBeNull();
    const solvedState = applyMoves(state, path!);
    expect(isSolved(solvedState, def)).toBe(true);
    expect(tileSnapshot(applyMoves(state, path!))).toEqual(snap);
  });
});
