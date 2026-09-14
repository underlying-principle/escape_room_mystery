/**
 * Level graph extraction: the visible "constellation" behind the board.
 *
 * Vertices are full puzzle states (one word per slot + wildcard budget used),
 * edges are legal moves under the level's real constraints. The runtime BFS
 * from the start state mirrors puzzleSolver's move generation so what the
 * player sees is exactly the playable space, not a hand-drawn decoration.
 */
import type { GameState, LevelData, PlayerMove } from './types';
import { diffPosition } from './wordGraph';
import { tryMove } from './transformEngine';

export interface GraphNode {
  key: string;
  words: string[];
  depth: number;
  isStart: boolean;
  isTarget: boolean;
}

export interface LevelGraph {
  nodes: GraphNode[];
  edges: Array<{ a: string; b: string }>;
  index: Map<string, number>;
  maxDepth: number;
}

export function stateKeyOf(words: string[], wildUsed: number): string {
  return words.join('|') + '#' + wildUsed;
}

function neighborStates(
  level: LevelData,
  state: GameState,
  graph: { has(w: string): boolean; neighbors(w: string): string[] },
): GameState[] {
  const out: GameState[] = [];
  for (let slot = 0; slot < level.slots.length; slot++) {
    const word = state.words[slot];
    for (const nb of graph.neighbors(word)) {
      const pos = diffPosition(word, nb);
      if (pos < 0) continue;
      const res = tryMove(level, state, slot, pos, nb[pos], graph);
      if (res.ok) out.push(res.nextState);
    }
  }
  return out;
}

/**
 * BFS neighborhood around the start state, capped for stable rendering.
 * Deterministic: same level + dictionary always yields the same graph.
 */
export function buildLevelGraph(
  level: LevelData,
  graph: { has(w: string): boolean; neighbors(w: string): string[] },
  maxNodes = 110,
): LevelGraph {
  const start: GameState = { words: level.slots.map((s) => s.startWord), wildUsed: 0 };
  const target: GameState = { words: level.slots.map((s) => s.targetWord), wildUsed: 0 };
  const startKey = stateKeyOf(start.words, 0);
  const targetKey = stateKeyOf(target.words, target.wildUsed);

  const nodes: GraphNode[] = [];
  const index = new Map<string, number>();
  const edges: Array<{ a: string; b: string }> = [];
  const edgeSeen = new Set<string>();
  let frontier: GameState[] = [start];
  let depth = 0;
  let maxDepth = 0;

  const pushNode = (state: GameState, d: number): GraphNode => {
    const key = stateKeyOf(state.words, state.wildUsed);
    const existing = index.get(key);
    if (existing !== undefined) return nodes[existing];
    const node: GraphNode = {
      key,
      words: state.words.slice(),
      depth: d,
      isStart: key === startKey,
      isTarget: key === targetKey,
    };
    index.set(key, nodes.length);
    nodes.push(node);
    return node;
  };

  pushNode(start, 0);

  const targetInSet = index.has(targetKey);
  while (frontier.length > 0 && nodes.length < maxNodes) {
    const next: GameState[] = [];
    for (const state of frontier) {
      if (nodes.length >= maxNodes && !targetInSet) break;
      const aKey = stateKeyOf(state.words, state.wildUsed);
      for (const nb of neighborStates(level, state, graph)) {
        const bKey = stateKeyOf(nb.words, nb.wildUsed);
        const edgeId = aKey < bKey ? `${aKey}>${bKey}` : `${bKey}>${aKey}`;
        const bNode = index.get(bKey);
        if (bNode === undefined) {
          if (nodes.length < maxNodes) {
            pushNode(nb, depth + 1);
            maxDepth = Math.max(maxDepth, depth + 1);
            edges.push({ a: aKey, b: bKey });
            edgeSeen.add(edgeId);
            next.push(nb);
          }
        } else if (!edgeSeen.has(edgeId)) {
          edges.push({ a: aKey, b: bKey });
          edgeSeen.add(edgeId);
        }
      }
    }
    frontier = next;
    depth++;
  }

  // Even if the cap cut the BFS short, always show the goal state so the
  // constellation has a visible destination.
  if (!index.has(targetKey)) {
    const node: GraphNode = {
      key: targetKey,
      words: target.words.slice(),
      depth: maxDepth + 1,
      isStart: false,
      isTarget: true,
    };
    index.set(targetKey, nodes.length);
    nodes.push(node);
    maxDepth += 1;
  }

  return { nodes, edges, index, maxDepth };
}

/** State-key sequence along the validator-baked optimal path (for the win reveal). */
export function optimalPathKeys(level: LevelData): string[] {
  const words = level.slots.map((s) => s.startWord);
  let wildUsed = 0;
  const keys = [stateKeyOf(words, wildUsed)];
  for (const move of level.optimalPath ?? []) {
    words[move.slot] =
      words[move.slot].slice(0, move.position) + move.toLetter + words[move.slot].slice(move.position + 1);
    for (const r of move.reactions ?? []) {
      words[r.slot] = words[r.slot].slice(0, r.position) + r.toLetter + words[r.slot].slice(r.position + 1);
    }
    wildUsed += move.usedWildcard ? 1 : 0;
    keys.push(stateKeyOf(words, wildUsed));
  }
  return keys;
}

/** Which graph edge a player move just traversed (for the pulse animation). */
export function moveEdge(level: LevelData, move: PlayerMove, from: GameState, to: GameState): { a: string; b: string } {
  return { a: stateKeyOf(from.words, from.wildUsed), b: stateKeyOf(to.words, to.wildUsed) };
}
