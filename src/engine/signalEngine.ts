/**
 * THE SIGNAL — generalized grid-puzzle engine (3×3 … 10×10).
 *
 * TILE IDENTITY (the blocker rule):
 * A tile is an immutable object { id, value, locked, wildcard }. Its value is
 * assigned once at board creation and is NEVER derived from an index, position,
 * animation or render state. The board is a permutation of tile IDs; swaps
 * move IDs between cells; values never change. Undo/restart/rapid swaps all
 * operate by replacing the cells array — tile objects are never mutated.
 */

export interface SignalTile {
  readonly id: string;
  readonly value: string; // letter, digit, symbol, glyph id, or '?' wildcard
  readonly locked: boolean;
  readonly wildcard: boolean;
}

export interface SignalBoardState {
  readonly size: number;
  /** cells[cellIndex] = tileId */
  readonly cells: readonly string[];
  readonly tiles: Readonly<Record<string, SignalTile>>;
}

export interface TargetLine {
  kind: 'line';
  orientation: 'row' | 'col';
  index: number;
  values: string[];
}

/** Values must read in order along the given cell path. */
export interface TargetSequence {
  kind: 'sequence';
  cells: number[];
  values: string[];
}

/** The given cells must hold the given values in any order. */
export interface TargetPattern {
  kind: 'pattern';
  cells: number[];
  values: string[];
}

export type SignalTarget = TargetLine | TargetSequence | TargetPattern;

/**
 * WANDER LETTERS — a level may declare letters that refuse to sit still.
 * Each wanderer's tile automatically swaps to another unlocked tile every
 * `intervalMs`, so the player has to chase it — but a wanderer settles
 * (stops hopping) while every target that requires its letter is satisfied,
 * and resumes the moment its word breaks again. Each letter must occur
 * exactly once in solvedValues (validated at generation time).
 */
export interface WanderSpec {
  letter: string;
  intervalMs: number;
}

export interface SignalLevelDef {
  id: string; // "S01"
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  index: number; // 1..60
  name: string;
  subtitle: string;
  size: number;
  /** The SOLVED arrangement of values (length size*size). */
  solvedValues: string[];
  /** The shipped scrambled start: cells[i] = tileId (validated pre-ship). */
  startCells?: string[];
  lockedCells: number[];
  wildcardCells: number[];
  targets: SignalTarget[];
  wanderers?: WanderSpec[];
  maxMoves: number;
  parMoves: number;
  timeLimitMs: number;
  starMoves: { three: number; two: number };
  difficulty: 'very easy' | 'easy' | 'medium' | 'hard' | 'expert' | 'master';
  background: string;
  storyBeat?: string;
}

export interface MoveRecord {
  a: number;
  b: number;
}

// ---------------------------------------------------------------------------
// Board construction & moves
// ---------------------------------------------------------------------------

export function createBoard(def: SignalLevelDef): SignalBoardState {
  const tiles: Record<string, SignalTile> = {};
  const cells: string[] = [];
  for (let i = 0; i < def.size * def.size; i++) {
    const id = `t${String(i).padStart(2, '0')}`;
    const wildcard = def.wildcardCells.includes(i);
    tiles[id] = {
      id,
      value: wildcard ? '?' : def.solvedValues[i],
      locked: def.lockedCells.includes(i),
      wildcard,
    };
    cells.push(id);
  }
  return { size: def.size, cells: def.startCells ? [...def.startCells] : cells, tiles };
}

export function restoreBoard(def: SignalLevelDef, cells: readonly string[]): SignalBoardState {
  const tiles: Record<string, SignalTile> = {};
  const seen = new Set<string>();
  for (const id of cells) {
    if (seen.has(id)) throw new Error(`duplicate tile id in saved board: ${id}`);
    seen.add(id);
  }
  for (let i = 0; i < def.size * def.size; i++) {
    const id = `t${String(i).padStart(2, '0')}`;
    const wildcard = def.wildcardCells.includes(i);
    tiles[id] = {
      id,
      value: wildcard ? '?' : def.solvedValues[i],
      locked: def.lockedCells.includes(i),
      wildcard,
    };
  }
  if (cells.length !== def.size * def.size) throw new Error('saved board has wrong cell count');
  return { size: def.size, cells: [...cells], tiles };
}

export function areAdjacent(size: number, a: number, b: number): boolean {
  const ra = Math.floor(a / size);
  const ca = a % size;
  const rb = Math.floor(b / size);
  const cb = b % size;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

export function isSwapLegal(state: SignalBoardState, a: number, b: number): boolean {
  if (a === b || a < 0 || b < 0 || a >= state.cells.length || b >= state.cells.length) return false;
  if (!areAdjacent(state.size, a, b)) return false;
  const tileA = state.tiles[state.cells[a]];
  const tileB = state.tiles[state.cells[b]];
  return !tileA.locked && !tileB.locked;
}

/** Immutable swap: tiles keep their identity; only the cells array changes. */
export function swapCells(state: SignalBoardState, a: number, b: number): SignalBoardState {
  const cells = state.cells.slice();
  const tmp = cells[a];
  cells[a] = cells[b];
  cells[b] = tmp;
  return { ...state, cells };
}

export function applyMoves(state: SignalBoardState, moves: MoveRecord[]): SignalBoardState {
  let s = state;
  for (const m of moves) s = swapCells(s, m.a, m.b);
  return s;
}

// ---------------------------------------------------------------------------
// Targets & win condition
// ---------------------------------------------------------------------------

function lineCells(size: number, orientation: 'row' | 'col', index: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) out.push(orientation === 'row' ? index * size + i : i * size + index);
  return out;
}

function valueAt(state: SignalBoardState, cell: number): string {
  return state.tiles[state.cells[cell]].value;
}

function matches(actual: string, expected: string): boolean {
  return actual === '?' || actual === expected;
}

export function isTargetSatisfied(state: SignalBoardState, target: SignalTarget): boolean {
  if (target.kind === 'line') {
    const cells = lineCells(state.size, target.orientation, target.index);
    return target.values.every((v, i) => matches(valueAt(state, cells[i]), v));
  }
  if (target.kind === 'sequence') {
    return target.values.every((v, i) => matches(valueAt(state, target.cells[i]), v));
  }
  // pattern: multiset equality with wildcards filling gaps
  const remaining = [...target.values];
  for (const cell of target.cells) {
    const v = valueAt(state, cell);
    const idx = v === '?' ? (remaining.length > 0 ? 0 : -1) : remaining.indexOf(v);
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return remaining.length === 0;
}

export function isSolved(state: SignalBoardState, def: SignalLevelDef): boolean {
  return def.targets.every((t) => isTargetSatisfied(state, t));
}

/** How many target-required cells hold a correct/wildcard value (progress metric). */
export function placedCount(state: SignalBoardState, def: SignalLevelDef): number {
  let total = 0;
  let good = 0;
  for (const target of def.targets) {
    const cells = target.kind === 'line' ? lineCells(state.size, target.orientation, target.index) : target.cells;
    target.values.forEach((v, i) => {
      total++;
      if (matches(valueAt(state, cells[i]), v)) good++;
    });
  }
  return good / Math.max(1, total);
}

// ---------------------------------------------------------------------------
// Scramble (always from the solved state — guaranteed solvable)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Scramble by applying `moves` random legal adjacent swaps from the solved
 * board. Locked tiles are never part of a swap. The result is always solvable
 * within `moves` swaps (the inverse of the applied sequence is a solution).
 */
export function scrambleFromSolved(
  def: SignalLevelDef,
  moves: number,
  rng: () => number,
): { state: SignalBoardState; path: MoveRecord[] } {
  // Always scramble from the SOLVED layout, ignoring any shipped startCells.
  let state = createBoard({ ...def, startCells: undefined });
  const path: MoveRecord[] = [];
  let guard = 0;
  while (path.length < moves && guard < moves * 60) {
    guard++;
    const a = Math.floor(rng() * state.cells.length);
    const dirs = [1, -1, state.size, -state.size];
    const dir = dirs[Math.floor(rng() * 4)];
    const b = a + dir;
    if (b < 0 || b >= state.cells.length) continue;
    if (Math.floor(a / state.size) !== Math.floor(b / state.size) && Math.abs(dir) === 1) continue;
    if (!isSwapLegal(state, a, b)) continue;
    const next = swapCells(state, a, b);
    if (isSolved(next, def)) continue; // don't end on a solved-looking state
    state = next;
    path.push({ a, b });
  }
  return { state, path };
}

// ---------------------------------------------------------------------------
// Solver (exact BFS where feasible) + hints
// ---------------------------------------------------------------------------

function stateKey(state: SignalBoardState): string {
  return state.cells.join(',');
}

/**
 * Exact optimal swap sequence. Only tractable for small boards (3×3 with
 * mostly-distinct values); returns null when the state cap is exceeded.
 */
export function solveBFS(
  state: SignalBoardState,
  def: SignalLevelDef,
  maxStates = 450_000,
): MoveRecord[] | null {
  if (isSolved(state, def)) return [];
  const visited = new Set<string>([stateKey(state)]);
  type Node = { state: SignalBoardState; move: MoveRecord | null; parent: Node | null };
  let frontier: Node[] = [{ state, move: null, parent: null }];
  let explored = 0;
  while (frontier.length > 0) {
    const next: Node[] = [];
    for (const node of frontier) {
      explored++;
      if (explored > maxStates) return null;
      for (let a = 0; a < state.cells.length; a++) {
        for (const b of [a + 1, a - 1, a + state.size, a - state.size]) {
          if (b < 0 || b >= state.cells.length) continue;
          if (!isSwapLegal(node.state, a, b)) continue;
          const ns = swapCells(node.state, a, b);
          const key = stateKey(ns);
          if (visited.has(key)) continue;
          visited.add(key);
          const child: Node = { state: ns, move: { a, b }, parent: node };
          if (isSolved(ns, def)) {
            const path: MoveRecord[] = [];
            let cur: Node | null = child;
            while (cur && cur.move) {
              path.unshift(cur.move);
              cur = cur.parent;
            }
            return path;
          }
          next.push(child);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Hint for any board size. Small boards: the exact optimal first swap.
 * Large boards: a legal swap that strictly improves the placed-correct-value
 * ratio (real state information, never fake).
 */
export function hintSwap(state: SignalBoardState, def: SignalLevelDef): MoveRecord | null {
  if (state.size <= 3) {
    const path = solveBFS(state, def, 400_000);
    if (path && path.length > 0) return path[0];
  }
  const current = placedCount(state, def);
  let best: MoveRecord | null = null;
  let bestScore = current;
  for (let a = 0; a < state.cells.length; a++) {
    for (const b of [a + 1, a + state.size]) {
      if (b >= state.cells.length) continue;
      if (!isSwapLegal(state, a, b)) continue;
      const score = placedCount(swapCells(state, a, b), def);
      if (score > bestScore) {
        bestScore = score;
        best = { a, b };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Difficulty / timers / stars
// ---------------------------------------------------------------------------

const BUFFERS: Record<SignalLevelDef['difficulty'], number> = {
  'very easy': 1.8,
  easy: 1.6,
  medium: 1.5,
  hard: 1.4,
  expert: 1.3,
  master: 1.25,
};

/** estimatedOptimalTime × difficultyBuffer, with a sane floor. */
export function estimateTimeLimit(def: Omit<SignalLevelDef, 'timeLimitMs'>): number {
  const optimal = def.parMoves * 4_500 + 14_000; // ~4.5s per move + reading window
  // Wandering letters keep moving during the whole solve — chase time needs
  // roughly double the calm estimate.
  const wanderBuffer = def.wanderers?.length ? 2 : 1;
  return Math.max(45_000, Math.round(optimal * BUFFERS[def.difficulty] * wanderBuffer));
}

export function starsForSignal(moves: number, def: SignalLevelDef): 1 | 2 | 3 {
  if (moves <= def.starMoves.three) return 3;
  if (moves <= def.starMoves.two) return 2;
  return 1;
}
