/**
 * Transform engine: applies a player (or solver) move to the puzzle state.
 *
 * A move is legal only if:
 *  - the slot/position are in range and the letter actually changes,
 *  - the position is not locked (or a wildcard is available to break the lock),
 *  - the resulting word is in the curated dictionary,
 *  - every reaction rule triggered by the edit produces a valid dictionary
 *    word too (a triggered rule whose result letter is already in place is a
 *    satisfied no-op).
 */
import type {
  GameState,
  LevelData,
  MoveResult,
  ReactionEffect,
} from './types';

export function isLocked(level: LevelData, slot: number, position: number): boolean {
  return level.slots[slot].lockedPositions.includes(position);
}

export function isGoal(level: LevelData, state: GameState): boolean {
  return level.slots.every((s, i) => state.words[i] === s.targetWord);
}

export function tryMove(
  level: LevelData,
  state: GameState,
  slot: number,
  position: number,
  letter: string,
  graph: { has(word: string): boolean }
): MoveResult {
  if (slot < 0 || slot >= level.slots.length) return { ok: false, reason: 'out-of-range' };
  const word = state.words[slot];
  if (!word || position < 0 || position >= word.length) {
    return { ok: false, reason: 'out-of-range' };
  }
  const cur = word[position];
  if (letter === cur) return { ok: false, reason: 'not-a-change' };

  let usedWildcard = false;
  if (isLocked(level, slot, position)) {
    if (state.wildUsed >= level.wildcardCount) {
      return {
        ok: false,
        reason: level.wildcardCount > 0 ? 'no-wildcard-left' : 'locked-position',
      };
    }
    usedWildcard = true;
  }

  const newWord = word.slice(0, position) + letter + word.slice(position + 1);
  if (!graph.has(newWord)) return { ok: false, reason: 'invalid-word' };

  const words = state.words.slice();
  words[slot] = newWord;

  const reactions: ReactionEffect[] = [];
  for (const rule of level.reactionRules ?? []) {
    if (
      rule.triggerSlot !== slot ||
      rule.triggerPosition !== position ||
      rule.triggerLetter !== letter
    ) {
      continue;
    }
    const target = words[rule.resultSlot];
    if (target === undefined || rule.resultPosition >= target.length) {
      return { ok: false, reason: 'out-of-range' };
    }
    if (target[rule.resultPosition] === rule.resultLetter) continue; // already satisfied
    const after =
      target.slice(0, rule.resultPosition) +
      rule.resultLetter +
      target.slice(rule.resultPosition + 1);
    if (!graph.has(after)) return { ok: false, reason: 'reaction-invalid-word' };
    reactions.push({
      slot: rule.resultSlot,
      position: rule.resultPosition,
      fromLetter: target[rule.resultPosition],
      toLetter: rule.resultLetter,
    });
    words[rule.resultSlot] = after;
  }

  const move = {
    slot,
    position,
    fromLetter: cur,
    toLetter: letter,
    usedWildcard,
    ...(reactions.length > 0 ? { reactions } : {}),
  };
  return {
    ok: true,
    nextState: { words, wildUsed: state.wildUsed + (usedWildcard ? 1 : 0) },
    move,
  };
}
