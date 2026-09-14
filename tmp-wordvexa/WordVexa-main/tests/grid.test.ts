import { describe, expect, it } from 'vitest';
import {
  GRID_SOLVED,
  GRID_TARGETS,
  areAdjacent,
  completedRows,
  gridDistance,
  gridIsSolved,
  gridNextSwap,
  gridRowWords,
  shuffledGrid,
  solvedLines,
} from '../src/engine/gridLevel';

const swapCells = (grid: string, a: number, b: number) =>
  grid.split('').map((c, i) => (i === a ? grid[b] : i === b ? grid[a] : c)).join('');

describe('grid3 level', () => {
  it('solved grid has distance 0 and matching rows', () => {
    expect(gridDistance(GRID_SOLVED)).toBe(0);
    expect(gridIsSolved(GRID_SOLVED)).toBe(true);
    expect(gridRowWords(GRID_SOLVED)).toEqual(GRID_TARGETS);
    expect(completedRows(GRID_SOLVED)).toEqual([true, true, true]);
  });

  it('one swap from solved has distance 1 and hint finds it', () => {
    const oneSwap = GRID_SOLVED.split('');
    [oneSwap[0], oneSwap[1]] = [oneSwap[1], oneSwap[0]]; // swap cells 0,1
    const grid = oneSwap.join('');
    expect(gridDistance(grid)).toBe(1);
    const next = gridNextSwap(grid);
    expect(next).not.toBeNull();
    expect([next![0], next![1]].sort()).toEqual([0, 1]);
  });

  it('accepts a full vertical match as solved, but not partial lines', () => {
    // Transpose the solved grid: rows become the targets' letters read down columns.
    const transposed = Array.from({ length: 9 }, (_, i) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      return GRID_SOLVED[c * 3 + r];
    }).join('');
    expect(gridIsSolved(transposed)).toBe(true);
    expect(gridIsSolved(GRID_SOLVED)).toBe(true);
    // columns with only one word placed are not a finish
    const partial = GRID_SOLVED.split('');
    [partial[0], partial[3]] = [partial[3], partial[0]];
    expect(gridIsSolved(partial.join(''))).toBe(false);
    expect(solvedLines(transposed).some((l) => l >= 3)).toBe(true);
    expect(solvedLines(GRID_SOLVED)).toEqual([0, 1, 2]);
  });

  it('following hints always reaches solved in exactly the par distance', () => {
    const grid = shuffledGrid('w1-l1');
    const par = gridDistance(grid);
    expect(par).toBeGreaterThanOrEqual(5);
    expect(par).toBeLessThanOrEqual(11);
    let cur = grid;
    let steps = 0;
    while (!gridIsSolved(cur) && steps < 64) {
      const next = gridNextSwap(cur);
      expect(next).not.toBeNull();
      cur = swapCells(cur, next![0], next![1]);
      steps++;
    }
    expect(gridIsSolved(cur)).toBe(true);
    expect(steps).toBe(par);
  });

  it('scramble is deterministic and never solved', () => {
    expect(shuffledGrid('w1-l1')).toBe(shuffledGrid('w1-l1'));
    expect(shuffledGrid('w1-l1')).not.toBe(GRID_SOLVED);
    expect(shuffledGrid('w1-l1').split('').sort().join('')).toBe(GRID_SOLVED.split('').sort().join(''));
  });

  it('adjacency only accepts orthogonal neighbours', () => {
    expect(areAdjacent(0, 1)).toBe(true);
    expect(areAdjacent(1, 0)).toBe(true);
    expect(areAdjacent(0, 3)).toBe(true);
    expect(areAdjacent(0, 4)).toBe(false);
    expect(areAdjacent(0, 2)).toBe(false);
    expect(areAdjacent(0, 8)).toBe(false);
  });
});
