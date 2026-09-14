/**
 * Level 1 "grid3" mode: a 3x3 tile puzzle. Nine letter tiles sit in a grid;
 * the three target words (3 letters each) must end up as the three rows,
 * reading left to right. The player swaps orthogonally adjacent tiles.
 *
 * Optimal play is computed with a bidirectional BFS over the swap space
 * (adjacent transpositions generate every permutation of the nine tiles, so
 * the search always finds the true minimum swap count). Typical queries touch
 * a few thousand states and run in about a millisecond, which keeps par and
 * solver-derived hints instant — same principle as the ladder puzzleSolver.
 */

export const GRID_SIZE = 3;
export const GRID_TARGETS = ['cat', 'dog', 'sun'];
export const GRID_SOLVED = GRID_TARGETS.join('');
export const GRID_LEVEL_ID = 'w1-l1';

const SEED = 0x516a1c;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orthogonally adjacent cell pairs in a 3x3 grid (12 swap edges). */
export function gridSwapEdges(): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const i = r * GRID_SIZE + c;
      if (c < GRID_SIZE - 1) edges.push([i, i + 1]);
      if (r < GRID_SIZE - 1) edges.push([i, i + GRID_SIZE]);
    }
  }
  return edges;
}

const EDGES = gridSwapEdges();

export function areAdjacent(a: number, b: number): boolean {
  return EDGES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Neighbour cell in a direction, or null when the move would leave the grid. */
export function gridNeighbor(cell: number, dir: 'up' | 'down' | 'left' | 'right'): number | null {
  const r = Math.floor(cell / GRID_SIZE);
  const c = cell % GRID_SIZE;
  const nr = r + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
  const nc = c + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
  if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return null;
  return nr * GRID_SIZE + nc;
}

export function swapped(grid: string, a: number, b: number): string {
  const chars = grid.split('');
  const tmp = chars[a];
  chars[a] = chars[b];
  chars[b] = tmp;
  return chars.join('');
}

// ---- bidirectional BFS over permutations ----
// All nine letters are distinct, so a grid string is a permutation of tile ids.
const CHAR_ID: Record<string, number> = {};
GRID_SOLVED.split('').forEach((ch, i) => {
  CHAR_ID[ch] = i;
});

// A state packs into a single int: sum(tileId * 9^cell). 9^9 < 2^31.
const POW9 = [1, 9, 81, 729, 6561, 59049, 531441, 4782969, 43046721];
function permKey(perm: number[]): number {
  let key = 0;
  for (let i = 0; i < 9; i++) key += perm[i] * POW9[i];
  return key;
}

interface SearchNode {
  perm: number[];
  /** Move that produced this node from its side's root: [cellA, cellB]. */
  move: [number, number];
  parent: number;
}

/**
 * Exact minimum swap sequence from `from` to `to`. Swaps are symmetric, so
 * both search sides share the same move semantics.
 */
export function solveGridPath(from: string, to: string = GRID_SOLVED): Array<[number, number]> | null {
  const startPerm = from.split('').map((c) => CHAR_ID[c]);
  const goalPerm = to.split('').map((c) => CHAR_ID[c]);
  if (from === to) return [];

  const seenA = new Map<number, SearchNode>();
  const seenB = new Map<number, SearchNode>();
  const startKey = permKey(startPerm);
  const goalKey = permKey(goalPerm);
  seenA.set(startKey, { perm: startPerm, move: [-1, -1], parent: -1 });
  seenB.set(goalKey, { perm: goalPerm, move: [-1, -1], parent: -1 });
  let frontierA: SearchNode[] = [seenA.get(startKey)!];
  let frontierB: SearchNode[] = [seenB.get(goalKey)!];

  const expand = (
    frontier: SearchNode[],
    seen: Map<number, SearchNode>,
    other: Map<number, SearchNode>,
  ): { meetKey: number } | null => {
    const next: SearchNode[] = [];
    for (const node of frontier) {
      for (const [a, b] of EDGES) {
        const perm = node.perm.slice();
        const tmp = perm[a];
        perm[a] = perm[b];
        perm[b] = tmp;
        const key = permKey(perm);
        if (seen.has(key)) continue;
        const child: SearchNode = { perm, move: [a, b], parent: permKey(node.perm) };
        seen.set(key, child);
        if (other.has(key)) return { meetKey: key };
        next.push(child);
      }
    }
    frontier.length = 0;
    frontier.push(...next);
    return null;
  };

  while (frontierA.length > 0 && frontierB.length > 0) {
    // Expand the smaller frontier first.
    const expandA = frontierA.length <= frontierB.length;
    const meet = expandA
      ? expand(frontierA, seenA, seenB)
      : expand(frontierB, seenB, seenA);
    if (meet) {
      // Reconstruct: start → meet from side A, meet → goal by reversing B's edges.
      const pathA: Array<[number, number]> = [];
      let k = meet.meetKey;
      while (k !== startKey) {
        const node = seenA.get(k)!;
        pathA.unshift(node.move);
        k = node.parent;
      }
      const pathB: Array<[number, number]> = [];
      k = meet.meetKey;
      while (k !== goalKey) {
        const node = seenB.get(k)!;
        pathB.push(node.move);
        k = node.parent;
      }
      pathB.reverse();
      return [...pathA, ...pathB];
    }
  }
  return null;
}

/** Exact optimal number of adjacent swaps to solve the given grid. */
export function gridDistance(grid: string): number {
  return solveGridPath(grid)?.length ?? Number.POSITIVE_INFINITY;
}

export function isGridSolved(grid: string): boolean {
  return gridIsSolved(grid);
}

/**
 * The cube is solved when every target word lines up — as the three ROWS
 * (left to right) or as the three COLUMNS (top to bottom). A horizontal match
 * is the canonical arrangement the solver aims for; a vertical match is an
 * equally valid finish.
 */
export function gridIsSolved(grid: string): boolean {
  const rows = gridRowWords(grid);
  if (GRID_TARGETS.every((t, i) => rows[i] === t)) return true;
  for (let c = 0; c < GRID_SIZE; c++) {
    let col = '';
    for (let r = 0; r < GRID_SIZE; r++) col += grid[r * GRID_SIZE + c];
    if (col !== GRID_TARGETS[c]) return false;
  }
  return true;
}

/** Which full lines read a target word: rows 0-2, columns 3-5. */
export function solvedLines(grid: string): number[] {
  const lines: number[] = [];
  const rows = gridRowWords(grid);
  GRID_TARGETS.forEach((t, i) => {
    if (rows[i] === t) lines.push(i);
  });
  for (let c = 0; c < GRID_SIZE; c++) {
    let col = '';
    for (let r = 0; r < GRID_SIZE; r++) col += grid[r * GRID_SIZE + c];
    if (col === GRID_TARGETS[c]) lines.push(3 + c);
  }
  return lines;
}

export function gridRowWords(grid: string): string[] {
  return [0, 1, 2].map((r) => grid.slice(r * 3, r * 3 + 3));
}

/** Rows currently reading a target word, in target order. */
export function completedRows(grid: string): boolean[] {
  const rows = gridRowWords(grid);
  return GRID_TARGETS.map((t, i) => rows[i] === t);
}

/**
 * Deterministic scramble for the level: shuffled until it is neither solved
 * nor trivial, with a stable optimal par. Same seed → same puzzle for everyone.
 */
export function shuffledGrid(levelId: string): string {
  let seed = SEED;
  for (let i = 0; i < levelId.length; i++) seed = Math.imul(seed ^ levelId.charCodeAt(i), 16777619) >>> 0;
  const rng = mulberry32(seed);
  const letters = GRID_SOLVED.split('');
  let fallback = '';
  for (let attempt = 0; attempt < 64; attempt++) {
    const pool = letters.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const candidate = pool.join('');
    if (attempt === 0) fallback = candidate;
    if (candidate === GRID_SOLVED) continue;
    const d = gridDistance(candidate);
    if (d >= 5 && d <= 11) return candidate;
  }
  return fallback;
}

/**
 * One optimal next swap from the current grid (the first move of an optimal
 * continuation — following hints always solves in exactly
 * `gridDistance(grid)` more moves).
 */
export function gridNextSwap(grid: string): [number, number] | null {
  const path = solveGridPath(grid);
  return path && path.length > 0 ? path[0] : null;
}
