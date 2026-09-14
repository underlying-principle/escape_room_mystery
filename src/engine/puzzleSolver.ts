/**
 * Puzzle solver: BFS over the level's *actual* constrained state space.
 *
 * A state is one word per slot plus the number of wildcards consumed. Moves
 * are generated from the word graph's adjacency lists and validated through
 * tryMove, so locks, the wildcard budget and scripted reaction rules are all
 * enforced exactly as they are in gameplay — the solver never searches the
 * unconstrained general graph.
 *
 * Because BFS explores in layers, the first goal state reached is guaranteed
 * to be an optimal (shortest) solution.
 */
import type { GameState, LevelData, PlayerMove } from './types';
import { diffPosition } from './wordGraph';
import { isGoal, tryMove } from './transformEngine';

export interface SolveResult {
  path: PlayerMove[];
  statesExplored: number;
  /** True if the state cap was hit before the goal was found or space exhausted. */
  truncated: boolean;
}

function stateKey(state: GameState): string {
  return state.words.join('|') + '#' + state.wildUsed;
}

const initialState = (level: LevelData): GameState => ({
  words: level.slots.map((s) => s.startWord),
  wildUsed: 0,
});

export function solve(
  level: LevelData,
  graph: { has(w: string): boolean; neighbors(w: string): string[] },
  from?: GameState,
  maxStates = 2_000_000
): SolveResult | null {
  const start = from ?? initialState(level);
  if (isGoal(level, start)) return { path: [], statesExplored: 0, truncated: false };

  const key0 = stateKey(start);
  type Parent = { key: string; move: PlayerMove };
  const parents = new Map<string, Parent | null>();
  parents.set(key0, null);

  let frontier: GameState[] = [start];
  let explored = 0;

  while (frontier.length > 0) {
    const next: GameState[] = [];
    for (const state of frontier) {
      explored++;
      if (explored > maxStates) {
        return { path: [], statesExplored: explored, truncated: true };
      }
      const key = stateKey(state);
      for (let slot = 0; slot < level.slots.length; slot++) {
        const word = state.words[slot];
        for (const nb of graph.neighbors(word)) {
          const pos = diffPosition(word, nb);
          if (pos < 0) continue;
          const res = tryMove(level, state, slot, pos, nb[pos], graph);
          if (!res.ok) continue;
          const nk = stateKey(res.nextState);
          if (parents.has(nk)) continue;
          parents.set(nk, { key, move: res.move });
          if (isGoal(level, res.nextState)) {
            const path: PlayerMove[] = [];
            let k: string = nk;
            while (k !== key0) {
              const p = parents.get(k)!;
              path.unshift(p.move);
              k = p.key;
            }
            return { path, statesExplored: explored, truncated: false };
          }
          next.push(res.nextState);
        }
      }
    }
    frontier = next;
  }
  return null;
}
