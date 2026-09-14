/**
 * Hint system: every hint is derived from the solver's actual optimal
 * continuation from the player's *current* state — never hand-written, so
 * hints can't fall out of sync with a level (even after the player wanders
 * off the optimal path).
 *
 * Escalation:
 *   stage 0 — highlight which tile to change (position only)
 *   stage 1 — also reveal the exact letter to change it to
 *   stage 2 — auto-apply the next move
 */
import type { GameState, LevelData, PlayerMove } from './types';
import { solve } from './puzzleSolver';

/**
 * Next `count` moves along an optimal continuation, or null if no continuation
 * exists (player is in a dead end) or the search hit its cap.
 */
export function optimalContinuation(
  level: LevelData,
  state: GameState,
  graph: { has(w: string): boolean; neighbors(w: string): string[] },
  count = 3,
  maxStates = 400_000
): PlayerMove[] | null {
  const r = solve(level, graph, state, maxStates);
  if (!r || r.truncated) return null;
  return r.path.slice(0, count);
}

export function slotLabel(level: LevelData, slot: number): string {
  return level.slots.length > 1 ? (slot === 0 ? 'TOP' : 'BOTTOM') : 'WORD';
}

export function describeMove(level: LevelData, move: PlayerMove): string {
  const ord = move.position + 1;
  let text = `${slotLabel(level, move.slot)} · letter ${ord}: ${move.fromLetter.toUpperCase()} → ${move.toLetter.toUpperCase()}`;
  if (move.usedWildcard) text += ' (wildcard)';
  for (const r of move.reactions ?? []) {
    text += ` — then ${slotLabel(level, r.slot)} letter ${r.position + 1} flips to ${r.toLetter.toUpperCase()}`;
  }
  return text;
}
