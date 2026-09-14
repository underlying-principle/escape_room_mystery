/**
 * Scoring: ★ Complete / ★★ Efficient / ★★★ Perfect, measured against the
 * solver's optimal move count (which the validator baked into the level data).
 * Time is tracked and displayed but does not gate stars.
 */
export function starsFor(moves: number, optimalMoveCount: number): 1 | 2 | 3 {
  if (moves <= optimalMoveCount) return 3;
  if (moves <= optimalMoveCount + 2) return 2;
  return 1;
}
